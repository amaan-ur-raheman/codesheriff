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
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
	parseSuggestionsFromReview,
	type CodeSuggestion,
	type ReviewSuggestions,
} from "@/modules/ai/lib/suggestions";
import { Message, MessageContent } from "@/components/ai-elements/message";

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

function SuggestionCard({ suggestion }: { suggestion: CodeSuggestion }) {
	const [open, setOpen] = useState(false);

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
	reviewText: string;
}

export default function InlineSuggestions({
	reviewText,
}: InlineSuggestionsProps) {
	const parsed = parseSuggestionsFromReview(reviewText);

	if (parsed.suggestions.length === 0) {
		return (
			<div className="text-xs text-muted-foreground italic">
				No inline suggestions found in this review.
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<SummaryBar summary={parsed.summary} />
			<div className="space-y-1">
				{parsed.suggestions.map((suggestion) => (
					<SuggestionCard key={suggestion.id} suggestion={suggestion} />
				))}
			</div>
		</div>
	);
}
