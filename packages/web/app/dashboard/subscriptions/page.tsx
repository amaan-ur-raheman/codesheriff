import { Metadata } from "next";
import SubscriptionPageClient from "@/modules/payment/components/subscription-page-client";

export const metadata: Metadata = {
	title: "Subscription",
	description: "Manage your subscription plan and billing.",
};

export default function SubscriptionPage() {
	return <SubscriptionPageClient />;
}