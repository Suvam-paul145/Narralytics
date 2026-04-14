import time
from typing import Any, TypedDict

from fastapi import APIRouter, Depends, HTTPException

from analytics.aggregation_engine import normalize_chart_result
from analytics.chart_builder import convert_llm_json_to_chart_spec
from analytics.deterministic_engine import plan_rule_based_query, summarize_chart_data
from auth.dependencies import get_current_user
from database.datasets import get_dataset, touch_dataset
from database.history import save_interaction
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


def _execute_chart_specs(
    chart_specs: list[dict[str, Any]],
    db_path: str,
    prompt: str,
    schema: DatasetSchema,
) -> list[ChartResult]:
    results: list[ChartResult] = []

    for spec_dict in chart_specs:
        spec = ChartSpec(**spec_dict)
        try:
            import logging

            logging.info("[query_router] Executing SQL: %s", spec.sql)
            raw_data = execute_query(db_path, spec.sql)
            logging.info("[query_router] Processed dataset shape: %s rows", len(raw_data))

            normalized_spec_payload, data = normalize_chart_result(
                spec=spec.model_dump(),
                rows=raw_data,
                schema=schema,
            )
            spec = ChartSpec(**normalized_spec_payload)

            if data:
                spec.insight = summarize_chart_data(
                    question=prompt,
                    chart_title=spec.title,
                    chart_type=spec.chart_type,
                    data=data,
                    x_key=spec.x_key,
                    y_key=spec.y_key,
                )

            results.append(ChartResult(spec=spec, data=data, raw_sql=spec.sql))
        except Exception as exc:
            results.append(
                ChartResult(spec=spec, data=[], raw_sql=spec.sql, error=str(exc))
            )

    return results


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
    results: list[ChartResult] = []

    while retries <= max_retries:
        results = []
        error_msgs: list[str] = []
        
        # Convert LLM MANDATORY JSON into standard ChartSpec formatted dicts
        chart_spec_dicts = convert_llm_json_to_chart_spec(current_options, schema)
        results = _execute_chart_specs(chart_spec_dicts, db_path, prompt, schema)

        for result in results:
            if result.error:
                error_msgs.append(
                    f"Chart '{result.spec.title}' SQL failed: {result.error}. "
                    f"Tried SQL: {result.spec.sql}"
                )

        if not error_msgs or retries >= max_retries:
            return results

        retries = retries + 1
        all_columns = [str(col["name"]) for col in schema["columns"]]
        error_text = "\n".join(error_msgs)
        retry_prompt = (
            f"The query '{prompt}' produced errors with your mapped logic:\n{error_text}\n\n"
            f"Valid columns are: {', '.join(all_columns)}\n"
            f"Fix the JSON structure. ONLY return the MANDATORY JSON array."
        )
        retry_history: list[dict[str, str]] = [
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
    import logging
    logging.info(f"[chart_query] Raw User Prompt: {request.prompt}")
    dataset = await get_dataset(request.dataset_id, user["sub"])
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    schema: dict[str, Any] = {
        "row_count": dataset["row_count"],
        "columns": dataset["columns"],
        "date_columns": dataset["date_columns"],
        "numeric_columns": dataset["numeric_columns"],
        "categorical_columns": dataset["categorical_columns"],
        # Normalized codes used by SQLite table
        "column_codes": dataset.get("column_codes", []),
        "date_column_codes": dataset.get("date_column_codes", dataset.get("date_columns", [])),
        "numeric_column_codes": dataset.get("numeric_column_codes", dataset.get("numeric_columns", [])),
        "categorical_column_codes": dataset.get("categorical_column_codes", dataset.get("categorical_columns", [])),
    }
    history: list[dict[str, str]] = [
        {"role": turn.role, "content": turn.content} for turn in request.history
    ]
    started_at = time.perf_counter()

    deterministic_plan = plan_rule_based_query(request.prompt, schema)

    if deterministic_plan.get("invalid"):
        reason = deterministic_plan.get("reason") or "The query is not relevant to the uploaded dataset."
        await save_interaction(
            user["sub"],
            "chart_query",
            {
                "dataset_id": request.dataset_id,
                "prompt": request.prompt,
                "response_summary": "cannot_answer (deterministic validator)",
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

    if deterministic_plan.get("matched"):
        options = _execute_chart_specs(
            chart_specs=deterministic_plan.get("specs", []),
            db_path=dataset["db_path"],
            prompt=request.prompt,
            schema=schema,
        )

        if not options or all(option.error for option in options):
            return QueryResponse(
                cannot_answer=True,
                reason="The query matched the dataset, but the chart could not be executed safely.",
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
                "planner": "deterministic",
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
        # We do not hallucinate fake fallback charts anymore. We rely entirely on dynamic Groq output.
        pass

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
