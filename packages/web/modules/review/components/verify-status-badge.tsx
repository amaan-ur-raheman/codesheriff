"use client";

import { Badge } from "@/components/ui/badge";
import { Check, AlertCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
	VERIFY_STATUS_META,
	resolveVerifyStatus,
	type VerifyStatusView,
} from "@/modules/review/lib/verify-status";
import type { CodeSuggestion } from "@/modules/ai/lib/suggestions";

const ICONS: Record<VerifyStatusView, React.ElementType> = {
	verified: Check,
	failed: AlertCircle,
	sandbox_error: AlertTriangle,
	neutral: Check,
};

/**
 * Renders the sandbox verify outcome for a suggestion. Neutral suggestions
 * (never checked, or posted unlabeled after a sandbox outage) render nothing.
 */
export function VerifyStatusBadge({ suggestion }: { suggestion: CodeSuggestion }) {
	const status = resolveVerifyStatus(suggestion);
	if (status === "neutral") return null;

	const meta = VERIFY_STATUS_META[status];
	const Icon = ICONS[status];

	return (
		<Badge
			variant="outline"
			className={cn("gap-1 text-[10px] py-0 h-5", meta.badgeClassName)}
		>
			<Icon className="h-3 w-3" />
			{meta.label}
		</Badge>
	);
}
