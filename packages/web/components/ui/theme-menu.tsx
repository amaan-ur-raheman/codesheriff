"use client";

/**
 * Shared theme preference menu — the Light / Dark / System selector used by
 * the sidebar footer dropdown (and reusable on any future surface).
 *
 * Editorial Paper treatment:
 * - Mono kicker above the options (the system voice for group labels).
 * - Sharp-corner active marker: a tiny brand square (`bg-brand`) on the
 *   selected row — sparse accent, never a pill or circle.
 * - Active row reads in `foreground`, inactive rows in `muted-foreground`
 *   with a quiet accent hover.
 *
 * The component owns its own `mounted` guard (not the parent's), so it is
 * hydration-safe wherever it is dropped in — reading `theme` from next-themes
 * in render is only safe after mount. Theme values (`light`/`dark`/`system`)
 * are exactly what next-themes `setTheme` expects.
 */

import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const THEME_OPTIONS = [
	{ value: "light", label: "Light", icon: Sun },
	{ value: "dark", label: "Dark", icon: Moon },
	{ value: "system", label: "System", icon: Monitor },
] as const;

export function ThemeMenu() {
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	return (
		<>
			<p className="px-3 pb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
				Theme
			</p>
			{THEME_OPTIONS.map((option) => {
				const active = mounted && theme === option.value;
				return (						<DropdownMenuItem
							key={option.value}
							onSelect={() => setTheme(option.value)}
							className={cn(
								"cursor-pointer px-3 py-3 transition-colors text-sm font-medium",
								active
									? "text-foreground hover:bg-accent/40"
									: "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
							)}
						>
							<option.icon
								className={cn(
									"w-5 h-5 shrink-0",
									active && "text-foreground"
								)}
							/>
						<span>{option.label}</span>
						{active && (
							<span
								aria-hidden="true"
								className="ml-auto h-1.5 w-1.5 bg-brand"
							/>
						)}
					</DropdownMenuItem>
				);
			})}
		</>
	);
}
