"""
backend/llm/genai_client.py
────────────────────────────
Shared Gemini client — migrated to google.genai (new SDK).

Fixes FutureWarning:
  "All support for the google.generativeai package has ended."

The new SDK uses genai.Client(api_key=...) instead of
genai.configure() + GenerativeModel().
"""

import logging
from functools import lru_cache

from google import genai
from google.genai import types

from config import settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_client() -> genai.Client:
    """
    Return a singleton Gemini client.
    Cached so the API key is only read once per process.
    """
    if not settings.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    return genai.Client(api_key=settings.GEMINI_API_KEY)


def generate_content(prompt: str, temperature: float = 0.1) -> str:
    """
    Call Gemini and return raw text response.
    Raises on quota exhaustion or network error.
    """
    client = get_client()
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=2048,
        ),
    )
    return response.text


# ── Quota / Error Classification ──────────────────────────────────────────────

def is_quota_error(exc: Exception) -> bool:
    """
    Return True if the exception is a Gemini quota exhaustion error.
    Works for both old and new SDK exception types.
    """
    msg = str(exc).lower()
    return any(kw in msg for kw in [
        "quota",
        "rate limit",
        "resource exhausted",
        "429",
        "retry available",
        "quota_exceeded",
    ])
