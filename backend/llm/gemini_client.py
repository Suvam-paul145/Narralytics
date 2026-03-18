#!/usr/bin/env python3
"""Gemini client helpers (Gemini-only, key-rotation aware)."""

from llm.genai_client import generate_with_retry, _GROQ_MODEL


def generate_content_with_fallback(prompt: str, request_type: str = "general", **kwargs):
    """Generate content using the shared Gemini retry+rotation client.

    Args:
        prompt: Prompt text.
        request_type: Logical type used only for diagnostics.
        **kwargs: Kept for API compatibility.
    """
    del kwargs
    try:
        response = generate_with_retry(
            client=None,
            model=_GROQ_MODEL,
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
        )
        return response.text.strip() if response and response.text else ""
    except Exception as exc:
        print(f"⚠️ Gemini API error ({request_type}): {exc}")
        return ""


def test_gemini_connection() -> str:
    """Quick connectivity test for Gemini."""
    try:
        response = generate_with_retry(
            client=None,
            model=_GROQ_MODEL,
            contents=[{"role": "user", "parts": [{"text": "Say 'Hello' if you can read this."}]}],
        )
        return response.text.strip() if response and response.text else "No response"
    except Exception as exc:
        return f"Error: {exc}"


def test_groq_connection() -> str:
    """Backward-compatible alias for old script references."""
    return test_gemini_connection()
