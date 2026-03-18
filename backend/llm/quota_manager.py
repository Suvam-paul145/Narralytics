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
        """Generate intelligent fallback responses when AI is unavailable."""
        fallback_handlers = {
            "prompt_enhancement": self._get_prompt_enhancement_fallback,
            "auto_dashboard": self._get_auto_dashboard_fallback,
            "chat": self._get_chat_fallback,
            "query_generation": self._get_query_generation_fallback,
            "report_summary": self._get_report_summary_fallback,
        }

        handler = fallback_handlers.get(request_type)
        if handler:
            return handler(**kwargs)

        return {"error": "Quota exhausted", "fallback": True}

    def _get_prompt_enhancement_fallback(self, raw_prompt: str, schema: Dict, **kwargs) -> str:
        """Smart fallback for prompt enhancement."""
        numeric_cols = schema.get("numeric_columns", [])
        date_cols = schema.get("date_columns", [])
        categorical_cols = schema.get("categorical_columns", [])

        enhanced = raw_prompt.lower()
        patterns = [
            (
                ["trend", "over time"],
                date_cols,
                numeric_cols,
                lambda: f"Show {numeric_cols[0]} trends over {date_cols[0]}",
            ),
            (
                ["total", "sum"],
                numeric_cols,
                None,
                lambda: f"Calculate total {numeric_cols[0]}",
            ),
            (
                ["by", "group"],
                categorical_cols and numeric_cols,
                None,
                lambda: f"Show {numeric_cols[0]} grouped by {categorical_cols[0]}",
            ),
        ]

        for keywords, required_cols, secondary_cols, formatter in patterns:
            if any(keyword in enhanced for keyword in keywords) and required_cols:
                if secondary_cols is None or secondary_cols:
                    return formatter()

        return raw_prompt

    def _get_auto_dashboard_fallback(self, schema: Dict, **kwargs) -> List[Dict[str, Any]]:
        """Generate a basic dashboard without AI."""
        charts = []
        numeric_cols = schema.get("numeric_columns", [])
        date_cols = schema.get("date_columns", [])
        categorical_cols = schema.get("categorical_columns", [])

        chart_generators = [
            self._generate_trend_chart,
            self._generate_category_chart,
            self._generate_distribution_chart,
        ]

        chart_id = 1
        for generator in chart_generators:
            chart = generator(chart_id, numeric_cols, date_cols, categorical_cols)
            if chart:
                charts.append(chart)
                chart_id += 1

        return charts[:6]

    def _generate_trend_chart(
        self,
        chart_id: int,
        numeric_cols: List[str],
        date_cols: List[str],
        categorical_cols: List[str],
    ) -> Optional[Dict[str, Any]]:
        """Generate a trend chart if conditions are met."""
        if not (date_cols and numeric_cols):
            return None

        return {
            "chart_id": f"chart_{chart_id}",
            "title": f"{numeric_cols[0].title()} Over Time",
            "chart_type": "line",
            "x_key": date_cols[0],
            "y_key": numeric_cols[0],
            "sql": (
                f"SELECT {date_cols[0]}, SUM({numeric_cols[0]}) as {numeric_cols[0]} "
                f"FROM data GROUP BY {date_cols[0]} ORDER BY {date_cols[0]}"
            ),
            "insight": f"Shows the trend of {numeric_cols[0]} over time",
            "category": "trend",
        }

    def _generate_category_chart(
        self,
        chart_id: int,
        numeric_cols: List[str],
        date_cols: List[str],
        categorical_cols: List[str],
    ) -> Optional[Dict[str, Any]]:
        """Generate a category breakdown chart if conditions are met."""
        if not (categorical_cols and numeric_cols):
            return None

        return {
            "chart_id": f"chart_{chart_id}",
            "title": f"{numeric_cols[0].title()} by {categorical_cols[0].title()}",
            "chart_type": "bar",
            "x_key": categorical_cols[0],
            "y_key": numeric_cols[0],
            "sql": (
                f"SELECT {categorical_cols[0]}, SUM({numeric_cols[0]}) as {numeric_cols[0]} "
                f"FROM data GROUP BY {categorical_cols[0]} ORDER BY {numeric_cols[0]} DESC"
            ),
            "insight": (
                f"Breakdown of {numeric_cols[0]} across different {categorical_cols[0]} categories"
            ),
            "category": "comparison",
        }

    def _generate_distribution_chart(
        self,
        chart_id: int,
        numeric_cols: List[str],
        date_cols: List[str],
        categorical_cols: List[str],
    ) -> Optional[Dict[str, Any]]:
        """Generate a distribution chart if conditions are met."""
        if not numeric_cols:
            return None

        return {
            "chart_id": f"chart_{chart_id}",
            "title": f"{numeric_cols[0].title()} Distribution",
            "chart_type": "bar",
            "x_key": "range",
            "y_key": "count",
            "sql": (
                f"SELECT CASE WHEN {numeric_cols[0]} < (SELECT AVG({numeric_cols[0]}) FROM data) "
                "THEN 'Below Average' ELSE 'Above Average' END as range, COUNT(*) as count "
                "FROM data GROUP BY range"
            ),
            "insight": f"Distribution of {numeric_cols[0]} values",
            "category": "distribution",
        }

    def _get_chat_fallback(self, message: str, schema: Dict, **kwargs) -> Dict[str, Any]:
        """Generate a basic chat response without AI."""
        numeric_cols = schema.get("numeric_columns", [])
        message_lower = message.lower()

        response_patterns = []
        if numeric_cols:
            col = numeric_cols[0]
            response_patterns.extend(
                [
                    (
                        ["total"],
                        (
                            f"I can help you calculate the total {col}. "
                            "Due to high demand, I'm using a simplified analysis mode."
                        ),
                        f"SELECT SUM({col}) as total_{col} FROM data",
                    ),
                    (
                        ["average"],
                        f"I can show you the average {col} from your dataset.",
                        f"SELECT AVG({col}) as avg_{col} FROM data",
                    ),
                ]
            )

        response_patterns.append(
            (
                ["count"],
                "I can provide the total number of records in your dataset.",
                "SELECT COUNT(*) as total_records FROM data",
            )
        )

        for keywords, answer, sql in response_patterns:
            if any(keyword in message_lower for keyword in keywords):
                return {
                    "answer": answer,
                    "supporting_sql": sql,
                    "needs_data": True,
                    "cannot_answer": False,
                }

        return {
            "answer": (
                "I'm currently in simplified mode due to high API usage. "
                "I can still help with basic data queries like totals, averages, and counts."
            ),
            "cannot_answer": False,
        }

    def _get_query_generation_fallback(self, prompt: str, schema: Dict, **kwargs) -> Dict[str, Any]:
        """Generate a minimal structured chart response without AI."""
        numeric_cols = schema.get("numeric_columns", [])
        categorical_cols = schema.get("categorical_columns", [])
        date_cols = schema.get("date_columns", [])
        prompt_lower = prompt.lower()

        if "trend" in prompt_lower and date_cols and numeric_cols:
            return {
                "cannot_answer": False,
                "options": [
                    {
                        "chartType": "line",
                        "xAxis": date_cols[0],
                        "yAxis": numeric_cols[0],
                        "aggregation": "SUM",
                        "groupBy": None,
                        "filters": {},
                        "limit": 12,
                        "title": f"{numeric_cols[0].title()} Trend",
                        "insight": "Basic trend analysis (simplified mode)",
                    }
                ],
            }

        if categorical_cols and numeric_cols:
            return {
                "cannot_answer": False,
                "options": [
                    {
                        "chartType": "bar",
                        "xAxis": categorical_cols[0],
                        "yAxis": numeric_cols[0],
                        "aggregation": "SUM",
                        "groupBy": None,
                        "filters": {},
                        "limit": 10,
                        "title": f"{numeric_cols[0].title()} by {categorical_cols[0].title()}",
                        "insight": "Category breakdown (simplified mode)",
                    }
                ],
            }

        if date_cols and numeric_cols:
            return {
                "cannot_answer": False,
                "options": [
                    {
                        "chartType": "line",
                        "xAxis": date_cols[0],
                        "yAxis": numeric_cols[0],
                        "aggregation": "SUM",
                        "groupBy": None,
                        "filters": {},
                        "limit": 12,
                        "title": f"{numeric_cols[0].title()} Over Time",
                        "insight": "Time-series fallback based on detected date and numeric columns.",
                    }
                ],
            }

        return {
            "cannot_answer": False,
            "options": [
                {
                    "chartType": "bar",
                    "xAxis": schema.get("columns", [{"name": "category"}])[0]["name"],
                    "yAxis": schema.get("numeric_columns", ["value"])[0] if schema.get("numeric_columns") else "count",
                    "aggregation": "COUNT",
                    "title": "Data Overview"
                }
            ],
            "reason": (
                "Currently in simplified mode. Showing basic overview."
            ),
        }

    def _get_report_summary_fallback(self, dataset_name: str, charts: List[Dict], **kwargs) -> str:
        """Generate a basic report summary without AI."""
        chart_count = len(charts)
        chart_types = list({chart.get("chart_type", "unknown") for chart in charts})

        return f"""Executive Summary for {dataset_name}

This report presents {chart_count} key visualizations analyzing your dataset. The analysis includes {', '.join(chart_types)} charts providing insights into your data patterns and trends.

Key findings are presented in the charts below, showing data relationships and patterns that can inform business decisions.

Note: This summary was generated in simplified mode due to high API usage. For detailed AI-powered insights, please try again later."""


quota_manager = QuotaManager()
