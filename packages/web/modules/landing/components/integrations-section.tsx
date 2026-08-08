"use client";

import { useEffect, useRef } from "react";
import { gsap, EASE, REVEAL_TRIGGER, ScrollTrigger } from "../lib/gsap";

const integrations = [
	"GitHub",
	"GitLab",
	"Bitbucket",
	"Slack",
	"Discord",
	"Inngest",
	"Pinecone",
	"Polar",
	"E2B",
];

export function IntegrationsSection() {
	const rootRef = useRef<HTMLElement>(null);

	useEffect(() => {
		const ctx = gsap.context(() => {
			const mm = gsap.matchMedia();
			mm.add("(prefers-reduced-motion: no-preference)", () => {
				gsap.from(".integrations-band", {
					opacity: 0,
					y: 16,
					duration: 0.7,
					ease: EASE,
					clearProps: "transform",
					scrollTrigger: { trigger: ".integrations-band", ...REVEAL_TRIGGER },
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
		<section ref={rootRef} className="border-t border-border py-20">
			<div className="mx-auto max-w-7xl px-6">
				<div className="integrations-band flex flex-wrap items-center gap-x-10 gap-y-5 border border-border bg-muted/20 px-8 py-7">
					<p className="w-full font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground sm:w-auto">
						Works where you already work
					</p>
					{integrations.map((name) => (
						<span
							key={name}
							className="flex items-center gap-2.5 font-mono text-[13px] text-muted-foreground"
						>
							<span
								aria-hidden="true"
								className="h-1.5 w-1.5 bg-brand"
							/>
							{name}
						</span>
					))}
				</div>
			</div>
		</section>
	);
}
