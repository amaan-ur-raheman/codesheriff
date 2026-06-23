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

import { useState } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	ExternalLink,
	Clock,
	CheckCircle2,
	XCircle,
	Sparkles,
	ChevronDown,
	ChevronRight,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

import { getReviews } from "@/modules/review/actions";
import InlineSuggestions from "@/modules/review/components/inline-suggestions";
import ReviewFeedback from "@/modules/review/components/review-feedback";
import ReviewFlowCanvas from "@/modules/review/components/review-flow-canvas";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageResponse } from "@/components/ai-elements/message";
import { useTheme } from "next-themes";

function ReviewCard({ review }: { review: any }) {
	const { resolvedTheme } = useTheme();
	const [showSuggestions, setShowSuggestions] = useState(false);
	const [showFullReview, setShowFullReview] = useState(false);

	return (
		<Card className="hover:shadow-md transition-shadow">
			<CardHeader>
				<div className="flex items-center justify-between">
					<div className="space-y-2 flex-1">
						<div className="flex items-center gap-2">
							<CardTitle className="text-lg">
								{review.prTitle}
							</CardTitle>
							{review.status === "completed" && (
								<Badge variant="default" className="gap-1">
									<CheckCircle2 className="h-3 w-3" />
									Completed
								</Badge>
							)}
							{review.status === "failed" && (
								<Badge variant="destructive" className="gap-1">
									<XCircle className="h-3 w-3" />
									Failed
								</Badge>
							)}
							{review.status === "pending" && (
								<Badge variant="secondary" className="gap-1">
									<Clock className="h-3 w-3" />
									Pending
								</Badge>
							)}
						</div>
						<CardDescription>
							{review.repository.fullName} ⋅ PR #{review.prNumber}
						</CardDescription>
					</div>

					<Button variant="ghost" size="icon" asChild>
						<a
							href={review.prUrl}
							target="_blank"
							rel="noopener noreferrer"
						>
							<ExternalLink className="h-4 w-4" />
						</a>
					</Button>
				</div>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					<div className="text-sm text-muted-foreground">
						{formatDistanceToNow(new Date(review.createdAt), {
							addSuffix: true,
						})}
					</div>
				<div className="bg-muted p-6 rounded-lg">
					<div className="prose prose-sm dark:prose-invert max-w-none">
						<MessageResponse
							key={showFullReview ? "full" : "short"}
							mode="static"
							mermaid={{
								config: {
									theme: resolvedTheme === "dark" ? "dark" : "default",
								},
							}}
						>
							{showFullReview
								? (review.review ?? "")
								: (review.review?.substring(0, 300) ?? "No review content") + (review.review && review.review.length > 300 ? "..." : "")}
						</MessageResponse>
					</div>
					{review.review && review.review.length > 300 && (
						<button
							onClick={() => setShowFullReview(!showFullReview)}
							className="mt-4 text-xs text-primary hover:underline block"
						>
							{showFullReview ? "Show less" : "Show full review"}
						</button>
					)}
				</div>

					{review.status === "completed" && (
						<Collapsible
							open={showSuggestions}
							onOpenChange={setShowSuggestions}
						>
							<CollapsibleTrigger asChild>
								<Button variant="outline" className="w-full gap-2">
									<Sparkles className="h-4 w-4" />
									Show Inline Suggestions
									{showSuggestions ? (
										<ChevronDown className="h-4 w-4 ml-auto" />
									) : (
										<ChevronRight className="h-4 w-4 ml-auto" />
									)}
								</Button>
							</CollapsibleTrigger>
							<CollapsibleContent>
								<div className="mt-3 p-4 rounded-lg border bg-card">
									<Tabs defaultValue="list" className="w-full space-y-4">
										<TabsList className="grid w-full grid-cols-2">
											<TabsTrigger value="list">List View</TabsTrigger>
											<TabsTrigger value="visual">Visual Graph View</TabsTrigger>
										</TabsList>
										<TabsContent value="list" className="space-y-4">
											<InlineSuggestions review={review} />
										</TabsContent>
										<TabsContent value="visual" className="space-y-4">
											<ReviewFlowCanvas review={review} />
										</TabsContent>
									</Tabs>
								</div>
							</CollapsibleContent>
						</Collapsible>
					)}

					<ReviewFeedback reviewId={review.id} />
					<Button variant="outline" asChild>
						<a
							href={review.prUrl}
							target="_blank"
							rel="noopener noreferrer"
						>
							View Full Review on GitHub
						</a>
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

export default function ReviewsPageClient() {
	const { data: reviews, isLoading } = useQuery({
		queryKey: ["reviews"],
		queryFn: async () => {
			return await getReviews();
		},
		refetchInterval: (query) => {
			const hasActive = query.state.data?.some(
				(r: any) => r.status === "pending" || r.status === "in_progress"
			);
			return hasActive ? 3000 : false;
		},
	});

	if (isLoading) {
		return (
			<div className="space-y-4">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">
						Review History
					</h1>
					<p className="text-muted-foreground">
						View all AI code reviews
					</p>
				</div>
				<div>
					<div className="animate-pulse space-y-4">
						<div className="h-10 bg-muted rounded" />
						<div className="h-10 bg-muted rounded" />
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div>
				<h1 className="text-3xl font-bold tracking-tight">
					Review History
				</h1>
				<p className="text-muted-foreground">
					View all AI code reviews
				</p>
			</div>

			{reviews?.length === 0 ? (
				<Card>
					<CardContent className="pt-6">
						<div className="text-center py-12">
							<p className="text-muted-foreground">
								No reviews yet. Connect a repository and open a
								PR to get started.
							</p>
						</div>
					</CardContent>
				</Card>
			) : (
				<div className="grid gap-4">
					{reviews?.map((review: any) => (
						<ReviewCard key={review.id} review={review} />
					))}
				</div>
			)}
		</div>
	);
}
