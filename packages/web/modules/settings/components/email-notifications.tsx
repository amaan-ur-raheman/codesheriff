"use client";

import {
	Card,
	CardDescription,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getEmailPreference, setEmailPreference } from "../actions";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function EmailNotifications() {
	const queryClient = useQueryClient();

	const { data: preference, isLoading } = useQuery({
		queryKey: ["email-preference"],
		queryFn: getEmailPreference,
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
	});

	const toggleMutation = useMutation({
		mutationFn: (enabled: boolean) => setEmailPreference(enabled),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["email-preference"] });
			toast.success("Email notification preference updated");
		},
		onError: (error: any) => {
			toast.error("Failed to update preference", {
				description: error.message || "An error occurred.",
			});
		},
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle>Email Notifications</CardTitle>
				<CardDescription>
					Control which emails you receive from Code Sheriff.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<div className="animate-pulse space-y-4">
						<div className="h-10 bg-muted rounded" />
					</div>
				) : (
					<div className="flex items-center justify-between">
						<div className="space-y-0.5">
							<Label htmlFor="email-notifications" className="text-sm font-medium">
								Email notifications
							</Label>
							<p className="text-xs text-muted-foreground">
								Receive emails for review completions, usage warnings, and subscription updates.
							</p>
						</div>
						<Switch
							id="email-notifications"
							checked={preference?.emailNotifications ?? true}
							onCheckedChange={(checked) => toggleMutation.mutate(checked)}
							disabled={toggleMutation.isPending}
						/>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
