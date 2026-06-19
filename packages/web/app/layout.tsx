/**
 * Root layout component for Code Horse application
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
import { Geist, Geist_Mono } from "next/font/google";

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

export const metadata: Metadata = {
	title: {
		default: "Code Horse - AI-Powered Code Review Platform",
		template: "%s | Code Horse",
	},
	description: "Automate your code reviews with AI. Connect your GitHub repositories and get instant, intelligent code review feedback on every pull request.",
	keywords: ["code review", "AI", "GitHub", "pull request", "automation", "code analysis", "developer tools"],
	authors: [{ name: "Code Horse" }],
	creator: "Code Horse",
	openGraph: {
		type: "website",
		locale: "en_US",
		title: "Code Horse - AI-Powered Code Review Platform",
		description: "Automate your code reviews with AI. Connect your GitHub repositories and get instant, intelligent code review feedback on every pull request.",
		siteName: "Code Horse",
	},
	twitter: {
		card: "summary_large_image",
		title: "Code Horse - AI-Powered Code Review Platform",
		description: "Automate your code reviews with AI. Connect your GitHub repositories and get instant, intelligent code review feedback on every pull request.",
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
				className={`${geistSans.variable} ${geistMono.variable} antialiased`}
			>
				<QueryProvider>
					<ThemeProvider
						attribute={"class"}
						defaultTheme="dark"
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
