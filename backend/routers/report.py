from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from auth.dependencies import get_current_user
from database.datasets import get_dataset
from database.history import save_interaction
from llm.report_engine import generate_report_summary
from llm.chart_renderer import render_chart_to_base64
from pdf.generator import build_pdf_report

router = APIRouter(prefix="/report", tags=["report"])


class ChartForReport(BaseModel):
    title: str
    insight: str | None = None
    chart_type: str
    image_base64: str | None = None
    # New fields for server-side rendering
    spec: dict[str, Any] | None = None
    data: list[dict[str, Any]] | None = None


class ReportRequest(BaseModel):
    dataset_id: str
    charts: list[ChartForReport]
    include_stats: bool = True


@router.post("/generate")
async def generate_report(req: ReportRequest, user: dict = Depends(get_current_user)):
    dataset = await get_dataset(req.dataset_id, user["sub"])
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Process charts - render images if not provided
    processed_charts = []
    for chart in req.charts:
        chart_dict = chart.model_dump()
        
        # Generate image if missing but we have data and spec
        if not chart_dict.get("image_base64") and chart.data and chart.spec:
            try:
                image_base64 = render_chart_to_base64(chart.spec, chart.data)
                if image_base64:
                    chart_dict["image_base64"] = image_base64
            except Exception as e:
                print(f"⚠️ Failed to render chart image: {e}")
        
        processed_charts.append(chart_dict)

    summary = generate_report_summary(
        dataset_name=dataset["original_filename"],
        charts=processed_charts,
    )

    stats = None
    if req.include_stats:
        stats = {
            "Dataset": dataset["original_filename"],
            "Total Rows": f"{dataset['row_count']:,}",
            "Total Columns": dataset["column_count"],
            "Numeric Columns": len(dataset["numeric_columns"]),
            "Date Columns": len(dataset["date_columns"]),
            "Categorical Columns": len(dataset["categorical_columns"]),
            "Charts in Report": len(processed_charts),
            "Report Generated": datetime.now().strftime("%Y-%m-%d %H:%M"),
        }

    pdf_bytes = build_pdf_report(
        dataset_name=dataset["original_filename"],
        executive_summary=summary,
        charts=processed_charts,
        stats=stats,
    )

    await save_interaction(
        user["sub"],
        "pdf",
        {
            "dataset_id": req.dataset_id,
            "response_summary": f"Generated report with {len(processed_charts)} charts",
            "output_count": len(processed_charts),
            "was_forecast": False,
        },
        dataset_id=req.dataset_id,
    )

    filename = (
        f"narralytics_report_"
        f"{dataset['original_filename'].replace('.csv', '').replace(' ', '_')}.pdf"
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
