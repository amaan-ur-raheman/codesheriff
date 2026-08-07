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
import {
	Users,
	Star,
	Crown,
	AlertTriangle,
	Loader2,
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

export default function AdminPageClient() {
	const { data: session } = useSession();
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const user = session?.user as any;

	if (user?.role !== "admin") {
		return (
			<div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
				<Shield className="w-16 h-16 text-muted-foreground" />
				<h1 className="text-2xl font-bold">Access Denied</h1>
				<p className="text-muted-foreground">
					You do not have permission to access the admin dashboard.
				</p>
			</div>
		);
	}

	return <AdminDashboard />;
}

function AdminDashboard() {
	const { data: stats, isLoading: statsLoading } = useQuery({
		queryKey: ["admin-stats"],
		queryFn: getAdminStats,
	});

	const { data: usersData, isLoading: usersLoading } = useQuery({
		queryKey: ["admin-users"],
		queryFn: () => getUsersList(1, 10),
	});

	const { data: reviews, isLoading: reviewsLoading } = useQuery({
		queryKey: ["admin-reviews"],
		queryFn: () => getRecentReviews(10),
	});

	const { data: reviewsOverTime, isLoading: chartLoading } = useQuery({
		queryKey: ["admin-reviews-over-time"],
		queryFn: getReviewsOverTime,
	});

	const { data: verifyMetrics, isLoading: verifyLoading } = useQuery({
		queryKey: ["admin-verify-metrics"],
		queryFn: getVerifyMetrics,
	});

	const { data: indexingMetrics, isLoading: indexingLoading } = useQuery({
		queryKey: ["admin-indexing-metrics"],
		queryFn: getIndexingMetrics,
	});

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold tracking-tight">
					Admin Dashboard
				</h1>
				<p className="text-muted-foreground">
					System overview and management.
				</p>
			</div>

			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<StatCard
					title="Total Users"
					value={stats?.totalUsers ?? 0}
					icon={Users}
					loading={statsLoading}
				/>
				<StatCard
					title="Total Reviews"
					value={stats?.totalReviews ?? 0}
					icon={Star}
					loading={statsLoading}
				/>
				<StatCard
					title="Active Subscriptions"
					value={stats?.activeSubscriptions ?? 0}
					icon={Crown}
					loading={statsLoading}
				/>
				<StatCard
					title="Error Rate"
					value={`${stats?.errorRate ?? 0}%`}
					icon={AlertTriangle}
					loading={statsLoading}
				/>
			</div>

			{/* Verify + indexing pipeline metrics (Spec 0006 AC-4) */}
			<Card>
				<CardHeader>
					<CardTitle>Pipeline Metrics</CardTitle>
					<CardDescription>
						Sandbox verify and incremental indexing health over the
						last 7 days
					</CardDescription>
				</CardHeader>
				<CardContent>
					{verifyLoading || indexingLoading ? (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
						</div>
					) : (
						<div className="grid gap-6 md:grid-cols-2">
							<div className="space-y-3">
								<h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
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
								<h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
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
					<CardTitle>Reviews Over Time</CardTitle>
					<CardDescription>
						Daily review count for the last 30 days
					</CardDescription>
				</CardHeader>
				<CardContent>
					{chartLoading ? (
						<div className="h-[300px] flex items-center justify-center">
							<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
						</div>
					) : (
						<ResponsiveContainer width="100%" height={300}>
							<LineChart data={reviewsOverTime}>
								<CartesianGrid
									strokeDasharray="3 3"
									className="stroke-muted"
								/>
								<XAxis
									dataKey="date"
									tick={{ fontSize: 12 }}
									tickFormatter={(value) => {
										const date = new Date(value);
										return `${date.getMonth() + 1}/${date.getDate()}`;
									}}
								/>
								<YAxis tick={{ fontSize: 12 }} />
								<Tooltip
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
						<CardTitle>Recent Users</CardTitle>
						<CardDescription>Latest registered users</CardDescription>
					</CardHeader>
					<CardContent>
						{usersLoading ? (
							<div className="flex items-center justify-center py-8">
								<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
								</TableHeader>
								<TableBody>
									{usersData?.users.map((user) => (
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
									))}
								</TableBody>
							</Table>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Recent Reviews</CardTitle>
						<CardDescription>Latest code reviews</CardDescription>
					</CardHeader>
					<CardContent>
						{reviewsLoading ? (
							<div className="flex items-center justify-center py-8">
								<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
								</TableHeader>
								<TableBody>
									{reviews?.map((review) => (
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
									))}
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
}: {
	title: string;
	value: string | number;
	icon: React.ComponentType<{ className?: string }>;
	loading: boolean;
}) {
	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle className="text-sm font-medium">{title}</CardTitle>
				<Icon className="h-4 w-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				{loading ? (
					<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
				) : (
					<div className="text-2xl font-bold">{value}</div>
				)}
			</CardContent>
		</Card>
	);
}
