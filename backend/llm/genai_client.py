import re
import time
from itertools import cycle
from threading import Lock
from typing import Any

from config import settings
from llm.quota_manager import quota_manager

try:
    from google import genai

    _HAS_GEMINI = True
except Exception:
    genai = None  # type: ignore
    _HAS_GEMINI = False


_RETRYABLE_MARKERS = (
    "503",
    "service unavailable",
    "unavailable",
    "model_capacity_exhausted",
    "capacity",
    "resource exhausted",
    "deadline exceeded",
    "timed out",
    "rate_limit_exceeded",
    "rate limit",
    "too many requests",
)

_QUOTA_MARKERS = (
    "429",
    "quota",
    "rate limit",
    "too many requests",
    "resource exhausted",
)

_GEMINI_MODEL = "gemini-2.0-flash"
_GROQ_MODEL = _GEMINI_MODEL  # Backward-compat constant name used across the codebase.


class _TextResponse:
    """Thin wrapper so callers can keep using response.text."""

    def __init__(self, content: str) -> None:
        self.text = content


def _is_retryable_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return any(marker in message for marker in _RETRYABLE_MARKERS)


def _is_quota_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return any(marker in message for marker in _QUOTA_MARKERS)


def _extract_retry_delay_seconds(exc: Exception) -> int:
    match = re.search(r"retry[-_]after[^\d]*(\d+(?:\.\d+)?)", str(exc), re.I)
    if not match:
        return quota_manager.DEFAULT_RETRY_DELAY
    return max(1, min(int(float(match.group(1))), 3600))


def _contents_to_prompt(contents) -> str:
    parts: list[str] = []
    for item in contents:
        role = item.get("role", "user")
        text = " ".join(p.get("text", "") for p in item.get("parts", []) if isinstance(p, dict)).strip()
        if text:
            parts.append(f"{role}: {text}")
    return "\n\n".join(parts)


_key_cycle_lock = Lock()
_key_cycle: Any = None


def get_gemini_api_keys() -> list[str]:
    return settings.gemini_api_keys


def get_primary_api_key() -> str:
    keys = get_gemini_api_keys()
    return keys[0] if keys else ""


def _next_gemini_key() -> str:
    global _key_cycle
    keys = get_gemini_api_keys()
    if not keys:
        return ""

    with _key_cycle_lock:
        if _key_cycle is None:
            _key_cycle = cycle(keys)
        return next(_key_cycle)


def _extract_text_from_response(response: Any) -> str:
    # google.genai usually exposes .text; keep robust fallbacks.
    text = getattr(response, "text", None)
    if text:
        return str(text)

    candidates = getattr(response, "candidates", None)
    if candidates:
        try:
            parts = candidates[0].content.parts
            return " ".join(str(getattr(p, "text", "")) for p in parts).strip()
        except Exception:
            return ""

    return ""


def _call_gemini(contents, api_key: str):
    prompt = _contents_to_prompt(contents)
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(model=_GEMINI_MODEL, contents=prompt)
    text = _extract_text_from_response(response)
    return _TextResponse(text)


def generate_with_retry(client: Any, model: str, contents, max_attempts: int = 2):
    """Gemini-only generation with API-key rotation.

    Signature keeps ``client`` and ``model`` for backwards compatibility.
    """
    del client, model

    if not _HAS_GEMINI:
        raise RuntimeError("google-genai package is not installed")

    keys = get_gemini_api_keys()
    if not keys:
        raise RuntimeError("No Gemini API key configured (set GEMINI_API_KEY_1..3)")

    last_exc: Exception | None = None

    attempts = max(1, max_attempts) * len(keys)
    for _ in range(attempts):
        api_key = _next_gemini_key()
        if not api_key:
            break

        try:
            return _call_gemini(contents, api_key=api_key)
        except Exception as exc:
            last_exc = exc

            if _is_quota_error(exc) or _is_retryable_error(exc):
                # Try next key quickly.
                continue

            # Non-quota functional errors should bubble immediately.
            raise

    if last_exc is not None:
        if _is_quota_error(last_exc) or _is_retryable_error(last_exc):
            quota_manager.record_quota_exhausted(
                retry_delay_seconds=_extract_retry_delay_seconds(last_exc),
                api_key=get_primary_api_key(),
            )
        raise last_exc

    raise RuntimeError("Gemini request failed before any attempt was made.")
