from fastapi import APIRouter, Depends, HTTPException

from analytics.aggregation_engine import normalize_chart_result
from auth.dependencies import get_current_user
from database.datasets import get_dataset, touch_dataset
from database.history import save_interaction
from llm.auto_dashboard import generate_auto_dashboard
from sqlite.executor import execute_query

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.post("/auto/{dataset_id}")
async def auto_generate_dashboard(dataset_id: str, user: dict = Depends(get_current_user)):
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
    chart_specs = generate_auto_dashboard(schema)

    results = []
    for spec in chart_specs:
        try:
            raw_data = execute_query(dataset["db_path"], spec["sql"])
            normalized_spec, data = normalize_chart_result(spec=spec, rows=raw_data, schema=schema)
            results.append(
                {
                    "chart_id": normalized_spec.get("chart_id"),
                    "title": normalized_spec["title"],
                    "chart_type": normalized_spec["chart_type"],
                    "x_key": normalized_spec["x_key"],
                    "y_key": normalized_spec["y_key"],
                    "color_by": normalized_spec.get("color_by"),
                    "insight": normalized_spec.get("insight"),
                    "category": normalized_spec.get("category"),
                    "sql": normalized_spec["sql"],
                    "data": data,
                    "error": None,
                }
            )
        except Exception as exc:
            results.append(
                {
                    "chart_id": spec.get("chart_id"),
                    "title": spec.get("title", "Chart"),
                    "chart_type": spec.get("chart_type"),
                    "data": [],
                    "error": str(exc),
                }
            )

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
