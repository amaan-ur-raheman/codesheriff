import crypto from "crypto";

/** Default invite token lifetime in days (Spec 0003 AC-5). */
export const INVITE_TOKEN_TTL_DAYS = 7;

/**
 * Generates a single-use invite token (opaque, not user-derivable).
 */
export function generateInviteToken(): string {
	return crypto.randomBytes(24).toString("hex");
}

/**
 * Returns true when the invite created at `invitedAt` has passed its TTL.
 * A null invitedAt (defensive) is treated as never expired.
 */
export function isInviteExpired(invitedAt: Date | null | undefined): boolean {
	if (!invitedAt) return false;
	const ttlMs = INVITE_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
	return Date.now() - invitedAt.getTime() > ttlMs;
}

export interface SeatUpgradeInput {
	/** Current active (non-pending) member count. */
	activeCount: number;
	/**
	 * Seats currently purchased on the org's Polar subscription.
	 * null = no subscription yet; 0 = free org (no seats purchased).
	 */
	currentSeats: number | null;
}

/**
 * Computes how many extra seats the org must add so that all active members
 * are covered (Spec 0003 AC-3). Returns 0 when no upgrade is needed — free
 * orgs and orgs without a subscription are never forced to upgrade.
 */
export function computeSeatUpgrade({
	activeCount,
	currentSeats,
}: SeatUpgradeInput): number {
	if (!currentSeats || currentSeats <= 0) return 0;
	return Math.max(0, activeCount - currentSeats);
}
