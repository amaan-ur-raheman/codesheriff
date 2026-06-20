"use client";

import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createOrganization } from "@/modules/organization/actions";

export default function CreateOrgDialog() {
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const queryClient = useQueryClient();

	const createMutation = useMutation({
		mutationFn: async () => {
			return await createOrganization(
				name,
				description || undefined
			);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["organizations"] });
			toast.success("Organization created successfully");
			setOpen(false);
			setName("");
			setDescription("");
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to create organization");
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim()) {
			toast.error("Organization name is required");
			return;
		}
		createMutation.mutate();
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button>
					<Plus className="h-4 w-4 mr-2" />
					Create Organization
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Create Organization</DialogTitle>
					<DialogDescription>
						Create a new organization to collaborate with your
						team.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="name">Name</Label>
						<Input
							id="name"
							placeholder="My Organization"
							value={name}
							onChange={(e) => setName(e.target.value)}
							disabled={createMutation.isPending}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="description">
							Description (optional)
						</Label>
						<Textarea
							id="description"
							placeholder="A brief description of your organization"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							disabled={createMutation.isPending}
							rows={3}
						/>
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setOpen(false)}
							disabled={createMutation.isPending}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={createMutation.isPending}>
							{createMutation.isPending ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Creating...
								</>
							) : (
								"Create"
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
