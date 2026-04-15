import pandas as pd

from analytics.dataset_profile import (
    build_dataset_profile,
    build_profile_dashboard_specs,
    clean_uploaded_dataframe,
    extract_embedded_csv_text,
    is_suspicious_dataframe,
    parse_csv_text,
)
from sqlite.schema_detector import detect_schema


def _build_schema():
    dataframe = pd.DataFrame(
        {
            "order_id": [1, 2, 3],
            "order_date": ["2024-01-01", "2024-01-02", "2024-01-03"],
            "product_id": ["P1", "P2", "P3"],
            "product_category": ["Books", "Fashion", "Books"],
            "quantity_sold": [4, 2, 7],
            "customer_region": ["Asia", "Europe", "Asia"],
            "payment_method": ["UPI", "Card", "UPI"],
            "rating": [4.2, 3.8, 4.6],
            "review_count": [100, 40, 180],
            "discount_percent": [10, 20, 15],
            "total_revenue": [400.0, 250.0, 610.0],
        }
    )
    return detect_schema(dataframe)


def test_extract_embedded_csv_text_recovers_header_and_rows():
    wrapped = (
        b'bplist00\x00\x01junk\n'
        b'"WebMainResource",random,noise\n'
        b'order_id,order_date,product_category,total_revenue\n'
        b'1,2024-01-01,Books,400\n'
        b'2,2024-01-02,Fashion,250\n'
    )

    extracted = extract_embedded_csv_text(wrapped)

    assert extracted is not None
    assert extracted.splitlines()[0] == "order_id,order_date,product_category,total_revenue"


def test_extract_embedded_csv_text_recovers_html_wrapped_header():
    wrapped = (
        b'bplist00\x00\x01junk\n'
        b'<html><body><pre style="word-wrap: break-word; white-space: pre-wrap;">order_id,order_date,product_id,product_category,price,total_revenue\n'
        b'1,13-04-2022,2637,Books,128.75,463.52\n'
        b'2,14-04-2022,9262,Fashion,100.00,400.00\n'
    )

    extracted = extract_embedded_csv_text(wrapped)

    assert extracted is not None
    first_line = extracted.splitlines()[0]
    assert first_line.startswith("order_id,order_date,product_id,product_category")


def test_suspicious_dataframe_flags_wrapper_columns():
    frame = pd.DataFrame(columns=["bplist00 payload", "Unnamed: 1", "Unnamed: 2"])

    assert is_suspicious_dataframe(frame) is True


def test_suspicious_dataframe_flags_numeric_like_headers():
    frame = pd.DataFrame(columns=["1", "13-04-2022", "2637", "Books"])

    assert is_suspicious_dataframe(frame) is True


def test_clean_uploaded_dataframe_drops_empty_unnamed_columns():
    frame = pd.DataFrame(
        {
            "order_id": [1, 2],
            "Unnamed: 1": [None, None],
            " ": [None, None],
            "total_revenue": [100, 120],
        }
    )

    cleaned, report = clean_uploaded_dataframe(frame)

    assert list(cleaned.columns) == ["order_id", "total_revenue"]
    assert report["dropped_column_count"] == 2


def test_build_dataset_profile_generates_recommended_questions_and_specs():
    schema = _build_schema()

    profile = build_dataset_profile(schema, "amazon_sales.csv")

    assert profile["recommended_questions"]
    assert profile["dashboard_seed_specs"]
    assert "summary" in profile


def test_build_profile_dashboard_specs_uses_profile_and_requirements():
    schema = _build_schema()
    profile = build_dataset_profile(schema, "amazon_sales.csv")

    specs = build_profile_dashboard_specs(schema, profile, "regional performance and trends")

    assert specs
    assert any("customer_region" in spec["sql"] for spec in specs)
    assert any(spec["chart_type"] == "line" for spec in specs)


def test_parse_csv_text_reads_plain_csv():
    dataframe = parse_csv_text("order_id,total_revenue\n1,100\n2,150\n")

    assert list(dataframe.columns) == ["order_id", "total_revenue"]
    assert len(dataframe) == 2
