/**
 * Review detail page — server wrapper for deep links (notifications, emails,
 * global-search results). Fetches the review server-side for tab metadata so
 * the browser title reads "PR #N: <title> | Code Sheriff", then delegates
 * rendering to the client component (which refetches for fresh state and
 * handles loading / error / not-found).
 */
import type { Metadata } from "next";
import { getReview } from "@/modules/review/actions";
import ReviewDetailClient from "@/modules/review/components/review-detail-client";

interface ReviewDetailPageProps {
	params: Promise<{ id: string }>;
}

export async function generateMetadata({
	params,
}: ReviewDetailPageProps): Promise<Metadata> {
	const { id } = await params;

	try {
		const review = await getReview(id);
		if (review) {
			return {
				title: `PR #${review.prNumber}: ${review.prTitle}`,
			};
		}
	} catch {
		// Unauthorized, removed, or unavailable — fall through to the
		// generic title rather than letting metadata crash the page.
	}

	return { title: "Review" };
}

export default async function ReviewDetailPage({
	params,
}: ReviewDetailPageProps) {
	const { id } = await params;
	return <ReviewDetailClient reviewId={id} />;
}
