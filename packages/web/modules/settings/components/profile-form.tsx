"use client";

import {
	Card,
	CardDescription,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";

import { getUserProfile, updateUserProfile } from "../actions";

export function ProfileForm() {
	const queryClient = useQueryClient();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");

	const { data: profile, isLoading } = useQuery({
		queryKey: ["user-profile"],
		queryFn: async () => await getUserProfile(),
		staleTime: 5 * 60 * 1000, // 5 minutes
		refetchOnWindowFocus: false,
	});

	useEffect(() => {
		if (profile) {
			setName(profile.name || "");
			setEmail(profile.email || "");
		}
	}, [profile]);

	const updateMutation = useMutation({
		mutationFn: async (data: { name: string; email: string }) => {
			return await updateUserProfile(data);
		},
		onSuccess: (result) => {
			if (result?.success) {
				queryClient.invalidateQueries({ queryKey: ["user-profile"] });
				toast.success("Profile updated successfully");
			}
		},
		onError: (error: any) => {
			toast.error("Failed to update profile", {
				description:
					error.message ||
					"An error occurred while updating your profile.",
			});
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		updateMutation.mutate({ name, email });
	};

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Profile Settings</CardTitle>
					<CardDescription>
						Update your profile information
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
				<CardTitle>Profile Settings</CardTitle>
				<CardDescription>
					Update your profile information
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit} className="space-y-6">
					<div className="space-y-2">
						<Label htmlFor="name">Full Name</Label>
						<Input
							id="name"
							placeholder="Enter your full name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							disabled={updateMutation.isPending}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="email">Email</Label>
						<Input
							id="email"
							type="email"
							placeholder="Enter your email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							disabled={updateMutation.isPending}
						/>
					</div>

					<Button type="submit" disabled={updateMutation.isPending}>
						{updateMutation.isPending
							? "Saving..."
							: "Save Changes"}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
