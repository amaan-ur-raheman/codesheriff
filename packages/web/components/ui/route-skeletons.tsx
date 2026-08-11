/**
 * Route-level loading skeleton primitives for dashboard pages.
 *
 * Next.js renders a route's `loading.tsx` while its RSC payload streams in —
 * the gap between clicking a sidebar link and the client component mounting.
 * These primitives mirror the real page layouts (header, stat grids, cards,
 * tables, charts) using the Editorial Paper skeleton language
 * (`skeleton-sweep`, the quiet accent sweep from globals.css), so navigation
 * never lands on a bare spinner or a layout jump.
 *
 * Plain server-compatible components: no hooks, no "use client".
 */
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Header placeholder matching PageHeader's canonical block:
 * mono kicker → Fraunces headline → Geist body.
 */
export function PageHeaderSkeleton({
	backLink = false,
	className,
}: {
	/** Render a "back to list" link line above the kicker (detail pages). */
	backLink?: boolean;
	className?: string;
}) {
	return (
		<div className={className}>
			{backLink && <Skeleton className="mb-4 h-3.5 w-24" />}
			<Skeleton className="mb-2 h-2.5 w-14" />
			<Skeleton className="h-8 w-56 max-w-full" />
			<Skeleton className="mt-3 h-4 w-96 max-w-full" />
		</div>
	);
}

/** One stat card placeholder: title row + big display number + caption. */
export function StatCardSkeleton() {
	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<Skeleton className="h-4 w-24" />
				<Skeleton className="size-4" />
			</CardHeader>
			<CardContent>
				<Skeleton className="h-8 w-14" />
				<Skeleton className="mt-2 h-3 w-20" />
			</CardContent>
		</Card>
	);
}

/** Grid of stat cards — defaults to the dashboard's 4-up layout. */
export function StatGridSkeleton({
	count = 4,
	className,
}: {
	count?: number;
	className?: string;
}) {
	return (
		<div className={cn("grid gap-4 md:grid-cols-4", className)}>
			{Array.from({ length: count }).map((_, i) => (
				<StatCardSkeleton key={i} />
			))}
		</div>
	);
}

/**
 * Generic card placeholder: header title lines + body lines, with optional
 * custom content (charts, tables) rendered after the body lines.
 */
export function CardSkeleton({
	titleLines = 1,
	bodyLines = 2,
	className,
	children,
}: {
	titleLines?: number;
	bodyLines?: number;
	className?: string;
	children?: ReactNode;
}) {
	return (
		<Card className={className}>
			<CardHeader className="space-y-2">
				{Array.from({ length: titleLines }).map((_, i) => (
					<Skeleton
						key={i}
						className={cn("h-5", i === 0 ? "w-1/3" : "w-1/4")}
					/>
				))}
			</CardHeader>
			<CardContent className="space-y-3">
				{Array.from({ length: bodyLines }).map((_, i) => (
					<Skeleton key={i} className="h-4 w-full" />
				))}
				{children}
			</CardContent>
		</Card>
	);
}

/** Stacked table rows (admin Recent Users / Recent Reviews placeholders). */
export function TableSkeleton({
	rows = 5,
	className,
}: {
	rows?: number;
	className?: string;
}) {
	return (
		<div className={cn("space-y-2 py-4", className)}>
			{Array.from({ length: rows }).map((_, i) => (
				<Skeleton key={i} className="h-8 w-full" />
			))}
		</div>
	);
}

/** Bar-chart placeholder — pseudo-random bar heights like the real charts. */
export function ChartBarsSkeleton({
	bars = 12,
	height = "h-80",
	className,
}: {
	bars?: number;
	height?: string;
	className?: string;
}) {
	return (
		<div className={cn("flex w-full items-end gap-2 px-2 pb-1", height, className)}>
			{Array.from({ length: bars }).map((_, i) => (
				<Skeleton
					key={i}
					className="flex-1"
					style={{ height: `${28 + ((i * 37) % 56)}%` }}
				/>
			))}
		</div>
	);
}

/** Contribution-calendar placeholder — a compact grid of paper squares.
 * Sizes itself naturally (7 rows) so there's no dead space before the next
 * section. */
export function CalendarSkeleton({ className }: { className?: string }) {
	return (
		<div
			className={cn(
				"grid grid-flow-col grid-rows-7 gap-1 overflow-hidden",
				className
			)}
		>
			{Array.from({ length: 98 }).map((_, i) => (
				<Skeleton key={i} className="size-3.5" />
			))}
		</div>
	);
}
