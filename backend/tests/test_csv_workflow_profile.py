import sqlite3
from pathlib import Path

import pandas as pd

from sqlite.loader import generate_column_code, load_csv_to_sqlite
from sqlite.schema_detector import detect_schema


def test_column_codes_are_stable_and_safe(tmp_path: Path):
    df = pd.DataFrame(
        {
            "Order Date": ["2024-01-01", "2024-01-02", "2024-02-03"],
            "Revenue (%)": [100.5, 200.25, 300.75],
            "Region-Code": ["North", "South", "West"],
            "Notes (optional)": ["A", "B", None],
        }
    )

    schema = detect_schema(df)
    column_codes = [column["code"] for column in schema["columns"]]

    # Codes should be deterministic and mirror the normalization used for SQLite
    assert column_codes == [
        "Order_Date",
        "Revenue_percent",
        "Region_Code",
        "Notes_optional",
    ]
    assert schema["column_codes"] == column_codes
    assert schema["date_column_codes"] == ["Order_Date"]
    assert schema["numeric_column_codes"] == ["Revenue_percent"]
    assert set(schema["categorical_column_codes"]) == {"Region_Code", "Notes_optional"}

    # Loading into SQLite should use the same codes, ensuring the pipeline is consistent
    db_path = tmp_path / "pipeline.db"
    load_csv_to_sqlite(df, str(db_path))

    with sqlite3.connect(db_path) as conn:
        cursor = conn.execute("PRAGMA table_info(data)")
        table_columns = [row[1] for row in cursor.fetchall()]

    assert table_columns == column_codes


def test_generate_column_code_matches_normalization():
    assert generate_column_code("Revenue (%)") == "Revenue_percent"
    assert generate_column_code("Product/Category") == "Product_Category"
    assert generate_column_code("Customer (ID)") == "Customer_ID"
