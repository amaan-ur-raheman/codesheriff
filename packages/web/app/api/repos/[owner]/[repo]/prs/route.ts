import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { Octokit } from "octokit";

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ owner: string; repo: string }> }
) {
	try {
		const authHeader = request.headers.get("authorization");
		const token = authHeader?.replace("Bearer ", "");

		if (!token) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Look up the api key
		const apiKeyRecord = await prisma.apiKey.findUnique({
			where: { key: token },
			include: {
				user: {
					include: {
						accounts: {
							where: { providerId: "github" },
						},
					},
				},
			},
		});

		if (!apiKeyRecord) {
			return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
		}

		const githubAccount = apiKeyRecord.user.accounts[0];
		if (!githubAccount?.accessToken) {
			return NextResponse.json(
				{ error: "GitHub account not connected or missing token" },
				{ status: 400 }
			);
		}

		const { owner, repo } = await params;

		const octokit = new Octokit({ auth: githubAccount.accessToken });

		const { data: pulls } = await octokit.rest.pulls.list({
			owner,
			repo,
			state: "open",
			per_page: 50,
		});

		const pullRequests = pulls.map((pr) => ({
			number: pr.number,
			title: pr.title,
			url: pr.html_url,
			state: pr.state,
		}));

		return NextResponse.json({ pullRequests });
	} catch (error) {
		console.error("API Fetch PRs error:", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Internal server error" },
			{ status: 500 }
		);
	}
}
