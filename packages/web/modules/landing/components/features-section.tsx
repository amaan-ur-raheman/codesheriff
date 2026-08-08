"use client";

import { useEffect, useRef } from "react";
import { Bot, MessageSquare, Activity, Globe } from "lucide-react";
import { gsap, EASE } from "../lib/gsap";

const languages = ["TypeScript", "Python", "Go", "Rust", "Java", "Ruby"];

const features = [
	{
		icon: Bot,
		index: "01",
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
		index: "02",
		title: "Auto PR Comments",
		description:
			"Inline suggestions posted directly on your pull requests — actionable feedback without leaving GitHub.",
		span: "md:col-span-2",
	},
	{
		icon: Activity,
		index: "03",
		title: "Health Scores",
		description:
			"Track code quality trends over time. Completion rates, issue density, and team performance at a glance.",
		span: "md:col-span-2",
	},
	{
		icon: Globe,
		index: "04",
		title: "Multi-language Support",
		description:
			"Works across your entire stack — one AI reviewing JavaScript, TypeScript, Python, Go, Rust, and more.",
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
					scrollTrigger: { trigger: ".features-head", start: "top 80%" },
				});
				gsap.from(".feature-card", {
					opacity: 0,
					y: 32,
					duration: 0.7,
					stagger: 0.1,
					ease: EASE,
					// Drop GSAP's inline transform when done so the Tailwind
					// hover lift keeps working.
					clearProps: "transform",
					scrollTrigger: {
						trigger: ".features-grid",
						start: "top 80%",
					},
				});
			});
		}, rootRef);
		return () => ctx.revert();
	}, []);

	return (
		<section
			id="features"
			ref={rootRef}
			className="relative py-32"
		>
			<div className="mx-auto max-w-7xl px-6">
				<div className="features-head mb-16 max-w-2xl">
					<p className="mb-3 font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">
						Capabilities
					</p>
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
						>
							<div className="mb-6 flex items-start justify-between">
								<div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 transition-colors duration-300 group-hover:bg-primary/20">
									<feature.icon className="h-5 w-5 text-primary" />
								</div>
								<span className="font-mono text-xs text-muted-foreground">
									{feature.index}
								</span>
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
