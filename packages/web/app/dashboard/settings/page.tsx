import { Metadata } from "next";
import SettingsPageClient from "@/modules/settings/components/settings-page-client";

export const metadata: Metadata = {
	title: "Settings",
	description: "Manage your account settings and connected repositories.",
};

export default function SettingsPage() {
	return <SettingsPageClient />;
}