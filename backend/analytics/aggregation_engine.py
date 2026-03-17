from __future__ import annotations

from collections import defaultdict
from copy import deepcopy
from typing import Any


def _is_numeric(value: Any) -> bool:
    if isinstance(value, (int, float)):
        return True
    if isinstance(value, str):
        try:
            float(value)
            return True
        except ValueError:
            return False
    return False


def _to_number(value: Any) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return 0.0
    return 0.0


def _is_categorical_column(col: str, rows: list[dict[str, Any]], excluded: set[str]) -> bool:
    if col in excluded:
        return False
    values = [row.get(col) for row in rows if row.get(col) is not None]
    if not values:
        return False

    # Must look like labels, not a numeric measure.
    if all(_is_numeric(v) for v in values[:20]):
        return False

    distinct_count = len(set(str(v) for v in values))
    return distinct_count > 1


def _infer_color_by(
    x_key: str,
    y_key: str,
    rows: list[dict[str, Any]],
    schema: dict[str, Any] | None = None,
) -> str | None:
    if not rows:
        return None

    excluded = {x_key, y_key}

    # 1) Prefer known categorical columns from schema.
    if schema:
        categorical_cols = schema.get("categorical_columns", [])
        for col in categorical_cols:
            if _is_categorical_column(col, rows, excluded):
                return col

    # 2) Fallback: detect candidate from row keys.
    sample_keys = rows[0].keys()
    for col in sample_keys:
        if _is_categorical_column(col, rows, excluded):
            return col

    return None


def _aggregate_rows(
    rows: list[dict[str, Any]],
    x_key: str,
    y_key: str,
    color_by: str | None,
) -> list[dict[str, Any]]:
    if color_by:
        grouped: dict[tuple[str, str], float] = defaultdict(float)
        x_order: list[str] = []
        color_order: list[str] = []

        for row in rows:
            x_val = str(row.get(x_key, ""))
            c_val = str(row.get(color_by, ""))
            key = (x_val, c_val)
            grouped[key] += _to_number(row.get(y_key, 0))

            if x_val not in x_order:
                x_order.append(x_val)
            if c_val not in color_order:
                color_order.append(c_val)

        aggregated: list[dict[str, Any]] = []
        for x_val in x_order:
            for c_val in color_order:
                key = (x_val, c_val)
                if key in grouped:
                    aggregated.append(
                        {
                            x_key: x_val,
                            color_by: c_val,
                            y_key: round(grouped[key], 2),
                        }
                    )
        return aggregated

    grouped_x: dict[str, float] = defaultdict(float)
    order: list[str] = []

    for row in rows:
        x_val = str(row.get(x_key, ""))
        grouped_x[x_val] += _to_number(row.get(y_key, 0))
        if x_val not in order:
            order.append(x_val)

    return [{x_key: x_val, y_key: round(grouped_x[x_val], 2)} for x_val in order]


def normalize_chart_result(
    spec: dict[str, Any],
    rows: list[dict[str, Any]],
    schema: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """
    Normalize and cumulatively aggregate chart rows for stable visualization.

    Behavior:
    - If a second categorical dimension exists (explicit color_by or inferred),
      aggregate by (x_key, color_by, sum(y_key)).
    - Otherwise aggregate by (x_key, sum(y_key)).
    - If no aggregation is required, return rows unchanged.
    """
    if not rows:
        return spec, rows

    next_spec = deepcopy(spec)
    x_key = next_spec.get("x_key")
    y_key = next_spec.get("y_key")

    if not x_key or not y_key:
        return next_spec, rows

    # Only aggregate numeric measures.
    y_values = [row.get(y_key) for row in rows if row.get(y_key) is not None]
    if not y_values or not all(_is_numeric(v) for v in y_values[:30]):
        return next_spec, rows

    color_by = next_spec.get("color_by")
    if not color_by:
        color_by = _infer_color_by(x_key=x_key, y_key=y_key, rows=rows, schema=schema)
        if color_by:
            next_spec["color_by"] = color_by

    # Aggregate whenever x has duplicates, or color_by is present and varied.
    x_values = [str(row.get(x_key, "")) for row in rows]
    has_duplicate_x = len(set(x_values)) < len(x_values)

    if color_by:
        color_values = [str(row.get(color_by, "")) for row in rows if row.get(color_by) is not None]
        has_multiple_colors = len(set(color_values)) > 1
        if has_multiple_colors or has_duplicate_x:
            return next_spec, _aggregate_rows(rows, x_key=x_key, y_key=y_key, color_by=color_by)

    if has_duplicate_x:
        return next_spec, _aggregate_rows(rows, x_key=x_key, y_key=y_key, color_by=None)

    return next_spec, rows
