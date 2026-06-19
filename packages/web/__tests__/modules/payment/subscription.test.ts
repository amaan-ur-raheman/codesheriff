import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
	default: {
		user: {
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		userUsage: {
			findUnique: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			upsert: vi.fn(),
		},
		repository: {
			findMany: vi.fn(),
		},
	},
}));

import prisma from "@/lib/db";
import {
	getUserTier,
	canConnectRepository,
	canCreateReview,
	getRemainingLimits,
} from "@/modules/payment/lib/subscription";

const mockPrisma = prisma as unknown as {
	user: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
	userUsage: {
		findUnique: ReturnType<typeof vi.fn>;
		create: ReturnType<typeof vi.fn>;
		update: ReturnType<typeof vi.fn>;
		upsert: ReturnType<typeof vi.fn>;
	};
	repository: { findMany: ReturnType<typeof vi.fn> };
};

describe("subscription tier logic", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("getUserTier", () => {
		it("returns FREE when user has no subscription", async () => {
			mockPrisma.user.findUnique.mockResolvedValue(null);
			const tier = await getUserTier("user-1");
			expect(tier).toBe("FREE");
		});

		it("returns user's subscription tier", async () => {
			mockPrisma.user.findUnique.mockResolvedValue({
				subscriptionTier: "PRO",
			} as never);
			const tier = await getUserTier("user-1");
			expect(tier).toBe("PRO");
		});
	});

	describe("canConnectRepository", () => {
		it("allows PRO users unlimited repositories", async () => {
			mockPrisma.user.findUnique.mockResolvedValue({
				subscriptionTier: "PRO",
			} as never);
			const result = await canConnectRepository("user-1");
			expect(result).toBe(true);
		});

		it("allows FREE user under limit", async () => {
			mockPrisma.user.findUnique.mockResolvedValue({
				subscriptionTier: "FREE",
			} as never);
			mockPrisma.userUsage.findUnique.mockResolvedValue({
				repositoryCount: 2,
			} as never);
			const result = await canConnectRepository("user-1");
			expect(result).toBe(true);
		});

		it("blocks FREE user at limit", async () => {
			mockPrisma.user.findUnique.mockResolvedValue({
				subscriptionTier: "FREE",
			} as never);
			mockPrisma.userUsage.findUnique.mockResolvedValue({
				repositoryCount: 5,
			} as never);
			const result = await canConnectRepository("user-1");
			expect(result).toBe(false);
		});
	});

	describe("canCreateReview", () => {
		it("allows PRO users unlimited reviews", async () => {
			mockPrisma.user.findUnique.mockResolvedValue({
				subscriptionTier: "PRO",
			} as never);
			const result = await canCreateReview("user-1", "repo-1");
			expect(result).toBe(true);
		});

		it("allows FREE user under review limit", async () => {
			mockPrisma.user.findUnique.mockResolvedValue({
				subscriptionTier: "FREE",
			} as never);
			mockPrisma.userUsage.findUnique.mockResolvedValue({
				reviewCounts: { "repo-1": 2 },
			} as never);
			const result = await canCreateReview("user-1", "repo-1");
			expect(result).toBe(true);
		});

		it("blocks FREE user at review limit", async () => {
			mockPrisma.user.findUnique.mockResolvedValue({
				subscriptionTier: "FREE",
			} as never);
			mockPrisma.userUsage.findUnique.mockResolvedValue({
				reviewCounts: { "repo-1": 5 },
			} as never);
			const result = await canCreateReview("user-1", "repo-1");
			expect(result).toBe(false);
		});
	});

	describe("getRemainingLimits", () => {
		it("returns correct limits for FREE tier", async () => {
			mockPrisma.user.findUnique.mockResolvedValue({
				subscriptionTier: "FREE",
			} as never);
			mockPrisma.userUsage.findUnique.mockResolvedValue({
				repositoryCount: 3,
				reviewCounts: { "repo-1": 2 },
			} as never);
			mockPrisma.repository.findMany.mockResolvedValue([
				{ id: "repo-1" },
			] as never);

			const limits = await getRemainingLimits("user-1");

			expect(limits.tier).toBe("FREE");
			expect(limits.repositories.current).toBe(3);
			expect(limits.repositories.limit).toBe(5);
			expect(limits.repositories.canAdd).toBe(true);
			expect(limits.reviews["repo-1"].current).toBe(2);
			expect(limits.reviews["repo-1"].limit).toBe(5);
		});

		it("returns unlimited limits for PRO tier", async () => {
			mockPrisma.user.findUnique.mockResolvedValue({
				subscriptionTier: "PRO",
			} as never);
			mockPrisma.userUsage.findUnique.mockResolvedValue({
				repositoryCount: 10,
				reviewCounts: {},
			} as never);
			mockPrisma.repository.findMany.mockResolvedValue([]);

			const limits = await getRemainingLimits("user-1");

			expect(limits.tier).toBe("PRO");
			expect(limits.repositories.limit).toBeNull();
			expect(limits.repositories.canAdd).toBe(true);
		});
	});
});
