/**
 * Review card — the full presentation of a single AI code review.
 *
 * Shared by the reviews list page and the review detail page
 * (/dashboard/reviews/[id]): status badges, truncated/full markdown body,
 * collapsible inline suggestions with list/visual-graph tabs, GitHub links,
 * and feedback.
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
import { formatDistanceToNow } from "date-fns";
import InlineSuggestions from "@/modules/review/components/inline-suggestions";
import ReviewFeedback from "@/modules/review/components/review-feedback";
import ReviewFlowCanvas from "@/modules/review/components/review-flow-canvas";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageResponse } from "@/components/ai-elements/message";
import { useTheme } from "next-themes";
import type { ReviewWithRepository } from "@/modules/review/types";

export function ReviewCard({
	review,
}: {
	review: ReviewWithRepository;
}) {
	const { resolvedTheme } = useTheme();
	const [showSuggestions, setShowSuggestions] = useState(false);
	const [showFullReview, setShowFullReview] = useState(false);

	return (
		<Card className="hover:border-brand/50 transition-colors overflow-hidden">
			<CardHeader>
				<div className="flex flex-col gap-3">
					<div className="space-y-2 flex-1 min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							<CardTitle className="text-lg min-w-0 truncate text-balance">
								{review.prTitle}
							</CardTitle>
							{review.status === "completed" && (
								<Badge variant="default" className="gap-1 shrink-0">
									<CheckCircle2 className="h-3 w-3" />
									Completed
								</Badge>
							)}
							{review.status === "failed" && (
								<Badge variant="destructive" className="gap-1 shrink-0">
									<XCircle className="h-3 w-3" />
									Failed
								</Badge>
							)}
							{review.status === "pending" && (
								<Badge variant="secondary" className="gap-1 shrink-0">
									<Clock className="h-3 w-3" />
									Pending
								</Badge>
							)}
						</div>
						<CardDescription className="truncate">
							{review.repository.fullName} ⋅ PR #{review.prNumber}
						</CardDescription>
					</div>

					<Button variant="ghost" size="icon" asChild className="self-end shrink-0">
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
					<div className="bg-card border border-border p-4 sm:p-6 overflow-x-auto">
						<div className="prose prose-sm dark:prose-invert max-w-none overflow-hidden break-words min-w-0">
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
								<div className="mt-3 p-3 sm:p-4 rounded-lg border bg-card">
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
				</div>
			</CardContent>
		</Card>
	);
}
