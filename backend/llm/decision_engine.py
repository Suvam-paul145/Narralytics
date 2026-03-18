from __future__ import annotations

import json
from functools import lru_cache
from typing import Any, Optional

from groq import Groq

from config import settings
from llm.genai_client import generate_with_retry, _GROQ_MODEL


@lru_cache(maxsize=1)
def _get_client() -> Optional[Groq]:
    if not settings.GROQ_API_KEY:
        return None
    try:
        return Groq(api_key=settings.GROQ_API_KEY)
    except Exception:
        return None


def _extract_json(raw: str) -> dict[str, Any]:
    text = raw.strip()
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1] if len(parts) > 1 else text
        if text.startswith("json"):
            text = text[4:].strip()  # type: ignore

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("Decision engine response missing JSON")
    return json.loads(text[start : end + 1])  # type: ignore


def _heuristic_decision(
    message: str,
    schema: dict[str, Any],
    rows: list[dict[str, Any]],
    supporting_sql: str,
) -> dict[str, Any]:
    msg = (message or "").lower()
    date_cols = schema.get("date_columns", [])
    categorical_cols = schema.get("categorical_columns", [])

    row_keys = set(rows[0].keys()) if rows else set()

    numeric_keys = []
    for key in row_keys:
        sample = [r.get(key) for r in rows[:20] if r.get(key) is not None]
        if sample and all(isinstance(v, (int, float)) for v in sample):
            numeric_keys.append(key)

    y_key = numeric_keys[0] if numeric_keys else (schema.get("numeric_columns", [None])[0])

    x_candidates = [k for k in row_keys if k != y_key]
    x_key = x_candidates[0] if x_candidates else None

    chart_type = "bar"
    if any(word in msg for word in ["trend", "over time", "monthly", "daily", "weekly", "yearly"]):
        chart_type = "line"
    elif any(word in msg for word in ["share", "proportion", "percentage", "contribution"]):
        chart_type = "pie"

    if x_key and x_key in date_cols:
        chart_type = "line"

    color_by = None
    for col in categorical_cols:
        if col in row_keys and col != x_key and col != y_key:
            color_by = col
            break

    title = f"{(y_key or 'value').replace('_', ' ').title()} by {(x_key or 'dimension').replace('_', ' ').title()}"

    return {
        "chart_type": chart_type,
        "x_key": x_key,
        "y_key": y_key,
        "color_by": color_by,
        "aggregation": "sum",
        "title": title,
        "sql": supporting_sql,
        "reasoning": "heuristic_fallback",
    }


def get_decision_plan(
    message: str,
    schema: dict[str, Any],
    rows: list[dict[str, Any]],
    supporting_sql: str,
) -> dict[str, Any]:
    if not rows:
        return _heuristic_decision(message, schema, rows, supporting_sql)

    columns = ", ".join([c["name"] for c in schema.get("columns", [])])
    sample = json.dumps(rows[:20], default=str)

    prompt = f"""
You are a decision engine for BI orchestration.
Given user query + SQL result sample, output the most appropriate visualization plan.

Rules:
- Always decide if cumulative aggregation is required.
- If two categorical dimensions exist, use primary as x_key and secondary as color_by.
- Use SUM-style cumulative semantics when repeated entities exist.
- Choose chart_type from: bar, line, area, pie, scatter.
- Preserve SQL as provided.
- Return JSON only.

User query: {message}
Available columns: {columns}
SQL: {supporting_sql}
Result sample: {sample}

Return:
{{
  "chart_type": "bar|line|area|pie|scatter",
  "x_key": "column",
  "y_key": "column",
  "color_by": "column|null",
  "aggregation": "sum|avg|count|min|max",
  "title": "short title",
  "sql": "{supporting_sql}",
  "reasoning": "short"
}}
"""

    try:
        client = _get_client()
        if client is None:
            return _heuristic_decision(message, schema, rows, supporting_sql)

        response = generate_with_retry(
            client=client,
            model=_GROQ_MODEL,
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
        )
        decision = _extract_json(response.text)

        # Safety normalization.
        if not decision.get("x_key") or not decision.get("y_key"):
            return _heuristic_decision(message, schema, rows, supporting_sql)

        if decision.get("chart_type") not in {"bar", "line", "area", "pie", "scatter"}:
            decision["chart_type"] = "bar"

        decision["sql"] = supporting_sql
        return decision
    except Exception:
        return _heuristic_decision(message, schema, rows, supporting_sql)
