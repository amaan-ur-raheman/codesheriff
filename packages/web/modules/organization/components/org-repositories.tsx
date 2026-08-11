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
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { useRepositories } from "@/modules/repository/hooks/use-repositories";
import { useConnectRepository } from "@/modules/repository/hooks/use-connect-repository";
import { RepositoryListSkeleton } from "@/modules/repository/components/repository-skeleton";

interface OrgRepositoriesProps {
	orgId: string;
	orgName: string;
}

interface Repository {
	id: number;
	name: string;
	full_name: string;
	description: string | null;
	html_url: string;
	language: string | null;
	isConnected?: boolean;
}

export default function OrgRepositories({
	orgId,
	orgName,
}: OrgRepositoriesProps) {
	const { data, isLoading } = useRepositories();
	const { mutate: connectRepo } = useConnectRepository();

	const [localConnectingId, setLocalConnectingId] = useState<number | null>(
		null
	);
	const [searchQuery, setSearchQuery] = useState("");

	const allRepositories = data?.pages.flatMap((page) => page) || [];

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
				orgId,
			},
			{
				onSettled: () => setLocalConnectingId(null),
			}
		);
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="font-display text-lg tracking-tight">Repositories: {orgName}</CardTitle>
						<CardDescription>
							Connect repositories to this organization so review
							events are delivered to its Slack and Discord
							integrations
						</CardDescription>
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="relative">
					<Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search repositories..."
						className="pl-8"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
				</div>

				{isLoading ? (
					<RepositoryListSkeleton />
				) : filteredRepositories.length === 0 ? (
					<EmptyState
						kicker="Repositories"
						title="No repositories found"
						description="Connect your GitHub account to browse repositories for this organization."
					/>
				) : (
					<div className="space-y-3">
						{filteredRepositories.map((repo: any) => (
							<div
								key={repo.id}
								className="flex items-center justify-between p-3 border border-border"
							>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2">
										<p className="font-medium truncate">
											{repo.name}
										</p>
										{repo.language && (
											<Badge variant="outline">
												{repo.language}
											</Badge>
										)}
										{repo.isConnected && (
											<Badge variant="secondary">
												Connected
											</Badge>
										)}
									</div>
									<p className="text-sm text-muted-foreground truncate">
										{repo.description || repo.full_name}
									</p>
								</div>
								<Button
									onClick={() => handleConnect(repo)}
									disabled={
										localConnectingId === repo.id ||
										repo.isConnected
									}
									variant={
										repo.isConnected ? "ghost" : "default"
									}
									className="ml-3 shrink-0"
								>
									{localConnectingId === repo.id
										? "Connecting..."
										: repo.isConnected
										? "Connected"
										: "Connect"}
								</Button>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
