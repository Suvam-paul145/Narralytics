"""
Groq LLM client — unified generation layer for Narralytics.

All AI modules (chart_engine, chat_engine, auto_dashboard, etc.) call
``generate_with_retry()`` from this module.  The old Gemini key-rotation
logic has been replaced by a single Groq API key + simple retry.
"""

import logging
import time
from typing import Any, Literal

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
_DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"
_FAST_GROQ_MODEL = "llama-3.1-8b-instant"
_STRUCTURED_REASONING_MODEL = "openai/gpt-oss-120b"
_STRUCTURED_REASONING_FALLBACK = "openai/gpt-oss-20b"

# Backward-compatible constant used by existing imports.
_GROQ_MODEL = _DEFAULT_GROQ_MODEL

ModelTask = Literal["dashboard", "query", "chat", "insight", "refine", "default"]

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

_MODEL_SELECTION_MARKERS = (
    "model_not_found",
    "invalid model",
    "model does not exist",
    "not permitted",
    "not allowed",
    "permission",
    "unsupported model",
)

_RESPONSE_FORMAT_MARKERS = (
    "response_format",
    "json_schema",
    "json schema",
    "json_object",
    "structured outputs",
    "generated json does not match the expected schema",
)

_STRICT_STRUCTURED_OUTPUT_MODELS = {
    "openai/gpt-oss-20b",
    "openai/gpt-oss-120b",
}

_JSON_SCHEMA_MODELS = {
    "moonshotai/kimi-k2-instruct-0905",
    "meta-llama/llama-4-scout-17b-16e-instruct",
    *_STRICT_STRUCTURED_OUTPUT_MODELS,
}


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


def _is_model_selection_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return any(marker in message for marker in _MODEL_SELECTION_MARKERS)


def _is_response_format_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return any(marker in message for marker in _RESPONSE_FORMAT_MARKERS)


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


def _dedupe_models(models: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []

    for model in models:
        candidate = str(model or "").strip()
        if not candidate or candidate in seen:
            continue
        seen.add(candidate)
        ordered.append(candidate)

    return ordered


def get_model_candidates(task: ModelTask = "default", preferred_model: str | None = None) -> list[str]:
    """
    Return the ordered list of model candidates for a workload.

    The first candidate is the model returned by ``select_model_for_task``.
    Environment overrides stay respected, while dashboard/query tasks get
    structured-output-capable candidates ahead of legacy defaults when possible.
    """
    default_model = (
        getattr(settings, "GROQ_MODEL_DEFAULT", "") or _DEFAULT_GROQ_MODEL
    ).strip()
    fast_model = (
        getattr(settings, "GROQ_MODEL_FAST", "") or _FAST_GROQ_MODEL
    ).strip()

    task_specific = {
        "dashboard": getattr(settings, "GROQ_MODEL_DASHBOARD", "").strip(),
        "query": getattr(settings, "GROQ_MODEL_QUERY", "").strip(),
        "chat": getattr(settings, "GROQ_MODEL_CHAT", "").strip(),
        "insight": getattr(settings, "GROQ_MODEL_INSIGHT", "").strip(),
        "refine": getattr(settings, "GROQ_MODEL_REFINE", "").strip(),
        "default": "",
    }

    workload_defaults = {
        "dashboard": [
            _STRUCTURED_REASONING_MODEL,
            _STRUCTURED_REASONING_FALLBACK,
            default_model,
            _DEFAULT_GROQ_MODEL,
            fast_model,
        ],
        "query": [
            _STRUCTURED_REASONING_MODEL,
            _STRUCTURED_REASONING_FALLBACK,
            default_model,
            _DEFAULT_GROQ_MODEL,
            fast_model,
        ],
        "chat": [
            fast_model,
            _FAST_GROQ_MODEL,
            default_model,
            _STRUCTURED_REASONING_FALLBACK,
        ],
        "insight": [
            fast_model,
            _FAST_GROQ_MODEL,
            default_model,
            _STRUCTURED_REASONING_FALLBACK,
        ],
        "refine": [
            fast_model,
            default_model,
            _FAST_GROQ_MODEL,
            _STRUCTURED_REASONING_FALLBACK,
        ],
        "default": [default_model, _DEFAULT_GROQ_MODEL, fast_model],
    }

    return _dedupe_models(
        [
            preferred_model or "",
            task_specific.get(task, ""),
            *workload_defaults.get(task, workload_defaults["default"]),
        ]
    )


def select_model_for_task(task: ModelTask = "default") -> str:
    """
    Select the best Groq model for a specific workload.

    Model can be overridden per task through environment variables:
    - GROQ_MODEL_DEFAULT
    - GROQ_MODEL_DASHBOARD
    - GROQ_MODEL_QUERY
    - GROQ_MODEL_CHAT
    - GROQ_MODEL_INSIGHT
    - GROQ_MODEL_REFINE
    """
    default_model = (
        getattr(settings, "GROQ_MODEL_DEFAULT", "") or _DEFAULT_GROQ_MODEL
    ).strip()
    fast_model = (
        getattr(settings, "GROQ_MODEL_FAST", "") or _FAST_GROQ_MODEL
    ).strip()

    task_specific = {
        "dashboard": getattr(settings, "GROQ_MODEL_DASHBOARD", "").strip(),
        "query": getattr(settings, "GROQ_MODEL_QUERY", "").strip(),
        "chat": getattr(settings, "GROQ_MODEL_CHAT", "").strip(),
        "insight": getattr(settings, "GROQ_MODEL_INSIGHT", "").strip(),
        "refine": getattr(settings, "GROQ_MODEL_REFINE", "").strip(),
        "default": "",
    }

    if task_specific.get(task):
        return task_specific[task]

    if task in {"dashboard", "query"}:
        return default_model
    if task in {"chat", "insight", "refine"}:
        return fast_model
    return default_model


def _supports_strict_structured_outputs(model: str) -> bool:
    return model in _STRICT_STRUCTURED_OUTPUT_MODELS


def _supports_json_schema_outputs(model: str) -> bool:
    return model in _JSON_SCHEMA_MODELS


def _build_json_response_format(
    model: str,
    schema_name: str,
    schema: dict[str, Any],
) -> dict[str, Any]:
    if _supports_strict_structured_outputs(model):
        return {
            "type": "json_schema",
            "json_schema": {
                "name": schema_name,
                "strict": True,
                "schema": schema,
            },
        }

    if _supports_json_schema_outputs(model):
        return {
            "type": "json_schema",
            "json_schema": {
                "name": schema_name,
                "schema": schema,
            },
        }

    return {"type": "json_object"}


# ── Core Groq call ────────────────────────────────────────────────────
def _call_groq(
    messages: list[dict[str, str]],
    model: str = _GROQ_MODEL,
    response_format: dict[str, Any] | None = None,
) -> _TextResponse:
    """Make a single call to the Groq chat completions API."""
    api_key = get_groq_api_key()
    if not api_key:
        raise RuntimeError("No Groq API key configured (set GROQ_API_KEY in .env)")

    client = Groq(api_key=api_key)
    request_payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": 4096,
    }
    if response_format:
        request_payload["response_format"] = response_format

    response = client.chat.completions.create(
        **request_payload,
    )

    text = response.choices[0].message.content if response.choices else ""
    return _TextResponse(text or "")


def generate_with_retry(
    client: Any = None,
    model: str = _GROQ_MODEL,
    contents: list | None = None,
    max_attempts: int = 3,
    response_format: dict[str, Any] | None = None,
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
            return _call_groq(
                messages,
                model=model or _GROQ_MODEL,
                response_format=response_format,
            )
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


def generate_json_with_retry(
    task: ModelTask,
    contents: list[dict[str, Any]],
    schema_name: str,
    schema: dict[str, Any],
    preferred_model: str | None = None,
    max_attempts: int = 3,
) -> tuple[str, _TextResponse]:
    """
    Generate JSON from Groq with workload-aware model routing.

    For structured workloads we prefer strict JSON-schema capable models.
    If a model rejects structured outputs, we fall back to JSON object mode
    and then to the next candidate model.
    """
    last_exc: Exception | None = None

    for candidate in get_model_candidates(task, preferred_model=preferred_model):
        response_format = _build_json_response_format(candidate, schema_name, schema)
        try:
            return (
                candidate,
                generate_with_retry(
                    model=candidate,
                    contents=contents,
                    max_attempts=max_attempts,
                    response_format=response_format,
                ),
            )
        except Exception as exc:
            last_exc = exc
            logger.warning(
                "Structured Groq call failed on model %s: %s",
                candidate,
                exc,
            )

            should_try_json_object = (
                response_format.get("type") != "json_object"
                and (
                    _is_response_format_error(exc)
                    or _is_model_selection_error(exc)
                    or _is_retryable_error(exc)
                )
            )
            if should_try_json_object:
                try:
                    return (
                        candidate,
                        generate_with_retry(
                            model=candidate,
                            contents=contents,
                            max_attempts=max_attempts,
                            response_format={"type": "json_object"},
                        ),
                    )
                except Exception as fallback_exc:
                    last_exc = fallback_exc
                    logger.warning(
                        "JSON object fallback failed on model %s: %s",
                        candidate,
                        fallback_exc,
                    )

            if (
                _is_model_selection_error(exc)
                or _is_response_format_error(exc)
                or _is_retryable_error(exc)
                or _is_quota_error(exc)
            ):
                continue

            raise

    if last_exc is not None:
        raise last_exc

    raise RuntimeError("No Groq model candidates were available for JSON generation.")
