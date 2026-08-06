/**
 * Builds a git credential helper script so the access token never appears in
 * the clone URL, argv, or logs.
 *
 * git invokes the helper with the credential description on stdin and expects
 * `username=` / `password=` lines on stdout. The script below statically
 * answers with the scoped token; the token lives only inside the 0700 helper
 * file, which the caller deletes (or, in the E2B case, the sandbox is killed)
 * afterwards.
 */
export function buildGitCredentialHelperScript(token: string): string {
	// The token is interpolated into the script content — never into a
	// command-line argument or URL.
	return [
		"#!/bin/sh",
		'echo "username=x-access-token"',
		`echo "password=${token}"`,
	].join("\n");
}
