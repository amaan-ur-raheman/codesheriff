"use client";

import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function CTASection() {
	return (
		<section className="relative py-32 overflow-hidden">
			<div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-primary/10 to-primary/5" />
			<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/10 rounded-full blur-[100px]" />

			<div className="relative max-w-4xl mx-auto px-6 text-center">
				<motion.div
					initial={{ opacity: 0, y: 30 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, margin: "-100px" }}
					transition={{ duration: 0.7 }}
				>
					<h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6 text-balance">
						Ready to revolutionize your{" "}
						<span className="text-primary">code review?</span>
					</h2>
					<p className="text-lg text-muted-foreground max-w-xl mx-auto mb-10">
						Join thousands of developers shipping better code, faster.
						Get started in minutes — no credit card required.
					</p>
					<div className="flex flex-wrap justify-center gap-4">
						<Button
							size="lg"
							className="bg-primary text-primary-foreground hover:bg-primary/90 px-8"
							asChild
						>
							<a href="/login">
								Get Started Free
								<ArrowRight className="ml-2 w-4 h-4" />
							</a>
						</Button>
					</div>
				</motion.div>
			</div>
		</section>
	);
}
