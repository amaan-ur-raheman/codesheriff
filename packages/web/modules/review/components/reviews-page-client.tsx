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
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

import { getReviews } from "@/modules/review/actions";
import { ReviewCard } from "@/modules/review/components/review-card";
import { PageHeader } from "@/components/page-header";

export default function ReviewsPageClient() {
	const { data: reviews, isLoading } = useQuery({
		queryKey: ["reviews"],
		queryFn: async () => {
			return await getReviews();
		},
		refetchInterval: (query) => {
			const hasActive = query.state.data?.some(
				(r) => r.status === "pending" || r.status === "in_progress"
			);
			return hasActive ? 3000 : false;
		},
	});

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

	return (
		<div className="space-y-4">
			<PageHeader
				kicker="Code reviews"
				title="Review History"
				description="View all AI code reviews"
			/>

			{reviews?.length === 0 ? (
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
					{reviews?.map((review) => (
						<ReviewCard key={review.id} review={review} />
					))}
				</div>
			)}
		</div>
	);
}
