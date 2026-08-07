import { sendReviewCompletedNotification } from "@/modules/notifications/actions";

/**
 * Step: send-notification
 * Fires the in-app + email notification for the saved review.
 */
export async function sendNotification(savedReview: any): Promise<void> {
	if (savedReview) {
		await sendReviewCompletedNotification(savedReview.id);
	}
}
