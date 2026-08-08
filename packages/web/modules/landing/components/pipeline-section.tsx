"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { GitPullRequest, ScanSearch, FlaskConical, MessageSquareText } from "lucide-react";
import { gsap, ScrollTrigger } from "../lib/gsap";

// Motion's useReducedMotion only honours the OS setting when wrapped in a
// <MotionConfig reducedMotion="user">, so use the media query directly.
const subscribeReducedMotion = (onChange: () => void) => {
	const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
	mq.addEventListener("change", onChange);
	return () => mq.removeEventListener("change", onChange);
};
const getReducedMotion = () =>
	window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function usePrefersReducedMotion() {
	return useSyncExternalStore(
		subscribeReducedMotion,
		getReducedMotion,
		() => false,
	);
}

const stages = [
	{
		icon: GitPullRequest,
		kicker: "Trigger",
		title: "A pull request opens",
		body: "The webhook fires the moment a PR is created or updated. Nothing to install in CI, no YAML to maintain.",
		meta: "webhook: pull_request.opened",
	},
	{
		icon: ScanSearch,
		kicker: "Analyze",
		title: "The AI reads the diff",
		body: "Every changed file is analyzed against your codebase context, project standards, and a library of known bug patterns.",
		meta: "diff: 47 files · 1,203 lines",
	},
	{
		icon: FlaskConical,
		kicker: "Verify",
		title: "Suggestions run in a sandbox",
		body: "Every fix is executed in an isolated sandbox first. If the suggested patch doesn't compile and pass, it never reaches your PR.",
		meta: "sandbox: e2b · 14s",
	},
	{
		icon: MessageSquareText,
		kicker: "Deliver",
		title: "Comments land on the PR",
		body: "Verified, inline suggestions appear on the exact lines, ready for one-click apply. Your team reviews less, ships more.",
		meta: "3 comments · 1 verified fix",
	},
];

/**
 * Scroll-pinned pipeline: each stage is sticky and stacks on the previous one
 * as you scroll, with the incoming card scaling the last one back. Reduced
 * motion renders the stages as a plain vertical list.
 */
export function PipelineSection() {
	const rootRef = useRef<HTMLElement>(null);
	const reduceMotion = usePrefersReducedMotion();

	useEffect(() => {
		if (reduceMotion) return;
		const ctx = gsap.context(() => {
			const mm = gsap.matchMedia();
			mm.add("(prefers-reduced-motion: no-preference)", () => {
				const cards = gsap.utils.toArray<HTMLElement>(".pipeline-card");

				cards.forEach((card, i) => {
					if (i === cards.length - 1) return;
					const next = cards[i + 1];
					gsap.to(card, {
						scale: 0.92,
						opacity: 0.45,
						yPercent: -8,
						ease: "none",
						scrollTrigger: {
							trigger: next,
							start: "top bottom",
							end: "top top",
							scrub: 0.6,
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
	}, [reduceMotion]);

	return (
		<section id="how-it-works" ref={rootRef} className="relative bg-muted/20">
			<div className="mx-auto max-w-4xl px-6 pt-32 pb-8">
				<div className="mb-16">
					<h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">
						From push to merge, fully automatic
					</h2>
					<p className="mt-4 max-w-xl text-lg text-muted-foreground">
						Four stages run behind the scenes on every pull request.
						Scroll to walk the pipeline.
					</p>
				</div>
			</div>

			<div className="mx-auto max-w-4xl px-6">
				<div className="relative pb-32">
					{stages.map((stage, i) => (
						<div
							key={stage.title}
							className={`pipeline-card ${reduceMotion ? "" : "sticky min-h-[85dvh]"}`}
							style={{
								// Later cards stack over earlier ones; offsets clear the
								// fixed navbar (h-16) when stuck. Static under reduced
								// motion, so nothing can overlap-hidden.
								top: reduceMotion ? undefined : `${i * 4 + 6}rem`,
								zIndex: reduceMotion ? undefined : i + 1,
							}}
						>
							<div className="flex h-full min-h-[60dvh] flex-col justify-center rounded-2xl border border-border bg-card p-8 sm:p-12 shadow-lg">
								<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neon/10 text-neon">
									<stage.icon className="h-6 w-6" />
								</div>
								<p className="mt-8 font-mono text-xs font-medium uppercase tracking-[0.18em] text-neon-text">
									{stage.kicker}
								</p>
								<h3 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
									{stage.title}
								</h3>
								<p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">
									{stage.body}
								</p>
								<p className="mt-8 inline-block w-fit rounded-md border border-border bg-muted/40 px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
									{stage.meta}
								</p>
							</div>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
