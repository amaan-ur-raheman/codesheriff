"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GitPullRequestArrow, SearchIcon, SquareArrowOutUpRight } from "lucide-react";

import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@/components/ui/command";
import { globalSearch, type SearchResult } from "../actions";

export function CommandPalette() {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<SearchResult[]>([]);
	const [loading, setLoading] = useState(false);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				setOpen((prev) => !prev);
			}
		};

		document.addEventListener("keydown", down);
		return () => document.removeEventListener("keydown", down);
	}, []);

	const search = useCallback(async (term: string) => {
		if (!term.trim()) {
			setResults([]);
			setLoading(false);
			return;
		}

		setLoading(true);
		try {
			const data = await globalSearch(term);
			setResults(data);
		} catch {
			setResults([]);
		} finally {
			setLoading(false);
		}
	}, []);

	const handleQueryChange = useCallback(
		(value: string) => {
			setQuery(value);

			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}

			debounceRef.current = setTimeout(() => {
				search(value);
			}, 300);
		},
		[search]
	);

	const handleSelect = useCallback(
		(url: string) => {
			setOpen(false);
			setQuery("");
			setResults([]);
			router.push(url);
		},
		[router]
	);

	useEffect(() => {
		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
		};
	}, []);

	const repositories = results.filter((r) => r.type === "repository");
	const reviews = results.filter((r) => r.type === "review");

	return (
		<CommandDialog
			open={open}
			onOpenChange={setOpen}
			title="Global Search"
			description="Search repositories and reviews"
		>
			<CommandInput
				placeholder="Search repositories, reviews..."
				value={query}
				onValueChange={handleQueryChange}
			/>
			<CommandList>
				{loading && (
					<div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
						<SearchIcon className="mr-2 h-4 w-4 animate-spin" />
						Searching...
					</div>
				)}

				{!loading && query.trim() && results.length === 0 && (
					<CommandEmpty>
						<div className="flex flex-col items-center gap-2 py-4">
							<SearchIcon className="h-8 w-8 text-muted-foreground/50" />
							<p>No results found for &quot;{query}&quot;</p>
						</div>
					</CommandEmpty>
				)}

				{!loading && repositories.length > 0 && (
					<CommandGroup heading="Repositories">
						{repositories.map((result, i) => (
							<CommandItem
								key={`repo-${i}`}
								value={`repository-${result.title}`}
								onSelect={() => handleSelect(result.url)}
							>
								<GitPullRequestArrow className="mr-2 h-4 w-4 shrink-0" />
								<div className="flex flex-col min-w-0">
									<span className="truncate font-medium">
										{result.title}
									</span>
									<span className="truncate text-xs text-muted-foreground">
										{result.description}
									</span>
								</div>
								<SquareArrowOutUpRight className="ml-auto h-3 w-3 shrink-0 opacity-50" />
							</CommandItem>
						))}
					</CommandGroup>
				)}

				{!loading && repositories.length > 0 && reviews.length > 0 && (
					<CommandSeparator />
				)}

				{!loading && reviews.length > 0 && (
					<CommandGroup heading="Reviews">
						{reviews.map((result, i) => (
							<CommandItem
								key={`review-${i}`}
								value={`review-${result.title}`}
								onSelect={() => handleSelect(result.url)}
							>
								<GitPullRequestArrow className="mr-2 h-4 w-4 shrink-0" />
								<div className="flex flex-col min-w-0">
									<span className="truncate font-medium">
										{result.title}
									</span>
									<span className="truncate text-xs text-muted-foreground capitalize">
										{result.description}
									</span>
								</div>
								<SquareArrowOutUpRight className="ml-auto h-3 w-3 shrink-0 opacity-50" />
							</CommandItem>
						))}
					</CommandGroup>
				)}

				{!loading && results.length === 0 && !query.trim() && (
					<div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
						<SearchIcon className="h-8 w-8" />
						<p className="text-sm">Type to search repositories and reviews</p>
						<p className="text-xs text-muted-foreground/70">
							Press <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">Esc</kbd> to close
						</p>
					</div>
				)}
			</CommandList>
		</CommandDialog>
	);
}
