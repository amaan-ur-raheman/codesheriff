import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
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

		const { id } = await params;

		const review = await prisma.review.findUnique({
			where: { id },
			include: {
				repository: true,
			},
		});

		if (!review) {
			return NextResponse.json({ error: "Review not found" }, { status: 404 });
		}

		// Ensure the review belongs to the user
		if (review.repository.userId !== apiKeyRecord.userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		return NextResponse.json({ review });
	} catch (error) {
		console.error("API Fetch review error:", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Internal server error" },
			{ status: 500 }
		);
	}
}
