/**
 * Shared editorial page header.
 *
 * The canonical "mono kicker → Fraunces headline → Geist body" block used at
 * the top of every dashboard page (see DESIGN.md → Components). One source of
 * truth for the pattern so a page can't silently drift off-register.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
	/** Mono uppercase eyebrow, e.g. "Overview", "Billing", "Source control". */
	kicker: string;
	/** The page headline. */
	title: ReactNode;
	/** One-line supporting copy under the headline. */
	description?: ReactNode;
	/** Optional "back to list" link rendered above the kicker. */
	backLink?: { href: string; label: string };
	className?: string;
}

export function PageHeader({
	kicker,
	title,
	description,
	backLink,
	className,
}: PageHeaderProps) {
	return (
		<div className={className}>
			{backLink && (
				<Link
					href={backLink.href}
					className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
				>
					<ArrowLeft className="h-3.5 w-3.5" />
					{backLink.label}
				</Link>
			)}
			<p
				className={cn(
					"font-mono text-[10px] uppercase tracking-[0.2em] text-brand-text",
					backLink ? "mt-4 mb-2" : "mb-2"
				)}
			>
				{kicker}
			</p>
			<h1 className="font-display text-2xl sm:text-3xl tracking-tight text-foreground">
				{title}
			</h1>
			{description && (
				<p className="mt-2 text-sm text-muted-foreground">{description}</p>
			)}
		</div>
	);
}
