"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Plus, Crown, Shield, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { getOrganizations } from "@/modules/organization/actions";
import CreateOrgDialog from "@/modules/organization/components/create-org-dialog";
import OrgMembers from "@/modules/organization/components/org-members";

export default function OrganizationPageClient() {
	const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

	const { data: organizations, isLoading } = useQuery({
		queryKey: ["organizations"],
		queryFn: async () => {
			return await getOrganizations();
		},
	});

	const selectedOrg = organizations?.find((org) => org.id === selectedOrgId);

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

	const getRoleBadgeVariant = (
		role: string
	): "default" | "secondary" | "destructive" | "outline" => {
		switch (role) {
			case "owner":
				return "default";
			case "admin":
				return "secondary";
			default:
				return "outline";
		}
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-[400px]">
				<Spinner />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">
						Organizations
					</h1>
					<p className="text-muted-foreground">
						Manage your teams and collaborate with members
					</p>
				</div>
				<CreateOrgDialog />
			</div>

			{organizations?.length === 0 ? (
				<Card>
					<CardContent className="pt-6">
						<div className="text-center py-12">
							<Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
							<p className="text-muted-foreground">
								No organizations yet. Create one to start
								collaborating.
							</p>
						</div>
					</CardContent>
				</Card>
			) : (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{organizations?.map((org) => (
						<Card
							key={org.id}
							className={`hover:shadow-md transition-shadow cursor-pointer ${
								selectedOrgId === org.id
									? "ring-2 ring-primary"
									: ""
							}`}
							onClick={() =>
								setSelectedOrgId(
									selectedOrgId === org.id ? null : org.id
								)
							}
						>
							<CardHeader>
								<div className="flex items-center justify-between">
									<CardTitle className="text-lg">
										{org.name}
									</CardTitle>
									<Badge
										variant={getRoleBadgeVariant(
											org.currentUserRole
										)}
										className="gap-1"
									>
										{getRoleIcon(org.currentUserRole)}
										{org.currentUserRole}
									</Badge>
								</div>
								{org.description && (
									<CardDescription className="line-clamp-2">
										{org.description}
									</CardDescription>
								)}
							</CardHeader>
							<CardContent>
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2 text-sm text-muted-foreground">
										<Users className="h-4 w-4" />
										<span>
											{org.memberCount}{" "}
											{org.memberCount === 1
												? "member"
												: "members"}
										</span>
									</div>
									{org.currentUserRole === "owner" && (
										<Badge variant="outline">
											Owner
										</Badge>
									)}
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			{selectedOrg && (
				<OrgMembers
					orgId={selectedOrg.id}
					orgName={selectedOrg.name}
					currentUserRole={selectedOrg.currentUserRole}
				/>
			)}
		</div>
	);
}
