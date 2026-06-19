"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, Trash2, AlertTriangle } from "lucide-react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useState } from "react";

import {
	getConnectedRepositories,
	disconnectRepository,
	disconnectAllRepositories,
} from "../actions";

export function RepositoryList() {
	const queryClient = useQueryClient();

	const [disconnectAllOpen, setDisconnectAllOpen] = useState(false);

	const { data: repositories, isLoading } = useQuery({
		queryKey: ["connected-repositories"],
		queryFn: async () => await getConnectedRepositories(),
		staleTime: 2 * 60 * 1000, // 2 minutes
		refetchOnWindowFocus: false,
	});

	const disconnectMutation = useMutation({
		mutationFn: async (repositoryId: string) => {
			return await disconnectRepository(repositoryId);
		},
		onSuccess: (result) => {
			if (result.success) {
				queryClient.invalidateQueries({
					queryKey: ["connected-repositories"],
				});
				queryClient.invalidateQueries({
					queryKey: ["dashboard-stats"],
				});
				queryClient.invalidateQueries({
					queryKey: ["reviews"],
				});
				queryClient.invalidateQueries({
					queryKey: ["subscription-data"],
				});
				toast.success("Repository disconnected successfully");
			} else {
				toast.error(result?.error || "Failed to disconnect repository");
			}
		},
		onError: (error: any) => {
			console.error("Failed to disconnect repository:", error);
			toast.error("Failed to disconnect repository");
		},
	});

	const disconnectAllMutation = useMutation({
		mutationFn: async () => {
			return await disconnectAllRepositories();
		},
		onSuccess: (result) => {
			if (result?.success) {
				queryClient.invalidateQueries({
					queryKey: ["connected-repositories"],
				});
				queryClient.invalidateQueries({
					queryKey: ["dashboard-stats"],
				});
				queryClient.invalidateQueries({
					queryKey: ["reviews"],
				});
				queryClient.invalidateQueries({
					queryKey: ["subscription-data"],
				});
				toast.success(
					`Disconnected ${
						result?.count || 0
					} repositories successfully`
				);
				setDisconnectAllOpen(false);
			} else {
				toast.error(
					result?.error || "Failed to disconnect repositories"
				);
			}
		},
		onError: (error: any) => {
			console.error("Failed to disconnect repositories:", error);
			toast.error("Failed to disconnect repositories");
		},
	});

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Connected Repositories</CardTitle>
					<CardDescription>
						Manage your connected GitHub repositories
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="animate-pulse space-y-4">
						<div className="h-10 bg-muted rounded" />
						<div className="h-10 bg-muted rounded" />
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle>Connected Repositories</CardTitle>
						<CardDescription>
							Manage your connected GitHub repositories
						</CardDescription>
					</div>
					{repositories && repositories.length > 0 && (
						<AlertDialog
							open={disconnectAllOpen}
							onOpenChange={setDisconnectAllOpen}
						>
							<AlertDialogTrigger asChild>
								<Button variant={"destructive"} size={"sm"}>
									<Trash2 className="h-4 w-4 mr-2" />
									Disconnect All
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle className="flex items-center gap-2">
										<AlertTriangle className="h-5 w-5 text-destructive" />
										Disconnect All Repositories?
									</AlertDialogTitle>
									<AlertDialogDescription>
										This will disconnect all{" "}
										{repositories.length} repositories and
										delete all associated AI reviews. This
										action cannot be undone.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>
										Cancel
									</AlertDialogCancel>
									<AlertDialogAction
										onClick={() =>
											disconnectAllMutation.mutate()
										}
										className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
										disabled={
											disconnectAllMutation.isPending
										}
									>
										{disconnectAllMutation.isPending
											? "Disconnecting..."
											: "Disconnect All"}
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					)}
				</div>
			</CardHeader>
			<CardContent>
				{!repositories || repositories.length === 0 ? (
					<div className="text-muted-foreground text-center py-4">
						<p>No repositories connected.</p>
						<p className="text-sm mt-2">
							Connect your GitHub repositories to enable
							AI-powered code reviews from repository page.
						</p>
					</div>
				) : (
					<div className="space-y-4">
						{repositories.map((repo) => (
							<div
								key={repo.id}
								className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
							>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2">
										<h3 className="font-medium truncate">
											{repo.fullName}
										</h3>
										<a
											href={repo.url}
											target="_blank"
											rel="noopener noreferrer"
											className="text-muted-foreground hover:text-foreground"
										>
											<ExternalLink className="h-4 w-4" />
										</a>
									</div>
								</div>

								<AlertDialog>
									<AlertDialogTrigger asChild>
										<Button
											variant={"ghost"}
											size={"sm"}
											className="ml-4 text-destructive hover:text-destructive hover:bg-destructive/10"
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</AlertDialogTrigger>
									<AlertDialogContent>
										<AlertDialogHeader>
											<AlertDialogTitle>
												Disconnect Repository
											</AlertDialogTitle>
											<AlertDialogDescription>
												This will disconnect{" "}
												<strong>{repo.fullName}</strong>{" "}
												and delete all associated AI
												reviews. This action cannot be
												undone.
											</AlertDialogDescription>
										</AlertDialogHeader>
										<AlertDialogFooter>
											<AlertDialogCancel>
												Cancel
											</AlertDialogCancel>
											<AlertDialogAction
												onClick={() =>
													disconnectMutation.mutate(
														repo.id
													)
												}
												className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
												disabled={
													disconnectMutation.isPending
												}
											>
												{disconnectMutation.isPending
													? "Disconnecting..."
													: "Disconnect"}
											</AlertDialogAction>
										</AlertDialogFooter>
									</AlertDialogContent>
								</AlertDialog>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
