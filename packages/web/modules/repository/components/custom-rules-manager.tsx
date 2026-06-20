"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Power } from "lucide-react";

import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

import {
	getCustomRules,
	createCustomRule,
	updateCustomRule,
	deleteCustomRule,
} from "../actions/review-config";

interface CustomRulesManagerProps {
	repositoryId: string;
}

interface RuleFormData {
	name: string;
	description: string;
	ruleContent: string;
}

const defaultFormData: RuleFormData = {
	name: "",
	description: "",
	ruleContent: "",
};

export function CustomRulesManager({
	repositoryId,
}: CustomRulesManagerProps) {
	const queryClient = useQueryClient();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
	const [formData, setFormData] = useState<RuleFormData>(defaultFormData);
	const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

	const { data: rules = [], isLoading } = useQuery({
		queryKey: ["custom-rules", repositoryId],
		queryFn: () => getCustomRules(repositoryId),
	});

	const { mutate: createRule, isPending: isCreating } = useMutation({
		mutationFn: (data: RuleFormData) =>
			createCustomRule(repositoryId, data.name, data.description, data.ruleContent),
		onSuccess: () => {
			toast.success("Rule created");
			queryClient.invalidateQueries({
				queryKey: ["custom-rules", repositoryId],
			});
			closeDialog();
		},
		onError: () => toast.error("Failed to create rule"),
	});

	const { mutate: updateRule, isPending: isUpdating } = useMutation({
		mutationFn: (data: RuleFormData) =>
			updateCustomRule(editingRuleId!, {
				name: data.name,
				description: data.description,
				ruleContent: data.ruleContent,
			}),
		onSuccess: () => {
			toast.success("Rule updated");
			queryClient.invalidateQueries({
				queryKey: ["custom-rules", repositoryId],
			});
			closeDialog();
		},
		onError: () => toast.error("Failed to update rule"),
	});

	const { mutate: toggleRule, isPending: isToggling } = useMutation({
		mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
			updateCustomRule(id, { isActive }),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["custom-rules", repositoryId],
			});
		},
		onError: () => toast.error("Failed to toggle rule"),
	});

	const { mutate: removeRule, isPending: isRemoving } = useMutation({
		mutationFn: (id: string) => deleteCustomRule(id),
		onSuccess: () => {
			toast.success("Rule deleted");
			queryClient.invalidateQueries({
				queryKey: ["custom-rules", repositoryId],
			});
			setDeleteConfirmId(null);
		},
		onError: () => toast.error("Failed to delete rule"),
	});

	const closeDialog = () => {
		setDialogOpen(false);
		setEditingRuleId(null);
		setFormData(defaultFormData);
	};

	const openEditDialog = (rule: (typeof rules)[number]) => {
		setEditingRuleId(rule.id);
		setFormData({
			name: rule.name,
			description: rule.description || "",
			ruleContent: rule.ruleContent,
		});
		setDialogOpen(true);
	};

	const handleSubmit = () => {
		if (!formData.name.trim() || !formData.ruleContent.trim()) {
			toast.error("Name and rule content are required");
			return;
		}

		if (editingRuleId) {
			updateRule(formData);
		} else {
			createRule(formData);
		}
	};

	const isPending = isCreating || isUpdating;

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="text-lg font-semibold">Custom Review Rules</h3>
				<Dialog
					open={dialogOpen}
					onOpenChange={(open) => {
						if (!open) closeDialog();
						else setDialogOpen(true);
					}}
				>
					<DialogTrigger asChild>
						<Button
							size="sm"
							onClick={() => {
								setEditingRuleId(null);
								setFormData(defaultFormData);
								setDialogOpen(true);
							}}
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Rule
						</Button>
					</DialogTrigger>
					<DialogContent className="sm:max-w-[500px]">
						<DialogHeader>
							<DialogTitle>
								{editingRuleId ? "Edit Rule" : "Add Custom Rule"}
							</DialogTitle>
						</DialogHeader>
						<div className="space-y-4 py-2">
							<div className="space-y-2">
								<Label htmlFor="rule-name">Name</Label>
								<Input
									id="rule-name"
									placeholder="e.g., No console.log in production"
									value={formData.name}
									onChange={(e) =>
										setFormData((prev) => ({ ...prev, name: e.target.value }))
									}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="rule-desc">Description</Label>
								<Input
									id="rule-desc"
									placeholder="Optional description"
									value={formData.description}
									onChange={(e) =>
										setFormData((prev) => ({
											...prev,
											description: e.target.value,
										}))
									}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="rule-content">Rule Content</Label>
								<Textarea
									id="rule-content"
									placeholder="Describe the rule the AI should enforce..."
									value={formData.ruleContent}
									onChange={(e) =>
										setFormData((prev) => ({
											...prev,
											ruleContent: e.target.value,
										}))
									}
									rows={6}
								/>
							</div>
						</div>
						<DialogFooter>
							<Button variant="outline" onClick={closeDialog} disabled={isPending}>
								Cancel
							</Button>
							<Button onClick={handleSubmit} disabled={isPending}>
								{isPending ? <Spinner className="mr-2 h-4 w-4" /> : null}
								{editingRuleId ? "Update" : "Create"}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>

			{isLoading ? (
				<div className="flex justify-center py-8">
					<Spinner />
				</div>
			) : rules.length === 0 ? (
				<Card>
					<CardContent className="py-8 text-center text-muted-foreground">
						No custom rules yet. Add a rule to get started.
					</CardContent>
				</Card>
			) : (
				<div className="space-y-3">
					{rules.map((rule) => (
						<Card key={rule.id}>
							<CardHeader className="pb-3">
								<div className="flex items-start justify-between">
									<div className="space-y-1 flex-1">
										<div className="flex items-center gap-2">
											<CardTitle className="text-base">
												{rule.name}
											</CardTitle>
											<Badge
												variant={rule.isActive ? "default" : "secondary"}
											>
												{rule.isActive ? "Active" : "Inactive"}
											</Badge>
										</div>
										{rule.description && (
											<p className="text-sm text-muted-foreground">
												{rule.description}
											</p>
										)}
									</div>
									<div className="flex items-center gap-1">
										<Button
											variant="ghost"
											size="icon"
											className="h-8 w-8"
											disabled={isToggling}
											onClick={() =>
												toggleRule({
													id: rule.id,
													isActive: !rule.isActive,
												})
											}
										>
											<Power className="h-4 w-4" />
										</Button>
										<Button
											variant="ghost"
											size="icon"
											className="h-8 w-8"
											onClick={() => openEditDialog(rule)}
										>
											<Pencil className="h-4 w-4" />
										</Button>
										<Dialog
											open={deleteConfirmId === rule.id}
											onOpenChange={(open) =>
												setDeleteConfirmId(open ? rule.id : null)
											}
										>
											<DialogTrigger asChild>
												<Button
													variant="ghost"
													size="icon"
													className="h-8 w-8 text-destructive"
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</DialogTrigger>
											<DialogContent>
												<DialogHeader>
													<DialogTitle>Delete Rule</DialogTitle>
												</DialogHeader>
												<p className="text-muted-foreground">
													Are you sure you want to delete &quot;{rule.name}&quot;?
													This action cannot be undone.
												</p>
												<DialogFooter>
													<Button
														variant="outline"
														onClick={() => setDeleteConfirmId(null)}
														disabled={isRemoving}
													>
														Cancel
													</Button>
													<Button
														variant="destructive"
														onClick={() => removeRule(rule.id)}
														disabled={isRemoving}
													>
														{isRemoving ? (
															<Spinner className="mr-2 h-4 w-4" />
														) : null}
														Delete
													</Button>
												</DialogFooter>
											</DialogContent>
										</Dialog>
									</div>
								</div>
							</CardHeader>
							<CardContent>
								<pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono bg-muted rounded-md p-3">
									{rule.ruleContent}
								</pre>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}
