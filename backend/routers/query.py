import time

from fastapi import APIRouter, Depends, HTTPException

from auth.dependencies import get_current_user
from database.datasets import get_dataset, touch_dataset
from database.history import save_interaction
from llm.chart_engine import generate_data_driven_insight
from llm.prompt_enhancer import enhance_prompt
from llm.query_generator import generate_query_spec
from models.schemas import ChartResult, ChartSpec, QueryRequest, QueryResponse
from sqlite.executor import execute_query

router = APIRouter(tags=["query"])


def _execute_options_with_retry(
    raw_options: list[dict],
    db_path: str,
    prompt: str,
    schema: dict,
    history: list[dict],
    output_count: int,
    max_retries: int = 2,
) -> list[ChartResult]:
    """
    Execute all SQL options. On any failure, re-prompt the LLM with the error
    message (self-healing loop). Max 2 retries per option set.
    """
    retries: int = 0
    current_options = raw_options

    while retries <= max_retries:
        results: list[ChartResult] = []
        error_msgs: list[str] = []

        for raw_option in current_options:
            spec = ChartSpec(**raw_option)
            try:
                data = execute_query(db_path, spec.sql)

                # Stage 5: data-driven insight (after data fetched, no hallucination)
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

        has_errors = bool(error_msgs)

        if not has_errors or retries >= max_retries:
            return results

        # Self-healing: tell LLM about the exact errors and ask it to fix
        retries += 1
        all_columns = [col["name"] for col in schema["columns"]]
        error_text = "\n".join(error_msgs)
        retry_prompt = (
            f"The query '{prompt}' produced SQL errors:\n{error_text}\n\n"
            f"Valid columns are: {', '.join(all_columns)}\n"
            f"Fix the SQL. Return only corrected JSON."
        )

        retry_llm = generate_query_spec(
            enhanced_prompt=retry_prompt,
            schema=schema,
            output_count=output_count,
            history=history + [  # type: ignore
                {"role": "user", "content": prompt},
                {"role": "model", "content": "Encountered SQL errors. Retrying."},
            ],
        )

        if retry_llm.get("cannot_answer"):
            # LLM gave up; return what we have (with errors)
            return results

        current_options = retry_llm.get("options", current_options)

    return results


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

    # ── Stage 2a: Prompt Enhancement ──────────────────────────────────────────
    enhanced = enhance_prompt(request.prompt, schema, history)

    # Catch CANNOT_ANSWER from the prompt enhancer
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

    # ── Stage 2b: SQL + Chart Spec Generation ─────────────────────────────────
    llm_result = generate_query_spec(
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

    # ── Stage 3: Execute with Self-Healing Fallback ───────────────────────────
    options = _execute_options_with_retry(
        raw_options=llm_result.get("options", []),
        db_path=dataset["db_path"],
        prompt=request.prompt,
        schema=schema,
        history=history,
        output_count=request.output_count,
    )

    if not options or all(o.error for o in options):
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
            "response_summary": " | ".join(o.spec.title for o in options),
            "chart_types": " / ".join(o.spec.chart_type for o in options),
            "sql_generated": "\n\n".join(o.raw_sql or "" for o in options),
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
