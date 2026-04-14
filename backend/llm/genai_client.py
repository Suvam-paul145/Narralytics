"""
Groq LLM client — unified generation layer for Narralytics.

All AI modules (chart_engine, chat_engine, auto_dashboard, etc.) call
``generate_with_retry()`` from this module.  The old Gemini key-rotation
logic has been replaced by a single Groq API key + simple retry.
"""

import logging
import time
from typing import Any

from config import settings
from llm.quota_manager import quota_manager

logger = logging.getLogger(__name__)

try:
    from groq import Groq

    _HAS_GROQ = True
except ImportError:
    Groq = None  # type: ignore[assignment,misc]
    _HAS_GROQ = False

# ── Model configuration ──────────────────────────────────────────────
_GROQ_MODEL = "llama-3.3-70b-versatile"

# ── Retryable / quota error markers ──────────────────────────────────
_RETRYABLE_MARKERS = (
    "503",
    "service unavailable",
    "unavailable",
    "capacity",
    "resource exhausted",
    "deadline exceeded",
    "timed out",
    "rate_limit_exceeded",
    "rate limit",
    "too many requests",
    "internal_server_error",
)

_QUOTA_MARKERS = (
    "429",
    "quota",
    "rate limit",
    "too many requests",
    "resource exhausted",
)


# ── Thin response wrapper ────────────────────────────────────────────
class _TextResponse:
    """Wrapper so all callers can keep using ``response.text``."""

    def __init__(self, content: str) -> None:
        self.text = content


# ── Error classification ─────────────────────────────────────────────
def _is_retryable_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return any(marker in message for marker in _RETRYABLE_MARKERS)


def _is_quota_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return any(marker in message for marker in _QUOTA_MARKERS)


# ── Prompt helpers ────────────────────────────────────────────────────
def _contents_to_messages(contents: list[dict[str, Any]]) -> list[dict[str, str]]:
    """Convert the legacy ``[{role, parts: [{text}]}]`` format into
    Groq-compatible ``[{role, content}]`` chat messages."""
    messages: list[dict[str, str]] = []
    for item in contents:
        role = item.get("role", "user")
        # Groq expects "assistant" not "model"
        if role == "model":
            role = "assistant"
        text = " ".join(
            p.get("text", "")
            for p in item.get("parts", [])
            if isinstance(p, dict)
        ).strip()
        if text:
            messages.append({"role": role, "content": text})
    return messages


# ── API key helpers (kept for backward compat) ────────────────────────
def get_groq_api_key() -> str:
    return settings.GROQ_API_KEY


# Legacy aliases — other modules import these
get_primary_api_key = get_groq_api_key


# ── Core Groq call ────────────────────────────────────────────────────
def _call_groq(messages: list[dict[str, str]], model: str = _GROQ_MODEL) -> _TextResponse:
    """Make a single call to the Groq chat completions API."""
    api_key = get_groq_api_key()
    if not api_key:
        raise RuntimeError("No Groq API key configured (set GROQ_API_KEY in .env)")

    client = Groq(api_key=api_key)
    response = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.2,
        max_tokens=4096,
    )

    text = response.choices[0].message.content if response.choices else ""
    return _TextResponse(text or "")


def generate_with_retry(
    client: Any = None,
    model: str = _GROQ_MODEL,
    contents: list | None = None,
    max_attempts: int = 3,
) -> _TextResponse:
    """Generate a response from Groq with automatic retry on transient errors.

    Parameters ``client`` and ``model`` are kept for backward compatibility
    with existing call-sites.  ``client`` is ignored; ``model`` falls back
    to the module-level ``_GROQ_MODEL``.
    """
    del client  # Not used — Groq client is created per-call

    if not _HAS_GROQ:
        raise RuntimeError(
            "groq package is not installed.  Run: pip install groq"
        )

    if not contents:
        raise ValueError("contents must be a non-empty list")

    messages = _contents_to_messages(contents)
    if not messages:
        raise ValueError("No valid messages could be extracted from contents")

    last_exc: Exception | None = None

    for attempt in range(max_attempts):
        try:
            return _call_groq(messages, model=model or _GROQ_MODEL)
        except Exception as exc:
            last_exc = exc
            logger.warning(
                "Groq attempt %d/%d failed: %s", attempt + 1, max_attempts, exc
            )

            if _is_retryable_error(exc) or _is_quota_error(exc):
                # Exponential backoff: 1s, 2s, 4s …
                wait = min(2 ** attempt, 8)
                time.sleep(wait)
                continue

            # Non-transient errors bubble immediately
            raise

    # All retries exhausted
    if last_exc is not None:
        if _is_quota_error(last_exc):
            quota_manager.record_quota_exhausted(
                retry_delay_seconds=60,
                api_key=get_groq_api_key(),
            )
        raise last_exc

    raise RuntimeError("Groq request failed before any attempt was made.")
