#!/usr/bin/env python3
"""
Groq LLM Client — replaces the previous Gemini/genai client.
Exposes the same public API so all callers work without changes.
"""

from functools import lru_cache

from groq import Groq

from config import settings
from llm.genai_client import generate_with_retry, _GROQ_MODEL


@lru_cache(maxsize=1)
def _get_client() -> Groq:
    """Return a cached Groq client instance."""
    if not settings.GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY is not configured")
    return Groq(api_key=settings.GROQ_API_KEY)


def generate_content_with_fallback(prompt: str, request_type: str = "general", **kwargs):
    """Generate content via Groq with a simple text fallback on error.

    Args:
        prompt: The prompt text to send to the model.
        request_type: Logical request type used in error messages.
        **kwargs: Ignored – kept for API compatibility.

    Returns:
        Generated content string or a fallback error message.
    """
    try:
        client = _get_client()
        response = generate_with_retry(
            client=client,
            model=_GROQ_MODEL,
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
        )
        return response.text.strip() if response and response.text else ""
    except Exception as exc:
        print(f"⚠️  Groq API error ({request_type}): {exc}")
        return ""


def test_groq_connection() -> str:
    """Quick connectivity test – returns the model reply or an error string."""
    try:
        client = _get_client()
        response = generate_with_retry(
            client=client,
            model=_GROQ_MODEL,
            contents=[{"role": "user", "parts": [{"text": "Say 'Hello' if you can read this."}]}],
        )
        return response.text.strip() if response and response.text else "No response"
    except Exception as e:
        return f"Error: {e}"
