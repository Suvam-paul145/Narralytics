"""
Prompt Enhancer - Stage 2a of the Narralytics pipeline.

Reads the user's vague natural language query and rewrites it into a precise
analytical instruction grounded strictly in the dataset schema. This prevents
hallucinated column names from ever reaching the SQL generator.
"""

import re
from functools import lru_cache

from groq import Groq

from config import settings
from llm.genai_client import _GROQ_MODEL, generate_with_retry
from llm.quota_manager import quota_manager


@lru_cache(maxsize=1)
def _get_client() -> Groq:
    """Get the Groq client instance."""
    if not settings.GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY is not configured")
    return Groq(api_key=settings.GROQ_API_KEY)


_SYSTEM_TEMPLATE = """
You are a prompt enhancement specialist for a BI platform called Narralytics.
Your ONLY job is to rewrite the user's vague question into a precise analytical
instruction using ONLY column names that exist in the schema below.

=== SCHEMA ===
{schema_text}

=== RULES ===
1. ALWAYS provide an enhanced prompt. Do NOT reject questions lightly.
2. Try your BEST to map user terms to actual columns:
   - "sales" or "revenue" or "total" → any numeric column (total_revenue, price, amount)
   - "product" or "category" → any categorical column (product_category, product_name)
   - "region" or "location" → geographic columns (customer_region, city)
   - "date" or "time" or "when" → date columns (order_date, transaction_date)
3. If EXACT columns don't exist, suggest reasonable substitutes with column names from schema.
4. ONLY prepend [CANNOT_ANSWER] if the question requires columns that genuinely don't exist 
   (e.g., asking for "inventory levels" but dataset has no quantity/stock columns).
5. Return ONLY the enhanced prompt string. No JSON. No explanation. No code fences.

=== RECENT CONVERSATION (for context) ===
{history_text}
"""


def build_schema_text(schema: dict) -> str:
    """Build a human-readable schema description for the LLM."""
    lines = [f"Table: data  |  Rows: {schema['row_count']}"]
    for col in schema["columns"]:
        meta = f"{col['name']} ({col['dtype']})"
        if col["dtype"] == "numeric":
            meta += f" range [{col.get('min')} -> {col.get('max')}]"
        elif col["dtype"] == "datetime":
            meta += f" dates [{col.get('min_date')} -> {col.get('max_date')}]"
        elif col["dtype"] == "categorical":
            samples = ", ".join(col.get("sample_values", [])[:4])
            meta += f" samples: [{samples}]"
        lines.append(f"  - {meta}")
    return "\n".join(lines)


def _smart_prompt_substitute(raw: str, schema: dict) -> str:
    """
    Do simple string substitutions for common aliases before LLM sees it.
    This helps avoid "[CANNOT_ANSWER]" for queries like "show sales by product".
    """
    enhanced = raw.lower()
    
    # Map common business terms to available columns
    numeric_cols = [col["name"].lower() for col in schema["columns"] if col["dtype"] == "numeric"]
    categorical_cols = [col["name"].lower() for col in schema["columns"] if col["dtype"] == "categorical"]
    
    # Common business term mappings
    substitutions = {
        # Sales/Revenue terms
        r'\bsales\b': 'total_revenue' if 'total_revenue' in numeric_cols else (numeric_cols[0] if numeric_cols else 'sales'),
        r'\brevenue\b': 'total_revenue' if 'total_revenue' in numeric_cols else (numeric_cols[0] if numeric_cols else 'revenue'),
        r'\bamount\b': numeric_cols[0] if numeric_cols else 'amount',
        r'\bprice\b': 'price' if 'price' in numeric_cols else (numeric_cols[0] if numeric_cols else 'price'),
        
        # Category terms
        r'\bproduct\b': 'product_category' if 'product_category' in categorical_cols else (categorical_cols[0] if categorical_cols else 'product'),
        r'\bcategory\b': 'product_category' if 'product_category' in categorical_cols else (categorical_cols[0] if categorical_cols else 'category'),
        r'\bregion\b': 'customer_region' if 'customer_region' in categorical_cols else (categorical_cols[0] if categorical_cols else 'region'),
        
        # Count terms
        r'\bcount\b': 'quantity' if 'quantity' in numeric_cols else (numeric_cols[0] if numeric_cols else 'count'),
        r'\bquantity\b': 'quantity' if 'quantity' in numeric_cols else (numeric_cols[1] if len(numeric_cols) > 1 else 'quantity'),
    }
    
    # Apply substitutions (case-insensitive but preserve original case structure)
    for pattern, replacement in substitutions.items():
        enhanced = re.sub(pattern, replacement, enhanced, flags=re.IGNORECASE)
    
    return enhanced


def enhance_prompt(raw: str, schema: dict, history: list[dict] | None = None) -> str:
    """
    Enhance a vague user prompt into a schema-grounded analytical instruction.

    Returns:
        Enhanced prompt string, or the original prompt prefixed with
        '[CANNOT_ANSWER]' if the question cannot be served from the schema.
    """
    # First try: do smart substitutions client-side
    smart_enhanced = _smart_prompt_substitute(raw, schema)
    
    if not quota_manager.is_quota_available(settings.GROQ_API_KEY):
        print("Groq API quota exhausted, using smart prompt enhancement")
        return smart_enhanced

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

    full_prompt = f"{system_prompt}\n\nUser question: {smart_enhanced}"

    try:
        client = _get_client()
        response = generate_with_retry(
            client=client,
            model=_GROQ_MODEL,
            contents=[{"role": "user", "parts": [{"text": full_prompt}]}],
        )
        quota_manager.record_request(settings.GROQ_API_KEY)
        enhanced = response.text.strip()

        # If response is JSON or too long, fallback to smart enhancement
        if enhanced.startswith("{") or len(enhanced.split("\n")) > 8:
            return smart_enhanced

        # If LLM tries to reject but we have both numeric and categorical columns, use smart enhancement
        if enhanced.startswith("[CANNOT_ANSWER]") and schema.get("numeric_columns") and schema.get("categorical_columns"):
            print(f"[prompt_enhancer] LLM rejected query, but schema has data. Using smart enhancement instead.")
            return smart_enhanced

        return enhanced
    except Exception as exc:
        print(f"[prompt_enhancer] LLM error: {exc}, using smart enhancement")
        if quota_manager.is_quota_error(exc):
            return smart_enhanced
        return smart_enhanced
