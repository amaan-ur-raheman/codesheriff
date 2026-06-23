import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// Persist the device codes map across hot reloads in development
const globalForDeviceCodes = global as unknown as {
	deviceCodes?: Map<
		string,
		{
			userCode: string;
			expiresAt: number;
			status: "pending" | "verified";
			userId?: string;
			apiKey?: string;
		}
	>;
};

const deviceCodes = globalForDeviceCodes.deviceCodes || new Map();
if (process.env.NODE_ENV !== "production") {
	globalForDeviceCodes.deviceCodes = deviceCodes;
}

export async function POST(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const action = searchParams.get("action");

		if (action === "initiate") {
			const deviceCode = crypto.randomUUID();
			// Generate user code in the format XXXX-XXXX
			const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed ambiguous letters/numbers
			let userCode = "";
			for (let i = 0; i < 8; i++) {
				if (i === 4) userCode += "-";
				userCode += characters.charAt(Math.floor(Math.random() * characters.length));
			}

			deviceCodes.set(deviceCode, {
				userCode,
				status: "pending",
				expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes expiry
			});

			const baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";

			return NextResponse.json({
				device_code: deviceCode,
				user_code: userCode,
				verification_uri: `${baseUrl}/device`,
			});
		}

		if (action === "poll") {
			const body = await request.json();
			const { device_code } = body;

			if (!device_code) {
				return NextResponse.json({ error: "Missing device_code" }, { status: 400 });
			}

			const codeData = deviceCodes.get(device_code);

			if (!codeData) {
				return NextResponse.json({ error: "Invalid device_code" }, { status: 400 });
			}

			if (Date.now() > codeData.expiresAt) {
				deviceCodes.delete(device_code);
				return NextResponse.json({ error: "expired_token" }, { status: 400 });
			}

			if (codeData.status === "verified" && codeData.apiKey && codeData.userId) {
				deviceCodes.delete(device_code);
				const user = await prisma.user.findUnique({
					where: { id: codeData.userId },
				});

				return NextResponse.json({
					status: "success",
					token: codeData.apiKey,
					user: {
						id: user?.id,
						name: user?.name,
						email: user?.email,
					},
				});
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

			if (!user_code) {
				return NextResponse.json({ error: "Missing user_code" }, { status: 400 });
			}

			// Find device code matching userCode
			let targetDeviceCode: string | null = null;
			let targetCodeData: any = null;

			for (const [dCode, data] of deviceCodes.entries()) {
				if (data.userCode.replace("-", "").toUpperCase() === user_code.replace("-", "").toUpperCase()) {
					targetDeviceCode = dCode;
					targetCodeData = data;
					break;
				}
			}

			if (!targetDeviceCode || !targetCodeData) {
				return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
			}

			if (Date.now() > targetCodeData.expiresAt) {
				deviceCodes.delete(targetDeviceCode);
				return NextResponse.json({ error: "Verification code expired" }, { status: 400 });
			}

			// Create a new API Key for the authenticated user
			const keyToken = "cs_" + crypto.randomBytes(24).toString("hex");
			await prisma.apiKey.create({
				data: {
					userId: session.user.id,
					name: `Code Sheriff CLI (${new Date().toLocaleDateString()})`,
					key: keyToken,
				},
			});

			// Update device code mapping
			deviceCodes.set(targetDeviceCode, {
				...targetCodeData,
				status: "verified",
				userId: session.user.id,
				apiKey: keyToken,
			});

			return NextResponse.json({ success: true });
		}

		return NextResponse.json({ error: "Invalid action" }, { status: 400 });
	} catch (error) {
		console.error("Device flow endpoint error:", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Internal server error" },
			{ status: 500 }
		);
	}
}
