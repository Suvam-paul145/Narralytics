from analytics.aggregation_engine import normalize_chart_result


def test_city_category_is_aggregated_cumulatively() -> None:
    spec = {
        "chart_type": "bar",
        "x_key": "city",
        "y_key": "sales",
        "color_by": "category",
        "title": "Sales by City",
        "sql": "SELECT city, category, sales FROM data",
    }
    rows = [
        {"city": "Goose Gut", "category": "A", "sales": 10},
        {"city": "Goose Gut", "category": "A", "sales": 12},
        {"city": "Goose Gut", "category": "B", "sales": 5},
        {"city": "Sudad", "category": "A", "sales": 9},
        {"city": "Sudad", "category": "B", "sales": 4},
    ]

    next_spec, aggregated = normalize_chart_result(spec, rows)

    assert next_spec["color_by"] == "category"
    assert {tuple(sorted(item.items())) for item in aggregated} == {
        tuple(sorted({"city": "Goose Gut", "category": "A", "sales": 22.0}.items())),
        tuple(sorted({"city": "Goose Gut", "category": "B", "sales": 5.0}.items())),
        tuple(sorted({"city": "Sudad", "category": "A", "sales": 9.0}.items())),
        tuple(sorted({"city": "Sudad", "category": "B", "sales": 4.0}.items())),
    }


def test_duplicate_x_without_color_gets_summed() -> None:
    spec = {
        "chart_type": "bar",
        "x_key": "city",
        "y_key": "sales",
        "title": "Sales by City",
        "sql": "SELECT city, sales FROM data",
    }
    rows = [
        {"city": "Goose Gut", "sales": 10},
        {"city": "Goose Gut", "sales": 15},
        {"city": "Sudad", "sales": 7},
    ]

    _, aggregated = normalize_chart_result(spec, rows)

    assert aggregated == [
        {"city": "Goose Gut", "sales": 25.0},
        {"city": "Sudad", "sales": 7.0},
    ]


def test_color_by_is_inferred_when_secondary_dimension_exists() -> None:
    spec = {
        "chart_type": "bar",
        "x_key": "city",
        "y_key": "sales",
        "title": "Sales by City",
        "sql": "SELECT city, category, sales FROM data",
    }
    rows = [
        {"city": "Goose Gut", "category": "A", "sales": 10},
        {"city": "Goose Gut", "category": "B", "sales": 8},
        {"city": "Sudad", "category": "A", "sales": 9},
    ]
    schema = {"categorical_columns": ["city", "category"]}

    next_spec, aggregated = normalize_chart_result(spec, rows, schema=schema)

    assert next_spec["color_by"] == "category"
    assert len(aggregated) == 3
