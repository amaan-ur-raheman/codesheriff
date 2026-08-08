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
				<p className="text-center font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground mb-5">
					Works where you already work
				</p>
				<div className="integrations-band marquee-mask overflow-hidden border border-border bg-muted/20">
					<div className="marquee-track flex w-max py-7" aria-label="Supported integrations">
						{[0, 1].map((copy) => (
							<div
								key={copy}
								aria-hidden={copy === 1}
								className="flex shrink-0 items-center gap-x-10 pr-10"
							>
								{integrations.map((name) => (
									<span
										key={name}
										className="flex items-center gap-2.5 font-mono text-[13px] text-muted-foreground whitespace-nowrap"
									>
										<span
											aria-hidden="true"
											className="h-1.5 w-1.5 bg-brand"
										/>
										{name}
									</span>
								))}
							</div>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}
