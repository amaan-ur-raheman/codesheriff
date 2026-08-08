"use client";

import { Navbar } from "./navbar";
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
		<div className="min-h-screen bg-background text-foreground">
			<Navbar />
			<HeroSection />
			<FeaturesSection />
			<IntegrationsSection />
			<PipelineSection />
			<TestimonialsSection />
			<PricingSection />
			<FAQSection />
			<CTASection />
			<Footer />
		</div>
	);
}
