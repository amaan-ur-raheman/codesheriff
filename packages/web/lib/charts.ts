/**
 * Shared recharts styling — paper-toned tooltips, axis ticks, and grid lines
 * that follow the Editorial Paper tokens (see DESIGN.md → Charts). Import
 * these into any chart instead of restyling per-chart so the data
 * surfaces stay on-register.
 */
export const CHART_TOOLTIP_STYLE = {
	contentStyle: {
		backgroundColor: "var(--card)",
		border: "1px solid var(--border)",
		borderRadius: 0,
		boxShadow: "var(--shadow-sm)",
	},
	labelStyle: {
		color: "var(--foreground)",
		fontFamily: "var(--font-mono)",
		fontSize: 11,
		letterSpacing: "0.14em",
		textTransform: "uppercase",
		paddingBottom: 4,
	},
	itemStyle: {
		color: "var(--muted-foreground)",
		fontSize: 12,
		padding: 0,
	},
} as const;

export const CHART_AXIS_TICK = {
	fill: "var(--muted-foreground)",
	fontSize: 12,
} as const;

export const CHART_GRID_STROKE = "var(--border)";
