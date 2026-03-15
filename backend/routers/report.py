from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from auth.dependencies import get_current_user
from database.datasets import get_dataset
from database.history import save_interaction
from llm.report_engine import generate_report_summary
from pdf.generator import build_pdf_report

router = APIRouter(prefix="/report", tags=["report"])


class ChartForReport(BaseModel):
    title: str
    insight: str | None = None
    chart_type: str
    image_base64: str | None = None


class ReportRequest(BaseModel):
    dataset_id: str
    charts: list[ChartForReport]
    include_stats: bool = True


@router.post("/generate")
async def generate_report(req: ReportRequest, user: dict = Depends(get_current_user)):
    dataset = await get_dataset(req.dataset_id, user["sub"])
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    summary = generate_report_summary(
        dataset_name=dataset["original_filename"],
        charts=[chart.model_dump() for chart in req.charts],
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
            "Charts in Report": len(req.charts),
            "Report Generated": datetime.now().strftime("%Y-%m-%d %H:%M"),
        }

    pdf_bytes = build_pdf_report(
        dataset_name=dataset["original_filename"],
        executive_summary=summary,
        charts=[chart.model_dump() for chart in req.charts],
        stats=stats,
    )

    await save_interaction(
        user["sub"],
        "pdf",
        {
            "dataset_id": req.dataset_id,
            "response_summary": f"Generated report with {len(req.charts)} charts",
            "output_count": len(req.charts),
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
