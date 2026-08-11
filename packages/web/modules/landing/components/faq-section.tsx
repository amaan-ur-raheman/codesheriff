"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { gsap, EASE, REVEAL_TRIGGER, DURATION, MOTION_PREFERRED_QUERY, ScrollTrigger } from "../lib/gsap";

const faqs = [
	{
		question: "How is CodeSheriff different from a linter?",
		answer:
			"A linter checks syntax and style against a rulebook. CodeSheriff reviews the whole diff for bugs, security holes, and regressions in context, then verifies every suggested fix in a sandbox before it reaches your PR.",
	},
	{
		question: "Does it run in our CI?",
		answer:
			"No. It hooks GitHub webhooks directly: a pull request opens, a review starts. There is nothing to install in CI and no YAML to maintain.",
	},
	{
		question: "Which languages does it support?",
		answer:
			"TypeScript, JavaScript, Python, Go, Rust, Java, and Ruby, with more on the way. Language coverage grows independently of your toolchain.",
	},
	{
		question: "What happens in the sandbox?",
		answer:
			"Every suggested change is executed in an isolated E2B sandbox. If the patch doesn't compile and pass, it is never posted. What your team sees is pre-verified.",
	},
	{
		question: "Can we change the review rules?",
		answer:
			"Pro teams get custom review rules: your standards, your tone, your must-fix list. Free teams get the default rulebook.",
	},
	{
		question: "What does it cost, and can we cancel?",
		answer:
			"Free forever for 5 repositories and 5 reviews per repository. Pro is $19 per month, cancel anytime. No credit card to start.",
	},
];

export function FAQSection() {
	const rootRef = useRef<HTMLElement>(null);
	const [open, setOpen] = useState<number>(0);

	useEffect(() => {
		const ctx = gsap.context(() => {
			const mm = gsap.matchMedia();
			mm.add(MOTION_PREFERRED_QUERY, () => {
				const belowFold = (el: Element) =>
					el.getBoundingClientRect().top > window.innerHeight * 0.95;

				const faqHead = rootRef.current?.querySelector(".faq-head");
				if (faqHead && belowFold(faqHead)) {
					gsap.set(".faq-head", { opacity: 0, y: 20 });
				}
				gsap.to(".faq-head", {
					opacity: 1,
					y: 0,
					duration: DURATION.section,
					ease: EASE,
					clearProps: "opacity,transform",
					scrollTrigger: { trigger: ".faq-head", ...REVEAL_TRIGGER },
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
		<section ref={rootRef} className="border-t border-border py-20 lg:py-28">
			<div className="mx-auto max-w-4xl px-6">
				<div className="faq-head max-w-2xl">
					{/* hairline-led header: no kicker, a brand hairline carries the mark */}
					<div className="h-px w-16 bg-brand" />
					<h2 className="mt-6 font-display text-4xl font-semibold leading-[1.05] tracking-[-0.02em] text-balance sm:text-5xl">
						Questions, answered
					</h2>
				</div>

				<div className="mt-16 border-t border-border">
					{faqs.map((faq, i) => {
						const isOpen = open === i;
						return (
							<div key={faq.question} className="border-b border-border">
								<button
									type="button"
									aria-expanded={isOpen}
									aria-controls={`faq-panel-${i}`}
									onClick={() => setOpen(isOpen ? -1 : i)}
									className="flex w-full cursor-pointer items-center justify-between gap-6 py-7 text-left"
								>
									<span className="flex items-baseline gap-5">
										<span className="font-mono text-xs text-brand-text">
											{String(i + 1).padStart(2, "0")}
										</span>
										<span className="font-display text-xl font-medium tracking-tight sm:text-2xl">
											{faq.question}
										</span>
									</span>
									<Plus
										className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300 ease-in-out ${
											isOpen ? "rotate-45" : ""
										}`}
										strokeWidth={1.5}
									/>
								</button>
								<div
									id={`faq-panel-${i}`}
									className={`grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none ${
										isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr] invisible"
									}`}
								>
									<div
										className="overflow-hidden"
										aria-hidden={!isOpen}
									>
										<p className="max-w-2xl pb-7 pl-6 sm:pl-[2.9rem] leading-relaxed text-muted-foreground">
											{faq.answer}
										</p>
									</div>
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</section>
	);
}
