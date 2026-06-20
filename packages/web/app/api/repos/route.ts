import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(request: NextRequest) {
	try {
		const authHeader = request.headers.get("authorization");
		const token = authHeader?.replace("Bearer ", "");

		if (!token) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Look up the api key in the DB
		const apiKeyRecord = await prisma.apiKey.findUnique({
			where: { key: token },
			include: { user: true },
		});

		if (!apiKeyRecord) {
			return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
		}

		const repositories = await prisma.repository.findMany({
			where: {
				userId: apiKeyRecord.userId,
			},
			select: {
				id: true,
				name: true,
				owner: true,
				fullName: true,
				url: true,
			},
			orderBy: {
				updatedAt: "desc",
			},
		});

		return NextResponse.json({ repositories });
	} catch (error) {
		console.error("API Fetch repositories error:", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Internal server error" },
			{ status: 500 }
		);
	}
}
