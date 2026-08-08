"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { gsap, EASE } from "../lib/gsap";

export function HeroSection() {
	const rootRef = useRef<HTMLElement>(null);

	useEffect(() => {
		const ctx = gsap.context(() => {
			const mm = gsap.matchMedia();
			mm.add("(prefers-reduced-motion: no-preference)", () => {
				const targets = gsap.utils.toArray<HTMLElement>(
					".hero-kicker, .hero-line, .hero-sub, .hero-cta, .hero-stats, .hero-sheet",
				);

				// Explicit initial states, never `from` tweens: a context
				// revert or HMR remount restores `set()` cleanly, so nothing
				// can be left stuck at a hidden state.
				gsap.set(".hero-kicker", { opacity: 0, y: 12 });
				gsap.set(".hero-line", { yPercent: 112 });
				gsap.set(".hero-sub", { opacity: 0, y: 20 });
				gsap.set(".hero-cta", { opacity: 0, y: 14 });
				gsap.set(".hero-stats", { opacity: 0, y: 16 });
				gsap.set(".hero-sheet", { opacity: 0, y: 36 });

				const tl = gsap.timeline({ defaults: { ease: EASE } });
				tl.to(".hero-kicker", { opacity: 1, y: 0, duration: 0.5 }, 0.05)
					.to(
						".hero-line",
						{ yPercent: 0, duration: 0.9, stagger: 0.13 },
						0.25,
					)
					.to(".hero-sub", { opacity: 1, y: 0, duration: 0.6 }, 0.75)
					.to(
						".hero-cta",
						{ opacity: 1, y: 0, duration: 0.5, stagger: 0.09 },
						0.9,
					)
					.to(".hero-stats", { opacity: 1, y: 0, duration: 0.55 }, 1.0)
					.to(".hero-sheet", { opacity: 1, y: 0, duration: 0.9 }, 0.5);

				// Count-up the stat numerals once the stats row settles.
				gsap.utils.toArray<HTMLElement>(".hero-stat-num").forEach((el) => {
					const target = Number(el.dataset.count || "0");
					const obj = { v: 0 };
					tl.to(
						obj,
						{
							v: target,
							duration: 1.3,
							ease: "power3.out",
							onUpdate: () => {
								el.textContent =
									target >= 1000
										? Math.round(obj.v).toLocaleString("en-US")
										: String(Math.round(obj.v));
							},
						},
						1.05,
					);
				});

				tl.eventCallback("onComplete", () => {
					// Entrance done — leave zero inline styles behind.
					gsap.set(targets, { clearProps: "all" });
				});
			});
		}, rootRef);
		return () => {
			// Restore the static numerals — the count-up mutates textContent,
			// which a context revert won't restore (StrictMode/HMR remount
			// safety: a mid-count teardown leaves the markup value intact).
			gsap.utils.toArray<HTMLElement>(".hero-stat-num").forEach((el) => {
				el.textContent = el.dataset.static || "";
			});
			ctx.revert();
		};
	}, []);

	return (
		<section
			ref={rootRef}
			className="relative overflow-hidden pt-40 pb-24"
		>
			{/* hairline top meta row */}
			<div className="hero-kicker mx-auto flex max-w-7xl items-center justify-between border-t border-border px-6 pt-4 pb-2">
				<p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
					Automated code review · for GitHub
				</p>
				<p className="hidden font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground sm:block">
					Edition 01 · 2026
				</p>
			</div>

			<div className="mx-auto mt-10 grid max-w-7xl items-center gap-16 px-6 lg:grid-cols-12 lg:gap-10">
				{/* ---- copy ---- */}
				<div className="lg:col-span-7">
					<h1 className="font-display text-[clamp(2.75rem,5vw+1rem,5.25rem)] font-semibold leading-[1.05] tracking-[-0.02em] text-balance">
						<span className="hero-line-mask block overflow-hidden pb-3">
							<span className="hero-line block">Your code,</span>
						</span>
						<span className="hero-line-mask block overflow-hidden pb-5">
							<span className="hero-line block font-medium italic text-brand">
								under review.
							</span>
						</span>
					</h1>

					<p className="hero-sub mt-7 max-w-md text-lg leading-relaxed text-muted-foreground">
						Every pull request is read by an AI that catches bugs,
						blocks regressions, and enforces your standards. Every fix
						is verified in a sandbox before it reaches your branch.
					</p>

					<div className="mt-10 flex flex-wrap items-center gap-8">
						<Button size="lg" className="hero-cta rounded-none px-8" asChild>
							<a href="/login">
								Get started
								<ArrowRight className="ml-2 h-4 w-4" />
							</a>
						</Button>
						<a
							href="#how-it-works"
							className="hero-cta text-sm text-foreground underline decoration-border underline-offset-[6px] transition-colors duration-200 hover:decoration-brand"
						>
							See how it works
						</a>
					</div>

					<div className="hero-stats mt-14 flex flex-wrap gap-x-10 gap-y-4 border-t border-border pt-6">
						{[
							{ value: 12400, display: "12,400", suffix: "+", label: "PRs reviewed" },
							{ value: 14, display: "14", suffix: "s", label: "median review" },
							{ value: 100, display: "100", suffix: "%", label: "fixes sandboxed" },
						].map((stat) => (
							<div key={stat.label}>
								<p className="font-display text-2xl font-semibold tracking-tight tabular-nums">
									<span
										className="hero-stat-num"
										data-count={stat.value}
										data-static={stat.display}
									>
										{stat.display}
									</span>
									{stat.suffix}
								</p>
								<p className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
									{stat.label}
								</p>
							</div>
						))}
					</div>
				</div>

				{/* ---- review sheet specimen ---- */}
				<div className="hero-sheet lg:col-span-5">
					<div className="border border-border bg-card shadow-sm">
						{/* sheet header */}
						<div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
							<div className="min-w-0">
								<p className="truncate font-mono text-[13px] font-medium">
									acme/web-app · pull request #347
								</p>
								<p className="font-mono text-[11px] text-muted-foreground">
									src/validation.ts · 4 comments
								</p>
							</div>
							<span className="shrink-0 border border-brand/50 bg-brand-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-brand-text">
								AI review
							</span>
						</div>

						{/* diff */}
						<div className="border-b border-border px-5 py-4 font-mono text-[12.5px] leading-relaxed">
							<div className="flex gap-3">
								<span className="w-4 shrink-0 select-none text-muted-foreground/40">
									−
								</span>
								<span className="text-muted-foreground line-through decoration-muted-foreground/40">
									const password = req.body.password;
								</span>
							</div>
							<div className="flex gap-3">
								<span className="w-4 shrink-0 select-none text-muted-foreground/40">
									+
								</span>
								<span className="text-verified">
									const hashed = await argon2.hash(req.body.password);
								</span>
							</div>
						</div>

						{/* finding */}
						<div className="px-5 py-4">
							<div className="mb-2 flex items-center justify-between gap-3">
								<p className="text-[13px] font-medium">
									<span className="mr-2 font-mono text-[11px] text-brand-text">
										01
									</span>
									Input validation missing
								</p>
								<span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-verified">
									Sandbox verified
								</span>
							</div>
							<p className="text-[13px] leading-relaxed text-muted-foreground">
								Add{" "}
								<code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">
									isEmail()
								</code>{" "}
								validation before data reaches the database layer.
							</p>
						</div>
					</div>
					<p className="mt-3 text-right font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
						Fig. 01 · a live review, unretouched
					</p>
				</div>
			</div>
		</section>
	);
}
