"use client";

import { Navbar } from "./navbar";
import { ScrollProgress } from "./scroll-progress";
import { HeroSection } from "./hero-section";
import { FeaturesSection } from "./features-section";
import { IntegrationsSection } from "./integrations-section";
import { PipelineSection } from "./pipeline-section";
import { TestimonialsSection } from "./testimonials-section";
import { PricingSection } from "./pricing-section";
import { FAQSection } from "./faq-section";
import { CTASection } from "./cta-section";
import { Footer } from "./footer";

export function LandingPage() {
	return (
		<div className="min-h-dvh bg-background text-foreground">
			<ScrollProgress />
			<Navbar />
			<main id="main">
				<HeroSection />
				<FeaturesSection />
				<IntegrationsSection />
				<PipelineSection />
				<TestimonialsSection />
				<PricingSection />
				<FAQSection />
				<CTASection />
			</main>
			<Footer />
		</div>
	);
}
