"use client";

import { ActivityCalendar } from "react-activity-calendar";
import { useTheme } from "next-themes";
import { useQuery } from "@tanstack/react-query";

import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { getContributionStats } from "@/modules/dashboard/actions";

const ContributionGraph = () => {
	const { theme } = useTheme();

	const { data, isLoading } = useQuery({
		queryKey: ["contribution-graph"],
		queryFn: async () => await getContributionStats(),
		staleTime: 1000 * 60 * 5,
	});

	if (isLoading) {
		return (
			<div className="flex w-full flex-col items-center gap-4 p-4">
				<Skeleton className="h-4 w-44" />
				<div className="grid grid-flow-col auto-cols-max gap-1">
					{Array.from({ length: 26 }).map((_, i) => (
						<Skeleton key={i} className="h-3 w-3" />
					))}
				</div>
			</div>
		);
	}

	if (!data || !data.contributions.length) {
		return (
			<div className="w-full">
				<EmptyState
					kicker="Contributions"
					title="No contribution data yet"
					description="Once you push code and receive reviews, your yearly contribution graph will fill in."
				/>
			</div>
		);
	}

	return (
		<div className="w-full flex flex-col items-center gap-4 p-4">
			<div className="text-sm text-muted-foreground">
				<span className="font-semibold text-foreground">
					{data.totalContributions}
				</span>{" "}
				contributions in last year
			</div>

			<div className="w-full overflow-x-auto">
				<div className="flex justify-center min-w-max px-4">
					<ActivityCalendar
						data={data.contributions}
						colorScheme={theme === "dark" ? "dark" : "light"}
                        blockSize={11}
                        blockMargin={4}
                        fontSize={14}
                        showWeekdayLabels
                        showMonthLabels						theme={
							{
								light: ["#ebe4d4", "#2e7d5b"],
								dark: ["#241e15", "#34d399"]
							}
						}
					/>
				</div>
			</div>
		</div>
	);
};

export default ContributionGraph;
