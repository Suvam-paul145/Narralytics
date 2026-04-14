from llm.genai_client import generate_with_retry, _GROQ_MODEL, get_primary_api_key
from llm.quota_manager import quota_manager


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
    primary_key = get_primary_api_key()
    if not quota_manager.is_quota_available(primary_key):
        return quota_manager.get_fallback_response(
            "report_summary",
            dataset_name=dataset_name,
            charts=charts
        )

    try:
        response = generate_with_retry(
            client=None,
            model=_GROQ_MODEL,
            contents=[{"role": "user", "parts": [{"text": prompt}]}]
        )
        quota_manager.record_request(primary_key)
        return response.text.strip()
    except Exception as exc:
        # Use intelligent fallback if quota exhausted
        if quota_manager.is_quota_error(exc):
            return quota_manager.get_fallback_response(
                "report_summary",
                dataset_name=dataset_name,
                charts=charts
            )
        
        return "Executive summary unavailable. Review the charts below for the key findings."
