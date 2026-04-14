from analytics.chart_builder import (
    convert_llm_json_to_chart_spec,
    generate_sql_from_structured_json,
)


SCHEMA = {
    "columns": [
        {"name": "Order Date", "code": "Order_Date", "dtype": "datetime"},
        {"name": "Revenue (%)", "code": "Revenue_percent", "dtype": "numeric"},
        {"name": "Region", "code": "Region", "dtype": "categorical"},
    ],
    "date_columns": ["Order Date"],
    "numeric_columns": ["Revenue (%)"],
    "categorical_columns": ["Region"],
}


def test_generate_sql_from_structured_json_quotes_filter_literals_safely():
    sql = generate_sql_from_structured_json(
        {
            "chartType": "bar",
            "xAxis": "Region",
            "yAxis": "Revenue (%)",
            "aggregation": "sum",
            "groupBy": None,
            "filters": {"Region": "North:East's"},
            "sort": "desc",
            "limit": 5,
        },
        SCHEMA,
    )

    assert '"Region" = \'North:East\'\'s\'' in sql
    assert 'SUM("Revenue_percent")' in sql


def test_convert_llm_json_to_chart_spec_prefers_generated_sql_over_raw_sql():
    specs = convert_llm_json_to_chart_spec(
        [
            {
                "chartType": "bar",
                "xAxis": "Region",
                "yAxis": "Revenue (%)",
                "aggregation": "sum",
                "groupBy": None,
                "filters": {},
                "limit": 5,
                "sql": "SELECT broken:sql FROM data",
                "title": "Revenue by region",
                "insight": "Compare regions",
            }
        ],
        SCHEMA,
    )

    assert len(specs) == 1
    assert specs[0]["sql"].startswith('SELECT "Region"')
    assert "broken:sql" not in specs[0]["sql"]
