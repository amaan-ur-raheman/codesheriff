#!/usr/bin/env bash
# DESIGN.md drift gate.
#
# Lints DESIGN.md and verifies the css-tailwind export emits every populated
# token family. `@google/design.md lint` alone exits 0 even on schema
# violations it reports as warnings (e.g. scalar typography entries), so the
# export check is the real schema gate: an empty or missing token family in
# the export is a schema failure even when the command exits successfully.
#
# Used by .github/workflows/ci.yml → design-doc job. Runs from repo root.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

if [ ! -f DESIGN.md ]; then
	echo "::error::DESIGN.md not found at repo root"
	exit 1
fi

echo "--- lint ---"
LINT_OUT=$(bunx @google/design.md lint DESIGN.md 2>&1)
LINT_EXIT=$?
echo "$LINT_OUT"

# Fail if the command itself errored, or the summary reports any error.
if [ "$LINT_EXIT" -ne 0 ]; then
	echo "::error::@google/design.md lint failed (exit $LINT_EXIT)"
	exit 1
fi
if echo "$LINT_OUT" | grep -qE '"errors":\s*[1-9]'; then
	echo "::error::DESIGN.md lint reported errors"
	exit 1
fi

echo "--- export (css-tailwind) ---"
EXPORT_OUT=$(bunx @google/design.md export --format css-tailwind DESIGN.md 2>&1)
EXPORT_EXIT=$?
if [ "$EXPORT_EXIT" -ne 0 ]; then
	echo "::error::@google/design.md export failed (exit $EXPORT_EXIT)"
	echo "$EXPORT_OUT"
	exit 1
fi

# Every populated category must emit its token family. Empty = schema failure.
FOUND_FAMILIES=0
for FAMILY in '--color-' '--font-' '--radius-' '--spacing-'; do
	if echo "$EXPORT_OUT" | grep -qF -- "$FAMILY"; then
		echo "ok: $FAMILY tokens emitted"
		FOUND_FAMILIES=$((FOUND_FAMILIES + 1))
	fi
done
if [ "$FOUND_FAMILIES" -ne 4 ]; then
	echo "::error::DESIGN.md export missing one or more token families (empty category = schema failure; check the lint warnings above — unparseable frontmatter exports nothing)"
	echo "$EXPORT_OUT"
	exit 1
fi

echo "DESIGN.md gate passed."
