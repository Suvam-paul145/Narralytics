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


def build_chat_system_prompt(schema: dict, dataset_filename: str) -> str:
    columns_summary = ", ".join([f"{column['name']} ({column['dtype']})" for column in schema["columns"]])
    return f"""
You are a senior business analyst embedded in a BI platform.
You are answering questions about a dataset called "{dataset_filename}".

=== DATASET CONTEXT ===
Rows: {schema['row_count']}
Columns: {columns_summary}
Date columns: {', '.join(schema['date_columns'])}
Numeric columns: {', '.join(schema['numeric_columns'])}
Categorical columns: {', '.join(schema['categorical_columns'])}

SQL table name: data

=== YOUR BEHAVIOR ===
1. Answer in 2-4 sentences of executive-ready language
2. If the question requires specific numbers, generate a supporting SQL query
3. For explicit forecast requests, set needs_forecast=true
4. If the dataset cannot answer the question, say exactly what is missing
5. Maintain conversation context for natural follow-ups
6. Never invent statistics

=== OUTPUT ===
Return valid JSON only:
{{
  "cannot_answer": false,
  "answer": "2-4 sentence response",
  "supporting_sql": "SELECT ... or null",
  "needs_data": true,
  "needs_forecast": false
}}
Or:
{{ "cannot_answer": true, "reason": "specific explanation" }}
"""


def get_chat_response(schema: dict, dataset_filename: str, message: str, history: list) -> dict:
    system_prompt = build_chat_system_prompt(schema, dataset_filename)
    
    # Convert history to new format
    contents = []
    for turn in history[-10:]:
        contents.append({
            "role": turn["role"],
            "parts": [{"text": turn["content"]}]
        })
    
    # Add current message
    contents.append({
        "role": "user", 
        "parts": [{"text": f"{system_prompt}\n\nUser: {message}"}]
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


def refine_chat_answer(
    dataset_filename: str,
    question: str,
    draft_answer: str,
    sql_result: list[dict],
) -> str:
    prompt = f"""
You are refining an analyst answer for dataset "{dataset_filename}".

Question: {question}
Draft answer: {draft_answer}
SQL result rows: {json.dumps(sql_result[:10], default=str)}

Rewrite the answer in 2-4 sentences using the exact figures from the SQL result.
Return only the final answer text.
"""
    try:
        client = _get_client()
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
        )
        return response.text.strip()
    except Exception:
        return draft_answer
