import time

from fastapi import APIRouter, Depends, HTTPException

from auth.dependencies import get_current_user
from database.datasets import get_dataset, touch_dataset
from database.history import save_interaction
from llm.chart_engine import get_chart_specs
from models.schemas import ChartResult, ChartSpec, QueryRequest, QueryResponse
from sqlite.executor import execute_query

router = APIRouter(tags=["query"])


@router.post("/query", response_model=QueryResponse)
async def chart_query(request: QueryRequest, user: dict = Depends(get_current_user)):
    dataset = await get_dataset(request.dataset_id, user["sub"])
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    schema = {
        "row_count": dataset["row_count"],
        "columns": dataset["columns"],
        "date_columns": dataset["date_columns"],
        "numeric_columns": dataset["numeric_columns"],
        "categorical_columns": dataset["categorical_columns"],
    }
    history = [turn.model_dump() for turn in request.history]
    started_at = time.perf_counter()
    llm_result = get_chart_specs(schema, request.prompt, history, request.output_count)

    if llm_result.get("cannot_answer"):
        await save_interaction(
            user["sub"],
            "chart_query",
            {
                "dataset_id": request.dataset_id,
                "prompt": request.prompt,
                "response_summary": "cannot_answer",
                "output_count": request.output_count,
                "was_forecast": False,
                "reason": llm_result.get("reason"),
            },
            dataset_id=request.dataset_id,
            session_id=request.session_id,
        )
        return QueryResponse(
            cannot_answer=True,
            reason=llm_result.get("reason"),
            dataset_id=request.dataset_id,
            output_count=request.output_count,
        )

    options = []
    for raw_option in llm_result.get("options", []):
        spec = ChartSpec(**raw_option)
        try:
            data = execute_query(dataset["db_path"], spec.sql)
            options.append(ChartResult(spec=spec, data=data, raw_sql=spec.sql))
        except Exception as exc:
            options.append(ChartResult(spec=spec, data=[], raw_sql=spec.sql, error=str(exc)))

    if not options:
        return QueryResponse(
            cannot_answer=True,
            reason="The chart engine did not return a usable visualization.",
            dataset_id=request.dataset_id,
            output_count=request.output_count,
        )

    elapsed_ms = int((time.perf_counter() - started_at) * 1000)
    await touch_dataset(request.dataset_id)
    await save_interaction(
        user["sub"],
        "chart_query",
        {
            "dataset_id": request.dataset_id,
            "prompt": request.prompt,
            "response_summary": " | ".join(option.spec.title for option in options),
            "chart_types": " / ".join(option.spec.chart_type for option in options),
            "sql_generated": "\n\n".join(option.raw_sql or "" for option in options),
            "output_count": request.output_count,
            "was_forecast": False,
            "execution_ms": elapsed_ms,
        },
        dataset_id=request.dataset_id,
        session_id=request.session_id,
    )

    return QueryResponse(
        cannot_answer=False,
        dataset_id=request.dataset_id,
        output_count=request.output_count,
        options=options,
    )
