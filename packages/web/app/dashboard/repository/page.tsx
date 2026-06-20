import { Metadata } from "next";
import RepositoryPageClient from "@/modules/repository/components/repository-page-client";

export const metadata: Metadata = {
	title: "Repositories",
	description: "Manage and view all your GitHub repositories.",
};

export default function RepositoryPage() {
	return <RepositoryPageClient />;
}