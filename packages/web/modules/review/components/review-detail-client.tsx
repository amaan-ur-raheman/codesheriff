/**
 * Review detail client — fetches a single review via the getReview server
 * action and renders the shared ReviewCard with loading / error / not-found
 * states. Rendered by the server page at app/dashboard/reviews/[id], which
 * supplies the route id and tab metadata for deep links.
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";

import { getReview } from "@/modules/review/actions";
import { ReviewCard } from "@/modules/review/components/review-card";
import { PageHeader } from "@/components/page-header";

export default function ReviewDetailClient({
	reviewId,
}: {
	reviewId: string;
}) {
	const {
		data: review,
		isLoading,
		isError,
		refetch,
	} = useQuery({
		queryKey: ["review", reviewId],
		queryFn: () => getReview(reviewId),
	});

	const header = (
		<PageHeader
			backLink={{ href: "/dashboard/reviews", label: "All reviews" }}
			kicker="Code review"
			title={isLoading ? "Loading review…" : review?.prTitle ?? "Review"}
			description={
				review
					? `${review.repository.fullName} · PR #${review.prNumber}`
					: "View the full AI code review"
			}
		/>
	);

	if (isLoading) {
		return (
			<div className="space-y-4">
				{header}
				<Card>
					<CardHeader className="space-y-2">
						<Skeleton className="h-6 w-2/3" />
						<Skeleton className="h-4 w-40" />
					</CardHeader>
					<CardContent className="space-y-3">
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-24 w-full" />
					</CardContent>
				</Card>
			</div>
		);
	}

	if (isError) {
		return (
			<div className="space-y-4">
				{header}
				<ErrorState
					title="Couldn't load review"
					description="This review couldn't be fetched right now."
					onRetry={() => refetch()}
				/>
			</div>
		);
	}

	if (!review) {
		return (
			<div className="space-y-4">
				{header}
				<EmptyState
					kicker="Reviews"
					title="Review not found"
					description="This review may have been removed, or you don't have access to it."
					action={
						<Button variant="outline" size="sm" asChild>
							<Link href="/dashboard/reviews">Back to reviews</Link>
						</Button>
					}
				/>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{header}
			<ReviewCard review={review} />
		</div>
	);
}
