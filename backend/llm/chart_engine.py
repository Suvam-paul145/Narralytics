import json
from functools import lru_cache
from typing import Any

from google import genai

from config import settings
from llm.genai_client import generate_with_retry


@lru_cache(maxsize=1)
def _get_client():
    """Get the Google GenAI client with API key configuration"""
    if not settings.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    return genai.Client(api_key=settings.GEMINI_API_KEY)


def _parse_json_payload(raw: str) -> dict[str, Any]:
    text = raw.strip()
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1] if len(parts) > 1 else text
        if text.startswith("json"):
            text = text[4:].strip()  # type: ignore
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("Model response did not contain JSON")
    return json.loads(text[start : end + 1])  # type: ignore


def get_chart_specs(schema: dict[str, Any], prompt: str, history: list[dict[str, Any]], output_count: int = 1) -> dict[str, Any]:
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
      "insight": "Predictive expectation (no hallucinated exact numbers)"
    }}
  ]
}}
If you cannot answer, return:
{{ "cannot_answer": true, "reason": "specific explanation" }}
"""

    # Convert history to new format
    contents = []
    for turn in history[-6:]:  # type: ignore
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
        response = generate_with_retry(
            client=client,
            model='gemini-2.5-flash',
            contents=contents
        )
        return _parse_json_payload(response.text)
    except Exception as exc:
        return {"cannot_answer": True, "reason": str(exc)}

def generate_data_driven_insight(prompt: str, chart_title: str, chart_type: str, data: list[dict]) -> str:
    """Stage 5: Data-driven insight generation based on actual aggregated data"""
    if not data:
        return "No data returned to generate an insight."
        
    data_sample = data[:30]  # type: ignore
    
    system_prompt = f"""
You are an expert data analyst. Look at these aggregate results and summarize the key takeaway in 1 to 2 short sentences.
Original Query: {prompt}
Chart Title: {chart_title}
Chart Type: {chart_type}

Aggregated Data (up to 30 rows):
{json.dumps(data_sample, default=str)}

Keep it professional, punchy, and include actual numbers from the data. Do NOT explain what the chart is. Just give the business takeaway.
"""
    try:
        client = _get_client()
        response = generate_with_retry(
            client=client,
            model='gemini-2.5-flash',
            contents=system_prompt
        )
        return response.text.replace('\n', ' ').strip()
    except Exception as exc:
        return "Could not generate insight."
