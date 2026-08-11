import type { Metadata } from "next";
import OrganizationPageClient from "@/modules/organization/components/organization-page-client";

export const metadata: Metadata = {
	title: "Organizations",
	description: "Manage your teams and collaborate with members.",
};

export default function OrganizationsPage() {
	return <OrganizationPageClient />;
}
