import json
import logging
from functools import lru_cache
from google import genai
from config import settings
from llm.genai_client import generate_with_retry
from llm.quota_manager import quota_manager

logger = logging.getLogger(__name__)

@lru_cache(maxsize=1)
def _get_client() -> genai.Client:
    if not settings.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    return genai.Client(api_key=settings.GEMINI_API_KEY)

def _clean_json(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1] if len(parts) > 1 else text
        if text.startswith("json"):
            text = text[4:].strip()
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return text[start : end + 1]
    return text

_SYSTEM_TEMPLATE = """You are a strict analytics engine for Narralytics.
You receive an analytical instruction and must extract the logic into a highly structured MANDATORY JSON format.
Absolutely NO free text. No markdown. ONLY JSON.

=== DATASET SCHEMA ===
{schema_text}

=== VALID COLUMNS ===
{columns_csv}

=== RULES ===
- NEVER invent column names. ONLY use valid columns.
- Ensure correct aggregation based on intent (SUM, AVG, COUNT, MIN, MAX).
- By default use grouping if comparing categories.
- For pie charts MUST use limit=6.
- chartType must be one of: bar, line, pie, area, scatter

=== MANDATORY JSON OUTPUT ===
{{
  "options": [
    {{
      "chartType": "bar",
      "xAxis": "column_name",
      "yAxis": "column_name",
      "aggregation": "SUM",
      "groupBy": "column_name",
      "filters": {{
        "Region": "West"
      }},
      "limit": 10,
      "title": "Analysis Title",
      "insight": "Short insight."
    }}
  ]
}}
"""

def generate_query_spec(enhanced_prompt: str, schema: dict, output_count: int = 1, history: list[dict] | None = None) -> dict:
    schema_lines = [f"Table: data | Rows: {schema.get('row_count', 0)}"]
    for col in schema.get("columns", []):
        schema_lines.append(f"  - {col['name']} ({col.get('dtype', 'text')})")
    schema_text = "\n".join(schema_lines)
    all_col_names = [col["name"] for col in schema.get("columns", [])]

    system_prompt = _SYSTEM_TEMPLATE.format(
        schema_text=schema_text,
        columns_csv=", ".join(all_col_names)
    )

    history_text = ""
    if history:
        for turn in history[-6:]:
            role = turn.get("role", "user").upper()
            history_text += f"\n{role}: {turn.get('content', '')}"

    full_prompt = f"{system_prompt}\n\n=== HISTORY ===\n{history_text}\n\n=== INSTRUCTION ===\n{enhanced_prompt}"

    try:
        client = _get_client()
        logger.info(f"[query_generator] Requesting LLM for schema query")
        response = generate_with_retry(
            client=client,
            model="models/gemini-2.5-flash",
            contents=[{"role": "user", "parts": [{"text": full_prompt}]}]
        )
        raw = response.text
        logger.info(f"[query_generator] LLM raw response JSON:\n{raw}")
        cleaned = _clean_json(raw)
        return json.loads(cleaned)
    except Exception as exc:
        logger.error(f"[query_generator] Validation/LLM Error: {exc}")
        return {"cannot_answer": True, "reason": "AI failure"}
