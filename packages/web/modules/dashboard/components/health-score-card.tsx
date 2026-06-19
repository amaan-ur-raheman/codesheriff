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
import { Spinner } from "@/components/ui/spinner";
import { getHealthScores } from "@/modules/repository/actions/health-score";

function getScoreColor(score: number): string {
	if (score >= 80) return "text-emerald-500";
	if (score >= 60) return "text-yellow-500";
	if (score >= 40) return "text-orange-500";
	return "text-red-500";
}

function getScoreStrokeColor(score: number): string {
	if (score >= 80) return "#10b981";
	if (score >= 60) return "#eab308";
	if (score >= 40) return "#f97316";
	return "#ef4444";
}

function getScoreBgColor(score: number): string {
	if (score >= 80) return "bg-emerald-500/10";
	if (score >= 60) return "bg-yellow-500/10";
	if (score >= 40) return "bg-orange-500/10";
	return "bg-red-500/10";
}

function TrendArrow({
	current,
	previous,
}: {
	current: number;
	previous: number;
}) {
	if (current > previous) {
		return <TrendingUp className="h-4 w-4 text-emerald-500" />;
	}
	if (current < previous) {
		return <TrendingDown className="h-4 w-4 text-red-500" />;
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
				className={`absolute text-xl font-bold ${getScoreColor(score)}`}
			>
				{score}
			</span>
		</div>
	);
}

export function HealthScoreCard() {
	const { data: scores = [], isLoading } = useQuery({
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
				<CardContent className="flex justify-center py-4">
					<Spinner />
				</CardContent>
			</Card>
		);
	}

	if (scores.length === 0) {
		return null;
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
				<CardContent className="flex justify-center py-4">
					<Spinner />
				</CardContent>
			</Card>
		);
	}

	const validScores = trend
		.filter((t) => t.healthScore !== null)
		.map((t) => ({ score: t.healthScore }));

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
