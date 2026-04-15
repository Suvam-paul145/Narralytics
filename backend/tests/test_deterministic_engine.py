from analytics.deterministic_engine import (
    build_dashboard_fallback_specs,
    plan_rule_based_query,
    summarize_chart_data,
)


SCHEMA = {
    "row_count": 500,
    "columns": [
        {"name": "order_id", "code": "order_id", "dtype": "numeric"},
        {"name": "order_date", "code": "order_date", "dtype": "datetime"},
        {"name": "product_id", "code": "product_id", "dtype": "categorical"},
        {"name": "product_category", "code": "product_category", "dtype": "categorical"},
        {"name": "price", "code": "price", "dtype": "numeric"},
        {"name": "discount_percent", "code": "discount_percent", "dtype": "numeric"},
        {"name": "quantity_sold", "code": "quantity_sold", "dtype": "numeric"},
        {"name": "customer_region", "code": "customer_region", "dtype": "categorical"},
        {"name": "payment_method", "code": "payment_method", "dtype": "categorical"},
        {"name": "rating", "code": "rating", "dtype": "numeric"},
        {"name": "review_count", "code": "review_count", "dtype": "numeric"},
        {"name": "discounted_price", "code": "discounted_price", "dtype": "numeric"},
        {"name": "total_revenue", "code": "total_revenue", "dtype": "numeric"},
    ],
    "date_columns": ["order_date"],
    "numeric_columns": [
        "order_id",
        "price",
        "discount_percent",
        "quantity_sold",
        "rating",
        "review_count",
        "discounted_price",
        "total_revenue",
    ],
    "categorical_columns": [
        "product_id",
        "product_category",
        "customer_region",
        "payment_method",
    ],
}


def test_rule_based_query_maps_regions_to_customer_region_and_revenue():
    result = plan_rule_based_query("Show top 5 regions by total revenue", SCHEMA)

    assert result["matched"] is True
    spec = result["specs"][0]
    assert spec["chart_type"] == "bar"
    assert spec["x_key"] == "customer_region"
    assert spec["y_key"] == "total_revenue"
    assert 'GROUP BY "customer_region"' in spec["sql"]


def test_rule_based_query_rejects_missing_customer_identifier():
    result = plan_rule_based_query("Top 10 customers and their total revenue", SCHEMA)

    assert result["invalid"] is True
    assert "customer" in result["reason"].lower()


def test_rule_based_query_allows_customer_region_questions():
    result = plan_rule_based_query("Show customer region breakdown by total revenue", SCHEMA)

    assert result["matched"] is True
    assert result["specs"][0]["x_key"] == "customer_region"


def test_rule_based_query_rejects_unrelated_text():
    result = plan_rule_based_query("raju goes to school everyday", SCHEMA)

    assert result["invalid"] is True
    assert "dataset" in result["reason"].lower()


def test_rule_based_summary_highlights_top_segment():
    summary = summarize_chart_data(
        question="Show top 5 regions by total revenue",
        chart_title="Top 5 Regions by Revenue",
        chart_type="bar",
        data=[
            {"customer_region": "North America", "total_revenue": 1000},
            {"customer_region": "Asia", "total_revenue": 700},
            {"customer_region": "Europe", "total_revenue": 500},
        ],
        x_key="customer_region",
        y_key="total_revenue",
    )

    assert "North America" in summary
    assert "1,000" in summary


def test_dashboard_fallback_builds_multiple_specs():
    specs = build_dashboard_fallback_specs(SCHEMA)

    assert len(specs) >= 3
    assert any(spec["chart_type"] == "line" for spec in specs)
    assert any(spec["chart_type"] == "bar" for spec in specs)


def test_rule_based_query_uses_avg_for_rating_by_payment_type():
    result = plan_rule_based_query("give me top 5 payment type by rating", SCHEMA)

    assert result["matched"] is True
    spec = result["specs"][0]
    assert spec["x_key"] == "payment_method"
    assert spec["y_key"] == "rating"
    assert spec["aggregation"] == "avg"
    assert 'AVG("rating")' in spec["sql"]
