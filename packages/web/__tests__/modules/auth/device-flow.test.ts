import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
	default: {
		deviceCode: {
			create: vi.fn(),
			findUnique: vi.fn(),
			delete: vi.fn(),
			deleteMany: vi.fn(),
			updateMany: vi.fn(),
		},
		apiKey: { create: vi.fn() },
		user: { findUnique: vi.fn() },
		$transaction: vi.fn(),
	},
}));

vi.mock("@/lib/auth", () => ({
	auth: {
		api: {
			getSession: vi.fn(),
		},
	},
}));

vi.mock("next/headers", () => ({
	headers: vi.fn().mockResolvedValue(new Headers()),
}));

import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { POST } from "@/app/api/auth/device/route";

const mockPrisma = prisma as unknown as {
	deviceCode: {
		create: ReturnType<typeof vi.fn>;
		findUnique: ReturnType<typeof vi.fn>;
		delete: ReturnType<typeof vi.fn>;
		deleteMany: ReturnType<typeof vi.fn>;
		updateMany: ReturnType<typeof vi.fn>;
	};
	apiKey: { create: ReturnType<typeof vi.fn> };
	user: { findUnique: ReturnType<typeof vi.fn> };
	$transaction: ReturnType<typeof vi.fn>;
};

const mockAuth = auth as unknown as {
	api: { getSession: ReturnType<typeof vi.fn> };
};

const pendingCode = (overrides: Record<string, unknown> = {}) => ({
	id: "dev-1",
	userCode: "ABCDEFGH",
	status: "pending",
	userId: null,
	apiKey: null,
	expiresAt: new Date(Date.now() + 10 * 60 * 1000),
	createdAt: new Date(),
	...overrides,
});

const makeRequest = (action: string, body?: unknown) =>
	new NextRequest(`http://localhost:3000/api/auth/device?action=${action}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: body === undefined ? undefined : JSON.stringify(body),
	});

const json = async (res: Response) => res.json() as Promise<any>;

beforeEach(() => {
	vi.clearAllMocks();
	mockPrisma.$transaction.mockImplementation((fn: (tx: typeof mockPrisma) => unknown) =>
		fn(mockPrisma)
	);
});

describe("device flow — initiate", () => {
	it("persists a normalized DeviceCode with a 10-minute expiry and returns the CLI contract", async () => {
		mockPrisma.deviceCode.create.mockResolvedValue({});

		const res = await POST(makeRequest("initiate"));
		expect(res.status).toBe(200);

		const body = await json(res);
		expect(body.device_code).toMatch(/^[0-9a-f-]{36}$/);
		expect(body.user_code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
		expect(body.verification_uri).toMatch(/\/device$/);

		const createArg = mockPrisma.deviceCode.create.mock.calls[0][0];
		expect(createArg.data.id).toBe(body.device_code);
		// Stored normalized: uppercase, no hyphen
		expect(createArg.data.userCode).toMatch(/^[A-Z2-9]{8}$/);
		expect(createArg.data.userCode).not.toContain("-");
		// ~10 minute expiry
		const ttl = createArg.data.expiresAt.getTime() - Date.now();
		expect(ttl).toBeGreaterThan(9 * 60 * 1000);
		expect(ttl).toBeLessThanOrEqual(10 * 60 * 1000);
	});

	it("retries with a fresh code on a unique-index collision (P2002)", async () => {
		const uniqueViolation = Object.assign(new Error("Unique constraint"), { code: "P2002" });
		mockPrisma.deviceCode.create
			.mockRejectedValueOnce(uniqueViolation)
			.mockResolvedValueOnce({});

		const res = await POST(makeRequest("initiate"));
		expect(res.status).toBe(200);
		expect(mockPrisma.deviceCode.create).toHaveBeenCalledTimes(2);
		const second = mockPrisma.deviceCode.create.mock.calls[1][0];
		expect(second.data.userCode).toMatch(/^[A-Z2-9]{8}$/);
	});
});

describe("device flow — poll", () => {
	it("returns authorization_pending for a pending, unexpired code", async () => {
		mockPrisma.deviceCode.findUnique.mockResolvedValue(pendingCode());

		const res = await POST(makeRequest("poll", { device_code: "dev-1" }));
		expect(await json(res)).toEqual({ status: "authorization_pending" });
		expect(mockPrisma.deviceCode.delete).not.toHaveBeenCalled();
	});

	it("rejects an unknown device_code", async () => {
		mockPrisma.deviceCode.findUnique.mockResolvedValue(null);

		const res = await POST(makeRequest("poll", { device_code: "nope" }));
		expect(res.status).toBe(400);
		expect((await json(res)).error).toBe("Invalid device_code");
	});

	it("lazily deletes an expired code and reports expired_token", async () => {
		mockPrisma.deviceCode.findUnique.mockResolvedValue(
			pendingCode({ expiresAt: new Date(Date.now() - 1000) })
		);
		mockPrisma.deviceCode.delete.mockResolvedValue({});

		const res = await POST(makeRequest("poll", { device_code: "dev-1" }));
		expect(res.status).toBe(400);
		expect((await json(res)).error).toBe("expired_token");
		expect(mockPrisma.deviceCode.delete).toHaveBeenCalledWith({ where: { id: "dev-1" } });
	});

	it("returns the API key + user exactly once, then removes the row", async () => {
		mockPrisma.deviceCode.findUnique.mockResolvedValue(
			pendingCode({
				status: "verified",
				userId: "user-123",
				apiKey: "cs_secretkey",
			})
		);
		mockPrisma.deviceCode.deleteMany.mockResolvedValue({ count: 1 });
		mockPrisma.user.findUnique.mockResolvedValue({
			id: "user-123",
			name: "Alice",
			email: "alice@example.com",
		});

		const res = await POST(makeRequest("poll", { device_code: "dev-1" }));
		expect(res.status).toBe(200);
		expect(await json(res)).toEqual({
			status: "success",
			token: "cs_secretkey",
			user: { id: "user-123", name: "Alice", email: "alice@example.com" },
		});
		// One-time use — the conditional deleteMany is the atomic claim
		expect(mockPrisma.deviceCode.deleteMany).toHaveBeenCalledWith({
			where: { id: "dev-1", status: "verified" },
		});
	});

	it("does not hand the key out twice to concurrent polls", async () => {
		mockPrisma.deviceCode.findUnique.mockResolvedValue(
			pendingCode({
				status: "verified",
				userId: "user-123",
				apiKey: "cs_secretkey",
			})
		);
		// A concurrent poll already claimed (deleted) the row — count 0
		mockPrisma.deviceCode.deleteMany.mockResolvedValue({ count: 0 });

		const res = await POST(makeRequest("poll", { device_code: "dev-1" }));
		expect(res.status).toBe(200);
		// Falls back to pending for the next tick; no key is exposed
		expect(await json(res)).toEqual({ status: "authorization_pending" });
	});
});

describe("device flow — verify", () => {
	beforeEach(() => {
		mockAuth.api.getSession.mockResolvedValue({ user: { id: "user-123" } });
	});

	it("rejects unauthenticated requests", async () => {
		mockAuth.api.getSession.mockResolvedValue(null);

		const res = await POST(makeRequest("verify", { user_code: "ABCDEFGH" }));
		expect(res.status).toBe(401);
		expect((await json(res)).error).toBe("Unauthorized");
	});

	it("normalizes the entered code and finds it by the unique-indexed userCode", async () => {
		mockPrisma.deviceCode.findUnique.mockResolvedValue(pendingCode());
		mockPrisma.deviceCode.updateMany.mockResolvedValue({ count: 1 });
		mockPrisma.apiKey.create.mockResolvedValue({});

		const res = await POST(makeRequest("verify", { user_code: "abcd-efgh" }));
		expect(res.status).toBe(200);
		expect(await json(res)).toEqual({ success: true });

		// Exact, normalized lookup — no in-memory scan
		expect(mockPrisma.deviceCode.findUnique).toHaveBeenCalledWith({
			where: { userCode: "ABCDEFGH" },
		});
		// Conditional atomic claim on pending AND unexpired — expiry-safe even if the
		// code lapses between the pre-check and the transaction
		expect(mockPrisma.deviceCode.updateMany).toHaveBeenCalledWith({
			where: {
				id: "dev-1",
				status: "pending",
				expiresAt: { gt: expect.any(Date) },
			},
			data: expect.objectContaining({
				status: "verified",
				userId: "user-123",
				apiKey: expect.stringMatching(/^cs_[0-9a-f]{48}$/),
			}),
		});
		expect(mockPrisma.apiKey.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				userId: "user-123",
				key: expect.stringMatching(/^cs_[0-9a-f]{48}$/),
			}),
		});
	});

	it("rejects an unknown user code", async () => {
		mockPrisma.deviceCode.findUnique.mockResolvedValue(null);

		const res = await POST(makeRequest("verify", { user_code: "ZZZZZZZZ" }));
		expect(res.status).toBe(400);
		expect((await json(res)).error).toBe("Invalid verification code");
		expect(mockPrisma.apiKey.create).not.toHaveBeenCalled();
	});

	it("rejects and lazily deletes an expired code without creating a key", async () => {
		mockPrisma.deviceCode.findUnique.mockResolvedValue(
			pendingCode({ expiresAt: new Date(Date.now() - 1000) })
		);
		mockPrisma.deviceCode.delete.mockResolvedValue({});

		const res = await POST(makeRequest("verify", { user_code: "ABCDEFGH" }));
		expect(res.status).toBe(400);
		expect((await json(res)).error).toBe("Verification code expired");
		expect(mockPrisma.deviceCode.delete).toHaveBeenCalledWith({ where: { id: "dev-1" } });
		expect(mockPrisma.apiKey.create).not.toHaveBeenCalled();
	});

	it("is atomic: a duplicate/concurrent verify fails and creates no API key", async () => {
		mockPrisma.deviceCode.findUnique.mockResolvedValue(pendingCode());
		// The conditional claim loses — another verifier got there first
		mockPrisma.deviceCode.updateMany.mockResolvedValue({ count: 0 });

		const res = await POST(makeRequest("verify", { user_code: "ABCDEFGH" }));
		expect(res.status).toBe(400);
		expect((await json(res)).error).toBe("Verification code already used");
		expect(mockPrisma.apiKey.create).not.toHaveBeenCalled();
	});
});
