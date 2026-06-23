/**
 * Inline code suggestions component for AI code reviews.
 *
 * Displays parsed suggestions with severity badges, file paths,
 * line ranges, and side-by-side code diffs.
 *
 * @component
 */
"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	AlertTriangle,
	Info,
	Lightbulb,
	AlertCircle,
	ChevronDown,
	ChevronRight,
	FileCode2,
	Check,
	Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
	parseSuggestionsFromReview,
	type CodeSuggestion,
	type ReviewSuggestions,
} from "@/modules/ai/lib/suggestions";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { useQueryClient } from "@tanstack/react-query";
import { applySuggestion, applySuggestionsBatch } from "@/modules/review/actions";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

const SEVERITY_CONFIG: Record<
	CodeSuggestion["severity"],
	{ label: string; icon: React.ElementType; className: string }
> = {
	error: {
		label: "Error",
		icon: AlertCircle,
		className:
			"border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400",
	},
	warning: {
		label: "Warning",
		icon: AlertTriangle,
		className:
			"border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
	},
	info: {
		label: "Info",
		icon: Info,
		className:
			"border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-400",
	},
	suggestion: {
		label: "Suggestion",
		icon: Lightbulb,
		className:
			"border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
	},
};

function SeverityBadge({ severity }: { severity: CodeSuggestion["severity"] }) {
	const config = SEVERITY_CONFIG[severity];
	const Icon = config.icon;

	return (
		<Badge variant="outline" className={cn("gap-1", config.className)}>
			<Icon className="h-3 w-3" />
			{config.label}
		</Badge>
	);
}

function CodeDiff({
	original,
	suggested,
}: {
	original: string;
	suggested: string;
}) {
	if (!original && !suggested) return null;

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
			{original && (
				<div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 overflow-x-auto">
					<div className="text-[10px] uppercase tracking-wider text-red-500/70 mb-1.5 font-sans font-medium">
						Original
					</div>
					<pre className="whitespace-pre-wrap text-red-600 dark:text-red-400">
						{original}
					</pre>
				</div>
			)}
			{suggested && (
				<div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 overflow-x-auto">
					<div className="text-[10px] uppercase tracking-wider text-emerald-500/70 mb-1.5 font-sans font-medium">
						Suggested
					</div>
					<pre className="whitespace-pre-wrap text-emerald-600 dark:text-emerald-400">
						{suggested}
					</pre>
				</div>
			)}
		</div>
	);
}

function SuggestionCard({
	suggestion,
	reviewId,
	onApply,
}: {
	suggestion: CodeSuggestion;
	reviewId: string;
	onApply: () => void;
}) {
	const [open, setOpen] = useState(false);
	const [applying, setApplying] = useState(false);

	const handleApply = async () => {
		setApplying(true);
		try {
			const res = await applySuggestion(reviewId, suggestion.id);
			if (res.success) {
				toast.success("Suggestion successfully applied and committed to GitHub!");
				onApply();
			} else {
				toast.error("Failed to apply suggestion");
			}
		} catch (err) {
			console.error("Failed to apply suggestion:", err);
			toast.error(err instanceof Error ? err.message : "Failed to apply suggestion");
		} finally {
			setApplying(false);
		}
	};

	return (
		<Collapsible open={open} onOpenChange={setOpen}>
			<CollapsibleTrigger asChild>
				<button
					className={cn(
						"w-full text-left flex items-start gap-3 p-3 rounded-lg border transition-colors",
						"hover:bg-muted/50",
						open ? "bg-muted/30" : "bg-transparent"
					)}
				>
					{open ? (
						<ChevronDown className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
					) : (
						<ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
					)}
					<div className="flex-1 min-w-0 space-y-1.5">
						<div className="flex items-center gap-2 flex-wrap">
							<SeverityBadge severity={suggestion.severity} />
							{suggestion.verified === true && (
								<Badge variant="outline" className="border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 gap-1 text-[10px] py-0 h-5">
									<Check className="h-3 w-3" />
									Verified Fix
								</Badge>
							)}
							{suggestion.verified === false && (
								<Badge variant="outline" className="border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400 gap-1 text-[10px] py-0 h-5">
									<AlertCircle className="h-3 w-3" />
									Test Failed
								</Badge>
							)}
							{suggestion.applied && (
								<Badge variant="outline" className="border-emerald-500/50 bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 gap-1 text-[10px] font-semibold py-0 h-5">
									<Check className="h-3 w-3 stroke-[2.5]" />
									Applied
								</Badge>
							)}
							<span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
								<FileCode2 className="h-3 w-3" />
								{suggestion.filePath}
								{suggestion.startLine > 0 && (
									<span>
										L{suggestion.startLine}
										{suggestion.endLine !== suggestion.startLine &&
											`-${suggestion.endLine}`}
									</span>
								)}
							</span>
						</div>
						<p className="text-sm font-medium leading-none">
							{suggestion.title}
						</p>
					</div>
				</button>
			</CollapsibleTrigger>
			<CollapsibleContent>
				<Message from="assistant" className="max-w-full ml-7 mt-2">
					<MessageContent className="w-full">
						<div className="space-y-3">
							{suggestion.description && (
								<p className="text-sm text-muted-foreground">
									{suggestion.description}
								</p>
							)}
							{suggestion.category && (
								<Badge variant="secondary" className="text-[10px]">
									{suggestion.category}
								</Badge>
							)}
							<CodeDiff
								original={suggestion.originalCode}
								suggested={suggestion.suggestedCode}
							/>
							{suggestion.verified === false && suggestion.verificationLog && (
								<div className="rounded-md border border-red-500/20 bg-red-500/5 p-3 overflow-x-auto mt-2">
									<div className="text-[10px] uppercase tracking-wider text-red-500/70 mb-1.5 font-sans font-medium">
										Verification Logs (Test Failures)
									</div>
									<pre className="whitespace-pre-wrap text-xs text-red-600 dark:text-red-400 font-mono">
										{suggestion.verificationLog}
									</pre>
								</div>
							)}
							
							{/* Apply Suggestion Button Row */}
							{suggestion.suggestedCode && (
								<div className="flex items-center justify-end pt-3 border-t border-border/60">
									{suggestion.applied ? (
										<Button variant="outline" disabled className="gap-2 text-emerald-600 border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/5 cursor-default">
											<Check className="h-4 w-4 stroke-[3]" />
											Applied on GitHub
										</Button>
									) : (
										<Button
											variant="default"
											className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition-all duration-200 shadow-sm"
											disabled={applying}
											onClick={handleApply}
										>
											{applying ? (
												<>
													<Loader2 className="h-3.5 w-3.5 animate-spin" />
													Applying...
												</>
											) : (
												<>
													<Check className="h-3.5 w-3.5 stroke-[2.5]" />
													Apply Suggestion
												</>
											)}
										</Button>
									)}
								</div>
							)}
						</div>
					</MessageContent>
				</Message>
			</CollapsibleContent>
		</Collapsible>
	);
}

function SummaryBar({ summary }: { summary: ReviewSuggestions["summary"] }) {
	if (summary.totalIssues === 0) return null;

	return (
		<div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
			<span className="font-medium">Summary:</span>
			{summary.errors > 0 && (
				<span className="flex items-center gap-1 text-red-600 dark:text-red-400">
					<AlertCircle className="h-3 w-3" />
					{summary.errors} error{summary.errors !== 1 && "s"}
				</span>
			)}
			{summary.warnings > 0 && (
				<span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
					<AlertTriangle className="h-3 w-3" />
					{summary.warnings} warning{summary.warnings !== 1 && "s"}
				</span>
			)}
			{summary.suggestions > 0 && (
				<span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
					<Lightbulb className="h-3 w-3" />
					{summary.suggestions} suggestion
					{summary.suggestions !== 1 && "s"}
				</span>
			)}
		</div>
	);
}

interface InlineSuggestionsProps {
	review: any;
}

export default function InlineSuggestions({
	review,
}: InlineSuggestionsProps) {
	const queryClient = useQueryClient();
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [applyingBatch, setApplyingBatch] = useState(false);

	let parsedSuggestions: CodeSuggestion[] = [];
	let summary = { totalIssues: 0, errors: 0, warnings: 0, suggestions: 0 };

	if (review.suggestions && typeof review.suggestions === "object") {
		const suggestionsData = review.suggestions as any;
		if (Array.isArray(suggestionsData.suggestions)) {
			parsedSuggestions = suggestionsData.suggestions;
		}
		if (suggestionsData.summary) {
			summary = suggestionsData.summary;
		}
	}

	if (parsedSuggestions.length === 0 && review.review) {
		const fallbackParsed = parseSuggestionsFromReview(review.review);
		parsedSuggestions = fallbackParsed.suggestions;
		summary = fallbackParsed.summary;
	}

	const unappliedSuggestions = parsedSuggestions.filter((s) => !s.applied);
	const effectiveSelectedIds = selectedIds.filter((id) =>
		unappliedSuggestions.some((s) => s.id === id)
	);

	const handleApplyCallback = () => {
		queryClient.invalidateQueries({ queryKey: ["reviews"] });
	};

	const handleSelectAll = (checked: any) => {
		if (checked) {
			setSelectedIds(unappliedSuggestions.map((s) => s.id));
		} else {
			setSelectedIds([]);
		}
	};

	const handleApplyBatch = async () => {
		setApplyingBatch(true);
		try {
			const res = await applySuggestionsBatch(review.id, effectiveSelectedIds);
			if (res.success) {
				toast.success(`Successfully applied and committed ${effectiveSelectedIds.length} suggestions to GitHub!`);
				setSelectedIds([]);
				handleApplyCallback();
			} else {
				toast.error("Failed to apply suggestions");
			}
		} catch (err) {
			console.error("Failed to apply batch:", err);
			toast.error(err instanceof Error ? err.message : "Failed to apply suggestions");
		} finally {
			setApplyingBatch(false);
		}
	};

	if (parsedSuggestions.length === 0) {
		return (
			<div className="text-xs text-muted-foreground italic">
				No inline suggestions found in this review.
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-4 flex-wrap bg-muted/40 p-3 rounded-lg border border-border">
				<SummaryBar summary={summary} />
				
				{unappliedSuggestions.length > 0 && (
					<div className="flex items-center gap-3">
						<div className="flex items-center gap-2">
							<Checkbox
								id={`select-all-${review.id}`}
								checked={
									effectiveSelectedIds.length === unappliedSuggestions.length &&
									unappliedSuggestions.length > 0
								}
								onCheckedChange={handleSelectAll}
							/>
							<label
								htmlFor={`select-all-${review.id}`}
								className="text-xs font-medium text-muted-foreground cursor-pointer"
							>
								Select All ({unappliedSuggestions.length})
							</label>
						</div>
						
						{effectiveSelectedIds.length > 0 && (
							<Button
								variant="default"
								size="sm"
								className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-all duration-200"
								disabled={applyingBatch}
								onClick={handleApplyBatch}
							>
								{applyingBatch ? (
									<>
										<Loader2 className="h-3.5 w-3.5 animate-spin" />
										Applying {effectiveSelectedIds.length}...
									</>
								) : (
									<>
										<Check className="h-3.5 w-3.5 stroke-[2.5]" />
										Apply Selected ({effectiveSelectedIds.length})
									</>
								)}
							</Button>
						)}
					</div>
				)}
			</div>

			<div className="space-y-2">
				{parsedSuggestions.map((suggestion) => (
					<div key={suggestion.id} className="flex items-start gap-3">
						{!suggestion.applied && (
							<Checkbox
								checked={effectiveSelectedIds.includes(suggestion.id)}
								onCheckedChange={(checked) => {
									if (checked) {
										setSelectedIds((prev) => [...prev, suggestion.id]);
									} else {
										setSelectedIds((prev) => prev.filter((id) => id !== suggestion.id));
									}
								}}
								className="mt-4 shrink-0"
							/>
						)}
						<div className="flex-1">
							<SuggestionCard
								suggestion={suggestion}
								reviewId={review.id}
								onApply={handleApplyCallback}
							/>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
