"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
	submitReviewFeedback,
	getReviewFeedback,
} from "@/modules/review/actions/feedback";

interface ReviewFeedbackProps {
	reviewId: string;
}

export default function ReviewFeedback({ reviewId }: ReviewFeedbackProps) {
	const [comment, setComment] = useState("");
	const [showComment, setShowComment] = useState(false);
	const [pendingRating, setPendingRating] = useState<number | null>(null);
	const queryClient = useQueryClient();

	const { data } = useQuery({
		queryKey: ["reviewFeedback", reviewId],
		queryFn: () => getReviewFeedback(reviewId),
	});

	const mutation = useMutation({
		mutationFn: (values: { rating: number; comment?: string }) =>
			submitReviewFeedback(reviewId, values.rating, values.comment),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["reviewFeedback", reviewId] });
			toast.success("Feedback submitted");
			setComment("");
			setShowComment(false);
			setPendingRating(null);
		},
		onError: () => {
			toast.error("Failed to submit feedback");
		},
	});

	const handleRating = (rating: number) => {
		if (data?.userFeedback?.rating === rating) {
			setPendingRating(null);
			setShowComment(false);
			return;
		}
		setPendingRating(rating);
		setShowComment(true);
	};

	const handleSubmitComment = () => {
		if (pendingRating === null) return;
		mutation.mutate({ rating: pendingRating, comment: comment || undefined });
	};

	const handleSkipComment = () => {
		if (pendingRating === null) return;
		mutation.mutate({ rating: pendingRating });
	};

	const averageRating = data?.averageRating ?? 0;
	const totalFeedback = data?.totalFeedback ?? 0;
	const userRating = data?.userFeedback?.rating ?? null;

	const positivePercent = totalFeedback > 0
		? Math.round(((data?.positiveCount ?? 0) / totalFeedback) * 100)
		: 0;

	return (
		<TooltipProvider delayDuration={200}>
			<div className="flex items-center gap-3 pt-2 border-t">
				<div className="flex items-center gap-1">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant={userRating === 5 ? "default" : "ghost"}
								size="icon-sm"
								onClick={() => handleRating(5)}
								disabled={mutation.isPending}
							>
								<ThumbsUp className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Helpful</TooltipContent>
					</Tooltip>

					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant={userRating === 1 ? "destructive" : "ghost"}
								size="icon-sm"
								onClick={() => handleRating(1)}
								disabled={mutation.isPending}
							>
								<ThumbsDown className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Not helpful</TooltipContent>
					</Tooltip>
				</div>

				{totalFeedback > 0 && (
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<span>
							{averageRating.toFixed(1)} avg
						</span>
						<span>·</span>
						<span>
							{totalFeedback} {totalFeedback === 1 ? "rating" : "ratings"}
						</span>
						<span>·</span>
						<span className="text-green-600 dark:text-green-400">
							{positivePercent}% positive
						</span>
					</div>
				)}
			</div>

			{showComment && (
				<div className="space-y-2 pt-2">
					<Textarea
						placeholder="Add a comment (optional)"
						value={comment}
						onChange={(e) => setComment(e.target.value)}
						rows={2}
						className="text-sm"
					/>
					<div className="flex gap-2">
						<Button
							size="sm"
							onClick={handleSubmitComment}
							disabled={mutation.isPending}
						>
							Submit
						</Button>
						<Button
							size="sm"
							variant="ghost"
							onClick={handleSkipComment}
							disabled={mutation.isPending}
						>
							Skip
						</Button>
					</div>
				</div>
			)}
		</TooltipProvider>
	);
}
