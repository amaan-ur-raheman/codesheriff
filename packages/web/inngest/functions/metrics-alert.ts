import { inngest } from "../client";
import { runMetricsAlertCheck } from "@/modules/admin/actions/metrics";

/**
 * Scheduled verify/indexing alert check (Spec 0006 AC-3).
 *
 * Runs every 6 hours: computes the trailing-7-day metrics, evaluates the
 * configured thresholds, and delivers any fired alerts to org webhooks,
 * admin email, and in-app notifications. No event data — purely a cron.
 */
export const metricsAlertCheck = inngest.createFunction(
	{
		id: "metrics-alert-check",
		concurrency: { limit: 1 },
	},
	{ cron: "0 */6 * * *" },
	async () => {
		const result = await runMetricsAlertCheck();
		return {
			alerts: result.alerts.length,
			attemptedOrgs: result.attemptedOrgs,
			deliveredToUsers: result.deliveredToUsers,
		};
	}
);
