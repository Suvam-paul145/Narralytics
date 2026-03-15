import base64
import io
from datetime import datetime
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import HRFlowable, Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def _text(value: str | None) -> str:
    return escape(value or "").replace("\n", "<br/>")


def build_pdf_report(
    dataset_name: str,
    executive_summary: str,
    charts: list,
    stats: dict | None = None,
) -> bytes:
    buffer = io.BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    title_style = ParagraphStyle(
        "Title",
        fontName="Helvetica-Bold",
        fontSize=20,
        textColor=colors.HexColor("#07071c"),
        spaceAfter=6,
        leading=24,
    )
    subtitle_style = ParagraphStyle(
        "Subtitle",
        fontName="Helvetica",
        fontSize=11,
        textColor=colors.HexColor("#3e4268"),
        spaceAfter=16,
    )
    section_header_style = ParagraphStyle(
        "SectionHeader",
        fontName="Helvetica-Bold",
        fontSize=13,
        textColor=colors.HexColor("#4338ca"),
        spaceBefore=16,
        spaceAfter=8,
    )
    body_style = ParagraphStyle(
        "Body",
        fontName="Helvetica",
        fontSize=10,
        textColor=colors.HexColor("#3e4268"),
        leading=16,
        alignment=TA_JUSTIFY,
        spaceAfter=8,
    )
    insight_style = ParagraphStyle(
        "Insight",
        fontName="Helvetica-Oblique",
        fontSize=9,
        textColor=colors.HexColor("#4338ca"),
        leftIndent=12,
        spaceAfter=8,
    )
    chart_title_style = ParagraphStyle(
        "ChartTitle",
        fontName="Helvetica-Bold",
        fontSize=11,
        textColor=colors.HexColor("#07071c"),
        spaceAfter=4,
    )
    footer_style = ParagraphStyle(
        "Footer",
        fontName="Helvetica",
        fontSize=8,
        textColor=colors.HexColor("#8888b0"),
        alignment=TA_CENTER,
    )

    story = []
    story.append(
        Paragraph(
            "Narralytics",
            ParagraphStyle(
                "Brand",
                fontName="Helvetica-Bold",
                fontSize=11,
                textColor=colors.HexColor("#4338ca"),
                spaceAfter=4,
            ),
        )
    )
    story.append(Paragraph(f"Analytics Report: {_text(dataset_name)}", title_style))
    story.append(Paragraph(f"Generated: {datetime.now().strftime('%B %d, %Y at %H:%M')}", subtitle_style))
    story.append(
        HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e8e8f4"), spaceAfter=16)
    )

    story.append(Paragraph("Executive Summary", section_header_style))
    story.append(Paragraph(_text(executive_summary), body_style))
    story.append(Spacer(1, 12))

    if stats:
        story.append(Paragraph("Statistical Overview", section_header_style))
        table_data = [["Metric", "Value"]]
        for key, value in stats.items():
            table_data.append([str(key), str(value)])

        stats_table = Table(table_data, colWidths=[8 * cm, 8 * cm])
        stats_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4338ca")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f4f4fa"), colors.white]),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e8e8f4")),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        story.append(stats_table)
        story.append(Spacer(1, 16))

    story.append(Paragraph("Dashboard Charts", section_header_style))

    for index, chart in enumerate(charts, start=1):
        story.append(Paragraph(f"{index}. {_text(chart['title'])}", chart_title_style))

        if chart.get("image_base64"):
            image_data = base64.b64decode(chart["image_base64"])
            image_buffer = io.BytesIO(image_data)
            story.append(Image(image_buffer, width=15 * cm, height=8 * cm))

        if chart.get("insight"):
            story.append(Paragraph(f"Insight: {_text(chart['insight'])}", insight_style))

        story.append(Spacer(1, 12))

    story.append(
        HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e8e8f4"), spaceBefore=16)
    )
    story.append(Paragraph(f"Generated by Narralytics - {datetime.now().year}", footer_style))

    document.build(story)
    return buffer.getvalue()
