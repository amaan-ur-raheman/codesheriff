/**
 * GitHub webhook endpoint for handling repository events
 * 
 * Processes incoming webhooks from GitHub repositories and triggers
 * appropriate actions based on the event type:
 * 
 * - pull_request events: Initiates AI code review generation
 * - issue_comment events: Responds when Code Sheriff is mentioned in PR comments
 * - pull_request_review_comment events: Responds when Code Sheriff is mentioned in inline review comments
 * - ping events: Responds with pong for webhook verification
 * 
 * @route POST /api/webhooks/github
 */
import { reviewPullRequest, replyToPullRequestComment } from "@/modules/ai/actions";

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/**
 * Handles GitHub webhook POST requests
 * @param request - Next.js request object containing webhook payload
 * @returns JSON response indicating success or error
 */
export async function POST(request: NextRequest) {
	try {
		const signature = request.headers.get("x-hub-signature-256");
		const payload = await request.text();

		// Optional: Verify signature if GITHUB_WEBHOOK_SECRET is set
		if (process.env.GITHUB_WEBHOOK_SECRET) {
			if (!signature) {
				return NextResponse.json({ error: "Missing signature" }, { status: 401 });
			}
			const hmac = crypto.createHmac("sha256", process.env.GITHUB_WEBHOOK_SECRET);
			const digest = "sha256=" + hmac.update(payload).digest("hex");
			if (signature !== digest) {
				return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
			}
		}

		const body = JSON.parse(payload);
		const event = request.headers.get("x-github-event");

		console.log(`Received GitHub event: ${event}`);

		if (event === "ping") {
			return NextResponse.json({ message: "Pong" }, { status: 200 });
		}

		if (event === "pull_request") {
			const action = body.action;
			const repo = body.repository.full_name;
			const prNumber = body.number;
			const before = action === "synchronize" ? body.before : undefined;
			const after = action === "synchronize" ? body.after : undefined;

			const [owner, repoName] = repo.split("/");

			if (action === "opened" || action === "synchronize") {
				await reviewPullRequest(owner, repoName, prNumber, before, after)
					.then(() =>
						console.log(
							`Successfully processed pull request ${prNumber} for ${repo}`
						)
					)
					.catch((error: unknown) =>
						console.error(
							`Failed to process pull request ${prNumber} for ${repo}:`,
							error
						)
					);
			}
		}

		if (event === "issue_comment") {
			const action = body.action;
			const isPR = !!body.issue.pull_request;
			const commentBody = body.comment?.body || "";
			const repo = body.repository.full_name;
			const prNumber = body.issue.number;
			const commentId = body.comment?.id;

			const [owner, repoName] = repo.split("/");

			if (action === "created" && isPR && commentBody.toLowerCase().includes("@codesheriff")) {
				await replyToPullRequestComment(owner, repoName, prNumber, commentBody, commentId, false)
					.then(() =>
						console.log(
							`Successfully processed issue comment reply trigger for PR ${prNumber} in ${repo}`
						)
					)
					.catch((error: unknown) =>
						console.error(
							`Failed to process issue comment reply trigger for PR ${prNumber} in ${repo}:`,
							error
						)
					);
			}
		}

		if (event === "pull_request_review_comment") {
			const action = body.action;
			const commentBody = body.comment?.body || "";
			const repo = body.repository.full_name;
			const prNumber = body.pull_request.number;
			const commentId = body.comment?.id;

			const [owner, repoName] = repo.split("/");

			if (action === "created" && commentBody.toLowerCase().includes("@codesheriff")) {
				await replyToPullRequestComment(owner, repoName, prNumber, commentBody, commentId, true)
					.then(() =>
						console.log(
							`Successfully processed PR review comment reply trigger for PR ${prNumber} in ${repo}`
						)
					)
					.catch((error: unknown) =>
						console.error(
							`Failed to process PR review comment reply trigger for PR ${prNumber} in ${repo}:`,
							error
						)
					);
			}
		}

		return NextResponse.json(
			{ message: "Event processed" },
			{ status: 200 }
		);
	} catch (error) {
		console.error("Error processing webhook:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
