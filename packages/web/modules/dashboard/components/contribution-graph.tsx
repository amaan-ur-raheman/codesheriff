"use client";

import { ActivityCalendar } from "react-activity-calendar";
import { useTheme } from "next-themes";
import { useQuery } from "@tanstack/react-query";

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
			<div className="w-full flex flex-col items-center justify-center p-8">
				<div className="animate-pulse text-muted-foreground">
					Loading contribution data...
				</div>
			</div>
		);
	}

	if (!data || !data.contributions.length) {
		return (
			<div className="w-full flex flex-col items-center justify-center p-8">
				<div className="text-muted-foreground">
					No contribution data available
				</div>
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
                        showMonthLabels
                        theme={
                            {
                                light: ["hsl(0, 0%, 92%)", "hsl(142, 71%, 45%)"],
                                dark: ["#161b22", "hsl(142, 71%, 45%)"]
                            }
                        }
					/>
				</div>
			</div>
		</div>
	);
};

export default ContributionGraph;
