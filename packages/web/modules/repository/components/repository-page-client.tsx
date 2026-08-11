"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExternalLink, Star, Search } from "lucide-react";
import { useState, useEffect } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Pagination } from "@/components/ui/pagination";

import { useRepositories } from "@/modules/repository/hooks/use-repositories";
import { RepositoryListSkeleton } from "@/modules/repository/components/repository-skeleton";
import { useConnectRepository } from "@/modules/repository/hooks/use-connect-repository";
import { PageHeader } from "@/components/page-header";

interface Repository {
	id: number;
	name: string;
	full_name: string;
	description: string | null;
	html_url: string;
	stargazers_count: number;
	language: string | null;
	topics: string[];
	isConnected?: boolean;
}

const RepositoryPageClient = () => {
	const {
		data,
		isLoading,
		isError,
		refetch,
		page,
		totalPages,
		goToPage,
		isFetching,
	} = useRepositories();

	const { mutate: connectRepo } = useConnectRepository();

	const [localConnectingId, setLocalConnectingId] = useState<number | null>(
		null
	);
	const [searchQuery, setSearchQuery] = useState("");

	// Search filters the current page only, so always start from page 1 when
	// the query changes (matches may exist on later pages).
	useEffect(() => {
		goToPage(1);
	}, [searchQuery, goToPage]);

	const allRepositories = data || [];

	const filteredRepositories = allRepositories.filter(
		(repo: Repository) =>
			repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			repo.full_name.toLowerCase().includes(searchQuery.toLowerCase())
	);

	const handleConnect = (repo: Repository) => {
		setLocalConnectingId(repo.id);
		connectRepo(
			{
				owner: repo.full_name.split("/")[0],
				repo: repo.name,
				githubId: repo.id,
			},
			{
				onSettled: () => setLocalConnectingId(null),
			}
		);
	};

	if (isLoading) {
		return (
			<div className="space-y-4">
				<PageHeader
					kicker="Source control"
					title="Repositories"
					description="Manage and view all your GitHub repositories"
				/>
				<RepositoryListSkeleton />
			</div>
		);
	}

	if (isError) {
		return (
			<div className="space-y-4">
				<PageHeader
					kicker="Source control"
					title="Repositories"
					description="Manage and view all your GitHub repositories"
				/>
				<ErrorState
					title="Couldn't load repositories"
					description="Your GitHub repositories couldn't be fetched. Check your connection and try again."
					onRetry={() => refetch()}
				/>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<PageHeader
				kicker="Source control"
				title="Repositories"
				description="Manage and view all your GitHub repositories"
			/>

			<div className="relative">
				<Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
				<Input
					placeholder="Search repositories..."
					className="pl-8"
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
				/>
			</div>

			{allRepositories.length === 0 ? (
				<EmptyState
					kicker="Repositories"
					title="No repositories found"
					description="Connect your GitHub account to browse and connect repositories for AI review."
				/>
			) : filteredRepositories.length === 0 ? (
				<EmptyState
					kicker="Search"
					title="No matching repositories"
					description={`Nothing matches \u201c${searchQuery}\u201d. Try a different search term.`}
				/>
			) : (
			<div className="border border-border">
				{filteredRepositories.map((repo: Repository, idx: number) => (
					<div
						key={repo.id}
						className={`group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/40 ${
							idx !== 0 ? "border-t border-border" : ""
						}`}
					>
						{/* left: name + meta */}
						<div className="flex-1 min-w-0">
							<div className="flex flex-wrap items-center gap-2">
								<span className="font-mono text-sm font-medium text-foreground truncate">
									{repo.full_name}
								</span>
								{repo.language && (
									<Badge variant="outline" className="shrink-0">
										{repo.language}
									</Badge>
								)}
								{repo.isConnected && (
									<Badge variant="secondary" className="shrink-0">
										Connected
									</Badge>
								)}
							</div>
							{repo.description && (
								<p className="mt-0.5 text-xs text-muted-foreground truncate max-w-lg">
									{repo.description}
								</p>
							)}
							<div className="mt-1 flex items-center gap-3">
								<span className="flex items-center gap-1 text-xs text-muted-foreground">
									<Star className="h-3 w-3" />
									{repo.stargazers_count}
								</span>
								{repo.topics?.slice(0, 3).map((topic: string) => (
									<Badge key={topic} variant="outline" className="text-[10px] px-1.5 py-0">
										{topic}
									</Badge>
								))}
							</div>
						</div>

						{/* right: actions */}
						<div className="flex items-center gap-2 shrink-0">
							<Button variant="ghost" size="icon" asChild>
								<a
									href={repo.html_url}
									target="_blank"
									rel="noopener noreferrer"
									aria-label={`Open ${repo.full_name} on GitHub`}
								>
									<ExternalLink className="h-4 w-4" />
								</a>
							</Button>
							<Button
								size="sm"
								onClick={() => handleConnect(repo)}
								disabled={localConnectingId === repo.id || repo.isConnected}
								variant={repo.isConnected ? "ghost" : "default"}
								className="rounded-none min-w-[90px]"
							>
								{localConnectingId === repo.id
									? "Connecting…"
									: repo.isConnected
									? "Connected"
									: "Connect"}
							</Button>
						</div>
					</div>
				))}
			</div>
			)}

			{allRepositories.length > 0 && totalPages > 1 && (
				<Pagination
					page={page}
					totalPages={totalPages}
					onPageChange={goToPage}
					isFetching={isFetching}
					className="mt-2"
				/>
			)}
		</div>
	);
};

export default RepositoryPageClient;
