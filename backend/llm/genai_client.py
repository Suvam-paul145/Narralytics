import time
from functools import lru_cache


_DISCOVERY_RETRYABLE_MARKERS = (
    "503",
    "service unavailable",
    "unavailable",
    "model_capacity_exhausted",
    "capacity",
    "resource exhausted",
    "deadline exceeded",
    "timed out",
)

_DISCOVERY_SKIP_MARKERS = ("embedding", "image", "tts", "audio", "vision")


def _is_retryable_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return any(marker in message for marker in _DISCOVERY_RETRYABLE_MARKERS)


def _model_rank(name: str) -> tuple[int, int, str]:
    lowered = name.lower()
    flash_priority = 0 if "flash" in lowered else 1
    stability_penalty = 1 if any(tag in lowered for tag in ("exp", "experimental", "preview")) else 0
    return (flash_priority, stability_penalty, lowered)


@lru_cache(maxsize=1)
def _discover_candidate_models(client) -> tuple[str, ...]:
    try:
        models = client.models.list()
    except Exception:
        return ()

    discovered: list[str] = []
    for item in models:
        actions = getattr(item, "supported_actions", None) or []
        if "generateContent" not in actions:
            continue

        raw_name = getattr(item, "name", "") or ""
        short_name = raw_name.split("/", 1)[-1]
        lowered = short_name.lower()

        if any(marker in lowered for marker in _DISCOVERY_SKIP_MARKERS):
            continue

        discovered.append(short_name)

    unique_models = sorted(set(discovered), key=_model_rank)
    return tuple(unique_models)


def _candidate_models(client, requested_model: str) -> list[str]:
    candidates = [requested_model]

    for discovered_model in _discover_candidate_models(client):
        if discovered_model not in candidates:
            candidates.append(discovered_model)

    return candidates


def generate_with_retry(client, model: str, contents, max_attempts: int = 3):
    last_exc: Exception | None = None

    for candidate_model in _candidate_models(client, model):
        for attempt in range(1, max_attempts + 1):
            try:
                return client.models.generate_content(
                    model=candidate_model,
                    contents=contents,
                )
            except Exception as exc:
                last_exc = exc
                if not _is_retryable_error(exc):
                    raise
                if attempt < max_attempts:
                    time.sleep(min(2 ** (attempt - 1), 4))

    if last_exc is not None:
        raise last_exc

    raise RuntimeError("Gemini request failed before any model attempt was made.")
