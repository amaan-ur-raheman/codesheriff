"use client";


import {
	Card,
	CardContent,
	CardHeader,
	CardDescription,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Check, X, ExternalLink, RefreshCw, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";

import { customer, checkout } from "@/lib/auth-client";
import {
	getSubscriptionData,
	syncSubscriptionStatus,
} from "@/modules/payment/actions";
import { Spinner } from "@/components/ui/spinner";

const PLAN_FEATURE = {
	free: [
		{ name: "Up to 5 repositories", included: true },
		{ name: "Up to 5 reviews per repository", included: true },
		{ name: "Basic code reviews", included: true },
		{ name: "Community support", included: true },
		{ name: "Advanced analytics", included: false },
		{ name: "Priority support", included: false },
	],
	pro: [
		{ name: "Unlimited repositories", included: true },
		{ name: "Unlimited reviews per repository", included: true },
		{ name: "Advanced code reviews", included: true },
		{ name: "Email support", included: true },
		{ name: "Advanced analytics", included: true },
		{ name: "Priority support", included: true },
	],
};

export default function SubscriptionPageClient() {
	const [checkoutLoading, setCheckoutLoading] = useState(false);
	const [portalLoading, setPortalLoading] = useState(false);
	const [syncLoading, setSyncLoading] = useState(false);

	const searchParams = useSearchParams();
	const success = searchParams.get("success");

	const { data, isLoading, error, refetch } = useQuery({
		queryKey: ["subscription-data"],
		queryFn: getSubscriptionData,
		refetchOnWindowFocus: true,
	});

	useEffect(() => {
		if (success === "true") {
			const sync = async () => {
				try {
					await syncSubscriptionStatus();
					refetch();
				} catch (error) {
					console.error(
						"Failed to sync subscription on success return",
						error
					);
				}
			};

			sync();
		}
	}, [success, refetch]);

	if (isLoading) {
		return (
			<div className="flex items-center  justify-center min-h-[400px]">
				<Spinner />
			</div>
		);
	}

	if (error) {
		return (
			<div className="space-y-6">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">
						Subscription Plans
					</h1>
					<p className="text-muted-foreground">
						Failed to load subscription data. Please try again.
					</p>
				</div>
				<Alert variant={"destructive"}>
					<AlertTitle>Error</AlertTitle>
					<AlertDescription>
						Failed to load subscription data. Please try again.
					</AlertDescription>
					<Button
						variant="outline"
						size={"sm"}
						className="ml-4"
						onClick={() => refetch()}
					>
						Retry
					</Button>
				</Alert>
			</div>
		);
	}

	if (!data?.user) {
		return (
			<div className="space-y-8">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">
						Subscription Plans
					</h1>
					<p className="text-muted-foreground">
						Please sign in to view subscription options.
					</p>
				</div>
			</div>
		);
	}

	const currentTier = data.user.subscriptionTier as "FREE" | "PRO";
	const isPro = currentTier === "PRO";
	const isActive = data.user.subscriptionStatus === "ACTIVE";

	const handleSync = async () => {
		try {
			setSyncLoading(true);
			const result = await syncSubscriptionStatus();

			if (result.success) {
				toast.success("Subscription status synced successfully");
				refetch();
			} else {
				toast.error("Failed to sync subscription status");
			}
		} catch (error) {
			toast.error("Failed to sync subscription status");
		} finally {
			setSyncLoading(false);
		}
	};

	const handleManageSubscription = async () => {
		try {
			setPortalLoading(true);
			await customer.portal();
		} catch (error) {
			console.error("Failed to open portal:", error);
		} finally {
			setPortalLoading(false);
		}
	};

	const handleUpgrade = async () => {
		try {
			setCheckoutLoading(true);

			await checkout({
				slug: "pro",
			});
		} catch (error) {
			console.error("Failed to initialize checkout:", error);
		} finally {
			setCheckoutLoading(false);
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">
						Subscription Plans
					</h1>
					<p className="text-muted-foreground">
						Choose perfect plan for your needs
					</p>
				</div>

				<Button
					variant={"outline"}
					size={"sm"}
					onClick={handleSync}
					disabled={syncLoading}
				>
					{syncLoading ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<RefreshCw className="h-4 w-4 mr-2" />
					)}
					Sync Status
				</Button>
			</div>

			{success === "true" && (
				<Alert className="border-green-500 bg-green-50 dark:bg-green-950">
					<Check className="h-4 w-4 text-green-600" />
					<AlertTitle>Success!</AlertTitle>
					<AlertDescription>
						Your subscription status has been updated successfully.
						Changes may take a few moments to reflect.
					</AlertDescription>
				</Alert>
			)}

			{/* Current Usage */}
			{data.limits && (
				<Card>
					<CardHeader>
						<CardTitle>Current Usage</CardTitle>
						<CardDescription>
							Your current plan limits and usage
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<span className="text-sm font-medium">
										Repositories
									</span>
									<Badge
										variant={
											data.limits.repositories.canAdd
												? "default"
												: "destructive"
										}
									>
										{data.limits.repositories.current} /{" "}
										{data.limits.repositories.limit ?? "∞"}
									</Badge>
								</div>
								<div className="h-2 bg-muted rounded-full overflow-hidden">
									<div
										className={`h-full ${
											data.limits.repositories.canAdd
												? "bg-primary"
												: "bg-destructive"
										}`}
										style={{
											width: data.limits.repositories
												.limit
												? `${Math.min(
														(data.limits
															.repositories
															.current /
															data.limits
																.repositories
																.limit) *
															100,
														100
												  )}%`
												: `0%`,
										}}
									/>
								</div>
							</div>
							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<span className="text-sm font-medium">
										Reviews per Repository
									</span>
									<Badge variant={"outline"}>
										{isPro
											? "Unlimited"
											: "5 per repository"}
									</Badge>
								</div>
								<p className="text-xs text-muted-foreground">
									{isPro
										? "No limit on reviews"
										: "Free tier allows 5 reviews per repository"}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Plans */}
			<div className="grid gap-6 md:grid-cols-2">
				{/* Free Plan */}
				<Card className={!isPro ? "ring-2 ring-primary" : ""}>
					<CardHeader>
						<div className="flex items-center justify-between">
							<div>
								<CardTitle>Free Plan</CardTitle>
								<CardDescription>
									Perfect for getting started
								</CardDescription>
							</div>
							{!isPro && (
								<Badge className="ml-2">Current Plan</Badge>
							)}
						</div>
						<div className="mt-2">
							<span className="text-3xl font-bold">$0</span>
							<span className="text-muted-foreground">
								/month
							</span>
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-2">
							{PLAN_FEATURE.free.map((feature) => (
								<div
									key={feature.name}
									className="flex items-center gap-2"
								>
									{feature.included ? (
										<Check className="h-4 w-4 text-primary shrink-0" />
									) : (
										<X className="h-4 w-4 text-muted-foreground shrink-0" />
									)}
									<span
										className={
											feature.included
												? ""
												: "text-muted-foreground"
										}
									>
										{feature.name}
									</span>
								</div>
							))}
						</div>
						<Button className="w-full" variant={"outline"} disabled>
							{!isPro ? "Current Plan" : "Downgrade"}
						</Button>
					</CardContent>
				</Card>

				{/* Pro Plan */}
				<Card className={isPro ? "ring-2 ring-primary" : ""}>
					<CardHeader>
						<div className="flex items-center justify-between">
							<div>
								<CardTitle>Pro Plan</CardTitle>
								<CardDescription>
									For professional developers
								</CardDescription>
							</div>
							{isPro && (
								<Badge className="ml-2">Current Plan</Badge>
							)}
						</div>
						<div className="mt-2">
							<span className="text-3xl font-bold">$29.99</span>
							<span className="text-muted-foreground">
								/month
							</span>
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-2">
							{PLAN_FEATURE.pro.map((feature) => (
								<div
									key={feature.name}
									className="flex items-center gap-2"
								>
									{feature.included ? (
										<Check className="h-4 w-4 text-primary shrink-0" />
									) : (
										<X className="h-4 w-4 text-muted-foreground shrink-0" />
									)}
									<span
										className={
											feature.included
												? ""
												: "text-muted-foreground"
										}
									>
										{feature.name}
									</span>
								</div>
							))}
						</div>
						{isPro && isActive ? (
							<Button
								className="w-full"
								variant={"outline"}
								onClick={handleManageSubscription}
								disabled={portalLoading}
							>
								{portalLoading ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Opening portal...
									</>
								) : (
									<>
										Manage Subscription
										<ExternalLink className="ml-2 h-4 w-4" />
									</>
								)}
							</Button>
						) : (
							<Button
								className="w-full"
								onClick={handleUpgrade}
								disabled={checkoutLoading}
							>
								{checkoutLoading ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Loading checkout...
									</>
								) : (
									"Upgrade to Pro"
								)}
							</Button>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
