import type { Metadata } from "next";
import IntegrationsPageClient from "@/modules/integrations/components/integrations-page-client";
import prisma from "@/lib/db";
import { requireAuth } from "@/modules/auth/utils/auth-utils";

export const metadata: Metadata = {
	title: "Integrations",
	description: "Connect external services to receive notifications about your code reviews.",
};

export default async function IntegrationsPage() {
	const session = await requireAuth();

	const memberships = await prisma.organizationMember.findMany({
		where: { userId: session.user.id },
		take: 1,
	});

	const orgId = memberships[0]?.organizationId || "";

	return <IntegrationsPageClient orgId={orgId} />;
}
