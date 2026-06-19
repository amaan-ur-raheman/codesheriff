import { Metadata } from "next";
import ReviewsPageClient from "@/modules/review/components/reviews-page-client";

export const metadata: Metadata = {
	title: "Review History",
	description: "View all AI code reviews for your repositories.",
};

export default function ReviewsPage() {
	return <ReviewsPageClient />;
}