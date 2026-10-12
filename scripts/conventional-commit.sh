#!/usr/bin/env bash
# Checks that a commit subject follows Conventional Commits:
#   <type>(<optional scope>): <description>
# Used by the lefthook commit-msg hook (message file) and by CI (PR title, commits).
# Merge, Revert, fixup! and squash! subjects are allowed.
#
# Usage: conventional-commit.sh <message-file>   checks the first line of the file
#        conventional-commit.sh -s "<subject>"   checks the given text
# Exit status: 0 = fine, 1 = not conventional, 2 = bad usage.
set -euo pipefail

TYPES='feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert'

case "${1:-}" in
-s)
	[[ $# -eq 2 ]] || {
		echo "usage: $0 -s <subject>" >&2
		exit 2
	}
	subject="$2"
	;;
*)
	[[ $# -eq 1 && -f "$1" ]] || {
		echo "usage: $0 <message-file> | -s <subject>" >&2
		exit 2
	}
	subject="$(head -n 1 "$1")"
	;;
esac

case "$subject" in
"Merge "* | "Revert "* | "fixup! "* | "squash! "*) exit 0 ;;
esac

if ! printf '%s\n' "$subject" | grep -qE "^($TYPES)(\([a-z0-9._/-]+\))?!?: [^ ].{0,100}\$"; then
	echo "Commit message must look like: <type>(<optional scope>): <description>" >&2
	echo "  types: ${TYPES//|/ }" >&2
	echo "  got:   $subject" >&2
	exit 1
fi
