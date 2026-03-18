from __future__ import annotations

import json
from functools import lru_cache
from typing import Any, Optional

from groq import Groq

from config import settings
from llm.genai_client import generate_with_retry, _GROQ_MODEL


@lru_cache(maxsize=1)
def _get_client() -> Optional[Groq]:
    """Get the Groq client with API key configuration.

    Returns None when missing so callers can skip gracefully.
    """
    if not settings.GROQ_API_KEY:
        return None
    try:
        return Groq(api_key=settings.GROQ_API_KEY)
    except Exception:
        return None


def _parse_json_payload(raw: str) -> dict[str, Any]:
    """Extract JSON from a model response, tolerating markdown fences."""
    text = (raw or "").strip()
    if not text:
        raise ValueError("Empty model response")

    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1] if len(parts) > 1 else text
        if text.startswith("json"):
            text = text[4:].strip()

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("Model response did not contain JSON")
    return json.loads(text[start : end + 1])  # type: ignore


def _format_column(column: dict[str, Any]) -> str:
    dtype = column.get("dtype", "")
    name = column.get("name", "unknown")
    base = f"  - {name} ({dtype})"
    if dtype == "numeric":
        if column.get("min") is not None and column.get("max") is not None:
            base += f" | range: {column['min']} to {column['max']}"
    if dtype == "datetime":
        if column.get("min_date") and column.get("max_date"):
            base += f" | dates: {column['min_date']} to {column['max_date']}"
    if dtype == "categorical":
        samples = column.get("sample_values", [])
        if samples:
            base += f" | samples: {', '.join(map(str, samples[:3]))}"
    return base


def _build_prompt(schema: dict[str, Any], prompt: str, output_count: int) -> str:
    columns_text = "\n".join(_format_column(col) for col in schema.get("columns", []))
    count_instruction = (
        "Return EXACTLY TWO different chart specifications. Option A is the most direct answer. Option B must use a different metric, grouping, or chart type."
        if output_count == 2
        else "Return EXACTLY ONE chart specification, the single best visualization."
    )

    return f"""
You are a senior BI analyst. {count_instruction}

=== DATASET SCHEMA ===
Rows: {schema.get('row_count', 'unknown')}
Table name: data
Columns:
{columns_text}

Date columns: {schema.get('date_columns', [])}
Numeric columns: {schema.get('numeric_columns', [])}
Categorical columns: {schema.get('categorical_columns', [])}

=== SQL RULES ===
- Use ONLY columns listed above
- Table name is always data
- Always alias aggregations
- Always ROUND float aggregations
- Pie charts must include LIMIT 6
- line: X must be a date column
- bar: X categorical, Y numeric
- pie: proportions of a whole
- scatter: X and Y numeric

=== OUTPUT ===
Return valid JSON only:
{{
  "cannot_answer": false,
  "charts": [
    {{
      "title": "short title",
      "chart_type": "bar|line|pie|scatter",
      "x": "column",
      "y": "column",
      "color_by": "column|null",
      "aggregation": "sum|avg|count|min|max",
      "sql": "SELECT ... FROM data ...",
      "reason": "short explanation"
    }}
  ],
  "reason": "if cannot_answer true, explain"
}}
If you cannot answer, set cannot_answer true and provide a reason.
User query: {prompt}
"""


def get_chart_specs(schema: dict[str, Any], prompt: str, history: list[dict[str, Any]] | None, output_count: int = 1) -> dict[str, Any]:
    if not schema or not schema.get("columns"):
        return {"cannot_answer": True, "reason": "Missing schema"}

    system_prompt = _build_prompt(schema, prompt, output_count)

    contents = [{"role": "system", "parts": [{"text": system_prompt}]}]

    for msg in history or []:
        text = msg.get("content") or msg.get("text") or ""
        role = msg.get("role", "user")
        if text:
            contents.append({"role": role, "parts": [{"text": text}]})

    contents.append({"role": "user", "parts": [{"text": prompt}]})

    try:
        client = _get_client()
        response = generate_with_retry(
            client=client,
            model=_GROQ_MODEL,
            contents=contents,
        )
        return _parse_json_payload(response.text)
    except Exception as exc:
        return {"cannot_answer": True, "reason": str(exc)}


def generate_data_driven_insight(prompt: str, chart_title: str, chart_type: str, data: list[dict]) -> str:
    """Stage 5: Data-driven insight generation based on actual aggregated data."""
    if not data:
        return "No data returned to generate an insight."

    data_sample = data[:30]  # type: ignore

    system_prompt = f"""
You are an expert data analyst. Look at these aggregate results and summarize the key takeaway in 1 to 2 short sentences.
Original Query: {prompt}
Chart Title: {chart_title}
Chart Type: {chart_type}

Aggregated Data (up to 30 rows):
{json.dumps(data_sample, default=str)}

Keep it professional, punchy, and include actual numbers from the data. Do NOT explain what the chart is. Just give the business takeaway.
"""
    try:
        client = _get_client()
        response = generate_with_retry(
            client=client,
            model=_GROQ_MODEL,
            contents=[{"role": "user", "parts": [{"text": system_prompt}]}],
        )
        return response.text.replace("\n", " ").strip()
    except Exception:
        return "Could not generate insight."
