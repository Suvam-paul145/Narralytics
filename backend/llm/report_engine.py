from functools import lru_cache

import google.generativeai as genai

from config import settings


@lru_cache(maxsize=1)
def _get_model():
    if not settings.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    genai.configure(api_key=settings.GEMINI_API_KEY)
    return genai.GenerativeModel("gemini-1.5-flash")


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
        return _get_model().generate_content(prompt).text.strip()
    except Exception:
        return "Executive summary unavailable. Review the charts below for the key findings."
