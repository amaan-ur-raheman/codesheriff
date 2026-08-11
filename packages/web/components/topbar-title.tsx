/**
 * Route-aware topbar title for the dashboard shell.
 *
 * Replaces the hardcoded "Dashboard" heading with the label of the active
 * section (matching the sidebar's navigation vocabulary). Falls back to the
 * nearest ancestor route so nested pages (e.g. a future /dashboard/reviews/[id])
 * still resolve to a sensible label.
 */
"use client";

import { usePathname } from "next/navigation";

const TITLES: Record<string, string> = {
	"/dashboard": "Dashboard",
	"/dashboard/repository": "Repositories",
	"/dashboard/reviews": "Reviews",
	"/dashboard/organizations": "Teams",
	"/dashboard/subscriptions": "Subscriptions",
	"/dashboard/integrations": "Integrations",
	"/dashboard/settings": "Settings",
	"/dashboard/admin": "Admin",
};

// Longest-first so a nested path resolves to its most specific ancestor.
const ROUTES = Object.keys(TITLES).sort((a, b) => b.length - a.length);

export function TopbarTitle() {
	const pathname = usePathname();

	const title = ROUTES.find(
		(route) => pathname === route || pathname.startsWith(route + "/")
	);

	return (
		<p className="font-display text-lg tracking-tight text-foreground">
			{title ? TITLES[title] : "Dashboard"}
		</p>
	);
}
