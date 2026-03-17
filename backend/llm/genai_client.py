import time
from functools import lru_cache
from llm.quota_manager import quota_manager


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


def _is_quota_exhausted(exc: Exception) -> bool:
    """Check if the error is due to quota exhaustion"""
    message = str(exc).lower()
    return "429" in message or "quota" in message or "resource_exhausted" in message


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
    """Generate content with intelligent quota management and fallbacks"""
    
    # Check quota before making request
    if not quota_manager.is_quota_available():
        print("⚠️  Gemini API quota exhausted, using fallback mode")
        raise Exception("QUOTA_EXHAUSTED: Using fallback responses")
    
    last_exc: Exception | None = None

    for candidate_model in _candidate_models(client, model):
        for attempt in range(1, max_attempts + 1):
            try:
                response = client.models.generate_content(
                    model=candidate_model,
                    contents=contents,
                )
                
                # Record successful request
                quota_manager.record_request()
                return response
                
            except Exception as exc:
                last_exc = exc
                
                # Handle quota exhaustion specifically
                if _is_quota_exhausted(exc):
                    print(f"⚠️  Gemini API quota exhausted: {exc}")
                    # Extract retry delay from error message if available
                    retry_delay = 3600  # Default 1 hour
                    try:
                        import re
                        match = re.search(r'retry in (\d+(?:\.\d+)?)s', str(exc))
                        if match:
                            retry_delay = int(float(match.group(1)))
                    except:
                        pass
                    
                    quota_manager.record_quota_exhausted(retry_delay)
                    raise Exception("QUOTA_EXHAUSTED: API quota exceeded")
                
                if not _is_retryable_error(exc):
                    raise
                if attempt < max_attempts:
                    time.sleep(min(2 ** (attempt - 1), 4))

    if last_exc is not None:
        raise last_exc

    raise RuntimeError("Gemini request failed before any model attempt was made.")
