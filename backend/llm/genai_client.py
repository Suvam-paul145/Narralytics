import re
import time
from typing import Any

from llm.quota_manager import quota_manager
from config import settings

try:
    import google.generativeai as genai
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

_GROQ_MODEL = "llama-3.3-70b-versatile"
_GEMINI_MODEL = "gemini-2.0-flash"


class _GroqResponseWrapper:
    """Thin wrapper so callers can use response.text like they did with genai."""

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


def _contents_to_messages(contents) -> list[dict]:
    """Convert genai-style contents to OpenAI/Groq messages format.

    genai format:  [{"role": "user",  "parts": [{"text": "..."}]}]
    groq format:   [{"role": "user",  "content": "..."}]

    The genai role "model" maps to "assistant" in Groq.
    """
    messages = []
    for item in contents:
        role = item.get("role", "user")
        if role == "model":
            role = "assistant"
        parts = item.get("parts", [])
        text = " ".join(p.get("text", "") for p in parts if isinstance(p, dict))
        messages.append({"role": role, "content": text})
    return messages


def _contents_to_prompt(contents) -> str:
    parts: list[str] = []
    for item in contents:
        role = item.get("role", "user")
        text = " ".join(p.get("text", "") for p in item.get("parts", []) if isinstance(p, dict)).strip()
        if text:
            parts.append(f"{role}: {text}")
    return "\n\n".join(parts)


def _call_groq(client, contents):
    messages = _contents_to_messages(contents)
    response = client.chat.completions.create(
        model=_GROQ_MODEL,
        messages=messages,
    )
    content = response.choices[0].message.content or ""
    return _GroqResponseWrapper(content)


def _call_gemini(contents):
    prompt = _contents_to_prompt(contents)
    model = genai.GenerativeModel(_GEMINI_MODEL)
    response = model.generate_content(prompt)
    text = getattr(response, "text", "") or ""  # type: ignore
    return _GroqResponseWrapper(text)


def generate_with_retry(client: Any, model: str, contents, max_attempts: int = 2):
    """Generate content using Gemini if available, otherwise Groq, otherwise fail/skip."""
    use_gemini = bool(settings.GEMINI_API_KEY) and _HAS_GEMINI
    use_groq = client is not None or bool(settings.GROQ_API_KEY)

    if use_gemini and genai:
        genai.configure(api_key=settings.GEMINI_API_KEY)

    last_exc: Exception | None = None

    for attempt in range(1, max_attempts + 1):
        try:
            if use_gemini and genai:
                return _call_gemini(contents)
            if use_groq and client is not None:
                return _call_groq(client, contents)
            # Neither provider available
            raise RuntimeError("No LLM provider configured")
        except Exception as exc:
            last_exc = exc
            should_retry = _is_retryable_error(exc) and attempt < max_attempts

            if should_retry:
                delay = min(1, 2 ** (attempt - 1))
                match = re.search(r"retry[-_]after[^\d]*(\d+(?:\.\d+)?)", str(exc), re.I)
                if match:
                    delay = min(float(match.group(1)), 30)
                time.sleep(delay)
                continue

            if _is_quota_error(exc):
                quota_manager.record_quota_exhausted(
                    retry_delay_seconds=_extract_retry_delay_seconds(exc)
                )
            # If Gemini failed and Groq is available, try Groq once before giving up
            if use_gemini and use_groq and client is not None and not should_retry:
                try:
                    return _call_groq(client, contents)
                except Exception as groq_exc:
                    last_exc = groq_exc
            raise

    if last_exc is not None:
        if _is_quota_error(last_exc):
            quota_manager.record_quota_exhausted(
                retry_delay_seconds=_extract_retry_delay_seconds(last_exc)
            )
        raise last_exc

    raise RuntimeError("LLM request failed before any attempt was made.")
