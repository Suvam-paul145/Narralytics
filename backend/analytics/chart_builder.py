import json
import logging
from typing import Any, Dict

from sqlite.loader import generate_column_code

logger = logging.getLogger(__name__)


def _quote_sql_literal(value: Any) -> str:
    """Render a Python value as a safe SQLite literal."""
    if value is None:
        return "NULL"

    if isinstance(value, bool):
        return "1" if value else "0"

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)

    text = str(value).replace("'", "''")
    return f"'{text}'"


def _clamp_limit(value: Any, default: int = 10, minimum: int = 1, maximum: int = 50) -> int:
    try:
        limit = int(value)
    except (TypeError, ValueError):
        return default

    return max(minimum, min(limit, maximum))


def _is_safe_select_sql(sql: str) -> bool:
    normalized = (sql or "").strip().rstrip(";")
    lowered = normalized.lower()

    if not lowered.startswith("select"):
        return False
    if ";" in normalized:
        return False
    if " from data" not in lowered:
        return False

    return True

def _normalize_identifier(value: str | None, schema: Dict[str, Any]) -> str | None:
    """Map a raw column label from the LLM to the normalized SQLite column code.

    The SQLite loader normalizes column labels using ``generate_column_code``. When
    the LLM returns friendly names, we need to translate them back to the stored
    codes so SQL doesn't fail with "no such column" or token errors.
    """

    if not value:
        return None

    normalized_value = generate_column_code(str(value)).lower()
    for col in schema.get("columns", []):
        code = str(col.get("code") or col.get("name") or "").strip()
        if not code:
            continue

        # Compare against both raw code and normalized form.
        if normalized_value == generate_column_code(code).lower():
            return col.get("code") or code

        name = str(col.get("name") or "").strip()
        if name and normalized_value == generate_column_code(name).lower():
            return col.get("code") or name

    # Fallback to sanitized value so at least it is a safe identifier.
    return normalized_value or value

def generate_sql_from_structured_json(json_spec: dict, schema: dict) -> str:
    """Generate SQL from structured JSON, normalizing identifiers to SQLite codes."""
    x_axis = _normalize_identifier(json_spec.get("xAxis"), schema)
    y_axis = _normalize_identifier(json_spec.get("yAxis"), schema)
    agg = str(json_spec.get("aggregation", "sum")).upper()
    group_by = _normalize_identifier(json_spec.get("groupBy"), schema)
    filters = json_spec.get("filters", {})
    chart_type = str(json_spec.get("chartType") or json_spec.get("chart_type") or "bar").lower()
    sort_direction = str(json_spec.get("sort", "desc")).lower()
    limit = _clamp_limit(json_spec.get("limit", 10))

    # Reject invalid specs instead of injecting hardcoded visuals.
    if not x_axis or not y_axis:
        raise ValueError("Missing required x/y axis for SQL generation")

    if agg not in ["SUM", "COUNT", "AVG", "MIN", "MAX"]:
        agg = "SUM"

    aggregate_expr = f'{agg}("{y_axis}")'
    if agg != "COUNT":
        aggregate_expr = f"ROUND({aggregate_expr}, 2)"

    select_clause = f'"{x_axis}", {aggregate_expr} AS "{y_axis}"'
    group_clause = f'GROUP BY "{x_axis}"'
    
    if group_by and group_by != x_axis:
        select_clause = f'"{x_axis}", "{group_by}", {aggregate_expr} AS "{y_axis}"'
        group_clause = f'GROUP BY "{x_axis}", "{group_by}"'

    if not isinstance(filters, dict):
        filters = {}

    where_clauses = []
    for k, v in filters.items():
        safe_key = _normalize_identifier(k, schema) or generate_column_code(str(k))
        where_clauses.append(f'"{safe_key}" = {_quote_sql_literal(v)}')
    
    where_str = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
    order_clause = f'ORDER BY "{y_axis}" {"ASC" if sort_direction == "asc" else "DESC"}'
    limit_clause = f"LIMIT {limit}"
    
    # Pie charts MUST include LIMIT 6
    if chart_type == "pie":
        limit_clause = "LIMIT 6"

    sql = f"SELECT {select_clause} FROM data {where_str} {group_clause} {order_clause} {limit_clause}"
    return sql

def convert_llm_json_to_chart_spec(options: list[dict], schema: dict) -> list[dict]:
    """Take MANDATORY JSON list, validate, build SQL, output ChartSpec formatted dicts."""
    try:
        results = []
        for opt in options:
            chart_type = opt.get("chartType") or opt.get("chart_type") or "bar"
            x_axis = _normalize_identifier(opt.get("xAxis") or opt.get("x_key"), schema)
            y_axis = _normalize_identifier(opt.get("yAxis") or opt.get("y_key"), schema)
            group_by = _normalize_identifier(
                opt.get("groupBy") or opt.get("group_by") or opt.get("color_by"),
                schema,
            )
            
            # Skip invalid options; do not inject hardcoded fallback visuals.
            if not x_axis or not y_axis:
                logger.warning("Skipping option with unresolved axes: %s", json.dumps(opt))
                continue

            try:
                # Prefer deterministic SQL whenever the LLM gave us a structured spec.
                sql = generate_sql_from_structured_json(opt, schema)
            except ValueError:
                raw_sql = str(opt.get("sql") or "").strip()
                if not _is_safe_select_sql(raw_sql):
                    logger.warning("Skipping option with unsafe SQL: %s", json.dumps(opt))
                    continue
                sql = raw_sql

            # ECharts compatible mapping + trick for dynamic distinct colors
            # The frontend assigns different colors based on `color_by` 
            color_by = group_by if group_by else x_axis
            
            # Map back to standard ChartSpec needed by frontend/routers
            results.append({
                "chart_type": chart_type,
                "x_key": x_axis,
                "y_key": y_axis,
                "color_by": color_by,
                "sql": sql,
                "title": opt.get("title", f"{y_axis} by {x_axis}"),
                "insight": opt.get("insight", "")
            })
        return results
    except Exception as e:
        logger.error(f"Failed to parse LLM chart JSON: {e}")
        return []
