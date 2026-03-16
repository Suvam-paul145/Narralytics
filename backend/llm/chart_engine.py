import json
from functools import lru_cache

from google import genai

from config import settings


@lru_cache(maxsize=1)
def _get_client():
    """Get the Google GenAI client with API key configuration"""
    if not settings.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    return genai.Client(api_key=settings.GEMINI_API_KEY)


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

    # Convert history to new format
    contents = []
    for turn in history[-6:]:
        contents.append({
            "role": turn["role"],
            "parts": [{"text": turn["content"]}]
        })
    
    # Add current message
    contents.append({
        "role": "user", 
        "parts": [{"text": f"{system_prompt}\n\nQuery: {prompt}"}]
    })

    try:
        client = _get_client()
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=contents
        )
        return _parse_json_payload(response.text)
    except Exception as exc:
        return {"cannot_answer": True, "reason": str(exc)}
