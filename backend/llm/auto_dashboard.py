import json
from functools import lru_cache

import google.generativeai as genai

from config import settings


@lru_cache(maxsize=1)
def _get_model():
    if not settings.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    genai.configure(api_key=settings.GEMINI_API_KEY)
    return genai.GenerativeModel("gemini-1.5-flash")


def _parse_json_payload(raw: str) -> dict:
    text = raw.strip()
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1] if len(parts) > 1 else text
        if text.startswith("json"):
            text = text[4:].strip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("Model response did not contain JSON")
    return json.loads(text[start : end + 1])


def build_auto_dashboard_prompt(schema: dict) -> str:
    columns_text = "\n".join(
        [
            f"  - {column['name']} ({column['dtype']})"
            + (
                f" range: {column.get('min')} to {column.get('max')}"
                if column["dtype"] == "numeric"
                else ""
            )
            + (
                f" dates: {column.get('min_date')} to {column.get('max_date')}"
                if column["dtype"] == "datetime"
                else ""
            )
            + (
                f" samples: {', '.join(column['sample_values'][:3])}"
                if column["dtype"] == "categorical"
                else ""
            )
            for column in schema["columns"]
        ]
    )

    return f"""
You are a senior BI analyst generating an automatic dashboard for a newly uploaded dataset.

=== DATASET INFO ===
Total rows: {schema['row_count']}
Columns:
{columns_text}

Date columns: {schema['date_columns']}
Numeric columns: {schema['numeric_columns']}
Categorical columns: {schema['categorical_columns']}

=== YOUR TASK ===
Generate between 6 and 10 chart specifications that cover the most valuable business insights
this dataset can reveal. Cover a variety of chart types.

Priority order:
1. Time-series trends (if date columns exist)
2. Category comparisons (if categorical + numeric exist)
3. Distributions and proportions
4. Correlations between numeric columns
5. Top-N rankings

=== RULES ===
- Only use columns listed above, exact names only
- line chart: time-based X axis only
- bar chart: categorical X axis, numeric Y axis
- pie chart: max 6 categories, add LIMIT 6 to SQL
- scatter chart: two numeric columns
- All SQL queries must target table named exactly: data
- Always ROUND aggregated floats: ROUND(SUM(col), 2) AS col
- Always alias aggregations
- DO NOT include forecasting or predictions
- DO NOT fabricate data or insights

=== OUTPUT ===
Return valid JSON only:
{{
  "charts": [
    {{
      "chart_id": "c1",
      "title": "Short executive title",
      "chart_type": "bar|line|pie|scatter",
      "sql": "SELECT ...",
      "x_key": "column_name",
      "y_key": "column_name",
      "color_by": null,
      "insight": "One sentence business finding with a specific number",
      "category": "trend|comparison|distribution|correlation|ranking"
    }}
  ]
}}
"""


def generate_auto_dashboard(schema: dict) -> list[dict]:
    prompt = build_auto_dashboard_prompt(schema)
    try:
        response = _get_model().generate_content(prompt)
        payload = _parse_json_payload(response.text)
        return payload.get("charts", [])
    except Exception as exc:
        print(f"Auto-dashboard generation failed: {exc}")
        return []
