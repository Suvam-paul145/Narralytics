import json
import logging
from typing import Any

from analytics.chart_builder import convert_llm_json_to_chart_spec
from llm.genai_client import generate_json_with_retry, get_primary_api_key
from llm.quota_manager import quota_manager

logger = logging.getLogger(__name__)

MIN_CHARTS = 6
MAX_CHARTS = 10
MAX_PIE_CATEGORIES = 6
TABLE_NAME = "data"

CHART_TYPES = {
    "LINE": "line",
    "AREA": "area",
    "BAR": "bar",
    "PIE": "pie",
    "SCATTER": "scatter",
}

VALID_CHART_TYPES = set(CHART_TYPES.values())
VALID_AGGREGATIONS = {"sum", "avg", "count", "min", "max"}
VALID_CATEGORIES = {"trend", "comparison", "distribution", "correlation", "ranking"}

DTYPE_NUMERIC = "numeric"
DTYPE_DATETIME = "datetime"
DTYPE_CATEGORICAL = "categorical"

AUTO_DASHBOARD_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "charts": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "chart_id": {"type": "string"},
                    "title": {"type": "string"},
                    "chart_type": {
                        "type": "string",
                        "enum": sorted(VALID_CHART_TYPES),
                    },
                    "xAxis": {"type": "string"},
                    "yAxis": {"type": "string"},
                    "groupBy": {"type": ["string", "null"]},
                    "aggregation": {
                        "type": "string",
                        "enum": sorted(VALID_AGGREGATIONS),
                    },
                    "sort": {
                        "type": "string",
                        "enum": ["asc", "desc"],
                    },
                    "limit": {"type": ["integer", "null"]},
                    "insight": {"type": "string"},
                    "category": {
                        "type": "string",
                        "enum": sorted(VALID_CATEGORIES),
                    },
                },
                "required": [
                    "chart_id",
                    "title",
                    "chart_type",
                    "xAxis",
                    "yAxis",
                    "groupBy",
                    "aggregation",
                    "sort",
                    "limit",
                    "insight",
                    "category",
                ],
                "additionalProperties": False,
            },
        }
    },
    "required": ["charts"],
    "additionalProperties": False,
}


def _parse_json_payload(raw: str) -> dict[str, Any]:
    """Parse JSON payload from model response, handling markdown code blocks."""
    if not raw or not raw.strip():
        raise ValueError("Empty or whitespace-only response")

    text = raw.strip()
    if text.startswith("```"):
        parts = text.split("```")
        if len(parts) >= 3:
            text = parts[1]
            if text.startswith("json"):
                text = text[4:].strip()
        else:
            text = text[3:].strip()

    start = text.find("{")
    end = text.rfind("}")

    if start == -1 or end == -1 or start >= end:
        raise ValueError("Model response did not contain valid JSON boundaries")

    json_text = text[start : end + 1]

    try:
        parsed = json.loads(json_text)
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse dashboard JSON: %s...", json_text[:240])
        raise ValueError(f"Invalid JSON in model response: {exc}") from exc

    if not isinstance(parsed, dict):
        raise ValueError("Dashboard payload is not a JSON object")

    return parsed


def _format_column_info(column: dict[str, Any]) -> str:
    if not column or "name" not in column or "dtype" not in column:
        return "  - [Invalid column data]"

    code = column.get("code") or column["name"]
    base_info = f"  - {column['name']} [code: {code}] ({column['dtype']})"
    dtype = column["dtype"]

    if dtype == DTYPE_NUMERIC:
        min_val = column.get("min")
        max_val = column.get("max")
        if min_val is not None and max_val is not None:
            base_info += f" | range: {min_val} to {max_val}"
    elif dtype == DTYPE_DATETIME:
        min_date = column.get("min_date")
        max_date = column.get("max_date")
        if min_date and max_date:
            base_info += f" | dates: {min_date} to {max_date}"
    elif dtype == DTYPE_CATEGORICAL:
        sample_values = column.get("sample_values", [])
        if sample_values:
            samples = ", ".join(str(val) for val in sample_values[:3])
            base_info += f" | samples: {samples}"
            if len(sample_values) > 3:
                base_info += f" (+{len(sample_values) - 3} more)"

    return base_info


def _validate_schema(schema: dict[str, Any]) -> bool:
    required_fields = [
        "columns",
        "row_count",
        "date_columns",
        "numeric_columns",
        "categorical_columns",
    ]

    if not isinstance(schema, dict):
        return False

    for field in required_fields:
        if field not in schema:
            logger.warning("Schema missing required field: %s", field)
            return False

    columns = schema.get("columns", [])
    if not isinstance(columns, list) or not columns:
        logger.warning("Schema has no valid columns")
        return False

    return True


def build_auto_dashboard_prompt(schema: dict[str, Any], requirements: str | None = None) -> str:
    if not _validate_schema(schema):
        raise ValueError("Invalid schema provided")

    columns_text = "\n".join(_format_column_info(column) for column in schema["columns"])
    row_count = schema.get("row_count", 0)

    date_cols = ", ".join(schema.get("date_columns", [])) or "None"
    numeric_cols = ", ".join(schema.get("numeric_columns", [])) or "None"
    categorical_cols = ", ".join(schema.get("categorical_columns", [])) or "None"

    requirement_block = (
        f"\n=== DASHBOARD REQUIREMENTS FROM USER ===\n{requirements.strip()}\n"
        if requirements and requirements.strip()
        else "\n=== DASHBOARD REQUIREMENTS FROM USER ===\nNone provided. Build the best broad overview dashboard.\n"
    )

    return f"""
You are a senior BI analyst designing an automatic dashboard for a newly uploaded dataset.
You are NOT executing SQL. You are only planning the dashboard structure.

=== DATASET INFO ===
Total rows: {row_count:,}
Columns:
{columns_text}

Date columns: {date_cols}
Numeric columns: {numeric_cols}
Categorical columns: {categorical_cols}
{requirement_block}

=== YOUR TASK ===
Create a diverse dashboard plan with high-value charts tailored to this exact dataset and the user's requirements.
Aim for {MIN_CHARTS}-{MAX_CHARTS} charts, but only include charts that are genuinely supported by the schema.

Priority order:
1. Time-series trends when date columns exist
2. Category comparisons when categorical + numeric columns exist
3. Composition or share views
4. Correlations between numeric columns
5. Rankings and top performers

=== IMPORTANT RULES ===
- Only use exact column names listed above
- Do not invent columns, calculations, or dashboard sections
- Do not write SQL
- Do not claim exact numeric findings because query results are not available yet
- Make each chart meaningfully different from the others
- Prefer business-friendly titles
- {CHART_TYPES["LINE"]} and {CHART_TYPES["AREA"]} charts need a date/time X axis
- {CHART_TYPES["BAR"]} and {CHART_TYPES["PIE"]} charts should compare categories
- {CHART_TYPES["PIE"]} charts should be limited to {MAX_PIE_CATEGORIES} categories
- {CHART_TYPES["SCATTER"]} charts need two numeric columns
- Use aggregation only from: sum, avg, count, min, max
- Use category only from: trend, comparison, distribution, correlation, ranking
- The downstream SQL engine will query table named exactly: {TABLE_NAME}

=== OUTPUT NOTES ===
- `insight` should explain why the chart matters, not fabricate numbers
- Use `groupBy` only when a second grouping dimension materially improves the chart
- Use `limit` for ranking/pie charts when appropriate; otherwise use null
"""


def _normalize_chart_plan(plan: dict[str, Any], index: int) -> dict[str, Any] | None:
    if not isinstance(plan, dict):
        return None

    chart_type = str(plan.get("chart_type", "")).strip().lower()
    aggregation = str(plan.get("aggregation", "sum")).strip().lower()
    category = str(plan.get("category", "comparison")).strip().lower()
    x_axis = str(plan.get("xAxis", "")).strip()
    y_axis = str(plan.get("yAxis", "")).strip()
    title = str(plan.get("title", "")).strip()

    if chart_type not in VALID_CHART_TYPES:
        logger.warning("Skipping dashboard plan with invalid chart type: %s", chart_type)
        return None
    if aggregation not in VALID_AGGREGATIONS:
        logger.warning("Skipping dashboard plan with invalid aggregation: %s", aggregation)
        return None
    if category not in VALID_CATEGORIES:
        logger.warning("Skipping dashboard plan with invalid category: %s", category)
        return None
    if not x_axis or not y_axis or not title:
        logger.warning("Skipping dashboard plan with missing axes/title: %s", plan)
        return None

    limit = plan.get("limit")
    if limit is not None:
        try:
            limit = max(1, min(int(limit), 50))
        except (TypeError, ValueError):
            limit = None

    if chart_type == CHART_TYPES["PIE"]:
        limit = min(limit or MAX_PIE_CATEGORIES, MAX_PIE_CATEGORIES)

    normalized = {
        "chart_id": str(plan.get("chart_id") or f"c{index + 1}"),
        "title": title,
        "chartType": chart_type,
        "xAxis": x_axis,
        "yAxis": y_axis,
        "groupBy": plan.get("groupBy"),
        "aggregation": aggregation,
        "filters": {},
        "sort": "asc" if str(plan.get("sort", "desc")).lower() == "asc" else "desc",
        "limit": limit,
        "insight": str(plan.get("insight", "") or "").strip(),
        "category": category,
    }
    return normalized


def _build_chart_specs(plans: list[dict[str, Any]], schema: dict[str, Any]) -> list[dict[str, Any]]:
    chart_specs: list[dict[str, Any]] = []
    seen_signatures: set[tuple[str, str, str, str, str | None]] = set()

    for index, raw_plan in enumerate(plans):
        plan = _normalize_chart_plan(raw_plan, index=index)
        if not plan:
            continue

        signature = (
            str(plan["chartType"]),
            str(plan["xAxis"]),
            str(plan["yAxis"]),
            str(plan["aggregation"]),
            str(plan.get("groupBy") or ""),
        )
        if signature in seen_signatures:
            continue
        seen_signatures.add(signature)

        converted = convert_llm_json_to_chart_spec([plan], schema)
        if not converted:
            continue

        spec = {
            **converted[0],
            "chart_id": plan["chart_id"],
            "category": plan["category"],
            "insight": plan["insight"],
            "aggregation": plan["aggregation"],
        }
        chart_specs.append(spec)

        if len(chart_specs) >= MAX_CHARTS:
            break

    return chart_specs


def generate_auto_dashboard(schema: dict[str, Any], requirements: str | None = None) -> list[dict[str, Any]]:
    if not schema:
        logger.warning("No schema provided")
        return []

    try:
        prompt = build_auto_dashboard_prompt(schema, requirements=requirements)
    except ValueError as exc:
        logger.error("Invalid schema: %s", exc)
        return []

    primary_key = get_primary_api_key()
    if not quota_manager.is_quota_available(primary_key):
        logger.info("Auto-dashboard generation blocked due to active local LLM backoff")
        return []

    try:
        model_used, response = generate_json_with_retry(
            task="dashboard",
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
            schema_name="auto_dashboard_plan",
            schema=AUTO_DASHBOARD_SCHEMA,
        )
        quota_manager.record_request(primary_key)

        if not response or not response.text:
            logger.error("Empty response from Groq model")
            return []

        payload = _parse_json_payload(response.text)
        raw_charts = payload.get("charts", [])

        if not isinstance(raw_charts, list) or not raw_charts:
            logger.warning("No chart plans found in model response")
            return []

        valid_charts = _build_chart_specs(raw_charts, schema)

        if not valid_charts:
            logger.warning("No valid dashboard charts after validation")
            return []

        logger.info(
            "Generated %d dashboard charts using model %s",
            len(valid_charts),
            model_used,
        )
        return valid_charts

    except RuntimeError as exc:
        logger.error("Configuration error: %s", exc)
        return []
    except ValueError as exc:
        logger.error("Response parsing error: %s", exc)
        return []
    except Exception as exc:
        logger.exception("Auto-dashboard generation failed: %s", exc)
        if quota_manager.is_quota_error(exc):
            logger.info("Auto-dashboard generation failed due to quota exhaustion")
        return []
