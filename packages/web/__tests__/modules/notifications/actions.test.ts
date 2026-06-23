import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock database
vi.mock("@/lib/db", () => ({
	default: {
		user: {
			findUnique: vi.fn(),
		},
		notification: {
			findMany: vi.fn(),
			count: vi.fn(),
			updateMany: vi.fn(),
			findFirst: vi.fn(),
			create: vi.fn(),
		},
		review: {
			findUnique: vi.fn(),
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

// Mock email
vi.mock("@/lib/email", () => ({
	sendEmail: vi.fn().mockResolvedValue({}),
}));

// Mock email templates
vi.mock("@/modules/notifications/lib/email-templates", () => ({
	reviewCompletedEmail: vi.fn().mockReturnValue("completed-html"),
	reviewFailedEmail: vi.fn().mockReturnValue("failed-html"),
	usageLimitWarningEmail: vi.fn().mockReturnValue("warning-html"),
	subscriptionChangedEmail: vi.fn().mockReturnValue("subscription-html"),
	commentReplyEmail: vi.fn().mockReturnValue("reply-html"),
}));

vi.mock("next/headers", () => ({
	headers: vi.fn().mockResolvedValue({}),
}));

import prisma from "@/lib/db";
import { sendEmail } from "@/lib/email";
import {
	getNotifications,
	getUnreadCount,
	markAsRead,
	markAllAsRead,
	sendReviewCompletedNotification,
	sendReviewFailedNotification,
	sendUsageLimitWarning,
	sendSubscriptionChangedNotification,
} from "@/modules/notifications/actions";

const mockPrisma = prisma as unknown as {
	user: { findUnique: ReturnType<typeof vi.fn> };
	notification: {
		findMany: ReturnType<typeof vi.fn>;
		count: ReturnType<typeof vi.fn>;
		updateMany: ReturnType<typeof vi.fn>;
		findFirst: ReturnType<typeof vi.fn>;
		create: ReturnType<typeof vi.fn>;
	};
	review: { findUnique: ReturnType<typeof vi.fn> };
};

describe("Notifications Server Actions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("getNotifications", () => {
		it("retrieves notifications for user", async () => {
			const mockNotifs = [{ id: "n1", title: "N1" }];
			mockPrisma.notification.findMany.mockResolvedValue(mockNotifs);

			const result = await getNotifications();
			expect(result).toEqual(mockNotifs);
			expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { userId: "user-123" },
				})
			);
		});
	});

	describe("getUnreadCount", () => {
		it("returns unread count", async () => {
			mockPrisma.notification.count.mockResolvedValue(3);
			const result = await getUnreadCount();
			expect(result).toBe(3);
			expect(mockPrisma.notification.count).toHaveBeenCalledWith({
				where: { userId: "user-123", read: false },
			});
		});
	});

	describe("markAsRead", () => {
		it("marks a specific notification as read", async () => {
			await markAsRead("notif-1");
			expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
				where: { id: "notif-1", userId: "user-123" },
				data: { read: true },
			});
		});
	});

	describe("markAllAsRead", () => {
		it("marks all unread notifications as read", async () => {
			await markAllAsRead();
			expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
				where: { userId: "user-123", read: false },
				data: { read: true },
			});
		});
	});

	describe("sendReviewCompletedNotification", () => {
		it("creates database notification and sends email", async () => {
			mockPrisma.review.findUnique.mockResolvedValue({
				id: "rev-1",
				prNumber: 5,
				prTitle: "Fix issues",
				prUrl: "http://github.com/pr",
				repository: {
					fullName: "owner/repo",
					user: {
						id: "user-123",
						email: "user@example.com",
					},
				},
			} as never);
			mockPrisma.user.findUnique.mockResolvedValue({ emailNotifications: true } as never);
			mockPrisma.notification.findFirst.mockResolvedValue(null);

			await sendReviewCompletedNotification("rev-1");

			expect(mockPrisma.notification.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						userId: "user-123",
						type: "review_completed",
					}),
				})
			);

			expect(sendEmail).toHaveBeenCalledWith({
				to: "user@example.com",
				subject: "Review complete: #5 Fix issues",
				html: "completed-html",
			});
		});

		it("creates notification but skips email if user disabled email alerts", async () => {
			mockPrisma.review.findUnique.mockResolvedValue({
				id: "rev-1",
				prNumber: 5,
				prTitle: "Fix issues",
				prUrl: "http://github.com/pr",
				repository: {
					fullName: "owner/repo",
					user: {
						id: "user-123",
						email: "user@example.com",
					},
				},
			} as never);
			mockPrisma.user.findUnique.mockResolvedValue({ emailNotifications: false } as never);
			mockPrisma.notification.findFirst.mockResolvedValue(null);

			await sendReviewCompletedNotification("rev-1");

			expect(mockPrisma.notification.create).toHaveBeenCalled();
			expect(sendEmail).not.toHaveBeenCalled();
		});
	});

	describe("sendReviewFailedNotification", () => {
		it("creates failed review notification", async () => {
			mockPrisma.review.findUnique.mockResolvedValue({
				id: "rev-2",
				prNumber: 6,
				prTitle: "Buggy PR",
				prUrl: "http://github.com/pr2",
				repository: {
					fullName: "owner/repo",
					user: {
						id: "user-123",
						email: "user@example.com",
					},
				},
			} as never);
			mockPrisma.user.findUnique.mockResolvedValue({ emailNotifications: true } as never);
			mockPrisma.notification.findFirst.mockResolvedValue(null);

			await sendReviewFailedNotification("rev-2", "Gemini Timeout");

			expect(mockPrisma.notification.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						type: "review_failed",
						message: "Review for #6 Buggy PR failed: Gemini Timeout",
					}),
				})
			);
		});
	});

	describe("sendUsageLimitWarning", () => {
		it("sends usage warning notification and email", async () => {
			mockPrisma.user.findUnique.mockResolvedValue({ id: "user-123", email: "user@example.com", emailNotifications: true } as never);
			mockPrisma.notification.findFirst.mockResolvedValue(null);

			await sendUsageLimitWarning("user-123", "reviews", 4, 5);

			expect(mockPrisma.notification.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						type: "usage_warning",
						message: "80% of monthly reviews used.",
					}),
				})
			);

			expect(sendEmail).toHaveBeenCalledWith(
				expect.objectContaining({
					subject: "Usage warning: 80% of monthly reviews used",
				})
			);
		});
	});

	describe("sendSubscriptionChangedNotification", () => {
		it("notifies user of subscription update", async () => {
			mockPrisma.user.findUnique.mockResolvedValue({ id: "user-123", email: "user@example.com", emailNotifications: true } as never);
			mockPrisma.notification.findFirst.mockResolvedValue(null);

			await sendSubscriptionChangedNotification("user-123", "PRO", "active");

			expect(mockPrisma.notification.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						type: "subscription_changed",
						message: "Your subscription has been updated to PRO (active).",
					}),
				})
			);
		});
	});
});
