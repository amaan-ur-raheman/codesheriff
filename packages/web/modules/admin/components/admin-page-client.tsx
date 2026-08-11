"use client";

import { useQuery } from "@tanstack/react-query";
import {
	getAdminStats,
	getUsersList,
	getRecentReviews,
	getReviewsOverTime,
} from "@/modules/admin/actions";
import {
	getVerifyMetrics,
	getIndexingMetrics,
} from "@/modules/admin/actions/metrics";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import {
	Users,
	Star,
	Crown,
	AlertTriangle,
	Shield,
} from "lucide-react";
import {
	LineChart,
	Line,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
} from "recharts";
import { useSession } from "@/lib/auth-client";
import { PageHeader } from "@/components/page-header";
import {
	CHART_TOOLTIP_STYLE,
	CHART_AXIS_TICK,
	CHART_GRID_STROKE,
} from "@/lib/charts";	export default function AdminPageClient() {
	const { data: session } = useSession();
	// The better-auth client session type omits the custom `role` column even
	// though the server includes it in the session payload — narrow precisely.
	const user = session?.user as unknown as { role: string } | undefined;

	if (user?.role !== "admin") {
		return (
			<div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
				<Shield className="w-16 h-16 text-muted-foreground" />
				<h1 className="font-display text-2xl tracking-tight">Access Denied</h1>
				<p className="text-muted-foreground">
					You do not have permission to access the admin dashboard.
				</p>
			</div>
		);
	}

	return <AdminDashboard />;
}

function AdminDashboard() {
	const {
		data: stats,
		isLoading: statsLoading,
		isError: statsError,
	} = useQuery({
		queryKey: ["admin-stats"],
		queryFn: getAdminStats,
	});

	const {
		data: usersData,
		isLoading: usersLoading,
		isError: usersError,
		refetch: refetchUsers,
	} = useQuery({
		queryKey: ["admin-users"],
		queryFn: () => getUsersList(1, 10),
	});

	const {
		data: reviews,
		isLoading: reviewsLoading,
		isError: reviewsError,
		refetch: refetchReviews,
	} = useQuery({
		queryKey: ["admin-reviews"],
		queryFn: () => getRecentReviews(10),
	});

	const {
		data: reviewsOverTime,
		isLoading: chartLoading,
		isError: chartError,
		refetch: refetchChart,
	} = useQuery({
		queryKey: ["admin-reviews-over-time"],
		queryFn: getReviewsOverTime,
	});

	const {
		data: verifyMetrics,
		isLoading: verifyLoading,
		isError: verifyError,
		refetch: refetchVerify,
	} = useQuery({
		queryKey: ["admin-verify-metrics"],
		queryFn: getVerifyMetrics,
	});

	const {
		data: indexingMetrics,
		isLoading: indexingLoading,
		isError: indexingError,
		refetch: refetchIndexing,
	} = useQuery({
		queryKey: ["admin-indexing-metrics"],
		queryFn: getIndexingMetrics,
	});

	return (
		<div className="space-y-6">
			<PageHeader
				kicker="System"
				title="Admin Dashboard"
				description="System overview and management."
			/>

			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<StatCard
					title="Total Users"
					value={stats?.totalUsers ?? 0}
					icon={Users}
					loading={statsLoading}
					error={statsError}
				/>
				<StatCard
					title="Total Reviews"
					value={stats?.totalReviews ?? 0}
					icon={Star}
					loading={statsLoading}
					error={statsError}
				/>
				<StatCard
					title="Active Subscriptions"
					value={stats?.activeSubscriptions ?? 0}
					icon={Crown}
					loading={statsLoading}
					error={statsError}
				/>
				<StatCard
					title="Error Rate"
					value={`${stats?.errorRate ?? 0}%`}
					icon={AlertTriangle}
					loading={statsLoading}
					error={statsError}
				/>
			</div>

			{/* Verify + indexing pipeline metrics (Spec 0006 AC-4) */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base font-semibold">Pipeline Metrics</CardTitle>
					<CardDescription>
						Sandbox verify and incremental indexing health over the
						last 7 days
					</CardDescription>
				</CardHeader>
				<CardContent>
					{verifyError || indexingError ? (
						<ErrorState
							title="Couldn't load pipeline metrics"
							description="Sandbox verify and indexing health couldn't be fetched."
							onRetry={() => {
								refetchVerify();
								refetchIndexing();
							}}
						/>
					) : verifyLoading || indexingLoading ? (
						<div className="grid gap-6 md:grid-cols-2">
							{[0, 1].map((col) => (
								<div key={col} className="space-y-3">
									<Skeleton className="h-3 w-32" />
									{Array.from({ length: 5 }).map((_, i) => (
										<Skeleton key={i} className="h-4 w-full" />
									))}
								</div>
							))}
						</div>
					) : (
						<div className="grid gap-6 md:grid-cols-2">
							<div className="space-y-3">
							<h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
								Sandbox Verify
							</h3>
								<MetricRow
									label="Verified suggestions"
									value={String(verifyMetrics?.sampleCount ?? 0)}
								/>
								<MetricRow
									label="p50 duration"
									value={formatMs(verifyMetrics?.p50DurationMs)}
								/>
								<MetricRow
									label="p95 duration"
									value={formatMs(verifyMetrics?.p95DurationMs)}
								/>
								<MetricRow
									label="Sandbox error rate"
									value={`${Math.round(
										(verifyMetrics?.sandboxErrorRate ?? 0) * 100
									)}%`}
								/>
							</div>
							<div className="space-y-3">
							<h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
								Incremental Indexing
							</h3>
								<MetricRow
									label="Runs (7d)"
									value={String(indexingMetrics?.runCount ?? 0)}
								/>
								<MetricRow
									label="Avg file delta"
									value={String(indexingMetrics?.avgFileDelta ?? "—")}
								/>
								<MetricRow
									label="Max file delta"
									value={String(indexingMetrics?.maxFileDelta ?? "—")}
								/>
								<MetricRow
									label="Full re-index rate"
									value={`${Math.round(
										(indexingMetrics?.fallbackRate ?? 0) * 100
									)}%`}
								/>
								<MetricRow
									label="Failure rate"
									value={`${Math.round(
										(indexingMetrics?.failureRate ?? 0) * 100
									)}%`}
								/>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="text-base font-semibold">Reviews Over Time</CardTitle>
					<CardDescription>
						Daily review count for the last 30 days
					</CardDescription>
				</CardHeader>
				<CardContent>
					{chartError ? (
						<ErrorState
							title="Couldn't load review activity"
							description="Daily review counts couldn't be fetched."
							onRetry={() => refetchChart()}
							className="h-[300px]"
						/>
					) : chartLoading ? (
						<div className="flex h-[300px] items-end gap-2 px-2 pb-1">
							{Array.from({ length: 30 }).map((_, i) => (
								<Skeleton
									key={i}
									className="flex-1"
									style={{
											height: `${25 + ((i * 41) % 70)}%`,
									}}
								/>
							))}
						</div>
					) : (
						<ResponsiveContainer width="100%" height={300}>
							<LineChart data={reviewsOverTime}>
								<CartesianGrid
									strokeDasharray="3 3"
									stroke={CHART_GRID_STROKE}
								/>
								<XAxis
									dataKey="date"
									tick={CHART_AXIS_TICK}
									stroke={CHART_GRID_STROKE}
									tickFormatter={(value) => {
										const date = new Date(value);
										return `${date.getMonth() + 1}/${date.getDate()}`;
									}}
								/>
								<YAxis tick={CHART_AXIS_TICK} stroke={CHART_GRID_STROKE} />
								<Tooltip
									{...CHART_TOOLTIP_STYLE}
									labelFormatter={(value) =>
										new Date(value).toLocaleDateString()
									}
								/>
								<Line
									type="monotone"
									dataKey="reviews"
									stroke="var(--primary)"
									strokeWidth={2}
									dot={false}
								/>
							</LineChart>
						</ResponsiveContainer>
					)}
				</CardContent>
			</Card>

			<div className="grid gap-6 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle className="text-base font-semibold">Recent Users</CardTitle>
						<CardDescription>Latest registered users</CardDescription>
					</CardHeader>
					<CardContent>
						{usersError ? (
							<ErrorState
								title="Couldn't load users"
								description="The user list couldn't be fetched."
								onRetry={() => refetchUsers()}
							/>
						) : usersLoading ? (
							<div className="space-y-2 py-4">
								<Skeleton className="h-8 w-full" />
								<Skeleton className="h-8 w-full" />
								<Skeleton className="h-8 w-full" />
								<Skeleton className="h-8 w-full" />
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Name</TableHead>
										<TableHead>Email</TableHead>
										<TableHead>Tier</TableHead>
										<TableHead>Joined</TableHead>
									</TableRow>
								</TableHeader>									<TableBody>
										{!usersData?.users.length ? (
											<TableRow>
												<TableCell colSpan={4} className="h-32 text-center">
													<EmptyState
														kicker="Users"
														title="No users yet"
														className="py-6"
													/>
												</TableCell>
											</TableRow>
									) : (
										usersData.users.map((user) => (
											<TableRow key={user.id}>
												<TableCell className="font-medium">
													{user.name}
												</TableCell>
												<TableCell className="text-muted-foreground">
													{user.email}
												</TableCell>
												<TableCell>
													<Badge
														variant={
															user.subscriptionTier === "PRO"
																? "default"
																: "secondary"
														}
													>
														{user.subscriptionTier}
													</Badge>
												</TableCell>
												<TableCell className="text-muted-foreground">
													{new Date(
														user.createdAt
													).toLocaleDateString()}
												</TableCell>
											</TableRow>
										))
									)}
									</TableBody>
							</Table>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="text-base font-semibold">Recent Reviews</CardTitle>
						<CardDescription>Latest code reviews</CardDescription>
					</CardHeader>
					<CardContent>
						{reviewsError ? (
							<ErrorState
								title="Couldn't load reviews"
								description="Recent reviews couldn't be fetched."
								onRetry={() => refetchReviews()}
							/>
						) : reviewsLoading ? (
							<div className="space-y-2 py-4">
								<Skeleton className="h-8 w-full" />
								<Skeleton className="h-8 w-full" />
								<Skeleton className="h-8 w-full" />
								<Skeleton className="h-8 w-full" />
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>PR</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>User</TableHead>
										<TableHead>Date</TableHead>
									</TableRow>
								</TableHeader>									<TableBody>
										{!reviews?.length ? (
											<TableRow>
												<TableCell colSpan={4} className="h-32 text-center">
													<EmptyState
															kicker="Reviews"
															title="No reviews yet"
															className="py-6"
														/>
												</TableCell>
											</TableRow>
									) : (
										reviews.map((review) => (
											<TableRow key={review.id}>
												<TableCell className="font-medium">
													<a
														href={review.prUrl}
														target="_blank"
														rel="noopener noreferrer"
														className="hover:underline"
													>
														{review.prTitle} #
														{review.prNumber}
													</a>
												</TableCell>
												<TableCell>
													<Badge
														variant={
															review.status === "completed"
																? "default"
																: review.status === "error"
																	? "destructive"
																	: "secondary"
														}
													>
														{review.status}
													</Badge>
												</TableCell>
												<TableCell className="text-muted-foreground">
													{review.repository.user.name}
												</TableCell>
												<TableCell className="text-muted-foreground">
													{new Date(
														review.createdAt
													).toLocaleDateString()}
												</TableCell>
											</TableRow>
										))
									)}
									</TableBody>
							</Table>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

function formatMs(ms: number | null | undefined): string {
	if (ms === null || ms === undefined) return "—";
	if (ms < 1000) return `${ms}ms`;
	return `${(ms / 1000).toFixed(1)}s`;
}

function MetricRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-center justify-between gap-4">
			<span className="text-sm text-muted-foreground">{label}</span>
			<span className="text-sm font-semibold tabular-nums">{value}</span>
		</div>
	);
}

function StatCard({
	title,
	value,
	icon: Icon,
	loading,
	error,
}: {
	title: string;
	value: string | number;
	icon: React.ComponentType<{ className?: string }>;
	loading: boolean;
	error: boolean;
}) {
	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle className="text-sm font-medium">{title}</CardTitle>
				<Icon className="h-4 w-4 text-muted-foreground" />
			</CardHeader>				<CardContent>
					{loading ? (
						<Skeleton className="h-7 w-16" />
					) : error ? (
						<div className="font-display text-2xl tracking-tight text-muted-foreground">—</div>
					) : (
						<div className="font-display text-2xl tracking-tight">{value}</div>
					)}
			</CardContent>
		</Card>
	);
}
