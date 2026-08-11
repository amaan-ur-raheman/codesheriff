import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shared pagination control in the Editorial Paper register: sharp corners,
 * hairline-bordered outline buttons, mono page numbers.
 *
 * Two modes:
 * - `totalPages` provided (e.g. Settings connected repos): renders a numbered
 *   page window with ellipsis.
 * - `totalPages` omitted (e.g. the repository page, where GitHub exposes no
 *   total count): renders a "Page N" label with Prev/Next, Next disabled
 *   until `hasNextPage` turns false.
 *
 * Server-compatible: no hooks, purely presentational.
 */
export interface PaginationProps {
	page: number;
	/** Only required in label mode (no `totalPages`), where Next has to be
	 * disabled manually from the caller once the last page is reached. */
	hasNextPage?: boolean;
	onPageChange: (page: number) => void;
	/** Total page count when known; omit to render the label mode. */
	totalPages?: number;
	/** Disables the controls while a page is being fetched. */
	isFetching?: boolean;
	className?: string;
}

/** Numbered page list with ellipsis for large ranges. */
function buildPageList(
	current: number,
	total: number
): Array<number | "ellipsis"> {
	if (total <= 7) {
		return Array.from({ length: total }, (_, i) => i + 1);
	}

	const candidates = new Set(
		[1, 2, total - 1, total, current - 1, current, current + 1].filter(
			(p) => p >= 1 && p <= total
		)
	);
	const sorted = [...candidates].sort((a, b) => a - b);

	const out: Array<number | "ellipsis"> = [];
	let prev = 0;
	for (const p of sorted) {
		if (p - prev > 1) out.push("ellipsis");
		out.push(p);
		prev = p;
	}
	return out;
}

export function Pagination({
	page,
	hasNextPage,
	onPageChange,
	totalPages,
	isFetching = false,
	className,
}: PaginationProps) {
	const canGoPrev = page > 1 && !isFetching;
	const canGoNext =
		(totalPages ? page < totalPages : !!hasNextPage) && !isFetching;

	return (
		<nav
			aria-label="Pagination"
			className={cn(
				"flex items-center justify-between gap-2 border-t border-border pt-4",
				className
			)}
		>
			<Button
				variant="outline"
				size="sm"
				onClick={() => onPageChange(page - 1)}
				disabled={!canGoPrev}
			>
				<ChevronLeft className="h-4 w-4" />
				Previous
			</Button>

			{totalPages ? (
				<div className="flex items-center gap-1">
					{buildPageList(page, totalPages).map((p, i) =>
						p === "ellipsis" ? (
							<span
								key={`ellipsis-${i}`}
								className="px-1 font-mono text-xs text-muted-foreground"
							>
								…
							</span>
						) : (
							<Button
								key={p}
								variant={p === page ? "default" : "outline"}
								size="sm"
								className="min-w-9 px-2 font-mono text-xs tabular-nums"
								onClick={() => onPageChange(p)}
								disabled={isFetching}
								aria-current={p === page ? "page" : undefined}
							>
								{p}
							</Button>
						)
					)}
				</div>
			) : (
				<p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
					Page {page}
				</p>
			)}

			<Button
				variant="outline"
				size="sm"
				onClick={() => onPageChange(page + 1)}
				disabled={!canGoNext}
			>
				Next
				<ChevronRight className="h-4 w-4" />
			</Button>
		</nav>
	);
}
