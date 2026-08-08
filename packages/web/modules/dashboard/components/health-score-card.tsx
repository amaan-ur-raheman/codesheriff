"use client";

import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { getHealthScores } from "@/modules/repository/actions/health-score";

function getScoreColor(score: number): string {
	if (score >= 80) return "text-verified";
	if (score >= 60) return "text-chart-2";
	if (score >= 40) return "text-brand-text";
	return "text-destructive";
}

function getScoreStrokeColor(score: number): string {
	if (score >= 80) return "var(--verified)";
	if (score >= 60) return "var(--chart-2)";
	if (score >= 40) return "var(--brand-text)";
	return "var(--destructive)";
}

function TrendArrow({
	current,
	previous,
}: {
	current: number;
	previous: number;
}) {
	if (current > previous) {
		return <TrendingUp className="h-4 w-4 text-verified" />;
	}
	if (current < previous) {
		return <TrendingDown className="h-4 w-4 text-destructive" />;
	}
	return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function CircularScore({ score }: { score: number }) {
	const radius = 40;
	const circumference = 2 * Math.PI * radius;
	const offset = circumference - (score / 100) * circumference;
	const color = getScoreStrokeColor(score);

	return (
		<div className="relative inline-flex items-center justify-center">
			<svg width="100" height="100" className="-rotate-90">
				<circle
					cx="50"
					cy="50"
					r={radius}
					stroke="currentColor"
					strokeWidth="8"
					className="text-muted/20"
					fill="none"
				/>
				<circle
					cx="50"
					cy="50"
					r={radius}
					stroke={color}
					strokeWidth="8"
					strokeDasharray={circumference}
					strokeDashoffset={offset}
					strokeLinecap="round"
					fill="none"
					className="transition-all duration-1000"
				/>
			</svg>
			<span
				className={`absolute font-display text-xl tracking-tight ${getScoreColor(score)}`}
			>
				{score}
			</span>
		</div>
	);
}

export function HealthScoreCard() {
	const {
		data: scores = [],
		isLoading,
		isError,
		refetch,
	} = useQuery({
		queryKey: ["health-scores"],
		queryFn: () => getHealthScores(),
	});

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-sm font-medium">
						Codebase Health
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex items-center gap-6">
						<Skeleton className="h-24 w-24 shrink-0" />
						<div className="flex-1 space-y-3">
							<Skeleton className="h-4 w-40" />
							<Skeleton className="h-3 w-28" />
							<Skeleton className="h-3 w-24" />
							<Skeleton className="h-3 w-32" />
						</div>
					</div>
				</CardContent>
			</Card>
		);
	}

	if (isError) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-sm font-medium">
						Codebase Health
					</CardTitle>
				</CardHeader>
				<CardContent>
					<ErrorState
						title="Couldn't load health scores"
						description="Repository health scores couldn't be fetched."
						onRetry={() => refetch()}
					/>
				</CardContent>
			</Card>
		);
	}

	if (scores.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-sm font-medium">
						Codebase Health
					</CardTitle>
				</CardHeader>
				<CardContent>
					<EmptyState
						kicker="Health"
						title="No health data yet"
						description="Health scores appear once your repositories have review activity."
						action={
							<Button variant="outline" size="sm" asChild>
								<a href="/dashboard/repository">
									View repositories
								</a>
							</Button>
						}
					/>
				</CardContent>
			</Card>
		);
	}

	const avgScore = Math.round(
		scores.reduce((sum, s) => sum + s.healthScore, 0) / scores.length
	);

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle className="text-sm font-medium">
					Codebase Health
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="flex items-center gap-6">
					<CircularScore score={avgScore} />
					<div className="flex-1 space-y-3">
						<p className="text-sm text-muted-foreground">
							Average across {scores.length}{" "}
							{scores.length === 1 ? "repository" : "repositories"}
						</p>
						<div className="space-y-2">
							{scores.slice(0, 3).map((repo) => (
								<div
									key={repo.repositoryId}
									className="flex items-center justify-between"
								>
									<span className="text-sm truncate max-w-[120px]">
										{repo.repositoryName}
									</span>
									<div className="flex items-center gap-2">
										<span
											className={`text-sm font-medium ${getScoreColor(repo.healthScore)}`}
										>
											{repo.healthScore}
										</span>
										<div className="w-16 h-6">
											<ResponsiveContainer width="100%" height="100%">
												<LineChart
													data={[repo].map((r) => ({
														score: r.healthScore,
													}))}
												>
													<Line
														type="monotone"
														dataKey="score"
														stroke={getScoreStrokeColor(
															repo.healthScore
														)}
													 strokeWidth={2}
														dot={false}
													/>
												</LineChart>
											</ResponsiveContainer>
										</div>
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

export function RepositoryHealthCard({
	repositoryId,
	repositoryName,
}: {
	repositoryId: string;
	repositoryName: string;
}) {
	const { data: trend = [], isLoading } = useQuery({
		queryKey: ["health-trend", repositoryId],
		queryFn: async () => {
			const { getHealthTrend } = await import(
				"@/modules/repository/actions/health-score"
			);
			return getHealthTrend(repositoryId, 6);
		},
	});

	if (isLoading) {
		return (
			<Card>
				<CardContent>
					<div className="flex items-center gap-4">
						<Skeleton className="h-20 w-20 shrink-0" />
						<div className="flex-1 space-y-2">
							<Skeleton className="h-3 w-full" />
							<Skeleton className="h-3 w-3/4" />
						</div>
					</div>
				</CardContent>
			</Card>
		);
	}

	const validScores = trend
		.filter((t) => t.healthScore !== null)
		.map((t) => ({ score: t.healthScore }));

	if (!isLoading && validScores.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-sm font-medium">
						{repositoryName}
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
						No trend data yet
					</p>
				</CardContent>
			</Card>
		);
	}

	const currentScore = validScores.length > 0 ? validScores[validScores.length - 1].score! : 0;
	const previousScore = validScores.length > 1 ? validScores[validScores.length - 2].score! : currentScore;

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle className="text-sm font-medium">
					{repositoryName}
				</CardTitle>
				<TrendArrow current={currentScore} previous={previousScore} />
			</CardHeader>
			<CardContent>
				<div className="flex items-center gap-4">
					<CircularScore score={currentScore} />
					<div className="flex-1 h-12">
						{validScores.length > 0 && (
							<ResponsiveContainer width="100%" height="100%">
								<LineChart data={validScores}>
									<Line
										type="monotone"
										dataKey="score"
										stroke={getScoreStrokeColor(currentScore)}
										strokeWidth={2}
										dot={false}
									/>
								</LineChart>
							</ResponsiveContainer>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
