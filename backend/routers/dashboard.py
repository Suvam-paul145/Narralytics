import asyncio
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from analytics.aggregation_engine import normalize_chart_result
from analytics.dataset_profile import build_profile_dashboard_specs
from analytics.deterministic_engine import build_dashboard_fallback_specs, summarize_chart_data
from auth.dependencies import get_current_user
from database.datasets import get_dataset, touch_dataset
from database.history import save_interaction
from llm.auto_dashboard import generate_auto_dashboard
from models.schemas import DashboardAutoRequest
from sqlite.executor import execute_query

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _merge_dashboard_specs(
    llm_specs: list[dict[str, Any]],
    profile_specs: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    merged: list[dict[str, Any]] = []
    seen_sql: set[str] = set()

    for spec in [*profile_specs, *llm_specs]:
        sql = str(spec.get("sql") or "")
        if not sql or sql in seen_sql:
            continue
        seen_sql.add(sql)
        merged.append(spec)

    return merged[:10]


def _select_dashboard_results(
    results: list[dict[str, Any]],
    requirements: str | None,
    maximum: int = 6,
) -> list[dict[str, Any]]:
    requirement_text = str(requirements or "").lower()

    def score(result: dict[str, Any]) -> tuple[int, int, int]:
        chart_title = str(result.get("title", "")).lower()
        category = str(result.get("category", "")).lower()
        data_length = len(result.get("data", []) or [])
        base = 0 if result.get("error") else 100
        if data_length:
            base += 20
        if requirement_text and any(token in chart_title or token in category for token in requirement_text.split()):
            base += 15
        return (base, data_length, 1 if result.get("chart_type") == "line" else 0)

    ordered = sorted(results, key=score, reverse=True)
    deduped: list[dict[str, Any]] = []
    seen_titles: set[str] = set()
    for result in ordered:
        title = str(result.get("title") or "")
        if title in seen_titles:
            continue
        seen_titles.add(title)
        deduped.append(result)
        if len(deduped) >= maximum:
            break

    return deduped


def _execute_chart_sync(spec, dataset, schema):
    """Execute a single chart spec synchronously (for use with asyncio.to_thread)."""
    try:
        raw_data = execute_query(dataset["db_path"], spec["sql"])
        normalized_spec, data = normalize_chart_result(spec=spec, rows=raw_data, schema=schema)
        insight = normalized_spec.get("insight")
        if data:
            insight = summarize_chart_data(
                question=normalized_spec.get("title", "dashboard chart"),
                chart_title=normalized_spec.get("title", "Dashboard Chart"),
                chart_type=normalized_spec.get("chart_type", "bar"),
                data=data,
                x_key=normalized_spec.get("x_key", "x"),
                y_key=normalized_spec.get("y_key", "y"),
            )
        return {
            "chart_id": normalized_spec.get("chart_id"),
            "title": normalized_spec["title"],
            "chart_type": normalized_spec["chart_type"],
            "x_key": normalized_spec["x_key"],
            "y_key": normalized_spec["y_key"],
            "color_by": normalized_spec.get("color_by"),
            "insight": insight,
            "category": normalized_spec.get("category"),
            "sql": normalized_spec["sql"],
            "data": data,
            "error": None,
        }
    except Exception as exc:
        return {
            "chart_id": spec.get("chart_id"),
            "title": spec.get("title", "Chart"),
            "chart_type": spec.get("chart_type"),
            "data": [],
            "error": str(exc),
        }


@router.post("/auto/{dataset_id}")
async def auto_generate_dashboard(
    dataset_id: str,
    payload: DashboardAutoRequest | None = None,
    user: dict = Depends(get_current_user),
):
    dataset = await get_dataset(dataset_id, user["sub"])
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found or access denied")

    schema = {
        "row_count": dataset["row_count"],
        "columns": dataset["columns"],
        "date_columns": dataset["date_columns"],
        "numeric_columns": dataset["numeric_columns"],
        "categorical_columns": dataset["categorical_columns"],
    }
    requirements = payload.requirements if payload else None
    chart_specs = generate_auto_dashboard(
        schema,
        requirements=requirements,
    )
    profile_specs = build_profile_dashboard_specs(schema, dataset.get("profile"), requirements)
    if not chart_specs and not profile_specs:
        profile_specs = build_dashboard_fallback_specs(schema)
    chart_specs = _merge_dashboard_specs(chart_specs, profile_specs)

    # Execute all chart SQL queries in parallel instead of sequentially
    results = await asyncio.gather(
        *[asyncio.to_thread(_execute_chart_sync, spec, dataset, schema) for spec in chart_specs]
    )
    results = _select_dashboard_results(list(results), requirements)

    await touch_dataset(dataset_id)
    await save_interaction(
        user["sub"],
        "auto_gen",
        {
            "dataset_id": dataset_id,
            "charts_generated": len(results),
            "successful": sum(1 for result in results if not result["error"]),
        },
        dataset_id=dataset_id,
    )

    return {"dataset_id": dataset_id, "chart_count": len(results), "charts": results}
