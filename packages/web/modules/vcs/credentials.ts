import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import prisma from "@/lib/db";

/**
 * Resolves the stored access token for a VCS provider (e.g. "gitlab",
 * "bitbucket") for the currently authenticated user.
 *
 * @throws Error if the user is not authenticated or hasn't connected the provider.
 * @returns The provider access token string.
 */
export async function resolveVCSAccessToken(
  providerId: "gitlab" | "bitbucket"
): Promise<string> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  const account = await prisma.account.findFirst({
    where: {
      userId: session.user.id,
      providerId,
    },
  });

  if (!account?.accessToken) {
    throw new Error(`No ${providerId} access token found`);
  }

  return account.accessToken;
}
