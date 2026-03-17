"""
Prompt Enhancer — Stage 2a of the Narralytics Pipeline.

Reads the user's vague natural language query and rewrites it into a precise
analytical instruction grounded strictly in the dataset schema. This prevents
hallucinated column names from ever reaching the SQL generator.
"""

from functools import lru_cache

from google import genai

from config import settings


@lru_cache(maxsize=1)
def _get_client() -> genai.Client:
    if not settings.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    return genai.Client(api_key=settings.GEMINI_API_KEY)


_SYSTEM_TEMPLATE = """
You are a prompt enhancement specialist for a BI platform called Narralytics.
Your ONLY job is to rewrite the user's vague question into a precise analytical
instruction using ONLY column names that exist in the schema below.

=== SCHEMA ===
{schema_text}

=== RULES ===
- Never change user intent, only clarify it.
- Replace vague words with actual column names found in the schema.
  Example: "sales" → use the actual column name like total_revenue or sale_amount
- If the question CANNOT be answered from the available columns (e.g. user asks
  about inventory but there is no inventory column), prepend: [CANNOT_ANSWER]
  and then briefly explain why.
- Return ONLY the enhanced prompt string. No JSON. No explanation. No code fences.

=== RECENT CONVERSATION (for context) ===
{history_text}
"""


def build_schema_text(schema: dict) -> str:
    lines = [f"Table: data  |  Rows: {schema['row_count']}"]
    for col in schema["columns"]:
        meta = f"{col['name']} ({col['dtype']})"
        if col["dtype"] == "numeric":
            meta += f" range [{col.get('min')} → {col.get('max')}]"
        elif col["dtype"] == "datetime":
            meta += f" dates [{col.get('min_date')} → {col.get('max_date')}]"
        elif col["dtype"] == "categorical":
            samples = ", ".join(col.get("sample_values", [])[:4])
            meta += f" samples: [{samples}]"
        lines.append(f"  • {meta}")
    return "\n".join(lines)


def enhance_prompt(raw: str, schema: dict, history: list | None = None) -> str:
    """
    Enhance a vague user prompt into a schema-grounded analytical instruction.

    Returns:
        Enhanced prompt string, or the original prompt prefixed with
        '[CANNOT_ANSWER]' if the question cannot be served from the schema.
    """
    schema_text = build_schema_text(schema)

    history_text = ""
    if history:
        for turn in history[-4:]:
            role = turn.get("role", "user").upper()
            content = turn.get("content", "")
            history_text += f"\n{role}: {content}"

    system_prompt = _SYSTEM_TEMPLATE.format(
        schema_text=schema_text,
        history_text=history_text or "(none)",
    )

    full_prompt = f"{system_prompt}\n\nUser question: {raw}"

    try:
        client = _get_client()
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=full_prompt,
        )
        enhanced = response.text.strip()

        # Sanity guard: if LLM returns JSON or multi-line blob, fall back to raw
        if enhanced.startswith("{") or len(enhanced.split("\n")) > 8:
            return raw

        return enhanced
    except Exception as exc:
        print(f"[prompt_enhancer] fallback to raw prompt due to: {exc}")
        return raw
