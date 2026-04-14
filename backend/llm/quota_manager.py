#!/usr/bin/env python3
"""
Intelligent quota management for Groq-backed LLM requests.

This module persists short-lived backoff state for actual provider quota/rate
limit failures and provides deterministic fallbacks when AI calls are
unavailable.
"""

import hashlib
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class QuotaManagerError(Exception):
    """Custom exception for quota manager errors."""


class QuotaManager:
    """Manages provider backoff state and deterministic fallbacks."""

    BASE_DIR = Path(__file__).resolve().parents[1]
    DEFAULT_RETRY_DELAY = 3600  # 1 hour
    QUOTA_FILE_NAME = BASE_DIR / "llm_quota_status.json"
    QUOTA_ERROR_MARKERS = (
        "429",
        "quota",
        "rate limit",
        "too many requests",
        "resource exhausted",
        "requests per minute",
        "tokens per minute",
    )

    def __init__(self, quota_file: Optional[str] = None, daily_limit: int = 0):
        """
        Initialize QuotaManager.

        Args:
            quota_file: Custom path for quota status file.
            daily_limit: Optional local request counter for diagnostics only.
        """
        self.quota_file = Path(quota_file or self.QUOTA_FILE_NAME)
        self.daily_limit = daily_limit
        self.daily_requests = 0
        self.last_reset = datetime.now()
        self.quota_exhausted_until: Optional[datetime] = None
        self.api_key_fingerprint: Optional[str] = None

        self.load_quota_status()

    def _build_api_key_fingerprint(self, api_key: Optional[str]) -> Optional[str]:
        """Create a non-reversible fingerprint so key changes reset local backoff state."""
        if not api_key:
            return None
        return hashlib.sha256(api_key.strip().encode("utf-8")).hexdigest()[:12]

    def sync_api_key(self, api_key: Optional[str]) -> None:
        """
        Reset persisted backoff state when the configured API key changes.

        A fresh provider key should not inherit stale local exhaustion metadata.
        """
        if api_key is None:
            return

        new_fingerprint = self._build_api_key_fingerprint(api_key)
        if new_fingerprint == self.api_key_fingerprint:
            return

        self.api_key_fingerprint = new_fingerprint
        self.daily_requests = 0
        self.last_reset = datetime.now()
        self.quota_exhausted_until = None
        self.save_quota_status()
        logger.info("LLM API key change detected. Reset local quota/backoff state.")

    def is_quota_error(self, error: Exception | str) -> bool:
        """Return True when an error indicates provider quota/rate limiting."""
        message = str(error).lower()
        return any(marker in message for marker in self.QUOTA_ERROR_MARKERS)

    def load_quota_status(self) -> None:
        """Load quota status from file with robust error handling."""
        try:
            if self.quota_file.exists():
                with self.quota_file.open("r", encoding="utf-8") as handle:
                    data = json.load(handle)
                    self.daily_requests = data.get("daily_requests", 0)
                    self.daily_limit = data.get("daily_limit", self.daily_limit)
                    self.api_key_fingerprint = data.get("api_key_fingerprint")

                    last_reset_str = data.get("last_reset", datetime.now().isoformat())
                    self.last_reset = datetime.fromisoformat(last_reset_str)

                    quota_exhausted_str = data.get("quota_exhausted_until")
                    self.quota_exhausted_until = (
                        datetime.fromisoformat(quota_exhausted_str)
                        if quota_exhausted_str
                        else None
                    )
            else:
                self._initialize_quota()
        except (json.JSONDecodeError, ValueError, KeyError) as exc:
            logger.warning("Failed to load quota status: %s. Initializing fresh quota.", exc)
            self._initialize_quota()
        except Exception as exc:
            logger.error("Unexpected error loading quota status: %s", exc)
            self._initialize_quota()

    def _initialize_quota(self) -> None:
        """Initialize quota with default values."""
        self.daily_requests = 0
        self.last_reset = datetime.now()
        self.quota_exhausted_until = None
        self.save_quota_status()

    def save_quota_status(self) -> None:
        """Save quota status to file with atomic write."""
        try:
            self.quota_file.parent.mkdir(parents=True, exist_ok=True)

            data = {
                "daily_requests": self.daily_requests,
                "last_reset": self.last_reset.isoformat(),
                "quota_exhausted_until": (
                    self.quota_exhausted_until.isoformat()
                    if self.quota_exhausted_until
                    else None
                ),
                "daily_limit": self.daily_limit,
                "api_key_fingerprint": self.api_key_fingerprint,
            }

            temp_file = self.quota_file.with_suffix(".tmp")
            with temp_file.open("w", encoding="utf-8") as handle:
                json.dump(data, handle, indent=2)

            temp_file.replace(self.quota_file)
        except Exception as exc:
            logger.error("Failed to save quota status: %s", exc)

    def reset_daily_quota(self) -> None:
        """Reset the diagnostics counter."""
        self.daily_requests = 0
        self.last_reset = datetime.now()
        self.quota_exhausted_until = None
        self.save_quota_status()
        logger.info("Daily quota diagnostics reset successfully")

    def check_daily_reset(self) -> None:
        """Reset diagnostics counter when the day changes."""
        if datetime.now().date() > self.last_reset.date():
            self.reset_daily_quota()

    def is_quota_available(self, api_key: Optional[str] = None) -> bool:
        """Availability is driven only by active provider backoff state."""
        self.check_daily_reset()
        self.sync_api_key(api_key)

        if self.quota_exhausted_until and datetime.now() < self.quota_exhausted_until:
            return False

        return True

    def record_request(self, api_key: Optional[str] = None) -> None:
        """Record a successful API request for diagnostics only."""
        self.sync_api_key(api_key)
        self.daily_requests += 1
        self.save_quota_status()
        logger.debug("Recorded request. Daily count: %s", self.daily_requests)

    def record_quota_exhausted(
        self,
        retry_delay_seconds: int = DEFAULT_RETRY_DELAY,
        api_key: Optional[str] = None,
    ) -> None:
        """Persist a short-lived provider backoff window."""
        self.sync_api_key(api_key)
        self.quota_exhausted_until = datetime.now() + timedelta(seconds=retry_delay_seconds)
        self.save_quota_status()
        logger.warning("Quota exhausted. Retry available at: %s", self.quota_exhausted_until)

    def get_quota_status(self) -> Dict[str, Any]:
        """Get current diagnostics and backoff status."""
        self.check_daily_reset()
        return {
            "daily_requests": self.daily_requests,
            "daily_limit": self.daily_limit,
            "requests_remaining": max(0, self.daily_limit - self.daily_requests),
            "quota_available": self.is_quota_available(),
            "quota_exhausted_until": (
                self.quota_exhausted_until.isoformat()
                if self.quota_exhausted_until
                else None
            ),
            "last_reset": self.last_reset.isoformat(),
        }

    def get_fallback_response(self, request_type: str, **kwargs) -> Dict[str, Any]:
        """Generate a simple error when AI is unavailable, forcing the frontend to show an error state."""
        return {
            "cannot_answer": True, 
            "error": "API Quota Exhausted", 
            "reason": "The AI service is temporarily unavailable or out of quota. Please try again later.",
            "fallback": True
        }


quota_manager = QuotaManager()
