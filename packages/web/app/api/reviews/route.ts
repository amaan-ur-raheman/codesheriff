import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(request: NextRequest) {
	try {
		const authHeader = request.headers.get("authorization");
		const token = authHeader?.replace("Bearer ", "");

		if (!token) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Look up key
		const apiKeyRecord = await prisma.apiKey.findUnique({
			where: { key: token },
		});

		if (!apiKeyRecord) {
			return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const owner = searchParams.get("owner");
		const repo = searchParams.get("repo");
		const pr = searchParams.get("pr");

		if (!owner || !repo || !pr) {
			return NextResponse.json({ error: "Missing query params: owner, repo, pr" }, { status: 400 });
		}

		const review = await prisma.review.findFirst({
			where: {
				prNumber: Number(pr),
				repository: {
					owner,
					name: repo,
					userId: apiKeyRecord.userId,
				},
			},
			orderBy: {
				createdAt: "desc",
			},
		});

		return NextResponse.json({ review });
	} catch (error) {
		console.error("API Find review error:", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Internal server error" },
			{ status: 500 }
		);
	}
}
