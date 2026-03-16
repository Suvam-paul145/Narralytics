# -*- coding: utf-8 -*-
from pathlib import Path

import pandas as pd

from sqlite.executor import execute_query
from sqlite.loader import load_csv_to_sqlite


if __name__ == "__main__":
    csv_path = Path(__file__).parent / "data" / "amazon_sales.csv"
    db_path = Path(__file__).parent / "uploads" / "amazon_sales_test.db"

    dataframe = pd.read_csv(csv_path, encoding="latin1")
    load_csv_to_sqlite(dataframe, str(db_path), table_name="data")
    sample = execute_query(str(db_path), "SELECT COUNT(*) AS row_count FROM data")
    print(sample)
