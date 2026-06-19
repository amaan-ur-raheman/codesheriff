"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiKeys, createApiKey, deleteApiKey } from "../actions/api-keys";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import { Key, Plus, Trash2, Copy, Check, Loader2 } from "lucide-react";
import { useState } from "react";

export function ApiKeysManager() {
	const queryClient = useQueryClient();
	const [createOpen, setCreateOpen] = useState(false);
	const [newKeyName, setNewKeyName] = useState("");
	const [createdKey, setCreatedKey] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [deleteId, setDeleteId] = useState<string | null>(null);

	const { data: keys, isLoading } = useQuery({
		queryKey: ["api-keys"],
		queryFn: getApiKeys,
	});

	const createMutation = useMutation({
		mutationFn: (name: string) => createApiKey(name),
		onSuccess: (result) => {
			setCreatedKey(result.key);
			queryClient.invalidateQueries({ queryKey: ["api-keys"] });
			toast.success("API key created successfully");
		},
		onError: () => {
			toast.error("Failed to create API key");
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (keyId: string) => deleteApiKey(keyId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["api-keys"] });
			toast.success("API key deleted");
			setDeleteId(null);
		},
		onError: () => {
			toast.error("Failed to delete API key");
		},
	});

	const handleCreate = () => {
		if (!newKeyName.trim()) return;
		createMutation.mutate(newKeyName.trim());
	};

	const handleCopy = () => {
		if (createdKey) {
			navigator.clipboard.writeText(createdKey);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	const handleDialogClose = () => {
		setCreateOpen(false);
		setNewKeyName("");
		setCreatedKey(null);
		setCopied(false);
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle>API Keys</CardTitle>
						<CardDescription>
							Manage API keys for programmatic access
						</CardDescription>
					</div>
					<Dialog
						open={createOpen}
						onOpenChange={(open) => {
							if (!open) handleDialogClose();
							else setCreateOpen(true);
						}}
					>
						<DialogTrigger asChild>
							<Button size="sm">
								<Plus className="h-4 w-4 mr-2" />
								Create Key
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Create API Key</DialogTitle>
								<DialogDescription>
									{createdKey
										? "Copy your API key now. It won't be shown again."
										: "Enter a name for your new API key."}
								</DialogDescription>
							</DialogHeader>
							{createdKey ? (
								<div className="space-y-4">
									<div className="flex items-center gap-2">
										<Input
											value={createdKey}
											readOnly
											className="font-mono text-sm"
										/>
										<Button
											variant="outline"
											size="icon"
											onClick={handleCopy}
										>
											{copied ? (
												<Check className="h-4 w-4" />
											) : (
												<Copy className="h-4 w-4" />
											)}
										</Button>
									</div>
									<p className="text-sm text-muted-foreground">
										This key will not be displayed again.
									</p>
								</div>
							) : (
								<Input
									placeholder="e.g., CI Pipeline, Staging Server"
									value={newKeyName}
									onChange={(e) =>
										setNewKeyName(e.target.value)
									}
									onKeyDown={(e) => {
										if (e.key === "Enter") handleCreate();
									}}
								/>
							)}
							<DialogFooter>
								{createdKey ? (
									<Button onClick={handleDialogClose}>
										Done
									</Button>
								) : (
									<>
										<Button
											variant="outline"
											onClick={handleDialogClose}
										>
											Cancel
										</Button>
										<Button
											onClick={handleCreate}
											disabled={
												!newKeyName.trim() ||
												createMutation.isPending
											}
										>
											{createMutation.isPending && (
												<Loader2 className="h-4 w-4 mr-2 animate-spin" />
											)}
											Create
										</Button>
									</>
								)}
							</DialogFooter>
						</DialogContent>
					</Dialog>
				</div>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<div className="flex items-center justify-center py-8">
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				) : !keys || keys.length === 0 ? (
					<div className="text-center py-8">
						<Key className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
						<p className="text-muted-foreground">
							No API keys yet. Create one to get started.
						</p>
					</div>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Created</TableHead>
								<TableHead>Last Used</TableHead>
								<TableHead>Expires</TableHead>
								<TableHead className="w-[60px]" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{keys.map((key) => (
								<TableRow key={key.id}>
									<TableCell className="font-medium">
										{key.name}
									</TableCell>
									<TableCell className="text-muted-foreground">
										{new Date(
											key.createdAt
										).toLocaleDateString()}
									</TableCell>
									<TableCell className="text-muted-foreground">
										{key.lastUsed
											? new Date(
													key.lastUsed
												).toLocaleDateString()
											: "Never"}
									</TableCell>
									<TableCell>
										{key.expiresAt ? (
											<Badge
												variant={
													new Date(key.expiresAt) <
													new Date()
														? "destructive"
														: "secondary"
												}
											>
												{new Date(
													key.expiresAt
												).toLocaleDateString()}
											</Badge>
										) : (
											<Badge variant="outline">
												Never
											</Badge>
										)}
									</TableCell>
									<TableCell>
										<AlertDialog
											open={deleteId === key.id}
											onOpenChange={(open) => {
												if (!open) setDeleteId(null);
											}}
										>
											<AlertDialogTrigger asChild>
												<Button
													variant="ghost"
													size="icon"
													className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
													onClick={() =>
														setDeleteId(key.id)
													}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</AlertDialogTrigger>
											<AlertDialogContent>
												<AlertDialogHeader>
													<AlertDialogTitle>
														Delete API Key
													</AlertDialogTitle>
													<AlertDialogDescription>
														Are you sure you want to
														delete &quot;{key.name}&quot;?
														This action cannot be
														undone.
													</AlertDialogDescription>
												</AlertDialogHeader>
												<AlertDialogFooter>
													<AlertDialogCancel>
														Cancel
													</AlertDialogCancel>
													<AlertDialogAction
														onClick={() =>
															deleteMutation.mutate(
																key.id
															)
														}
														className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
														disabled={
															deleteMutation.isPending
														}
													>
														{deleteMutation.isPending
															? "Deleting..."
															: "Delete"}
													</AlertDialogAction>
												</AlertDialogFooter>
											</AlertDialogContent>
										</AlertDialog>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}
