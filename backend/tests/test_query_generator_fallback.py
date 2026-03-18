from llm.query_generator import _parse_payload
from llm.quota_manager import quota_manager


SCHEMA = {
    "row_count": 100,
    "columns": [
        {"name": "region", "dtype": "categorical"},
        {"name": "sales", "dtype": "numeric"},
        {"name": "order_date", "dtype": "datetime"},
    ],
    "date_columns": ["order_date"],
    "numeric_columns": ["sales"],
    "categorical_columns": ["region"],
}


def test_parse_payload_repairs_unescaped_newlines_in_strings():
    raw = """
    {
      "options": [
        {
          "chartType": "bar",
          "xAxis": "region",
          "yAxis": "sales",
          "aggregation": "SUM",
          "groupBy": null,
          "filters": {},
          "limit": 10,
          "title": "Sales by region",
          "insight": "Line one
Line two"
        }
      ]
    }
    """

    payload = _parse_payload(raw)

    assert payload["options"][0]["insight"] == "Line one\nLine two"


def test_query_fallback_returns_structured_chart_options():
    fallback = quota_manager.get_fallback_response(
        "query_generation",
        prompt="compare sales by region",
        schema=SCHEMA,
    )

    option = fallback["options"][0]
    assert fallback["cannot_answer"] is False
    assert option["chartType"] == "bar"
    assert option["xAxis"] == "region"
    assert option["yAxis"] == "sales"
