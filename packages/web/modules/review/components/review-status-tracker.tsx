"use client";

import { useQuery } from "@tanstack/react-query";
import { getActiveReviews } from "@/modules/review/actions/status";
import { Badge } from "@/components/ui/badge";
import { Clock, Loader2 } from "lucide-react";

export function ReviewStatusTracker() {
	const { data: activeReviews } = useQuery({
		queryKey: ["active-reviews"],
		queryFn: async () => {
			return await getActiveReviews();
		},
		refetchInterval: (query) => {
			const reviews = query.state.data;
			if (reviews && reviews.length > 0) {
				return 3000;
			}
			return false;
		},
	});

	if (!activeReviews || activeReviews.length === 0) {
		return null;
	}

	return (
		<div className="fixed bottom-4 right-4 z-50 space-y-2">
			{activeReviews.map((review) => (
				<div
					key={review.id}
					className="flex items-center gap-3 rounded-lg border bg-background shadow-lg px-4 py-3 animate-in slide-in-from-bottom-5 fade-in duration-300"
				>
					<div className="flex items-center gap-2">
						{review.status === "pending" ? (
							<Clock className="h-4 w-4 text-muted-foreground animate-pulse" />
						) : (
							<Loader2 className="h-4 w-4 text-primary animate-spin" />
						)}
						<span className="text-sm font-medium truncate max-w-[200px]">
							{review.prTitle}
						</span>
					</div>
					<Badge
						variant={
							review.status === "pending" ? "secondary" : "default"
						}
						className="text-xs"
					>
						{review.status === "pending" ? "Queued" : "In Progress"}
					</Badge>
				</div>
			))}
		</div>
	);
}
