"use client";

import { Navbar } from "./navbar";
import { HeroSection } from "./hero-section";
import { FeaturesSection } from "./features-section";
import { HowItWorks } from "./how-it-works";
import { PricingSection } from "./pricing-section";
import { CTASection } from "./cta-section";
import { Footer } from "./footer";

export function LandingPage() {
	return (
		<div className="min-h-screen bg-background text-foreground">
			<Navbar />
			<HeroSection />
			<FeaturesSection />
			<HowItWorks />
			<PricingSection />
			<CTASection />
			<Footer />
		</div>
	);
}
