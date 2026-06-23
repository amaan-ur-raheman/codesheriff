import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock database
vi.mock("@/lib/db", () => ({
	default: {
		repository: {
			findUnique: vi.fn(),
		},
		reviewConfig: {
			findUnique: vi.fn(),
			create: vi.fn(),
			upsert: vi.fn(),
		},
		customReviewRule: {
			findMany: vi.fn(),
			findUnique: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		},
	},
}));

// Mock auth
vi.mock("@/lib/auth", () => ({
	auth: {
		api: {
			getSession: vi.fn().mockResolvedValue({
				user: { id: "user-123" },
			}),
		},
	},
}));

vi.mock("next/headers", () => ({
	headers: vi.fn().mockResolvedValue({}),
}));

import prisma from "@/lib/db";
import {
	getReviewConfig,
	updateReviewConfig,
	getCustomRules,
	createCustomRule,
	updateCustomRule,
	deleteCustomRule,
} from "@/modules/repository/actions/review-config";

const mockPrisma = prisma as unknown as {
	repository: {
		findUnique: ReturnType<typeof vi.fn>;
	};
	reviewConfig: {
		findUnique: ReturnType<typeof vi.fn>;
		create: ReturnType<typeof vi.fn>;
		upsert: ReturnType<typeof vi.fn>;
	};
	customReviewRule: {
		findMany: ReturnType<typeof vi.fn>;
		findUnique: ReturnType<typeof vi.fn>;
		create: ReturnType<typeof vi.fn>;
		update: ReturnType<typeof vi.fn>;
		delete: ReturnType<typeof vi.fn>;
	};
};

describe("Repository Review Config Actions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("getReviewConfig", () => {
		it("throws error if unauthorized", async () => {
			const { auth } = await import("@/lib/auth");
			vi.mocked(auth.api.getSession).mockResolvedValueOnce(null);
			await expect(getReviewConfig("repo-1")).rejects.toThrow("Unauthorized");
		});

		it("throws error if repo not found or not owned by user", async () => {
			mockPrisma.repository.findUnique.mockResolvedValueOnce(null);
			await expect(getReviewConfig("repo-1")).rejects.toThrow("Repository not found");

			mockPrisma.repository.findUnique.mockResolvedValueOnce({ userId: "other" });
			await expect(getReviewConfig("repo-1")).rejects.toThrow("Repository not found");
		});

		it("returns config if existing", async () => {
			mockPrisma.repository.findUnique.mockResolvedValueOnce({ userId: "user-123" });
			mockPrisma.reviewConfig.findUnique.mockResolvedValueOnce({ id: "config-1", repositoryId: "repo-1" });

			const config = await getReviewConfig("repo-1");
			expect(config).toEqual({ id: "config-1", repositoryId: "repo-1" });
		});

		it("creates config if not existing", async () => {
			mockPrisma.repository.findUnique.mockResolvedValueOnce({ userId: "user-123" });
			mockPrisma.reviewConfig.findUnique.mockResolvedValueOnce(null);
			mockPrisma.reviewConfig.create.mockResolvedValueOnce({ id: "new-config", repositoryId: "repo-1" });

			const config = await getReviewConfig("repo-1");
			expect(config).toEqual({ id: "new-config", repositoryId: "repo-1" });
			expect(mockPrisma.reviewConfig.create).toHaveBeenCalledWith({
				data: { repositoryId: "repo-1" },
			});
		});
	});

	describe("updateReviewConfig", () => {
		it("upserts repository config", async () => {
			mockPrisma.repository.findUnique.mockResolvedValueOnce({ userId: "user-123" });
			mockPrisma.reviewConfig.upsert.mockResolvedValueOnce({ id: "config-1" });

			const result = await updateReviewConfig("repo-1", {
				focusAreas: ["security"],
				minSeverity: "error",
				autoReview: false,
				customPrompt: "custom prompt text",
			});

			expect(result).toEqual({ success: true });
			expect(mockPrisma.reviewConfig.upsert).toHaveBeenCalledWith({
				where: { repositoryId: "repo-1" },
				create: expect.objectContaining({
					repositoryId: "repo-1",
					focusAreas: ["security"],
					minSeverity: "error",
					autoReview: false,
					customPrompt: "custom prompt text",
				}),
				update: expect.objectContaining({
					focusAreas: ["security"],
					minSeverity: "error",
					autoReview: false,
					customPrompt: "custom prompt text",
				}),
			});
		});
	});

	describe("custom rules actions", () => {
		describe("getCustomRules", () => {
			it("returns custom rules for repository", async () => {
				mockPrisma.repository.findUnique.mockResolvedValueOnce({ userId: "user-123" });
				mockPrisma.customReviewRule.findMany.mockResolvedValueOnce([{ id: "rule-1" }]);

				const rules = await getCustomRules("repo-1");
				expect(rules).toEqual([{ id: "rule-1" }]);
			});
		});

		describe("createCustomRule", () => {
			it("creates a custom review rule", async () => {
				mockPrisma.repository.findUnique.mockResolvedValueOnce({ userId: "user-123" });
				mockPrisma.customReviewRule.create.mockResolvedValueOnce({ id: "new-rule" });

				const rule = await createCustomRule("repo-1", "No Console Logs", "Ensure no console logs", "rule content");
				expect(rule).toEqual({ id: "new-rule" });
				expect(mockPrisma.customReviewRule.create).toHaveBeenCalledWith({
					data: {
						repositoryId: "repo-1",
						name: "No Console Logs",
						description: "Ensure no console logs",
						ruleContent: "rule content",
					},
				});
			});
		});

		describe("updateCustomRule", () => {
			it("updates custom review rule details if user owns repo", async () => {
				mockPrisma.customReviewRule.findUnique.mockResolvedValueOnce({
					id: "rule-1",
					repository: { userId: "user-123" },
				});
				mockPrisma.customReviewRule.update.mockResolvedValueOnce({ id: "rule-1", isActive: false });

				const rule = await updateCustomRule("rule-1", { isActive: false });
				expect(rule).toEqual({ id: "rule-1", isActive: false });
				expect(mockPrisma.customReviewRule.update).toHaveBeenCalledWith({
					where: { id: "rule-1" },
					data: { isActive: false },
				});
			});

			it("throws error if user does not own rule repository", async () => {
				mockPrisma.customReviewRule.findUnique.mockResolvedValueOnce({
					id: "rule-1",
					repository: { userId: "other-user" },
				});

				await expect(updateCustomRule("rule-1", { isActive: false })).rejects.toThrow("Rule not found");
			});
		});

		describe("deleteCustomRule", () => {
			it("deletes rule if user owns repo", async () => {
				mockPrisma.customReviewRule.findUnique.mockResolvedValueOnce({
					id: "rule-1",
					repository: { userId: "user-123" },
				});
				mockPrisma.customReviewRule.delete.mockResolvedValueOnce({});

				const result = await deleteCustomRule("rule-1");
				expect(result).toEqual({ success: true });
				expect(mockPrisma.customReviewRule.delete).toHaveBeenCalledWith({
					where: { id: "rule-1" },
				});
			});
		});
	});
});
