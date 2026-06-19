"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	getIntegrationConfigs,
	createIntegrationConfig,
	deleteIntegrationConfig,
	toggleIntegrationActive,
	testWebhook,
} from "../actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Trash2, Send, Loader2 } from "lucide-react";

interface IntegrationProps {
	orgId: string;
}

const INTEGRATIONS = [
	{
		type: "slack",
		name: "Slack",
		description: "Receive review notifications in your Slack channels",
		icon: (
			<svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
				<path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.523-2.522v-2.522zM15.165 17.688a2.527 2.527 0 0 1-2.523-2.523 2.526 2.526 0 0 1 2.523-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
			</svg>
		),
		placeholder: "https://hooks.slack.com/services/...",
	},
	{
		type: "discord",
		name: "Discord",
		description: "Receive review notifications in your Discord channels",
		icon: (
			<svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
				<path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
			</svg>
		),
		placeholder: "https://discord.com/api/webhooks/...",
	},
];

export default function IntegrationsPageClient({ orgId }: IntegrationProps) {
	const queryClient = useQueryClient();
	const [webhookUrls, setWebhookUrls] = useState<Record<string, string>>({});
	const [testing, setTesting] = useState<string | null>(null);

	const { data: configs = [], isLoading } = useQuery({
		queryKey: ["integrations", orgId],
		queryFn: () => getIntegrationConfigs(orgId),
	});

	const createMutation = useMutation({
		mutationFn: ({
			type,
			webhookUrl,
		}: {
			type: string;
			webhookUrl: string;
		}) => createIntegrationConfig(orgId, type, { webhookUrl }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["integrations", orgId] });
			setWebhookUrls({});
		},
	});

	const deleteMutation = useMutation({
		mutationFn: deleteIntegrationConfig,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["integrations", orgId] });
		},
	});

	const toggleMutation = useMutation({
		mutationFn: ({
			id,
			isActive,
		}: {
			id: string;
			isActive: boolean;
		}) => toggleIntegrationActive(id, isActive),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["integrations", orgId] });
		},
	});

	const handleTest = async (type: string, webhookUrl: string) => {
		setTesting(type);
		try {
			await testWebhook(type, webhookUrl);
		} finally {
			setTesting(null);
		}
	};

	const getConfigForType = (type: string) =>
		configs.find((c) => c.type === type);

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-2xl font-bold tracking-tight">Integrations</h2>
				<p className="text-muted-foreground">
					Connect external services to receive notifications about your code
					reviews.
				</p>
			</div>

			<div className="grid gap-4 md:grid-cols-2">
				{INTEGRATIONS.map((integration) => {
					const config = getConfigForType(integration.type);

					return (
						<Card key={integration.type}>
							<CardHeader>
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-3">
										<div className="text-foreground">
											{integration.icon}
										</div>
										<div>
											<CardTitle className="text-base">
												{integration.name}
											</CardTitle>
											<CardDescription>
												{integration.description}
											</CardDescription>
										</div>
									</div>
									{config && (
										<Badge variant={config.isActive ? "default" : "secondary"}>
											{config.isActive ? "Active" : "Inactive"}
										</Badge>
									)}
								</div>
							</CardHeader>
							<CardContent className="space-y-4">
								{config ? (
									<>
										<div className="flex items-center gap-2">
											<Switch
												checked={config.isActive}
												onCheckedChange={(checked) =>
													toggleMutation.mutate({
														id: config.id,
														isActive: checked,
													})
												}
											/>
											<span className="text-sm text-muted-foreground">
												{config.isActive ? "Enabled" : "Disabled"}
											</span>
										</div>
										<div className="flex gap-2">
											<Button
												variant="outline"
												size="sm"
												disabled={testing === integration.type}
												onClick={() =>
													handleTest(
														integration.type,
														(config.config as any).webhookUrl
													)
												}
											>
												{testing === integration.type ? (
													<Loader2 className="h-4 w-4 animate-spin" />
												) : (
													<Send className="h-4 w-4" />
												)}
												Test
											</Button>
											<Button
												variant="outline"
												size="sm"
												onClick={() =>
													deleteMutation.mutate(config.id)
												}
											>
												<Trash2 className="h-4 w-4" />
												Delete
											</Button>
										</div>
									</>
								) : (
									<form
										onSubmit={(e) => {
											e.preventDefault();
											const url = webhookUrls[integration.type];
											if (url) {
												createMutation.mutate({
													type: integration.type,
													webhookUrl: url,
												});
											}
										}}
										className="space-y-3"
									>
										<Input
											placeholder={integration.placeholder}
											value={webhookUrls[integration.type] || ""}
											onChange={(e) =>
												setWebhookUrls((prev) => ({
													...prev,
													[integration.type]: e.target.value,
												}))
											}
										/>
										<Button
											type="submit"
											size="sm"
											disabled={
												!webhookUrls[integration.type] ||
												createMutation.isPending
											}
										>
											{createMutation.isPending ? (
												<Loader2 className="h-4 w-4 animate-spin" />
											) : null}
											Connect
										</Button>
									</form>
								)}
							</CardContent>
						</Card>
					);
				})}
			</div>
		</div>
	);
}
