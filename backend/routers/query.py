import time
from typing import Any, TypedDict

from fastapi import APIRouter, Depends, HTTPException

from analytics.aggregation_engine import normalize_chart_result
from auth.dependencies import get_current_user
from database.datasets import get_dataset, touch_dataset
from database.history import save_interaction
from llm.chart_engine import generate_data_driven_insight
from llm.prompt_enhancer import enhance_prompt
from llm.query_generator import generate_query_spec
from models.schemas import ChartResult, ChartSpec, QueryRequest, QueryResponse
from sqlite.executor import execute_query

router = APIRouter(tags=["query"])


class QueryHistoryTurn(TypedDict):
    role: str
    content: str


class DatasetSchema(TypedDict):
    row_count: int
    columns: list[dict[str, Any]]
    date_columns: list[str]
    numeric_columns: list[str]
    categorical_columns: list[str]


class QuerySpecPayload(TypedDict, total=False):
    cannot_answer: bool
    reason: str
    options: list[dict[str, Any]]


def _execute_options_with_retry(
    raw_options: list[dict[str, Any]],
    db_path: str,
    prompt: str,
    schema: DatasetSchema,
    history: list[QueryHistoryTurn],
    output_count: int,
    max_retries: int = 2,
) -> list[ChartResult]:
    """
    Execute all SQL options. On any failure, re-prompt the LLM with the error
    message (self-healing loop). Max 2 retries per option set.
    """
    retries = 0
    current_options = raw_options

    while retries <= max_retries:
        results: list[ChartResult] = []
        error_msgs: list[str] = []

        for raw_option in current_options:
            spec = ChartSpec(**raw_option)
            try:
                raw_data = execute_query(db_path, spec.sql)
                normalized_spec_payload, data = normalize_chart_result(
                    spec=spec.model_dump(),
                    rows=raw_data,
                    schema=schema,
                )
                spec = ChartSpec(**normalized_spec_payload)

                # Stage 5: data-driven insight after data fetch, with no hallucination.
                if data:
                    spec.insight = generate_data_driven_insight(
                        prompt, spec.title, spec.chart_type, data
                    )

                results.append(ChartResult(spec=spec, data=data, raw_sql=spec.sql))
            except Exception as exc:
                error_msgs.append(
                    f"Chart '{spec.title}' SQL failed: {exc}. "
                    f"Tried SQL: {spec.sql}"
                )
                results.append(
                    ChartResult(spec=spec, data=[], raw_sql=spec.sql, error=str(exc))
                )

        if not error_msgs or retries >= max_retries:
            return results

        retries = retries + 1
        all_columns = [str(col["name"]) for col in schema["columns"]]
        error_text = "\n".join(error_msgs)
        retry_prompt = (
            f"The query '{prompt}' produced SQL errors:\n{error_text}\n\n"
            f"Valid columns are: {', '.join(all_columns)}\n"
            f"Fix the SQL. Return only corrected JSON."
        )
        retry_history: list[QueryHistoryTurn] = [
            *history,
            {"role": "user", "content": prompt},
            {"role": "model", "content": "Encountered SQL errors. Retrying."},
        ]

        retry_llm: QuerySpecPayload = generate_query_spec(
            enhanced_prompt=retry_prompt,
            schema=schema,
            output_count=output_count,
            history=retry_history,
        )

        if retry_llm.get("cannot_answer"):
            return results

        if "options" in retry_llm:
            current_options = retry_llm["options"]

    return results


@router.post("/query", response_model=QueryResponse)
async def chart_query(request: QueryRequest, user: dict = Depends(get_current_user)):
    dataset = await get_dataset(request.dataset_id, user["sub"])
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    schema: DatasetSchema = {
        "row_count": dataset["row_count"],
        "columns": dataset["columns"],
        "date_columns": dataset["date_columns"],
        "numeric_columns": dataset["numeric_columns"],
        "categorical_columns": dataset["categorical_columns"],
    }
    history: list[QueryHistoryTurn] = [
        {"role": turn.role, "content": turn.content} for turn in request.history
    ]
    started_at = time.perf_counter()

    enhanced = enhance_prompt(request.prompt, schema, history)

    if enhanced.startswith("[CANNOT_ANSWER]"):
        reason = enhanced.replace("[CANNOT_ANSWER]", "").strip()
        await save_interaction(
            user["sub"],
            "chart_query",
            {
                "dataset_id": request.dataset_id,
                "prompt": request.prompt,
                "response_summary": "cannot_answer (prompt enhancer)",
                "output_count": request.output_count,
                "was_forecast": False,
                "reason": reason,
            },
            dataset_id=request.dataset_id,
            session_id=request.session_id,
        )
        return QueryResponse(
            cannot_answer=True,
            reason=reason,
            dataset_id=request.dataset_id,
            output_count=request.output_count,
        )

    llm_result: QuerySpecPayload = generate_query_spec(
        enhanced_prompt=enhanced,
        schema=schema,
        output_count=request.output_count,
        history=history,
    )

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

    raw_options = llm_result["options"] if "options" in llm_result else []
    options = _execute_options_with_retry(
        raw_options=raw_options,
        db_path=dataset["db_path"],
        prompt=request.prompt,
        schema=schema,
        history=history,
        output_count=request.output_count,
    )

    if not options or all(option.error for option in options):
        return QueryResponse(
            cannot_answer=True,
            reason="The AI could not generate a valid chart for your query. Please try rephrasing or upload a different dataset.",
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
            "enhanced_prompt": enhanced,
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
