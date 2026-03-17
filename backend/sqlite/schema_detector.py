import pandas as pd


def detect_schema(df: pd.DataFrame) -> dict:
    schema = {
        "row_count": int(len(df)),
        "columns": [],
        "date_columns": [],
        "numeric_columns": [],
        "categorical_columns": [],
    }

    for column_name in df.columns:
        series = df[column_name]
        column_info = {
            "name": column_name,
            "null_count": int(series.isna().sum()),
            "unique_count": int(series.nunique(dropna=True)),
            "sample_values": [str(value) for value in series.dropna().unique()[:3]],
        }

        if pd.api.types.is_numeric_dtype(series):
            column_info["dtype"] = "numeric"
            column_info["min"] = float(series.min()) if len(series.dropna()) else None
            column_info["max"] = float(series.max()) if len(series.dropna()) else None
            column_info["mean"] = round(float(series.mean()), 2) if len(series.dropna()) else None
            schema["numeric_columns"].append(column_name)
        elif pd.api.types.is_datetime64_any_dtype(series):
            column_info["dtype"] = "datetime"
            if len(series.dropna()):
                column_info["min_date"] = str(series.min().date())
                column_info["max_date"] = str(series.max().date())
            schema["date_columns"].append(column_name)
        else:
            # Avoid Pandas 2.x warning by being explicit
            try:
                # 'format="mixed"' is the modern way to handle varied formats without warnings
                parsed = pd.to_datetime(series, errors="coerce", format="mixed")
            except (TypeError, ValueError):
                # Fallback for older pandas or specifically tricky parsing
                parsed = pd.to_datetime(series, errors="coerce")

            if parsed.notna().sum() > len(df) * 0.8:
                column_info["dtype"] = "datetime"
                if len(parsed.dropna()):
                    column_info["min_date"] = str(parsed.min().date())
                    column_info["max_date"] = str(parsed.max().date())
                schema["date_columns"].append(column_name)
            else:
                column_info["dtype"] = "categorical"
                schema["categorical_columns"].append(column_name)

        schema["columns"].append(column_info)

    return schema
