import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

def build_fallback_chart(schema: dict) -> dict:
    """Fallback if LLM JSON fails to parse or is radically invalid."""
    x_axis = "unknown"
    y_axis = "unknown"
    if schema.get("categorical_columns"):
        x_axis = schema["categorical_columns"][0]
    elif schema.get("columns"):
        x_axis = schema["columns"][0]["name"]

    if schema.get("numeric_columns"):
        y_axis = schema["numeric_columns"][0]
    elif len(schema.get("columns", [])) > 1:
        y_axis = schema["columns"][1]["name"]

    return {
        "chartType": "bar",
        "xAxis": x_axis,
        "yAxis": y_axis,
        "aggregation": "sum",
        "groupBy": None,
        "filters": {},
        "limit": 10
    }

def generate_sql_from_structured_json(json_spec: dict, schema: dict) -> str:
    """Generate SQL from structured JSON."""
    x_axis = json_spec.get("xAxis")
    y_axis = json_spec.get("yAxis")
    agg = json_spec.get("aggregation", "sum").upper()
    group_by = json_spec.get("groupBy")
    filters = json_spec.get("filters", {})
    limit = json_spec.get("limit", 10)

    # Basic safety fallbacks
    if not x_axis or not y_axis:
        fb = build_fallback_chart(schema)
        x_axis = fb["xAxis"]
        y_axis = fb["yAxis"]

    if agg not in ["SUM", "COUNT", "AVG", "MIN", "MAX"]:
        agg = "SUM"

    select_clause = f'"{x_axis}", ROUND({agg}("{y_axis}"), 2) AS "{y_axis}"'
    group_clause = f'GROUP BY "{x_axis}"'
    
    if group_by and group_by != x_axis:
        select_clause = f'"{x_axis}", "{group_by}", ROUND({agg}("{y_axis}"), 2) AS "{y_axis}"'
        group_clause = f'GROUP BY "{x_axis}", "{group_by}"'

    where_clauses = []
    for k, v in filters.items():
        if isinstance(v, str):
            where_clauses.append(f'"{k}" = \'{v}\'')
        else:
            where_clauses.append(f'"{k}" = {v}')
    
    where_str = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
    order_clause = f'ORDER BY "{y_axis}" DESC'
    limit_clause = f"LIMIT {int(limit)}" if limit else "LIMIT 10"
    
    # Pie charts MUST include LIMIT 6
    if json_spec.get("chartType") == "pie":
        limit_clause = "LIMIT 6"

    sql = f"SELECT {select_clause} FROM data {where_str} {group_clause} {order_clause} {limit_clause}"
    return sql

def convert_llm_json_to_chart_spec(options: list[dict], schema: dict) -> list[dict]:
    """Take MANDATORY JSON list, validate, build SQL, output ChartSpec formatted dicts."""
    try:
        results = []
        for opt in options:
            chart_type = opt.get("chartType") or opt.get("chart_type") or "bar"
            x_axis = opt.get("xAxis") or opt.get("x_key")
            y_axis = opt.get("yAxis") or opt.get("y_key")
            group_by = opt.get("groupBy") or opt.get("group_by") or opt.get("color_by")
            
            # If invalid output, trigger fallback
            if not x_axis or not y_axis:
                opt = build_fallback_chart(schema)
                chart_type = opt["chartType"]
                x_axis = opt["xAxis"]
                y_axis = opt["yAxis"]

            sql = opt.get("sql") or generate_sql_from_structured_json(opt, schema)

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
        logger.error(f"Fallback triggered due to error parsing LLM json: {e}")
        fb = build_fallback_chart(schema)
        sql = generate_sql_from_structured_json(fb, schema)
        return [{
            "chart_type": fb["chartType"],
            "x_key": fb["xAxis"],
            "y_key": fb["yAxis"],
            "color_by": fb["xAxis"], # force distinct colors
            "sql": sql,
            "title": "Fallback Dashboard",
            "insight": "Could not parse query, showing default metrics."
        }]
