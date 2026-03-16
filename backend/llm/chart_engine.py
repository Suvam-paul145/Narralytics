import json
from functools import lru_cache

import google.generativeai as genai

from config import settings


@lru_cache(maxsize=1)
def _get_model():
    if not settings.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    genai.configure(api_key=settings.GEMINI_API_KEY)
    return genai.GenerativeModel("gemini-2.5-flash")


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


def get_chart_specs(schema: dict, prompt: str, history: list, output_count: int = 1) -> dict:
    columns_text = "\n".join(
        [
            f"  {column['name']} ({column['dtype']})"
            + (
                f" | range: {column.get('min')} to {column.get('max')}"
                if column["dtype"] == "numeric"
                else ""
            )
            + (
                f" | dates: {column.get('min_date')} to {column.get('max_date')}"
                if column["dtype"] == "datetime"
                else ""
            )
            + (
                f" | samples: {', '.join(column['sample_values'][:3])}"
                if column["dtype"] == "categorical"
                else ""
            )
            for column in schema["columns"]
        ]
    )

    count_instruction = (
        "Return EXACTLY TWO different chart specifications. Option A is the most direct answer. "
        "Option B must use a different metric, grouping, or chart type."
        if output_count == 2
        else "Return EXACTLY ONE chart specification, the single best visualization."
    )

    system_prompt = f"""
You are a senior BI analyst. {count_instruction}

=== DATASET SCHEMA ===
Rows: {schema['row_count']}
Table name: data
Columns:
{columns_text}

Date columns: {schema['date_columns']}
Numeric columns: {schema['numeric_columns']}
Categorical columns: {schema['categorical_columns']}

=== SQL RULES ===
- Use ONLY columns listed above
- Table name is always data
- Always alias aggregations
- Always ROUND float aggregations
- Pie charts must include LIMIT 6
- line: X must be a date column
- bar: X categorical, Y numeric
- pie: proportions of a whole
- scatter: X and Y numeric

=== OUTPUT ===
Return valid JSON only:
{{
  "cannot_answer": false,
  "options": [
    {{
      "label": "Option A",
      "approach": "one sentence why this chart type",
      "sql": "SELECT ...",
      "chart_type": "bar|line|pie|scatter",
      "x_key": "col_name",
      "y_key": "col_name",
      "color_by": null,
      "title": "Short executive title",
      "insight": "One finding with a real number"
    }}
  ]
}}
If you cannot answer, return:
{{ "cannot_answer": true, "reason": "specific explanation" }}
"""

    messages = [{"role": turn["role"], "parts": [turn["content"]]} for turn in history[-6:]]
    messages.append({"role": "user", "parts": [f"{system_prompt}\n\nQuery: {prompt}"]})

    try:
        response = _get_model().generate_content(messages)
        return _parse_json_payload(response.text)
    except Exception as exc:
        return {"cannot_answer": True, "reason": str(exc)}
