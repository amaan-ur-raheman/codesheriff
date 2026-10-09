/**
 * Resolves where a suggestion should actually be anchored on a pull request.
 *
 * The model supplies `startLine`/`endLine` alongside `originalCode`, and the two
 * routinely disagree: a live run declared a 7-line range for an 8-line snippet.
 * GitHub anchors a comment to a line range, so a wrong range puts the comment —
 * and the suggested change that rides on it — on the wrong code.
 *
 * `resolveSuggestionAnchor` prefers the location the `originalCode` text
 * actually occupies in the new file, falling back to what the model declared.
 */

export interface SuggestionAnchor {
	startLine: number;
	endLine: number;
	/** True when the range came from the code's real position, not the model. */
	anchoredByContent: boolean;
}

/** Compares two lines ignoring leading/trailing and internal whitespace runs. */
function looseEquals(a: string, b: string): boolean {
	return a.trim().replace(/\s+/g, "") === b.trim().replace(/\s+/g, "");
}

/** Expands the valid lines into every maximal contiguous run. */
function contiguousRuns(lines: Map<number, string>, validLines: Set<number>): number[][] {
	const numbers = [...validLines].sort((a, b) => a - b);
	const runs: number[][] = [];

	for (const lineNumber of numbers) {
		const current = runs[runs.length - 1];
		if (!current || lineNumber !== current[current.length - 1] + 1) {
			runs.push([lineNumber]);
		} else {
			current.push(lineNumber);
		}
	}

	return runs;
}

/**
 * Finds the line range that `originalCode` occupies.
 *
 * Returns null when the snippet cannot be located, so the caller can fall back
 * to the model's declared range rather than inventing one.
 */
export function findOriginalCodeRange(
	lines: Map<number, string>,
	validLines: Set<number>,
	originalCode: string,
	preferredStartLine?: number
): { startLine: number; endLine: number } | null {
	const snippet = originalCode.replace(/^\r?\n/, "").replace(/\r?\n$/, "");
	if (!snippet.trim()) return null;

	const snippetLines = snippet.split(/\r?\n/);
	const candidates = contiguousRuns(lines, validLines);

	let best:
		| { startLine: number; endLine: number; distance: number }
		| undefined;

	for (const run of candidates) {
		for (let i = 0; i < run.length; i++) {
			const start = run[i];
			const end = start + snippetLines.length - 1;

			// The snippet must lie wholly inside this run.
			if (!run.includes(end)) continue;

			const matched = snippetLines.every((snippetLine, offset) => {
				const candidate = lines.get(start + offset);
				if (candidate === undefined) return false;
				return candidate === snippetLine || looseEquals(candidate, snippetLine);
			});

			if (!matched) continue;

			// Prefer the match closest to what the model claimed, so repeated
			// identical snippets still resolve the way the reviewer expects.
			const distance = preferredStartLine
				? Math.abs(start - preferredStartLine)
				: 0;

			if (!best || distance < best.distance) {
				best = { startLine: start, endLine: end, distance };
			}
		}
	}

	return best ? { startLine: best.startLine, endLine: best.endLine } : null;
}

/**
 * Picks the anchor a comment should use: the code's real position when we can
 * find it, otherwise the model's declared range.
 */
export function resolveSuggestionAnchor(input: {
	lines?: Map<number, string>;
	validLines?: Set<number>;
	originalCode?: string;
	declaredStartLine?: number;
	declaredEndLine?: number;
}): SuggestionAnchor {
	const declaredStart = Number(input.declaredStartLine);
	const declaredEnd = Number(input.declaredEndLine);

	const fallback = (): SuggestionAnchor => ({
		startLine: declaredStart,
		endLine:
			Number.isFinite(declaredEnd) && declaredEnd >= declaredStart
				? declaredEnd
				: declaredStart,
		anchoredByContent: false,
	});

	if (!input.lines || !input.validLines || !input.originalCode) {
		return fallback();
	}
	if (!Number.isFinite(declaredStart) || declaredStart <= 0) {
		return fallback();
	}

	const located = findOriginalCodeRange(
		input.lines,
		input.validLines,
		input.originalCode,
		declaredStart
	);

	if (!located) return fallback();

	// Never widen the comment beyond what the model claimed, and never move it
	// somewhere the model did not point at — a wild anchor is worse than an
	// imprecise one.
	if (
		located.startLine !== declaredStart &&
		Math.abs(located.startLine - declaredStart) > 2
	) {
		return fallback();
	}

	return { ...located, anchoredByContent: true };
}