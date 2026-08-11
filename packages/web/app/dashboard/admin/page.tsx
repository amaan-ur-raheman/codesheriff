import type { Metadata } from "next";
import AdminPageClient from "@/modules/admin/components/admin-page-client";

export const metadata: Metadata = {
	title: "Admin Dashboard",
	description: "System overview and management.",
};

export default function AdminPage() {
	return <AdminPageClient />;
}
