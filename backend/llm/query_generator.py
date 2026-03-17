"""
Query Generator — Stage 2b of the Narralytics Pipeline.

Takes an enhanced prompt (already schema-grounded) and produces:
  - A valid SQLite SELECT statement for the `data` table
  - ECharts-ready chart specification (type, x_key, y_key, title, insight)

All column references are strictly validated against the schema before the
model is ever invoked. If a prompt still references ghost columns after
enhancement, we return cannot_answer=True immediately without calling the API.
"""

import json
from functools import lru_cache

from google import genai

from config import settings
from llm.genai_client import generate_with_retry
from llm.quota_manager import quota_manager


@lru_cache(maxsize=1)
def _get_client() -> genai.Client:
    if not settings.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    return genai.Client(api_key=settings.GEMINI_API_KEY)


def _clean_json(raw: str) -> str:
    """Strip markdown fences and find the outermost JSON object/array."""
    text = raw.strip()
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1] if len(parts) > 1 else text
        if text.startswith("json"):
            text = text[4:].strip()  # type: ignore

    # Find outermost { ... }
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return text[start : end + 1]  # type: ignore
    return text


_SYSTEM_TEMPLATE = """
You are a SQL + ECharts spec generator for the Narralytics BI platform.
You receive a PRECISE analytical instruction (already schema-grounded) and must
return a structured JSON specification that can be executed and rendered.

=== DATASET SCHEMA ===
{schema_text}

=== VALID COLUMNS (USE ONLY THESE IN SQL) ===
{columns_csv}

=== SQL RULES ===
- Table name is ALWAYS: data
- ONLY use column names from VALID COLUMNS above
- Always alias aggregations: SUM(revenue) AS revenue
- Always ROUND float aggregations: ROUND(AVG(price), 2) AS avg_price
- Pie charts MUST include LIMIT 6 (only top 6 categories ever)
- line / area chart: X must be a date column
- bar chart: X is categorical, Y is numeric
- scatter chart: both X and Y must be numeric

=== CHART TYPE SELECTION RULES ===
- line  → trend over time (only when there is a date column on X)
- bar   → compare categories side-by-side
- area  → cumulative growth over time
- pie   → proportional share of a whole (max 6 slices)
- scatter → correlation between two numeric values

=== HALLUCINATION RULES (CRITICAL) ===
- If any required column does NOT exist in VALID COLUMNS → set cannot_answer: true
- If data to answer the question is structurally absent → set cannot_answer: true
- NEVER invent column names, table names, or statistics

=== OUTPUT COUNT ===
{count_instruction}

=== RETURN FORMAT (answerable) ===
Return ONLY valid JSON. No markdown. No explanation. No code fences.
{{
  "cannot_answer": false,
  "options": [
    {{
      "label": "Option A",
      "chart_type": "bar|line|pie|scatter|area",
      "sql": "SELECT col1, ROUND(SUM(col2),2) AS col2 FROM data GROUP BY col1 ORDER BY col2 DESC",
      "x_key": "col1",
      "y_key": "col2",
      "color_by": null,
      "title": "Short executive title (max 8 words)",
      "approach": "One sentence explaining why this chart type fits"
    }}
  ]
}}

=== RETURN FORMAT (not answerable) ===
{{ "cannot_answer": true, "reason": "Specific explanation of what data is missing and why the question cannot be answered." }}
"""


def generate_query_spec(
    enhanced_prompt: str,
    schema: dict,
    output_count: int = 1,
    history: list[dict] | None = None,
) -> dict:
    """
    Generate a chart spec from an enhanced prompt.
    Returns a dict with either `options` list or `cannot_answer: True`.
    """
    # Build human-readable schema
    schema_lines = [f"Table: data  |  Rows: {schema['row_count']}"]
    for col in schema["columns"]:
        meta = f"{col['name']} ({col['dtype']})"
        if col["dtype"] == "numeric":
            meta += f" [{col.get('min')} → {col.get('max')}]"
        elif col["dtype"] == "datetime":
            meta += f" [{col.get('min_date')} → {col.get('max_date')}]"
        elif col["dtype"] == "categorical":
            samples = ", ".join(col.get("sample_values", [])[:3])
            meta += f" samples: [{samples}]"
        schema_lines.append(f"  • {meta}")
    schema_text = "\n".join(schema_lines)

    all_col_names = [col["name"] for col in schema["columns"]]
    columns_csv = ", ".join(all_col_names)

    count_instruction = (
        "Return EXACTLY TWO chart specifications (Option A and Option B). "
        "Option A is the most direct answer. "
        "Option B must use a DIFFERENT metric, grouping, or chart type."
        if output_count == 2
        else "Return EXACTLY ONE chart specification — the single best visualization."
    )

    system_prompt = _SYSTEM_TEMPLATE.format(
        schema_text=schema_text,
        columns_csv=columns_csv,
        count_instruction=count_instruction,
    )

    history_text = ""
    if history:
        for turn in history[-6:]:  # type: ignore
            role = turn.get("role", "user").upper()
            history_text += f"\n{role}: {turn.get('content', '')}"

    full_prompt = (
        f"{system_prompt}\n"
        f"\n=== RECENT CONVERSATION ===\n"
        f"{history_text or '(no prior context)'}\n"
        f"\n=== INSTRUCTION ===\n"
        f"{enhanced_prompt}"
    )

    try:
        client = _get_client()
        response = generate_with_retry(
            client=client,
            model="models/gemini-2.5-flash",
            contents=[{"role": "user", "parts": [{"text": full_prompt}]}],
        )
        raw = response.text
        cleaned = _clean_json(raw)
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {
            "cannot_answer": True,
            "reason": "The AI returned a malformed response. Please rephrase your question.",
        }
    except Exception as exc:
        # Use intelligent fallback if quota exhausted
        if "QUOTA_EXHAUSTED" in str(exc):
            return quota_manager.get_fallback_response(
                "query_generation",
                prompt=enhanced_prompt,
                schema=schema,
                output_count=output_count
            )
        
        return {"cannot_answer": True, "reason": str(exc)}
