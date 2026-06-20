import { Metadata } from "next";
import DashboardPageClient from "@/modules/dashboard/components/dashboard-page-client";

export const metadata: Metadata = {
	title: "Dashboard",
	description: "Overview of your coding activity and AI reviews.",
};

export default function DashboardPage() {
	return <DashboardPageClient />;
}