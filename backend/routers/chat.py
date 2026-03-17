from fastapi import APIRouter, Depends, HTTPException

from analytics.aggregation_engine import normalize_chart_result
from auth.dependencies import get_current_user
from database.datasets import get_dataset, touch_dataset
from database.history import get_history, save_interaction
from llm.chat_engine import get_chat_response, refine_chat_answer
from llm.decision_engine import get_decision_plan
from llm.forecast_engine import generate_simple_forecast
from models.schemas import ChatRequest, ChatResponse, ChartResult, ChartSpec
from sqlite.executor import execute_query

router = APIRouter(tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def business_chat(request: ChatRequest, user: dict = Depends(get_current_user)):
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
    chat_result = get_chat_response(schema, dataset["original_filename"], request.message, history)

    if chat_result.get("cannot_answer"):
        await save_interaction(
            user["sub"],
            "chat",
            {
                "dataset_id": request.dataset_id,
                "prompt": request.message,
                "response_summary": "cannot_answer",
                "was_forecast": False,
                "reason": chat_result.get("reason"),
            },
            dataset_id=request.dataset_id,
            session_id=request.session_id,
        )
        return ChatResponse(
            answer=f"I do not have enough data to answer that question. {chat_result.get('reason', '')}".strip(),
            cannot_answer=True,
        )

    answer = chat_result.get("answer", "")
    supporting_sql = chat_result.get("supporting_sql")
    data_used = []
    charts: list[ChartResult] = []

    if supporting_sql and chat_result.get("needs_data"):
        try:
            data_used = execute_query(dataset["db_path"], supporting_sql)
            if data_used:
                answer = refine_chat_answer(
                    dataset["original_filename"],
                    request.message,
                    answer,
                    data_used,
                )

                decision = get_decision_plan(
                    message=request.message,
                    schema=schema,
                    rows=data_used,
                    supporting_sql=supporting_sql,
                )
                raw_spec = {
                    "label": "Chat Option",
                    "approach": decision.get("reasoning"),
                    "sql": supporting_sql,
                    "chart_type": decision.get("chart_type", "bar"),
                    "x_key": decision.get("x_key"),
                    "y_key": decision.get("y_key"),
                    "color_by": decision.get("color_by"),
                    "title": decision.get("title", "Analysis Result"),
                    "insight": answer,
                    "aggregation": decision.get("aggregation", "sum"),
                }

                if raw_spec.get("x_key") and raw_spec.get("y_key"):
                    normalized_spec_payload, chart_data = normalize_chart_result(
                        spec=raw_spec,
                        rows=data_used,
                        schema=schema,
                    )
                    chart_spec = ChartSpec(**normalized_spec_payload)
                    charts.append(
                        ChartResult(spec=chart_spec, data=chart_data, raw_sql=supporting_sql)
                    )
        except Exception as exc:
            print(f"Chat SQL execution failed: {exc}")

    forecast = None
    is_forecast = False
    disclaimer = None
    if chat_result.get("needs_forecast") and supporting_sql:
        forecast = generate_simple_forecast(dataset["db_path"], supporting_sql, periods=3)
        is_forecast = bool(forecast.get("success"))
        disclaimer = "Statistical estimate based on historical trend only."

    await touch_dataset(request.dataset_id)
    await save_interaction(
        user["sub"],
        "chat",
        {
            "dataset_id": request.dataset_id,
            "prompt": request.message,
            "response_summary": answer[:400],
            "sql_generated": supporting_sql,
            "output_count": 0,
            "was_forecast": is_forecast,
        },
        dataset_id=request.dataset_id,
        session_id=request.session_id,
    )

    return ChatResponse(
        answer=answer,
        supporting_sql=supporting_sql,
        data_used=data_used[:10],
        charts=charts,
        forecast=forecast,
        is_forecast=is_forecast,
        disclaimer=disclaimer,
    )


@router.get("/history/{dataset_id}")
async def fetch_history(dataset_id: str, user: dict = Depends(get_current_user)):
    dataset = await get_dataset(dataset_id, user["sub"])
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    history_items = await get_history(user["sub"], dataset_id=dataset_id)
    return {"history": history_items}
