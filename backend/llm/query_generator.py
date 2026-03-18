import json
import logging
from functools import lru_cache

from config import settings
from llm.genai_client import _GROQ_MODEL, generate_with_retry, get_primary_api_key
from llm.quota_manager import quota_manager

logger = logging.getLogger(__name__)


def _generate_guaranteed_fallback(enhanced_prompt: str, schema: dict) -> dict:
    """
    Last resort: Generate at least ONE valid chart without relying on LLM.
    Used when LLM fails, quota exhausted, or data is insufficient.
    """
    # Prefer normalized codes to align with SQLite column names
    numeric_cols = schema.get("numeric_column_codes") or schema.get("numeric_columns", [])
    categorical_cols = schema.get("categorical_column_codes") or schema.get("categorical_columns", [])
    date_cols = schema.get("date_column_codes") or schema.get("date_columns", [])
    
    # If we have numeric + categorical, always generate a bar chart
    if numeric_cols and categorical_cols:
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
                    "insight": "Overview of key metrics"
                }
            ]
        }
    
    # If we have date + numeric, generate a line chart
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
                    "limit": 100,
                    "title": f"{numeric_cols[0].title()} Trend",
                    "insight": "Trend analysis over time"
                }
            ]
        }
    
    # If we ONLY have numeric, generate distribution
    if numeric_cols:
        return {
            "cannot_answer": False,
            "options": [
                {
                    "chartType": "bar",
                    "xAxis": numeric_cols[0],
                    "yAxis": numeric_cols[1] if len(numeric_cols) > 1 else numeric_cols[0],
                    "aggregation": "COUNT",
                    "groupBy": None,
                    "filters": {},
                    "limit": 10,
                    "title": f"Distribution of {numeric_cols[0].title()}",
                    "insight": "Data distribution"
                }
            ]
        }
    
    # Absolute fallback
    return {
        "cannot_answer": True,
        "reason": "Dataset has no analyzable columns (no numeric or categorical data)"
    }


@lru_cache(maxsize=1)
def _get_client():
    # Backwards compatibility: generate_with_retry is Gemini-only now.
    return None


def _clean_json(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1] if len(parts) > 1 else text
        if text.startswith("json"):
            text = text[4:].strip()
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return text[start : end + 1]
    return text


def _escape_control_characters(text: str) -> str:
    """Escape raw control characters that appear inside JSON string values."""
    escaped: list[str] = []
    in_string = False
    is_escaped = False

    for char in text:
        if is_escaped:
            escaped.append(char)
            is_escaped = False
            continue

        if char == "\\":
            escaped.append(char)
            is_escaped = True
            continue

        if char == '"':
            escaped.append(char)
            in_string = not in_string
            continue

        if in_string and char in {"\n", "\r", "\t"}:
            escaped.append(
                {
                    "\n": "\\n",
                    "\r": "\\r",
                    "\t": "\\t",
                }[char]
            )
            continue

        if in_string and ord(char) < 32:
            escaped.append(f"\\u{ord(char):04x}")
            continue

        escaped.append(char)

    return "".join(escaped)


def _parse_payload(raw: str) -> dict:
    cleaned = _clean_json(raw)

    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError:
        payload = json.loads(_escape_control_characters(cleaned))

    if not isinstance(payload, dict):
        raise ValueError("Model response is not a JSON object")

    # Accept user-prompt format alias: {"charts": [...]} and normalize to options.
    if "options" not in payload and isinstance(payload.get("charts"), list):
        payload["options"] = payload.get("charts")

    if payload.get("error"):
        return {
            "cannot_answer": True,
            "reason": str(payload.get("error")),
        }

    options = payload.get("options")
    if options is not None and not isinstance(options, list):
        raise ValueError("Model response 'options' must be a list")

    return payload


_SYSTEM_TEMPLATE = """Act as an expert business intelligence engine trained on an e-commerce dataset.
Convert ANY natural language query into STRICT structured JSON for analytics.

=== DATASET SCHEMA ===
{schema_text}

=== VALID COLUMNS ===
{columns_csv}

=== REQUIRED INTENT HANDLING ===
- Detect ranking intent: top, best, highest, leading, most, compare.
- Detect entity dimension from schema (e.g., customer_region, product_category, product_id, payment_method).
- Detect metric from schema (prefer total_revenue, quantity_sold, rating, review_count, discounted_price when present).
- Apply aggregation + sorting for ranking/comparison.

=== RULES ===
1) NEVER hallucinate columns outside the schema.
2) If query implies time, use chartType=line when date columns exist.
3) If query implies ranking/comparison, use chartType=bar.
4) If query implies distribution/share, use chartType=pie.
5) If metric is not explicit, default to total_revenue when available, else first numeric column.
6) If entity is not explicit, infer the best categorical/date column.
7) Ranking queries MUST include sort="desc" and a numeric limit.
8) Only output JSON; no prose.

=== MANDATORY JSON OUTPUT ===
{{
    "options": [
        {{
            "chartType": "bar|line|pie",
            "xAxis": "column_name",
            "yAxis": "column_name",
            "aggregation": "sum|avg|count",
            "groupBy": "column_name",
            "filters": {{}},
            "sort": "asc|desc",
            "limit": 5,
            "title": "chart title",
            "insight": "short factual insight"
        }}
    ]
}}

If impossible with available columns, return exactly:
{{"cannot_answer": true, "reason": "Data not available"}}
"""


def generate_query_spec(
    enhanced_prompt: str,
    schema: dict,
    output_count: int = 1,
    history: list[dict] | None = None,
) -> dict:
    schema_lines = [f"Table: data | Rows: {schema.get('row_count', 0)}"]
    for col in schema.get("columns", []):
        schema_lines.append(f"  - {col['name']} ({col.get('dtype', 'text')})")
    schema_text = "\n".join(schema_lines)
    all_col_names = [col["name"] for col in schema.get("columns", [])]

    system_prompt = _SYSTEM_TEMPLATE.format(
        schema_text=schema_text,
        columns_csv=", ".join(all_col_names),
    )

    history_text = ""
    if history:
        for turn in history[-6:]:
            role = turn.get("role", "user").upper()
            history_text += f"\n{role}: {turn.get('content', '')}"

    full_prompt = f"{system_prompt}\n\n=== HISTORY ===\n{history_text}\n\n=== INSTRUCTION ===\n{enhanced_prompt}"

    primary_key = get_primary_api_key()
    if not quota_manager.is_quota_available(primary_key):
        logger.warning("[query_generator] Quota exhausted - using guaranteed fallback")
        return _generate_guaranteed_fallback(enhanced_prompt, schema)

    try:
        client = _get_client()
        logger.info("[query_generator] Requesting LLM for schema query")
        response = generate_with_retry(
            client=client,
            model=_GROQ_MODEL,
            contents=[{"role": "user", "parts": [{"text": full_prompt}]}],
        )
        quota_manager.record_request(primary_key)
        raw = response.text
        logger.info("[query_generator] LLM raw response JSON:\n%s", raw)
        return _parse_payload(raw)
    except Exception as exc:
        logger.error("[query_generator] LLM Error: %s - using guaranteed fallback", exc)
        return _generate_guaranteed_fallback(enhanced_prompt, schema)
