import re
import time

from llm.quota_manager import quota_manager


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


def generate_with_retry(client, model: str, contents, max_attempts: int = 3):
    """Generate content using the Groq client with retry on transient errors.

    Maintains the same call signature as the previous genai-based helper so
    that all engine files work without interface changes. The *model* argument
    is accepted for API compatibility but is always overridden by the
    configured Groq model constant ``_GROQ_MODEL``.
    """
    messages = _contents_to_messages(contents)
    last_exc: Exception | None = None

    for attempt in range(1, max_attempts + 1):
        try:
            response = client.chat.completions.create(
                model=_GROQ_MODEL,
                messages=messages,
            )
            content = response.choices[0].message.content or ""
            return _GroqResponseWrapper(content)
        except Exception as exc:
            last_exc = exc
            should_retry = _is_retryable_error(exc) and attempt < max_attempts

            if should_retry:
                delay = 2 ** (attempt - 1)
                match = re.search(r"retry[-_]after[^\d]*(\d+(?:\.\d+)?)", str(exc), re.I)
                if match:
                    delay = min(float(match.group(1)), 30)
                time.sleep(delay)
                continue

            if _is_quota_error(exc):
                quota_manager.record_quota_exhausted(
                    retry_delay_seconds=_extract_retry_delay_seconds(exc)
                )
            raise

    if last_exc is not None:
        if _is_quota_error(last_exc):
            quota_manager.record_quota_exhausted(
                retry_delay_seconds=_extract_retry_delay_seconds(last_exc)
            )
        raise last_exc

    raise RuntimeError("Groq request failed before any attempt was made.")
