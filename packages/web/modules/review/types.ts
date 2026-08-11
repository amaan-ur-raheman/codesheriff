/**
 * Shared review types for the web client.
 *
 * `ReviewWithRepository` mirrors the include used by the review server
 * actions (getReviews / getReview) so the list page, review detail page,
 * and the shared ReviewCard / InlineSuggestions can type their props
 * without reaching for `any`.
 */
import type { Review, Repository } from "@/lib/generated/prisma/client";

export type ReviewWithRepository = Review & { repository: Repository };
