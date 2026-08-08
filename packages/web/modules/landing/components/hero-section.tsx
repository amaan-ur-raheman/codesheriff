"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, CheckCircle2, GitPullRequest } from "lucide-react";
import { HeroCanvas } from "./hero-canvas";
import { gsap, EASE } from "../lib/gsap";

export function HeroSection() {
	const rootRef = useRef<HTMLElement>(null);

	useEffect(() => {
		const ctx = gsap.context(() => {
			const mm = gsap.matchMedia();
			mm.add("(prefers-reduced-motion: no-preference)", () => {
				const tl = gsap.timeline({ defaults: { ease: EASE } });
				tl.from(".hero-eyebrow", { opacity: 0, y: 14, duration: 0.5 }, 0.1)
					.from(
						".hero-line",
						{ opacity: 0, y: 30, duration: 0.85, stagger: 0.13 },
						0.3,
					)
					.from(".hero-sub", { opacity: 0, y: 22, duration: 0.6 }, 0.75)
					.from(
						".hero-cta",
						{ opacity: 0, y: 16, duration: 0.5, stagger: 0.09 },
						0.9,
					)
					.from(".hero-meta", { opacity: 0, duration: 0.5 }, 1.05)
					.from(
						".hero-card",
						{ opacity: 0, y: 44, scale: 0.97, duration: 0.95 },
						0.4,
					);
			});
		}, rootRef);
		return () => ctx.revert();
	}, []);

	return (
		<section
			ref={rootRef}
			className="relative min-h-[100dvh] flex items-center overflow-hidden pt-16"
		>
			{/* Three.js star + particle field, faded out at the edges so it never fights the text */}
			<div className="absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_75%_70%_at_70%_45%,black,transparent_75%)]">
				<HeroCanvas />
			</div>

			<div className="relative mx-auto w-full max-w-7xl px-6 py-12 grid lg:grid-cols-2 gap-16 items-center">
				<div>
					<p className="hero-eyebrow inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 font-mono text-xs font-medium text-primary">
						<span className="h-1.5 w-1.5 rounded-full bg-primary" />
						AI code review on every pull request
					</p>

					<h1 className="mt-6 text-5xl sm:text-6xl lg:text-7xl font-bold tracking-[-0.04em] leading-[1.02] text-balance">
						<span className="hero-line block">Your code,</span>
						<span className="hero-line block text-primary">under review.</span>
					</h1>

					<p className="hero-sub mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
						Automated reviews that catch bugs and enforce your standards
						before code hits production.
					</p>

					<div className="mt-10 flex flex-wrap gap-4">
						<Button size="lg" className="hero-cta px-8" asChild>
							<a href="/login">
								Get Started Free
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

					<p className="hero-meta mt-8 font-mono text-xs text-muted-foreground">
						No credit card required — 3 repositories free
					</p>
				</div>

				{/* Real component preview: a review-result card */}
				<div className="hero-card relative">
					<div className="rounded-xl border border-border bg-card shadow-lg overflow-hidden">
						<div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
							<div className="flex items-center gap-2.5 min-w-0">
								<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
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
								className="shrink-0 border-primary/40 bg-primary/5 text-primary"
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
				</div>
			</div>

			{/* Scroll hint */}
			<div className="hero-meta absolute bottom-6 left-1/2 hidden -translate-x-1/2 md:block">
				<div className="flex h-9 w-5 items-start justify-center rounded-full border border-border p-1">
					<div className="h-1.5 w-1 rounded-full bg-primary/70 animate-bounce" />
				</div>
			</div>
		</section>
	);
}
