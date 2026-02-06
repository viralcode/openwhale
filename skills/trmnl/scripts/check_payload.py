#!/usr/bin/env python3
"""
Check TRMNL webhook payload size against limits.

Usage:
    python check_payload.py <json_file>
    python check_payload.py /tmp/trmnl.json

    # Or pipe JSON directly:
    echo '{"merge_variables":{"content":"<div>test</div>"}}' | python check_payload.py -

Limits:
    Free tier:  2,048 bytes (2 KB)
    TRMNL+:     5,120 bytes (5 KB)
"""

import sys
import json

FREE_LIMIT = 2048      # 2 KB
PLUS_LIMIT = 5120      # 5 KB

def check_payload(data: str) -> dict:
    """Check payload size and return status."""
    size = len(data.encode('utf-8'))

    return {
        'size_bytes': size,
        'size_kb': round(size / 1024, 2),
        'free_ok': size <= FREE_LIMIT,
        'plus_ok': size <= PLUS_LIMIT,
        'free_remaining': FREE_LIMIT - size,
        'plus_remaining': PLUS_LIMIT - size,
        'free_percent': round((size / FREE_LIMIT) * 100, 1),
        'plus_percent': round((size / PLUS_LIMIT) * 100, 1),
    }

def main():
    if len(sys.argv) < 2:
        print("Usage: python check_payload.py <json_file>")
        print("       echo '{...}' | python check_payload.py -")
        sys.exit(1)

    source = sys.argv[1]

    if source == '-':
        data = sys.stdin.read()
    else:
        with open(source, 'r') as f:
            data = f.read()

    # Validate JSON
    try:
        json.loads(data)
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON - {e}")
        sys.exit(1)

    result = check_payload(data)

    # Output
    print(f"Payload size: {result['size_bytes']} bytes ({result['size_kb']} KB)")
    print()
    print(f"Free tier (2 KB limit):")
    if result['free_ok']:
        print(f"  ✓ OK - {result['free_remaining']} bytes remaining ({result['free_percent']}% used)")
    else:
        print(f"  ✗ EXCEEDS by {-result['free_remaining']} bytes ({result['free_percent']}% of limit)")

    print()
    print(f"TRMNL+ (5 KB limit):")
    if result['plus_ok']:
        print(f"  ✓ OK - {result['plus_remaining']} bytes remaining ({result['plus_percent']}% used)")
    else:
        print(f"  ✗ EXCEEDS by {-result['plus_remaining']} bytes ({result['plus_percent']}% of limit)")

    # Exit code: 0 if free tier OK, 1 if only plus OK, 2 if both exceeded
    if result['free_ok']:
        sys.exit(0)
    elif result['plus_ok']:
        sys.exit(1)
    else:
        sys.exit(2)

if __name__ == '__main__':
    main()
