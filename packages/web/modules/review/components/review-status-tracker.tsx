"use client";

import { useQuery } from "@tanstack/react-query";
import { getActiveReviews } from "@/modules/review/actions/status";
import { Clock, Shield } from "lucide-react";

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
		<div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 w-[440px] max-w-[calc(100vw-2rem)] select-none">
			{activeReviews.map((review) => (
				<div
					key={review.id}
					className="bg-card border border-border shadow-lg text-foreground animate-in slide-in-from-bottom-5 fade-in duration-300"
				>
					{/* Review in-flight header */}
					<div className="bg-muted px-4 py-2 border-b border-border flex items-center justify-between text-xs font-medium text-muted-foreground">
						<span className="truncate max-w-[280px] font-mono tracking-tight">
							{review.repository.fullName} ⋅ PR #{review.prNumber}
						</span>
						<span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] bg-brand-soft/70 text-brand-text px-2 py-0.5 border border-brand-soft">
							<span className="h-1.5 w-1.5 bg-brand animate-pulse" />
							{review.status === "pending" ? "Queued" : "In Progress"}
						</span>
					</div>

					<div className="divide-y divide-border">
						{/* Row 1: CodeSheriff check run */}
						<div className="flex items-start gap-3 px-4 py-3 bg-card">
							{/* Brand pulse indicator */}
							<div className="flex items-center justify-center h-6 w-4 shrink-0">
								<span className="relative flex h-2 w-2">
									<span className="animate-ping absolute inline-flex h-full w-full bg-brand opacity-75"></span>
									<span className="relative inline-flex h-2 w-2 bg-brand"></span>
								</span>
							</div>

							{/* Logo: brand square with Shield icon */}
							<div className="h-6 w-6 bg-brand text-brand-soft flex items-center justify-center shrink-0">
								<Shield className="h-3.5 w-3.5 fill-current stroke-none" />
							</div>

							{/* Text */}
							<div className="flex-1 min-w-0 text-sm leading-snug">
								<span className="font-semibold text-foreground">CodeSheriff</span>{" "}
								<span className="text-muted-foreground text-[13px]">
									Waiting for status to be reported. Review in progress.
								</span>
							</div>
						</div>

						{/* Row 2: Conflict check — not yet implemented */}
						<div className="flex items-start gap-3 px-4 py-3 bg-card opacity-60">
							<div className="flex items-center justify-center h-6 w-4 shrink-0">
								<div className="h-5 w-5 bg-muted text-muted-foreground flex items-center justify-center shrink-0">
									<Clock className="h-3 w-3 stroke-[3]" />
								</div>
							</div>

							<div className="flex-1 min-w-0 text-sm leading-tight mt-0.5">
								<div className="font-semibold text-foreground">Merge conflict check</div>
								<div className="text-xs text-muted-foreground mt-0.5">
									Status not yet available. Coming soon.
								</div>
							</div>
						</div>
					</div>
				</div>
			))}
		</div>
	);
}
