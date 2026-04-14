from llm.auto_dashboard import _build_chart_specs


SCHEMA = {
    "columns": [
        {"name": "Order Date", "code": "Order_Date", "dtype": "datetime"},
        {"name": "Revenue", "code": "Revenue", "dtype": "numeric"},
        {"name": "Region", "code": "Region", "dtype": "categorical"},
    ],
    "date_columns": ["Order Date"],
    "numeric_columns": ["Revenue"],
    "categorical_columns": ["Region"],
}


def test_build_chart_specs_dedupes_duplicate_plans_and_preserves_metadata():
    plans = [
        {
            "chart_id": "c1",
            "title": "Revenue trend",
            "chart_type": "line",
            "xAxis": "Order Date",
            "yAxis": "Revenue",
            "groupBy": None,
            "aggregation": "sum",
            "sort": "asc",
            "limit": None,
            "insight": "Track how revenue changes over time.",
            "category": "trend",
        },
        {
            "chart_id": "c2",
            "title": "Revenue trend duplicate",
            "chart_type": "line",
            "xAxis": "Order Date",
            "yAxis": "Revenue",
            "groupBy": None,
            "aggregation": "sum",
            "sort": "asc",
            "limit": None,
            "insight": "Duplicate view.",
            "category": "trend",
        },
        {
            "chart_id": "c3",
            "title": "Regional share",
            "chart_type": "pie",
            "xAxis": "Region",
            "yAxis": "Revenue",
            "groupBy": None,
            "aggregation": "sum",
            "sort": "desc",
            "limit": 12,
            "insight": "Check if revenue is concentrated in a few regions.",
            "category": "distribution",
        },
    ]

    specs = _build_chart_specs(plans, SCHEMA)

    assert len(specs) == 2
    assert specs[0]["chart_id"] == "c1"
    assert specs[0]["category"] == "trend"
    assert specs[0]["aggregation"] == "sum"
    assert "LIMIT 6" in specs[1]["sql"]
