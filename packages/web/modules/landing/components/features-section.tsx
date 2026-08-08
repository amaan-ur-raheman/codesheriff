"use client";

import { useEffect, useRef } from "react";
import { Bot, MessageSquare, Activity, Globe } from "lucide-react";
import { gsap, EASE, REVEAL_TRIGGER, ScrollTrigger } from "../lib/gsap";

const languages = ["TypeScript", "Python", "Go", "Rust", "Java", "Ruby"];

const features = [
	{
		icon: Bot,
		title: "AI Code Review",
		description:
			"Deep analysis of every pull request. Catches bugs, security issues, and code smells before they reach production.",
		span: "md:col-span-4",
		preview: (
			<div className="mt-6 space-y-0.5 rounded-lg border border-border bg-muted/40 p-3 font-mono text-[12px] leading-relaxed">
				<div className="flex gap-2.5">
					<span className="select-none text-muted-foreground/40">-</span>
					<span className="text-muted-foreground line-through decoration-muted-foreground/40">
						const password = req.body.password;
					</span>
				</div>
				<div className="flex gap-2.5">
					<span className="select-none text-muted-foreground/40">+</span>
					<span className="text-verified">
						const hashed = await argon2.hash(req.body.password);
					</span>
				</div>
			</div>
		),
	},
	{
		icon: MessageSquare,
		title: "Auto PR Comments",
		description:
			"Inline suggestions posted directly on your pull requests, actionable feedback without leaving GitHub.",
		span: "md:col-span-2",
	},
	{
		icon: Activity,
		title: "Health Scores",
		description:
			"Track code quality trends over time: completion rates, issue density, and team performance at a glance.",
		span: "md:col-span-2",
	},
	{
		icon: Globe,
		title: "Multi-language Support",
		description:
			"One AI reviewing JavaScript, TypeScript, Python, Go, Rust, and more across your entire stack.",
		span: "md:col-span-4",
		preview: (
			<div className="mt-6 flex flex-wrap gap-2">
				{languages.map((lang) => (
					<span
						key={lang}
						className="rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-[11px] text-muted-foreground"
					>
						{lang}
					</span>
				))}
			</div>
		),
	},
];

export function FeaturesSection() {
	const rootRef = useRef<HTMLElement>(null);

	useEffect(() => {
		const ctx = gsap.context(() => {
			const mm = gsap.matchMedia();
			mm.add("(prefers-reduced-motion: no-preference)", () => {
				gsap.from(".features-head", {
					opacity: 0,
					y: 24,
					duration: 0.7,
					ease: EASE,
					scrollTrigger: {
						trigger: ".features-head",
						...REVEAL_TRIGGER,
					},
				});
				// Per-card triggers so a stale grid position can never leave
				// individual cards hidden.
				gsap.utils.toArray<HTMLElement>(".feature-card").forEach((card) => {
					gsap.from(card, {
						opacity: 0,
						y: 32,
						duration: 0.7,
						ease: EASE,
						// Drop GSAP's inline transform when done so the Tailwind
						// hover lift keeps working.
						clearProps: "transform",
						scrollTrigger: {
							trigger: card,
							...REVEAL_TRIGGER,
						},
					});
				});
			});
		}, rootRef);
		const raf = requestAnimationFrame(() => ScrollTrigger.refresh());
		return () => {
			cancelAnimationFrame(raf);
			ctx.revert();
		};
	}, []);

	return (
		<section id="features" ref={rootRef} className="relative py-32">
			<div className="mx-auto max-w-7xl px-6">
				<div className="features-head mb-16 max-w-2xl">
					<h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">
						Everything you need to review smarter
					</h2>
					<p className="mt-4 text-lg text-muted-foreground">
						Powerful AI tools that fit into your existing workflow. No
						context switching, no learning curve.
					</p>
				</div>

				<div className="features-grid grid gap-6 md:grid-cols-6">
					{features.map((feature) => (
						<div
							key={feature.title}
							className={`feature-card group relative rounded-2xl border border-border bg-card p-8 transition-all duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-lg ${feature.span}`}
							onMouseMove={(e) => {
								// Spotlight border: track the cursor into CSS vars
								// (no re-render, transform/opacity only).
								const rect = e.currentTarget.getBoundingClientRect();
								e.currentTarget.style.setProperty(
									"--spot-x",
									`${e.clientX - rect.left}px`,
								);
								e.currentTarget.style.setProperty(
									"--spot-y",
									`${e.clientY - rect.top}px`,
								);
							}}
						>
							{/* cursor-following highlight, clipped to the card */}
							<div
								aria-hidden="true"
								className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
								style={{
									background:
										"radial-gradient(240px circle at var(--spot-x, 50%) var(--spot-y, 50%), color-mix(in srgb, var(--primary) 9%, transparent), transparent 60%)",
								}}
							/>
							<div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 transition-colors duration-300 group-hover:bg-primary/20">
								<feature.icon className="h-5 w-5 text-primary" />
							</div>
							<h3 className="mb-2 text-lg font-semibold">
								{feature.title}
							</h3>
							<p className="max-w-md leading-relaxed text-muted-foreground">
								{feature.description}
							</p>
							{feature.preview}
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
