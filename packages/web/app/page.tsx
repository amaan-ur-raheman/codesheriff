import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { LandingPage } from "@/modules/landing/components/landing-page";

export const metadata: Metadata = {
	title: "CodeHorse - AI-Powered Code Review Platform",
	description:
		"Automate your code reviews with AI. Connect your GitHub repositories and get instant, intelligent code review feedback on every pull request.",
};

export default async function Home() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (session) {
		redirect("/dashboard");
	}

	return <LandingPage />;
}
