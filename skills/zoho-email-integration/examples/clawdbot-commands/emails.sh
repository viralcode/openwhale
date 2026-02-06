#!/bin/bash
# Example Clawdbot command wrapper for the zoho-email skill.
#
# This is intentionally simple and safe: it only prints summaries unless you
# explicitly call destructive actions.
#
# Usage:
#   ./emails.sh summary
#   ./emails.sh unread
#   ./emails.sh search "invoice"
#   ./emails.sh empty-spam --dry-run|--execute
#   ./emails.sh empty-trash --dry-run|--execute

set -euo pipefail

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$BASE_DIR"

# REQUIRED: set your mailbox
: "${ZOHO_EMAIL:?Set ZOHO_EMAIL first (export ZOHO_EMAIL='you@domain.com')}"

cmd="${1:-summary}"
shift || true

case "$cmd" in
  summary)
    python3 scripts/zoho-email.py unread
    ;;
  doctor)
    python3 scripts/zoho-email.py doctor
    ;;
  unread)
    python3 scripts/zoho-email.py unread
    ;;
  search)
    q="${1:-ALL}"
    python3 scripts/zoho-email.py search "$q"
    ;;
  empty-spam)
    python3 scripts/zoho-email.py empty-spam "$@"
    ;;
  empty-trash)
    python3 scripts/zoho-email.py empty-trash "$@"
    ;;
  *)
    echo "Unknown command: $cmd" >&2
    echo "Try: $0 doctor | unread | search <q> | empty-spam [--dry-run|--execute] | empty-trash [--dry-run|--execute]" >&2
    exit 1
    ;;
esac
