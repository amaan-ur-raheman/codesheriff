/**
 * Root layout component for Code Sheriff application
 * 
 * Provides:
 * - Global font configuration (Geist Sans & Mono)
 * - Theme provider for dark/light mode
 * - React Query provider for data fetching
 * - Toast notifications
 * - SEO metadata and Open Graph tags
 * 
 * @layout
 */
import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";

import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

const fraunces = Fraunces({
	variable: "--font-fraunces",
	subsets: ["latin"],
	style: ["normal", "italic"],
});

export const metadata: Metadata = {
	metadataBase: new URL(
		process.env.NEXT_PUBLIC_APP_URL ||
		process.env.NEXT_PUBLIC_APP_BASE_URL ||
		"http://localhost:3000"
	),
	title: {
		default: "Code Sheriff - AI-Powered Code Review Platform",
		template: "%s | Code Sheriff",
	},
	description: "Automate your code reviews with AI. Connect your GitHub repositories and get instant, intelligent code review feedback on every pull request.",
	keywords: ["code review", "AI", "GitHub", "pull request", "automation", "code analysis", "developer tools"],
	authors: [{ name: "Code Sheriff" }],
	creator: "Code Sheriff",
	openGraph: {
		type: "website",
		locale: "en_US",
		title: "Code Sheriff - AI-Powered Code Review Platform",
		description: "Automate your code reviews with AI. Connect your GitHub repositories and get instant, intelligent code review feedback on every pull request.",
		siteName: "Code Sheriff",
		images: [
			{
				url: "/codesheriff-poster.png",
				width: 1200,
				height: 630,
				alt: "Code Sheriff - Automated AI Code Reviews",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Code Sheriff - AI-Powered Code Review Platform",
		description: "Automate your code reviews with AI. Connect your GitHub repositories and get instant, intelligent code review feedback on every pull request.",
		images: ["/codesheriff-poster.png"],
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body
				className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} antialiased`}
			>
				<a
					href="#main"
					className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none"
				>
					Skip to content
				</a>
				<QueryProvider>
					<ThemeProvider
						attribute={"class"}
						defaultTheme="light"
						enableSystem
						disableTransitionOnChange
					>
						{children}
						<Toaster richColors />
					</ThemeProvider>
				</QueryProvider>
			</body>
		</html>
	);
}
