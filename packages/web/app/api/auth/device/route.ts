import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const DEVICE_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Removed ambiguous letters/numbers (0/O, 1/I/L, etc.)
const USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateUserCode(): string {
	let userCode = "";
	for (let i = 0; i < 8; i++) {
		if (i === 4) userCode += "-";
		userCode += USER_CODE_ALPHABET.charAt(Math.floor(Math.random() * USER_CODE_ALPHABET.length));
	}
	return userCode;
}

/** Normalized form stored in the DB; lookups are exact matches on the unique index. */
function normalizeUserCode(code: string): string {
	return code.replace(/-/g, "").toUpperCase();
}

export async function POST(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const action = searchParams.get("action");

		if (action === "initiate") {
			const id = crypto.randomUUID();
			let displayCode = generateUserCode();

			// The user code is unique-indexed, so a (vanishingly rare) collision is
			// retried with a fresh code instead of surfacing as a 500.
			for (let attempt = 0; ; attempt++) {
				try {
					await prisma.deviceCode.create({
						data: {
							id,
							userCode: normalizeUserCode(displayCode),
							expiresAt: new Date(Date.now() + DEVICE_CODE_TTL_MS),
						},
					});
					break;
				} catch (error) {
					const isUniqueViolation =
						typeof error === "object" &&
						error !== null &&
						"code" in error &&
						(error as { code?: string }).code === "P2002";
					if (!isUniqueViolation || attempt >= 2) throw error;
					displayCode = generateUserCode();
				}
			}

			const baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";

			return NextResponse.json({
				device_code: id,
				user_code: displayCode,
				verification_uri: `${baseUrl}/device`,
			});
		}

		if (action === "poll") {
			const body = await request.json();
			const { device_code } = body;

			if (typeof device_code !== "string" || !device_code) {
				return NextResponse.json({ error: "Missing device_code" }, { status: 400 });
			}

			const code = await prisma.deviceCode.findUnique({
				where: { id: device_code },
			});

			if (!code) {
				return NextResponse.json({ error: "Invalid device_code" }, { status: 400 });
			}

			if (code.expiresAt.getTime() < Date.now()) {
				// Lazy cleanup: expired codes are inert and removed on touch.
				// deleteMany is race-safe — a concurrent request may have already
				// removed the row (a bare delete would throw P2025 → 500).
				await prisma.deviceCode.deleteMany({ where: { id: code.id } });
				return NextResponse.json({ error: "expired_token" }, { status: 400 });
			}

			if (code.status === "verified" && code.apiKey && code.userId) {
				// One-time use: the key is handed to the CLI exactly once. The conditional
				// deleteMany is the atomic claim — a concurrent poll that also read
				// "verified" loses (count 0) and falls through to pending for its next tick.
				const deleted = await prisma.deviceCode.deleteMany({
					where: { id: code.id, status: "verified" },
				});
				if (deleted.count === 1) {
					const user = await prisma.user.findUnique({
						where: { id: code.userId },
					});

					return NextResponse.json({
						status: "success",
						token: code.apiKey,
						user: {
							id: user?.id,
							name: user?.name,
							email: user?.email,
						},
					});
				}
			}

			return NextResponse.json({ status: "authorization_pending" });
		}

		if (action === "verify") {
			// Authenticate the user calling this from the browser session
			const session = await auth.api.getSession({
				headers: await headers(),
			});

			if (!session) {
				return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
			}

			const body = await request.json();
			const { user_code } = body;

			if (typeof user_code !== "string" || !user_code) {
				return NextResponse.json({ error: "Missing user_code" }, { status: 400 });
			}

			const code = await prisma.deviceCode.findUnique({
				where: { userCode: normalizeUserCode(user_code) },
			});

			if (!code) {
				return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
			}

			if (code.expiresAt.getTime() < Date.now()) {
				// Race-safe cleanup — see poll above.
				await prisma.deviceCode.deleteMany({ where: { id: code.id } });
				return NextResponse.json({ error: "Verification code expired" }, { status: 400 });
			}

			// Atomic exactly-once claim: the conditional updateMany on status ===
			// "pending" AND unexpired succeeds for exactly one concurrent verifier; the
			// API key is only created when the claim wins, all inside a single
			// transaction. The expiry predicate makes the claim itself expiry-safe even
			// if the code lapses between the pre-check above and the transaction.
			const keyToken = "cs_" + crypto.randomBytes(24).toString("hex");
			const claimed = await prisma.$transaction(async (tx) => {
				const updated = await tx.deviceCode.updateMany({
					where: { id: code.id, status: "pending", expiresAt: { gt: new Date() } },
					data: { status: "verified", userId: session.user.id, apiKey: keyToken },
				});
				if (updated.count === 0) return false;

				await tx.apiKey.create({
					data: {
						userId: session.user.id,
						name: `Code Sheriff CLI (${new Date().toLocaleDateString()})`,
						key: keyToken,
					},
				});
				return true;
			});

			if (!claimed) {
				return NextResponse.json({ error: "Verification code already used" }, { status: 400 });
			}

			return NextResponse.json({ success: true });
		}

		return NextResponse.json({ error: "Invalid action" }, { status: 400 });
	} catch (error) {
		// Log the detail server-side; never echo internals (e.g. Prisma table
		// names) back to the client.
		console.error("Device flow endpoint error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
