/**
 * Dashboard page client component displaying user statistics and activity
 * 
 * Features:
 * - Overview cards showing commits, PRs, reviews, and repositories
 * - Monthly activity chart with contribution data
 * - GitHub contribution calendar integration
 * - Real-time data fetching with React Query
 * 
 * @component
 */
"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	BarChart,
	Bar,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
} from "recharts";
import {
	GitCommit,
	GitPullRequest,
	MessageSquare,
	GitBranch,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";

import {
	getDashboardStats,
	getMonthlyActivity,
} from "@/modules/dashboard/actions";
import ContributionGraph from "@/modules/dashboard/components/contribution-graph";
import { HealthScoreCard } from "@/modules/dashboard/components/health-score-card";

const DashboardPageClient = () => {
	const {
		data: stats,
		isLoading,
		isError: isStatsError,
	} = useQuery({
		queryKey: ["dashboard-stats"],
		queryFn: async () => await getDashboardStats(),
		refetchOnWindowFocus: false,
	});

	const {
		data: monthlyActivity,
		isLoading: isLoadingActivity,
		isError: isActivityError,
		refetch: refetchActivity,
	} = useQuery({
		queryKey: ["monthly-activity"],
		queryFn: async () => await getMonthlyActivity(),
		refetchOnWindowFocus: false,
	});

	return (
		<div className="space-y-6">
			<div>
				<p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand-text mb-2">
					Overview
				</p>
				<h1 className="font-display text-3xl tracking-tight text-foreground">
					Dashboard
				</h1>
				<p className="mt-2 text-sm text-muted-foreground">
					Your coding activity and AI reviews at a glance
				</p>
			</div>

			<div className="grid gap-4 md:grid-cols-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Total Repositories
						</CardTitle>
						<GitBranch className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="font-display text-3xl tracking-tight">
							{isLoading ? (
								<Skeleton className="h-8 w-14" />
							) : isStatsError ? (
								"—"
							) : (
								stats?.totalRepos || 0
							)}
						</div>
						<p className="text-xs text-muted-foreground">
							Connected Repositories
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Total Commits
						</CardTitle>
						<GitCommit className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="font-display text-3xl tracking-tight">
							{isLoading ? (
								<Skeleton className="h-8 w-20" />
							) : isStatsError ? (
								"—"
							) : (
								(stats?.totalCommits || 0).toLocaleString()
							)}
						</div>
						<p className="text-xs text-muted-foreground">
							In the last year
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Pull Requests
						</CardTitle>
						<GitPullRequest className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="font-display text-3xl tracking-tight">
							{isLoading ? (
								<Skeleton className="h-8 w-14" />
							) : isStatsError ? (
								"—"
							) : (
								stats?.totalPrs || 0
							)}
						</div>
						<p className="text-xs text-muted-foreground">
							All Time
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							AI Reviews
						</CardTitle>
						<MessageSquare className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="font-display text-3xl tracking-tight">
							{isLoading ? (
								<Skeleton className="h-8 w-14" />
							) : isStatsError ? (
								"—"
							) : (
								stats?.totalReviews || 0
							)}
						</div>
						<p className="text-xs text-muted-foreground">
							Generated Reviews
						</p>
					</CardContent>
				</Card>
			</div>

			<div className="grid gap-4 md:grid-cols-2">
				<HealthScoreCard />
				<Card className="flex flex-col">
					<CardHeader>
						<CardTitle className="font-display text-lg tracking-tight">Quick Actions</CardTitle>
						<CardDescription>Manage your repositories</CardDescription>
					</CardHeader>
					<CardContent className="flex-1 flex items-center">
						<p className="text-sm text-muted-foreground">
							Visit the Repositories page to configure review settings and custom rules.
						</p>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>						<CardTitle className="font-display text-lg tracking-tight">Contribution Activity</CardTitle>
					<CardDescription>
						Visualizing your coding frequency over the last year
					</CardDescription>
				</CardHeader>
				<CardContent>
					<ContributionGraph />
				</CardContent>
			</Card>

			<div className="grid gap-4 md:grid-cols-2">
				<Card className="col-span-2">
					<CardHeader>
						<CardTitle className="font-display text-lg tracking-tight">Activity Overview</CardTitle>
						<CardDescription>
							Monthly breakdown of commits, PRs and reviews (last
							6 months)
						</CardDescription>
					</CardHeader>
					<CardContent>
						{isLoadingActivity ? (
							<div className="flex h-80 w-full items-end gap-2 px-2 pb-1">
								{Array.from({ length: 12 }).map((_, i) => (
									<Skeleton
										key={i}
										className="flex-1"
										style={{
												height: `${32 + ((i * 37) % 56)}%`,
											}}
									/>
								))}
							</div>
						) : isActivityError ? (
							<div className="h-80 w-full">
								<ErrorState
									title="Couldn't load activity"
									description="Your contribution activity couldn't be fetched right now."
									onRetry={() => refetchActivity()}
									className="h-full"
								/>
							</div>
						) : !monthlyActivity || monthlyActivity.length === 0 ? (
							<div className="h-80 w-full">
								<EmptyState
									kicker="Activity"
									title="No activity yet"
									description="Once reviews start running, your monthly activity will appear here."
									className="h-full"
								/>
							</div>
						) : (
							<div className="h-80 w-full">
								<ResponsiveContainer
									width={"100%"}
									height={"100%"}
								>
									<BarChart data={monthlyActivity || []}>
										<CartesianGrid strokeDasharray="3 3" />
										<XAxis dataKey="name" />
										<YAxis />
										<Tooltip
											contentStyle={{
												backgroundColor:
													"var(--background)",
												borderColor: "var(--border)",
											}}
											itemStyle={{
												color: "var(--foreground)",
											}}
										/>
										<Legend />
									<Bar
										dataKey="commits"
										name="Commits"
										fill="var(--primary)"
										radius={[0, 0, 0, 0]}
									/>
									<Bar
										dataKey="prs"
										name="Pull Requests"
										fill="var(--chart-2)"
										radius={[0, 0, 0, 0]}
									/>
									<Bar
										dataKey="reviews"
										name="AI Reviews"
										fill="var(--chart-4)"
										radius={[0, 0, 0, 0]}
									/>
									</BarChart>
								</ResponsiveContainer>
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
};

export default DashboardPageClient;
