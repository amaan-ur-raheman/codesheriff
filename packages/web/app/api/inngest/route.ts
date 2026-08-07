import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { indexRepo } from "@/inngest/functions";
import { indexRepoIncremental } from "@/inngest/functions/index-incremental";
import { generateReview, handleCommentReply } from "@/inngest/functions/review";

// Create an API that serves zero functions
export const { GET, POST, PUT } = serve({
	client: inngest,
	functions: [indexRepo, indexRepoIncremental, generateReview, handleCommentReply],
});
