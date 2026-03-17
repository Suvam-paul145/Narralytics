from functools import lru_cache

from google import genai

from config import settings
from llm.genai_client import generate_with_retry
from llm.quota_manager import quota_manager


@lru_cache(maxsize=1)
def _get_client():
    """Get the Google GenAI client with API key configuration"""
    if not settings.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    return genai.Client(api_key=settings.GEMINI_API_KEY)


def generate_report_summary(dataset_name: str, charts: list) -> str:
    chart_descriptions = "\n".join(
        [f"- {chart['title']}: {chart.get('insight', 'No insight available')}" for chart in charts]
    )
    prompt = f"""
You are writing an executive summary for a business analytics report on: {dataset_name}

The report contains these charts and findings:
{chart_descriptions}

Write a 3-5 sentence executive summary paragraph that:
1. Opens with the most important finding
2. Connects the key insights into a coherent narrative
3. Ends with one clear business recommendation
4. Uses specific numbers from the insights where possible
5. Sounds like a senior management consultant wrote it

Return only the paragraph text.
"""
    try:
        client = _get_client()
        response = generate_with_retry(
            client=client,
            model='models/gemini-2.5-flash',
            contents=[{"role": "user", "parts": [{"text": prompt}]}]
        )
        return response.text.strip()
    except Exception as exc:
        # Use intelligent fallback if quota exhausted
        if "QUOTA_EXHAUSTED" in str(exc):
            return quota_manager.get_fallback_response(
                "report_summary",
                dataset_name=dataset_name,
                charts=charts
            )
        
        return "Executive summary unavailable. Review the charts below for the key findings."
