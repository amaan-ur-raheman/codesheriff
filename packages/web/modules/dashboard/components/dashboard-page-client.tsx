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
	ArrowUpRight,
	Blocks,
	Users,
} from "lucide-react";
import Link from "next/link";
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
import { PageHeader } from "@/components/page-header";
import {
	CHART_TOOLTIP_STYLE,
	CHART_AXIS_TICK,
	CHART_GRID_STROKE,
} from "@/lib/charts";

const QUICK_ACTIONS = [
	{
		href: "/dashboard/reviews",
		label: "Review pull requests",
		description: "See the latest AI reviews",
		icon: GitPullRequest,
	},
	{
		href: "/dashboard/repository",
		label: "Configure repositories",
		description: "Review settings and custom rules",
		icon: GitBranch,
	},
	{
		href: "/dashboard/integrations",
		label: "Connect integrations",
		description: "Slack and Discord notifications",
		icon: Blocks,
	},
	{
		href: "/dashboard/organizations",
		label: "Manage your team",
		description: "Invite members and assign roles",
		icon: Users,
	},
];

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
			<PageHeader
				kicker="Overview"
				title="Dashboard"
				description="Your coding activity and AI reviews at a glance"
			/>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Total Repositories
						</CardTitle>
						<GitBranch className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="font-mono text-3xl tracking-tight tabular-nums">
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
						<div className="font-mono text-3xl tracking-tight tabular-nums">
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
						<div className="font-mono text-3xl tracking-tight tabular-nums">
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
						<div className="font-mono text-3xl tracking-tight tabular-nums">
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
						<CardTitle className="text-sm font-semibold tracking-wide uppercase font-mono">Quick Actions</CardTitle>
						<CardDescription>
							Jump straight to the work that matters
						</CardDescription>
					</CardHeader>
					<CardContent className="flex-1 p-0">
						<div className="divide-y divide-border">
							{QUICK_ACTIONS.map((action) => {
								const Icon = action.icon;
								return (
									<Link
										key={action.href}
										href={action.href}
										className="group flex items-center gap-3 px-6 py-3 transition-colors hover:bg-muted/40"
									>
										<span className="flex size-8 shrink-0 items-center justify-center border border-border text-muted-foreground transition-colors group-hover:border-brand/40 group-hover:text-brand">
											<Icon className="h-4 w-4" />
										</span>
										<span className="flex-1 min-w-0">
											<span className="block text-sm font-medium">
												{action.label}
											</span>
											<span className="block text-xs text-muted-foreground">
												{action.description}
											</span>
										</span>
										<ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 -translate-x-1 transition-[transform,opacity,color] group-hover:translate-x-0 group-hover:opacity-100 group-hover:text-brand" />
									</Link>
								);
							})}
						</div>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="text-base font-semibold">Contribution Activity</CardTitle>
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
						<CardTitle className="text-base font-semibold">Activity Overview</CardTitle>
						<CardDescription>
							Monthly breakdown of commits, PRs and reviews (last
							6 months)
						</CardDescription>
					</CardHeader>
					<CardContent>
						{isLoadingActivity ? (
							<div className="flex h-60 sm:h-80 w-full items-end gap-2 px-2 pb-1">
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
							<div className="h-60 sm:h-80 w-full">
								<ErrorState
									title="Couldn't load activity"
									description="Your contribution activity couldn't be fetched right now."
									onRetry={() => refetchActivity()}
									className="h-full"
								/>
							</div>
						) : !monthlyActivity || monthlyActivity.length === 0 ? (
							<div className="h-60 sm:h-80 w-full">
								<EmptyState
									kicker="Activity"
									title="No activity yet"
									description="Once reviews start running, your monthly activity will appear here."
									className="h-full"
								/>
							</div>
						) : (
							<div className="h-60 sm:h-80 w-full">
								<ResponsiveContainer
									width={"100%"}
									height={"100%"}
								>
									<BarChart data={monthlyActivity || []}>
										<CartesianGrid
											strokeDasharray="3 3"
											stroke={CHART_GRID_STROKE}
										/>
										<XAxis dataKey="name" tick={CHART_AXIS_TICK} stroke={CHART_GRID_STROKE} />
										<YAxis tick={CHART_AXIS_TICK} stroke={CHART_GRID_STROKE} />
										<Tooltip {...CHART_TOOLTIP_STYLE} />
										<Legend
											wrapperStyle={{
												fontSize: 12,
												color: "var(--muted-foreground)",
											}}
										/>
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
