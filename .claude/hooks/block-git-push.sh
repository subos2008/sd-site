#!/usr/bin/env bash
# PreToolUse hook: block git push until Ryan explicitly asks for a push.
cmd=$(jq -r '.tool_input.command // ""')
if printf '%s' "$cmd" | grep -qE 'git([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+push([^[:alnum:]_-]|$)'; then
  echo "git push is blocked in this repo: wait until Ryan explicitly asks you to push. Keep committing locally and do not retry the push." >&2
  exit 2
fi
exit 0
