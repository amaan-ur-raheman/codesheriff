import { reviewPullRequest } from "@/modules/ai/actions";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function POST(request: NextRequest) {
	try {
		const apiKey = request.headers.get("authorization")?.replace("Bearer ", "");
		let authenticatedUserId: string | null = null;

		if (apiKey) {
			const keyRecord = await prisma.apiKey.findUnique({
				where: { key: apiKey },
			});
			if (keyRecord) {
				authenticatedUserId = keyRecord.userId;
			}
		}

		const isGlobalAuth = apiKey && apiKey === process.env.CODEHORSE_API_KEY;

		if (!isGlobalAuth && !authenticatedUserId) {
			return NextResponse.json(
				{ error: "Invalid or missing API key" },
				{ status: 401 }
			);
		}

		const body = await request.json();
		const { owner, repo, prNumber } = body;

		if (!owner || !repo || !prNumber) {
			return NextResponse.json(
				{ error: "Missing required fields: owner, repo, prNumber" },
				{ status: 400 }
			);
		}

		// Verify repository ownership for user key authorization
		if (authenticatedUserId) {
			const dbRepo = await prisma.repository.findFirst({
				where: {
					owner,
					name: repo,
					userId: authenticatedUserId,
				},
			});
			if (!dbRepo) {
				return NextResponse.json(
					{ error: "Repository not found or unauthorized access" },
					{ status: 403 }
				);
			}
		}

		const result = await reviewPullRequest(owner, repo, Number(prNumber));

		if (result?.success) {
			return NextResponse.json(result, { status: 200 });
		}

		return NextResponse.json(
			{ error: "Review failed to queue" },
			{ status: 500 }
		);
	} catch (error) {
		console.error("Error triggering review:", error);
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : "Internal server error",
			},
			{ status: 500 }
		);
	}
}
