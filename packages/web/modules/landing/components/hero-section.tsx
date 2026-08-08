"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, CheckCircle2, GitPullRequest, Star } from "lucide-react";
import { HeroCanvas } from "./hero-canvas";
import { gsap, EASE } from "../lib/gsap";

export function HeroSection() {
	const rootRef = useRef<HTMLElement>(null);

	useEffect(() => {
		const ctx = gsap.context(() => {
			const mm = gsap.matchMedia();
			mm.add("(prefers-reduced-motion: no-preference)", () => {
				const targets = gsap.utils.toArray<HTMLElement>(
					".hero-eyebrow, .hero-line, .hero-sub, .hero-cta, .hero-card",
				);

				// Explicit initial states rather than `from` tweens: a context
				// revert or HMR remount restores `set()` cleanly, so no element
				// can ever be left stuck at its hidden start state.
				gsap.set(".hero-eyebrow", { opacity: 0, y: 14 });
				gsap.set(".hero-line", { yPercent: 112 });
				gsap.set(".hero-sub", { opacity: 0, y: 22 });
				gsap.set(".hero-cta", { opacity: 0, y: 16 });
				gsap.set(".hero-card", { opacity: 0, y: 44, scale: 0.97 });

				const tl = gsap.timeline({ defaults: { ease: EASE } });
				tl.to(".hero-eyebrow", { opacity: 1, y: 0, duration: 0.5 }, 0.1)
					.to(
						".hero-line",
						{ yPercent: 0, duration: 0.9, stagger: 0.12 },
						0.3,
					)
					.to(".hero-sub", { opacity: 1, y: 0, duration: 0.6 }, 0.8)
					.to(
						".hero-cta",
						{ opacity: 1, y: 0, duration: 0.5, stagger: 0.09 },
						0.95,
					)
					.to(".hero-card", { opacity: 1, y: 0, scale: 1, duration: 0.95 }, 0.45)
					.eventCallback("onComplete", () => {
						// Entrance done — leave zero inline styles behind so the
						// hero is pure CSS state from here on.
						gsap.set(targets, { clearProps: "all" });
					});
			});
		}, rootRef);
		return () => ctx.revert();
	}, []);

	return (
		<section
			ref={rootRef}
			className="relative min-h-[100dvh] flex items-center overflow-hidden pt-20"
		>
			{/* Three.js neon star + particle field, faded so it never fights the text */}
			<div className="absolute inset-0 opacity-80 [mask-image:radial-gradient(ellipse_75%_70%_at_68%_45%,black,transparent_75%)]">
				<HeroCanvas />
			</div>
			{/* faint magenta bloom behind the copy for depth */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute -left-40 top-1/3 h-[30rem] w-[30rem] rounded-full bg-neon/10 blur-3xl"
			/>

			<div className="relative mx-auto w-full max-w-7xl px-6 py-12 grid lg:grid-cols-2 gap-16 items-center">
				<div>
					<p className="hero-eyebrow inline-flex items-center gap-2 rounded-full border border-neon/30 bg-neon/5 px-3 py-1 font-mono text-xs font-medium text-neon-text">
						<span className="h-1.5 w-1.5 rounded-full bg-neon" />
						AI code review on every pull request
					</p>

					<h1 className="mt-6 text-5xl sm:text-6xl lg:text-7xl font-bold tracking-[-0.04em] leading-[1.02] text-balance">
						<span className="hero-line-mask block overflow-hidden pb-1">
							<span className="hero-line block">Your code,</span>
						</span>
						<span className="hero-line-mask block overflow-hidden pb-1">
							<span className="hero-line block text-neon">
								under review.
							</span>
						</span>
					</h1>

					<p className="hero-sub mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
						Automated reviews that catch bugs and enforce your standards
						before code hits production.
					</p>

					<div className="mt-10 flex flex-wrap gap-4">
						<Button size="lg" className="hero-cta px-8" asChild>
							<a href="/login">
								Get Started
								<ArrowRight className="ml-2 h-4 w-4" />
							</a>
						</Button>
						<Button
							size="lg"
							variant="outline"
							className="hero-cta"
							asChild
						>
							<a href="#how-it-works">See how it works</a>
						</Button>
					</div>
				</div>

				{/* Real component preview: a review-result card */}
				<div className="hero-card relative">
					{/* neon edge accent */}
					<div
						aria-hidden="true"
						className="pointer-events-none absolute -inset-px rounded-xl bg-gradient-to-b from-neon/40 via-transparent to-transparent opacity-60"
					/>
					<div className="rounded-xl border border-border bg-card shadow-lg overflow-hidden">
						<div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
							<div className="flex items-center gap-2.5 min-w-0">
								<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-neon/10 text-neon">
									<GitPullRequest className="h-4 w-4" />
								</div>
								<div className="min-w-0">
									<p className="truncate text-sm font-medium leading-tight">
										acme/web-app
									</p>
									<p className="text-xs text-muted-foreground">
										pull request #347
									</p>
								</div>
							</div>
							<Badge
								variant="outline"
								className="shrink-0 border-neon/40 bg-neon/5 text-neon-text"
							>
								AI Review
							</Badge>
						</div>

						<div className="space-y-0.5 px-4 py-3 font-mono text-[13px] leading-relaxed">
							<div className="flex gap-3">
								<span className="w-4 shrink-0 select-none text-muted-foreground/40">
									+
								</span>
								<span className="text-verified">
									const validateInput = (data: UserInput) =&gt; {"{"}
								</span>
							</div>
							<div className="flex gap-3">
								<span className="w-4 shrink-0 select-none text-muted-foreground/40">
									+
								</span>
								<span className="text-verified">
									{"  "}if (!data.email) throw new ValidationError();
								</span>
							</div>
							<div className="flex gap-3">
								<span className="w-4 shrink-0 select-none text-muted-foreground/40">
									+
								</span>
								<span className="text-verified">
									{"  "}return sanitize(data);
								</span>
							</div>
							<div className="flex gap-3">
								<span className="w-4 shrink-0 select-none text-muted-foreground/40">
									+
								</span>
								<span className="text-verified">{"}"}</span>
							</div>
						</div>

						<div className="mx-4 mb-4 rounded-lg border border-border bg-muted/40 p-3.5">
							<div className="mb-2 flex items-center justify-between gap-2">
								<p className="text-xs font-medium">
									Input validation missing
								</p>
								<span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-verified">
									<CheckCircle2 className="h-3 w-3" />
									Sandbox verified
								</span>
							</div>
							<p className="text-xs leading-relaxed text-muted-foreground">
								Add{" "}
								<code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">
									isEmail()
								</code>{" "}
								validation before data reaches the database layer.
							</p>
						</div>
					</div>

					{/* floating badge on the card, anchored with a subtle motion-free layout */}
					<div
						aria-hidden="true"
						className="absolute -right-3 -top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-neon/40 bg-background shadow-md"
					>
						<Star className="h-4 w-4 text-neon" />
					</div>
				</div>
			</div>
		</section>
	);
}
