import { Skeleton } from "@/components/ui/skeleton";

/**
 * Repository loading skeleton in the current hairline row-list register
 * (the repository page renders rows, not cards): mono name + badges,
 * a truncated description, a stars/topics line, then the icon + Connect
 * actions on the right.
 */
export function RepositoryRowSkeleton() {
	return (
		<div className="flex items-center gap-4 px-5 py-4">
			<div className="flex-1 min-w-0 space-y-2">
				<div className="flex flex-wrap items-center gap-2">
					<Skeleton className="h-4 w-48" />
					<Skeleton className="h-4 w-16" />
					<Skeleton className="h-4 w-20" />
				</div>
				<Skeleton className="h-3 w-full max-w-lg" />
				<div className="flex items-center gap-3">
					<Skeleton className="h-3 w-12" />
					<Skeleton className="h-3 w-14" />
				</div>
			</div>
			<div className="flex items-center gap-2 shrink-0">
				<Skeleton className="size-9" />
				<Skeleton className="h-9 w-[90px]" />
			</div>
		</div>
	);
}

export function RepositoryListSkeleton({ rows = 5 }: { rows?: number }) {
	return (
		<div className="border border-border">
			{Array.from({ length: rows }).map((_, i) => (
				<div
					key={i}
					className={i !== 0 ? "border-t border-border" : ""}
				>
					<RepositoryRowSkeleton />
				</div>
			))}
		</div>
	);
}
