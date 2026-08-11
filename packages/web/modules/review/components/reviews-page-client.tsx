/**
 * Reviews page client component displaying AI-generated code reviews
 *
 * Features:
 * - List of all code reviews with status indicators
 * - Review content display with markdown formatting
 * - Links to original pull requests
 * - Status badges (pending, completed, failed)
 * - Inline code suggestions with collapsible cards
 * - Responsive card layout
 *
 * @component
 */
"use client";

import {
	Card,
	CardContent,
	CardHeader,
} from "@/components/ui/card";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";

import { getReviews } from "@/modules/review/actions";
import { ReviewCard } from "@/modules/review/components/review-card";
import { PageHeader } from "@/components/page-header";

const REVIEWS_PER_PAGE = 10;

export default function ReviewsPageClient() {
	const [page, setPage] = useState(1);

	const { data, isLoading, isError, isFetching, refetch } = useQuery({
		queryKey: ["reviews", page],
		queryFn: async () => {
			return await getReviews(page, REVIEWS_PER_PAGE);
		},
		// Keep the previous page visible while the next one loads — no flash.
		placeholderData: (prev) => prev,
		refetchInterval: (query) => {
			const hasActive = query.state.data?.reviews.some(
				(r) => r.status === "pending" || r.status === "in_progress"
			);
			return hasActive ? 3000 : false;
		},
	});

	const reviews = data?.reviews ?? [];
	const total = data?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / REVIEWS_PER_PAGE));

	// If the review count shrank (e.g. a repo disconnect in Settings deleted
	// reviews), pull back to a page that exists instead of stranding the user
	// on an empty one.
	useEffect(() => {
		if (page > totalPages) {
			setPage(totalPages);
		}
	}, [page, totalPages]);

	if (isLoading) {
		return (
			<div className="space-y-4">
				<PageHeader
					kicker="Code reviews"
					title="Review History"
					description="View all AI code reviews"
				/>
				<div className="grid gap-4">
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
					<Card>
						<CardHeader className="space-y-2">
							<Skeleton className="h-6 w-1/2" />
							<Skeleton className="h-4 w-32" />
						</CardHeader>
						<CardContent className="space-y-3">
							<Skeleton className="h-4 w-28" />
							<Skeleton className="h-24 w-full" />
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	if (isError) {
		return (
			<div className="space-y-4">
				<PageHeader
					kicker="Code reviews"
					title="Review History"
					description="View all AI code reviews"
				/>
				<ErrorState
					title="Couldn't load reviews"
					description="Your reviews couldn't be fetched right now."
					onRetry={() => refetch()}
				/>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<PageHeader
				kicker="Code reviews"
				title="Review History"
				description="View all AI code reviews"
			/>

			{total === 0 ? (
				<Card>
					<CardContent>
						<EmptyState
							kicker="Reviews"
							title="No reviews yet"
							description="Connect a repository and open a pull request to get your first AI review."
							action={
								<Button variant="outline" size="sm" asChild>
									<a href="/dashboard/repository">
										Connect a repository
									</a>
								</Button>
							}
						/>
					</CardContent>
				</Card>
			) : (
				<div className="grid gap-4">
					{reviews.map((review) => (
						<ReviewCard key={review.id} review={review} />
					))}
				</div>
			)}

			{totalPages > 1 && (
				<Pagination
					page={page}
					totalPages={totalPages}
					onPageChange={setPage}
					isFetching={isFetching}
				/>
			)}
		</div>
	);
}
