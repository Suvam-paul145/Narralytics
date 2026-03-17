import os
import sqlite3

import pandas as pd


def _clean_column_name(name: str) -> str:
    cleaned = str(name).strip().replace('"', "").replace("'", "")
    cleaned = cleaned.replace("%", "percent").replace("/", "_").replace("-", "_")
    cleaned = cleaned.replace("(", "").replace(")", "")
    cleaned = "_".join(cleaned.split())
    return cleaned or "column"


def _normalize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    normalized = df.copy()
    normalized.columns = [_clean_column_name(column) for column in normalized.columns]

    for column_name in normalized.columns:
        series = normalized[column_name]
        if pd.api.types.is_object_dtype(series):
            parsed = pd.to_datetime(series, errors="coerce")
            if parsed.notna().sum() > len(normalized) * 0.8:
                normalized[column_name] = parsed.dt.strftime("%Y-%m-%d").fillna(series)
    return normalized


def load_csv_to_sqlite(df: pd.DataFrame, db_path: str, table_name: str = "data") -> str:
    os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)
    normalized = _normalize_dataframe(df)
    connection = sqlite3.connect(db_path)
    try:
        normalized.to_sql(table_name, connection, if_exists="replace", index=False)
    finally:
        connection.close()
    return db_path
