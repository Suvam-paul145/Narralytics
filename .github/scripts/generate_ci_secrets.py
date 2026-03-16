#!/usr/bin/env python3
"""
Generate CI-safe fallback secrets for workflows.
Outputs environment variable assignments that can be appended to $GITHUB_ENV.
"""

import os
import secrets


def main() -> None:
    jwt_secret = os.environ.get("JWT_SECRET") or secrets.token_hex(32)
    gemini_key = os.environ.get("GEMINI_API_KEY") or f"CI-MOCK-gemini-key-{secrets.token_hex(8)}"

    print(f"JWT_SECRET={jwt_secret}")
    print(f"GEMINI_API_KEY={gemini_key}")


if __name__ == "__main__":
    main()
