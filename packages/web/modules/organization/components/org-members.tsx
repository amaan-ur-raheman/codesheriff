"use client";

import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
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
import { UserPlus, Trash2, Crown, Shield, User, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
	getOrganization,
	inviteMember,
	removeMember,
	updateMemberRole,
} from "@/modules/organization/actions";

interface OrgMembersProps {
	orgId: string;
	orgName: string;
	currentUserRole: string;
}

export default function OrgMembers({
	orgId,
	orgName,
	currentUserRole,
}: OrgMembersProps) {
	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteRole, setInviteRole] = useState("member");
	const queryClient = useQueryClient();

	const { data: org, isLoading } = useQuery({
		queryKey: ["organization", orgId],
		queryFn: async () => {
			return await getOrganization(orgId);
		},
		enabled: !!orgId,
	});

	const inviteMutation = useMutation({
		mutationFn: async () => {
			return await inviteMember(orgId, inviteEmail, inviteRole);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["organization", orgId],
			});
			queryClient.invalidateQueries({ queryKey: ["organizations"] });
			toast.success("Member invited successfully");
			setInviteEmail("");
			setInviteRole("member");
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to invite member");
		},
	});

	const removeMutation = useMutation({
		mutationFn: async (userId: string) => {
			return await removeMember(orgId, userId);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["organization", orgId],
			});
			queryClient.invalidateQueries({ queryKey: ["organizations"] });
			toast.success("Member removed successfully");
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to remove member");
		},
	});

	const roleMutation = useMutation({
		mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
			return await updateMemberRole(orgId, userId, role);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["organization", orgId],
			});
			toast.success("Member role updated successfully");
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to update member role");
		},
	});

	const getRoleIcon = (role: string) => {
		switch (role) {
			case "owner":
				return <Crown className="h-3 w-3" />;
			case "admin":
				return <Shield className="h-3 w-3" />;
			default:
				return <User className="h-3 w-3" />;
		}
	};

	const canManageMembers =
		currentUserRole === "owner" || currentUserRole === "admin";

	if (isLoading) {
		return (
			<Card>
				<CardContent className="pt-6">
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
						<CardTitle>Members - {orgName}</CardTitle>
						<CardDescription>
							Manage organization members and their roles
						</CardDescription>
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-6">
				{/* Invite Form */}
				{canManageMembers && (
					<div className="flex items-end gap-3 p-4 bg-muted/50 rounded-lg">
						<div className="flex-1 space-y-2">
							<Label htmlFor="invite-email">
								Invite by email
							</Label>
							<Input
								id="invite-email"
								type="email"
								placeholder="member@example.com"
								value={inviteEmail}
								onChange={(e) =>
									setInviteEmail(e.target.value)
								}
								disabled={inviteMutation.isPending}
							/>
						</div>
						<div className="w-32 space-y-2">
							<Label>Role</Label>
							<Select
								value={inviteRole}
								onValueChange={setInviteRole}
								disabled={inviteMutation.isPending}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="member">
										Member
									</SelectItem>
									{currentUserRole === "owner" && (
										<SelectItem value="admin">
											Admin
										</SelectItem>
									)}
								</SelectContent>
							</Select>
						</div>
						<Button
							onClick={() => inviteMutation.mutate()}
							disabled={
								!inviteEmail.trim() ||
								inviteMutation.isPending
							}
						>
							{inviteMutation.isPending ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<UserPlus className="h-4 w-4" />
							)}
						</Button>
					</div>
				)}

				{/* Members List */}
				<div className="space-y-3">
					{org?.members.map((member) => (
						<div
							key={member.id}
							className="flex items-center justify-between p-3 rounded-lg border"
						>
							<div className="flex items-center gap-3">
								<Avatar className="h-10 w-10">
									<AvatarImage
										src={member.user.image || ""}
										alt={member.user.name || ""}
									/>
									<AvatarFallback>
										{member.user.name
											?.split(" ")
											.map((s) => s[0])
											.join("")
											.toUpperCase() || "?"}
									</AvatarFallback>
								</Avatar>
								<div>
									<p className="font-medium">
										{member.user.name}
									</p>
									<p className="text-sm text-muted-foreground">
										{member.user.email}
									</p>
								</div>
							</div>
							<div className="flex items-center gap-3">
								<span className="text-xs text-muted-foreground">
									Joined{" "}
									{formatDistanceToNow(
										new Date(member.joinedAt),
										{ addSuffix: true }
									)}
								</span>
								<Badge
									variant={
										member.role === "owner"
											? "default"
											: member.role === "admin"
											? "secondary"
											: "outline"
									}
									className="gap-1"
								>
									{getRoleIcon(member.role)}
									{member.role}
								</Badge>

								{/* Role Change */}
								{currentUserRole === "owner" &&
									member.role !== "owner" && (
										<Select
											value={member.role}
											onValueChange={(value) =>
												roleMutation.mutate({
													userId: member.user.id,
													role: value,
												})
											}
											disabled={roleMutation.isPending}
										>
											<SelectTrigger className="w-28 h-8">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="member">
													Member
												</SelectItem>
												<SelectItem value="admin">
													Admin
												</SelectItem>
											</SelectContent>
										</Select>
									)}

								{/* Remove Button */}
								{canManageMembers &&
									member.role !== "owner" && (
										<AlertDialog>
											<AlertDialogTrigger asChild>
												<Button
													variant="ghost"
													size="icon"
													className="h-8 w-8 text-muted-foreground hover:text-destructive"
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</AlertDialogTrigger>
											<AlertDialogContent>
												<AlertDialogHeader>
													<AlertDialogTitle>
														Remove Member
													</AlertDialogTitle>
													<AlertDialogDescription>
														Are you sure you want
														to remove{" "}
														{member.user.name}{" "}
														from this
														organization? This
														action cannot be
														undone.
													</AlertDialogDescription>
												</AlertDialogHeader>
												<AlertDialogFooter>
													<AlertDialogCancel>
														Cancel
													</AlertDialogCancel>
													<AlertDialogAction
														onClick={() =>
															removeMutation.mutate(
																member.user
																	.id
															)
														}
														className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
													>
														Remove
													</AlertDialogAction>
												</AlertDialogFooter>
											</AlertDialogContent>
										</AlertDialog>
									)}
							</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
