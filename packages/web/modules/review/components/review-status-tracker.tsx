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
					className="bg-white dark:bg-[#0d1117] border border-[#d0d7de] dark:border-[#30363d] rounded-lg shadow-2xl overflow-hidden text-[#24292f] dark:text-[#c9d1d9] font-sans animate-in slide-in-from-bottom-5 fade-in duration-300"
				>
					{/* GitHub style PR Merge checks box header */}
					<div className="bg-[#f6f8fa] dark:bg-[#161b22] px-4 py-2 border-b border-[#d0d7de] dark:border-[#30363d] flex items-center justify-between text-xs font-semibold text-[#57606a] dark:text-[#8b949e]">
						<span className="truncate max-w-[280px] font-mono tracking-tight">
							{review.repository.fullName} ⋅ PR #{review.prNumber}
						</span>
						<span className="flex items-center gap-1.5 font-mono text-[10px] bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-500 px-2 py-0.5 rounded-full border border-amber-500/20">
							<span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
							{review.status === "pending" ? "Queued" : "In Progress"}
						</span>
					</div>

					<div className="divide-y divide-[#d0d7de] dark:divide-[#30363d]">
						{/* Row 1: CodeSheriff check run */}
						<div className="flex items-start gap-3 px-4 py-3 bg-white dark:bg-[#0d1117]">
							{/* Gold/Orange dot indicator */}
							<div className="flex items-center justify-center h-6 w-4 shrink-0">
								<span className="relative flex h-2 w-2">
									<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
									<span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
								</span>
							</div>

							{/* Logo: Orange square with Shield icon representing CodeSheriff */}
							<div className="h-6 w-6 rounded bg-[#ff6b00] text-white flex items-center justify-center shrink-0 shadow-sm">
								<Shield className="h-3.5 w-3.5 fill-white stroke-none" />
							</div>

							{/* Text */}
							<div className="flex-1 min-w-0 text-sm leading-snug">
								<span className="font-semibold text-[#24292f] dark:text-[#f0f6fc]">CodeSheriff</span>{" "}
								<span className="text-[#57606a] dark:text-[#8b949e] text-[13px]">
									Waiting for status to be reported — Review in progress
								</span>
							</div>
						</div>

						{/* Row 2: Conflict check — not yet implemented */}
						<div className="flex items-start gap-3 px-4 py-3 bg-white dark:bg-[#0d1117] opacity-60">
							<div className="flex items-center justify-center h-6 w-4 shrink-0">
								<div className="h-5 w-5 rounded-full bg-[#57606a] dark:bg-[#8b949e] text-white flex items-center justify-center shrink-0">
									<Clock className="h-3 w-3 stroke-[3]" />
								</div>
							</div>

							<div className="flex-1 min-w-0 text-sm leading-tight mt-0.5">
								<div className="font-semibold text-[#24292f] dark:text-[#f0f6fc]">Merge conflict check</div>
								<div className="text-xs text-[#57606a] dark:text-[#8b949e] mt-0.5">
									Status not yet available — coming soon.
								</div>
							</div>
						</div>
					</div>
				</div>
			))}
		</div>
	);
}
