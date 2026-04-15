from __future__ import annotations

import math
import re
from typing import Any


QUESTION_WORDS = {
    "show",
    "give",
    "list",
    "tell",
    "find",
    "which",
    "what",
    "who",
    "compare",
    "analyze",
    "analyse",
    "plot",
    "chart",
    "graph",
    "visualize",
}

RANKING_WORDS = {"top", "bottom", "highest", "lowest", "best", "worst", "most", "least", "leading"}
TIME_WORDS = {"trend", "timeline", "monthly", "daily", "yearly", "weekly", "over time", "time series", "timeseries"}
SHARE_WORDS = {"share", "breakdown", "distribution", "proportion", "composition", "split"}
CORRELATION_WORDS = {"correlation", "relationship", "relate", "related", "versus", "vs", "impact"}
AVERAGE_WORDS = {"average", "avg", "mean"}
COUNT_WORDS = {"count", "how many", "number of"}
FUTURE_WORDS = {"future", "forecast", "predict", "prediction", "next month", "next quarter", "next year"}

REVENUE_ALIASES = ("total revenue", "revenue", "sales", "turnover", "gmv", "amount")
QUANTITY_ALIASES = ("quantity sold", "quantity", "units sold", "units", "volume")
DISCOUNT_ALIASES = ("discount percent", "discount", "discounted", "markdown", "offer", "coupon", "promo")
PRICE_ALIASES = ("discounted price", "selling price", "price", "unit price")
RATING_ALIASES = ("rating", "score", "satisfaction")
REVIEW_ALIASES = ("review count", "reviews", "review", "feedback count")
REGION_ALIASES = ("customer region", "region", "geography", "location", "market")
CATEGORY_ALIASES = ("product category", "category", "segment", "vertical")
PRODUCT_ALIASES = ("product id", "product", "item", "sku")
PAYMENT_ALIASES = ("payment method", "payment mode", "payment type", "payment", "upi", "card", "wallet", "cod")
CUSTOMER_ALIASES = ("customer", "customers", "buyer", "client")
PROFIT_ALIASES = ("profit", "profitable", "margin", "gross profit", "net profit")
BUSINESS_ALIASES = ("business", "businesses", "company", "companies")


def _normalize_text(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value).lower()).strip()


def _titleize(value: str) -> str:
    return str(value).replace("_", " ").strip().title()


def _contains_phrase(text: str, phrases: tuple[str, ...] | set[str]) -> bool:
    normalized = f" {text} "
    return any(f" {_normalize_text(phrase)} " in normalized for phrase in phrases)


def _extract_limit(question: str, default: int = 5, maximum: int = 20) -> int:
    match = re.search(r"\b(top|bottom)\s+(\d{1,2})\b", question)
    if match:
        return max(1, min(int(match.group(2)), maximum))

    match = re.search(r"\b(\d{1,2})\s+(items|products|regions|categories|customers|methods)\b", question)
    if match:
        return max(1, min(int(match.group(1)), maximum))

    return default


def _sorted_columns(schema: dict[str, Any], dtype: str | None = None) -> list[dict[str, Any]]:
    columns = schema.get("columns", []) if isinstance(schema, dict) else []
    ordered = []
    for column in columns:
        if not isinstance(column, dict):
            continue
        if dtype and column.get("dtype") != dtype:
            continue
        ordered.append(column)
    return ordered


def _column_name(column: dict[str, Any]) -> str:
    return str(column.get("name") or column.get("code") or "").strip()


def _column_code(column: dict[str, Any]) -> str:
    return str(column.get("code") or column.get("name") or "").strip()


def _column_tokens(column: dict[str, Any]) -> set[str]:
    normalized = _normalize_text(f"{column.get('name', '')} {column.get('code', '')}")
    return {token for token in normalized.split() if token}


def _score_column(column: dict[str, Any], aliases: tuple[str, ...], question: str) -> int:
    score = 0
    name = _normalize_text(_column_name(column))
    code = _normalize_text(_column_code(column))
    tokens = _column_tokens(column)
    question_text = f" {question} "
    question_tokens = {token for token in question.split() if token}

    if name and f" {name} " in question_text:
        score += 16
    if code and f" {code} " in question_text:
        score += 16
    overlap_with_question = len(tokens & question_tokens)
    if overlap_with_question:
        score += overlap_with_question * 2

    for alias in aliases:
        normalized_alias = _normalize_text(alias)
        alias_tokens = {token for token in normalized_alias.split() if token}

        if not normalized_alias:
            continue
        alias_in_question = f" {normalized_alias} " in question_text
        alias_token_overlap = len(alias_tokens & question_tokens)

        if not alias_in_question and not alias_token_overlap:
            continue

        score += 8 + alias_token_overlap
        if normalized_alias == name or normalized_alias == code:
            score += 12
        if normalized_alias in name or normalized_alias in code:
            score += 9
        overlap = len(tokens & alias_tokens)
        if overlap:
            score += overlap * 3

    return score


def _pick_best_column(
    schema: dict[str, Any],
    question: str,
    aliases: tuple[str, ...],
    dtype: str | None = None,
) -> dict[str, Any] | None:
    best_column = None
    best_score = 0

    for column in _sorted_columns(schema, dtype=dtype):
        score = _score_column(column, aliases, question)
        if score > best_score:
            best_score = score
            best_column = column

    return best_column


def _pick_metric_column(schema: dict[str, Any], question: str) -> tuple[dict[str, Any] | None, str]:
    numeric_columns = _sorted_columns(schema, dtype="numeric")
    if not numeric_columns:
        return None, "sum"

    # First, detect explicit intent-driven aggregation keywords.
    explicit_aggregation = "avg" if _contains_phrase(question, AVERAGE_WORDS) else "sum"
    if _contains_phrase(question, COUNT_WORDS):
        explicit_aggregation = "count"

    # Score all numeric alias families and choose the strongest match instead of
    # returning the first non-null candidate (which can incorrectly bias to revenue).
    metric_families: list[tuple[tuple[str, ...], str]] = [
        (REVENUE_ALIASES, "sum"),
        (QUANTITY_ALIASES, "sum"),
        (DISCOUNT_ALIASES, "avg"),
        (PRICE_ALIASES, "avg"),
        (RATING_ALIASES, "avg"),
        (REVIEW_ALIASES, "sum"),
    ]
    best_metric: dict[str, Any] | None = None
    best_score = -1
    default_aggregation = explicit_aggregation

    for aliases, preferred_aggregation in metric_families:
        candidate = _pick_best_column(schema, question, aliases, dtype="numeric")
        if candidate is None:
            continue
        score = _score_column(candidate, aliases, question)
        if score > best_score:
            best_score = score
            best_metric = candidate
            default_aggregation = preferred_aggregation

    if best_metric is not None and best_score > 0:
        return best_metric, explicit_aggregation if explicit_aggregation != "sum" else default_aggregation

    revenue_default = _pick_best_column(schema, "revenue sales total amount", REVENUE_ALIASES, dtype="numeric")
    return revenue_default or numeric_columns[0], explicit_aggregation


def _pick_dimension_column(schema: dict[str, Any], question: str) -> dict[str, Any] | None:
    categorical_columns = _sorted_columns(schema, dtype="categorical")
    if not categorical_columns:
        return None

    alias_groups = (
        REGION_ALIASES,
        CATEGORY_ALIASES,
        PAYMENT_ALIASES,
        PRODUCT_ALIASES,
    )

    best_column = None
    best_score = 0
    for aliases in alias_groups:
        candidate = _pick_best_column(schema, question, aliases, dtype="categorical")
        if candidate is None:
            continue
        score = _score_column(candidate, aliases, question)
        if score > best_score:
            best_score = score
            best_column = candidate

    if best_column is not None:
        return best_column

    region_default = _pick_best_column(schema, "customer region geography", REGION_ALIASES, dtype="categorical")
    category_default = _pick_best_column(schema, "product category", CATEGORY_ALIASES, dtype="categorical")
    payment_default = _pick_best_column(schema, "payment method", PAYMENT_ALIASES, dtype="categorical")
    product_default = _pick_best_column(schema, "product id product", PRODUCT_ALIASES, dtype="categorical")

    return region_default or category_default or payment_default or product_default or categorical_columns[0]


def _pick_customer_entity(schema: dict[str, Any]) -> dict[str, Any] | None:
    for column in _sorted_columns(schema, dtype="categorical"):
        normalized_name = _normalize_text(_column_name(column))
        if "customer" in normalized_name and "region" not in normalized_name:
            return column
    return None


def _pick_profit_metric(schema: dict[str, Any]) -> dict[str, Any] | None:
    for column in _sorted_columns(schema, dtype="numeric"):
        normalized_name = _normalize_text(_column_name(column))
        if "profit" in normalized_name or "margin" in normalized_name:
            return column
    return None


def _pick_date_column(schema: dict[str, Any]) -> dict[str, Any] | None:
    date_columns = _sorted_columns(schema, dtype="datetime")
    if date_columns:
        return date_columns[0]
    return None


def _determine_time_bucket(question: str) -> tuple[str, str]:
    if "year" in question or "yearly" in question:
        return "%Y", "year"
    if "week" in question or "weekly" in question:
        return "%Y-W%W", "week"
    if "day" in question or "daily" in question:
        return "%Y-%m-%d", "day"
    return "%Y-%m", "month"


def _format_value(value: Any) -> str:
    if isinstance(value, (int, float)):
        if isinstance(value, float) and not value.is_integer():
            return f"{value:,.2f}"
        return f"{int(value):,}"
    return str(value)


def _format_change(base: float, current: float) -> str:
    if abs(base) < 1e-9:
        return "0.0%"
    return f"{((current - base) / base) * 100:.1f}%"


def _build_invalid_reason(schema: dict[str, Any], message: str) -> str:
    column_names = [_column_name(column) for column in _sorted_columns(schema)]
    sample = ", ".join(column_names[:6])
    if len(column_names) > 6:
        sample += ", ..."
    return f"{message} Please ask about the uploaded dataset columns such as {sample}."


def plan_rule_based_query(question: str, schema: dict[str, Any]) -> dict[str, Any]:
    normalized_question = _normalize_text(question)
    if not normalized_question:
        return {
            "matched": False,
            "invalid": True,
            "reason": "Please enter a query about your dataset.",
        }

    if _contains_phrase(normalized_question, CUSTOMER_ALIASES) and not _contains_phrase(
        normalized_question,
        ("customer region", "customer regions"),
    ):
        customer_column = _pick_customer_entity(schema)
        if customer_column is None:
            return {
                "matched": False,
                "invalid": True,
                "reason": _build_invalid_reason(
                    schema,
                    "This dataset does not contain a customer name or customer ID column.",
                ),
            }

    if _contains_phrase(normalized_question, PROFIT_ALIASES):
        profit_metric = _pick_profit_metric(schema)
        if profit_metric is None:
            return {
                "matched": False,
                "invalid": True,
                "reason": _build_invalid_reason(
                    schema,
                    "This dataset does not contain profit or margin data.",
                ),
            }

    if _contains_phrase(normalized_question, FUTURE_WORDS) and _contains_phrase(normalized_question, BUSINESS_ALIASES + PROFIT_ALIASES):
        return {
            "matched": False,
            "invalid": True,
            "reason": _build_invalid_reason(
                schema,
                "That future-looking business question cannot be answered from this sales dataset alone.",
            ),
        }

    schema_tokens: set[str] = set()
    for column in _sorted_columns(schema):
        schema_tokens.update(_column_tokens(column))
    has_direct_column_match = any(
        token in schema_tokens for token in normalized_question.split() if len(token) > 2
    )
    has_business_signal = any(
        _contains_phrase(
            normalized_question,
            aliases,
        )
        for aliases in (
            REVENUE_ALIASES,
            QUANTITY_ALIASES,
            DISCOUNT_ALIASES,
            PRICE_ALIASES,
            RATING_ALIASES,
            REVIEW_ALIASES,
            REGION_ALIASES,
            CATEGORY_ALIASES,
            PRODUCT_ALIASES,
            PAYMENT_ALIASES,
            CUSTOMER_ALIASES,
            PROFIT_ALIASES,
        )
    )
    has_question_signal = (
        _contains_phrase(normalized_question, QUESTION_WORDS)
        or _contains_phrase(normalized_question, RANKING_WORDS)
        or _contains_phrase(normalized_question, TIME_WORDS)
        or _contains_phrase(normalized_question, SHARE_WORDS)
        or _contains_phrase(normalized_question, CORRELATION_WORDS)
        or _contains_phrase(normalized_question, AVERAGE_WORDS)
        or _contains_phrase(normalized_question, COUNT_WORDS)
    )

    if not has_direct_column_match and not has_business_signal and not has_question_signal:
        return {
            "matched": False,
            "invalid": True,
            "reason": _build_invalid_reason(
                schema,
                "That query does not appear to be related to the uploaded dataset.",
            ),
        }

    if _contains_phrase(normalized_question, CORRELATION_WORDS):
        return _build_correlation_plan(normalized_question, schema)

    if _contains_phrase(normalized_question, TIME_WORDS) or "trend" in normalized_question:
        return _build_time_plan(normalized_question, schema)

    if any(word in normalized_question.split() for word in RANKING_WORDS) or _contains_phrase(normalized_question, SHARE_WORDS):
        return _build_group_plan(normalized_question, schema)

    if has_business_signal or has_direct_column_match:
        return _build_group_plan(normalized_question, schema)

    return {"matched": False, "invalid": False}


def _build_group_plan(question: str, schema: dict[str, Any]) -> dict[str, Any]:
    metric_column, aggregation = _pick_metric_column(schema, question)
    dimension_column = _pick_dimension_column(schema, question)

    if metric_column is None or dimension_column is None:
        return {"matched": False, "invalid": False}

    metric_name = _column_name(metric_column)
    metric_code = _column_code(metric_column)
    dimension_name = _column_name(dimension_column)
    dimension_code = _column_code(dimension_column)

    is_share = _contains_phrase(question, SHARE_WORDS)
    chart_type = "pie" if is_share else "bar"
    sort_direction = "asc" if any(word in question.split() for word in {"bottom", "lowest", "least", "worst"}) else "desc"
    limit = _extract_limit(question, default=6 if chart_type == "pie" else 5, maximum=12 if chart_type == "pie" else 20)
    if chart_type == "pie":
        limit = min(limit, 6)

    if aggregation == "count":
        value_alias = "record_count"
        aggregate_expression = f'COUNT("{metric_code}")'
    else:
        value_alias = metric_code
        aggregate_expression = f'ROUND({aggregation.upper()}("{metric_code}"), 2)'

    sql = (
        f'SELECT "{dimension_code}" AS "{dimension_code}", '
        f'{aggregate_expression} AS "{value_alias}" '
        f'FROM data '
        f'WHERE "{dimension_code}" IS NOT NULL '
        f'GROUP BY "{dimension_code}" '
        f'ORDER BY "{value_alias}" {"ASC" if sort_direction == "asc" else "DESC"} '
        f"LIMIT {limit}"
    )

    title_metric = "Count" if aggregation == "count" else _titleize(metric_name)
    chart_title = f"{'Top' if sort_direction == 'desc' else 'Bottom'} {limit} {_titleize(dimension_name)} by {title_metric}"
    if "highest" in question or "most" in question:
        chart_title = f"{_titleize(dimension_name)} by {title_metric}"
    if chart_type == "pie":
        chart_title = f"{title_metric} Share by {_titleize(dimension_name)}"

    return {
        "matched": True,
        "invalid": False,
        "specs": [
            {
                "label": "Rule-Based Chart",
                "approach": "deterministic",
                "chart_type": chart_type,
                "x_key": dimension_code,
                "y_key": value_alias,
                "color_by": None,
                "sql": sql,
                "title": chart_title,
                "insight": "",
                "category": "distribution" if chart_type == "pie" else "ranking",
                "aggregation": aggregation,
            }
        ],
    }


def _build_time_plan(question: str, schema: dict[str, Any]) -> dict[str, Any]:
    date_column = _pick_date_column(schema)
    metric_column, aggregation = _pick_metric_column(schema, question)

    if date_column is None or metric_column is None:
        return {"matched": False, "invalid": False}

    date_name = _column_name(date_column)
    date_code = _column_code(date_column)
    metric_name = _column_name(metric_column)
    metric_code = _column_code(metric_column)
    bucket_format, bucket_suffix = _determine_time_bucket(question)
    bucket_alias = f"{date_code}_{bucket_suffix}"

    if aggregation == "count":
        value_alias = "record_count"
        aggregate_expression = f'COUNT("{metric_code}")'
    else:
        value_alias = metric_code
        aggregate_expression = f'ROUND({aggregation.upper()}("{metric_code}"), 2)'

    sql = (
        f"SELECT strftime('{bucket_format}', \"{date_code}\") AS \"{bucket_alias}\", "
        f'{aggregate_expression} AS "{value_alias}" '
        f"FROM data "
        f'WHERE "{date_code}" IS NOT NULL '
        f'GROUP BY "{bucket_alias}" '
        f'ORDER BY "{bucket_alias}" ASC '
        f"LIMIT 60"
    )

    return {
        "matched": True,
        "invalid": False,
        "specs": [
            {
                "label": "Rule-Based Trend",
                "approach": "deterministic",
                "chart_type": "line",
                "x_key": bucket_alias,
                "y_key": value_alias,
                "color_by": None,
                "sql": sql,
                "title": f"{_titleize(metric_name)} Trend by {_titleize(bucket_suffix)}",
                "insight": "",
                "category": "trend",
                "aggregation": aggregation,
            }
        ],
    }


def _build_correlation_plan(question: str, schema: dict[str, Any]) -> dict[str, Any]:
    numeric_columns = _sorted_columns(schema, dtype="numeric")
    if len(numeric_columns) < 2:
        return {"matched": False, "invalid": False}

    x_column = None
    y_column = None

    if _contains_phrase(question, DISCOUNT_ALIASES):
        x_column = _pick_best_column(schema, question, DISCOUNT_ALIASES, dtype="numeric")
    if _contains_phrase(question, PRICE_ALIASES) and x_column is None:
        x_column = _pick_best_column(schema, question, PRICE_ALIASES, dtype="numeric")
    if _contains_phrase(question, RATING_ALIASES) and x_column is None:
        x_column = _pick_best_column(schema, question, RATING_ALIASES, dtype="numeric")

    if _contains_phrase(question, REVENUE_ALIASES):
        y_column = _pick_best_column(schema, question, REVENUE_ALIASES, dtype="numeric")
    if y_column is None and _contains_phrase(question, QUANTITY_ALIASES):
        y_column = _pick_best_column(schema, question, QUANTITY_ALIASES, dtype="numeric")

    if x_column is None:
        x_column = _pick_best_column(schema, "discount price rating", DISCOUNT_ALIASES + PRICE_ALIASES + RATING_ALIASES, dtype="numeric")
    if y_column is None:
        y_column = _pick_best_column(schema, "revenue sales quantity", REVENUE_ALIASES + QUANTITY_ALIASES, dtype="numeric")

    if x_column is None or y_column is None:
        return {"matched": False, "invalid": False}

    if _column_code(x_column) == _column_code(y_column):
        fallback = [column for column in numeric_columns if _column_code(column) != _column_code(x_column)]
        if not fallback:
            return {"matched": False, "invalid": False}
        y_column = fallback[0]

    dimension_column = _pick_dimension_column(schema, question) if " by " in f" {question} " else None

    x_name = _column_name(x_column)
    x_code = _column_code(x_column)
    y_name = _column_name(y_column)
    y_code = _column_code(y_column)

    if dimension_column is not None:
        dimension_name = _column_name(dimension_column)
        dimension_code = _column_code(dimension_column)
        sql = (
            f'SELECT "{dimension_code}" AS "{dimension_code}", '
            f'ROUND(AVG("{x_code}"), 2) AS "{x_code}", '
            f'ROUND(AVG("{y_code}"), 2) AS "{y_code}" '
            f"FROM data "
            f'WHERE "{dimension_code}" IS NOT NULL '
            f'AND "{x_code}" IS NOT NULL '
            f'AND "{y_code}" IS NOT NULL '
            f'GROUP BY "{dimension_code}" '
            f'ORDER BY "{y_code}" DESC '
            f"LIMIT 20"
        )
        color_by = dimension_code
        title = f"{_titleize(y_name)} vs {_titleize(x_name)} by {_titleize(dimension_name)}"
    else:
        sql = (
            f'SELECT ROUND("{x_code}", 2) AS "{x_code}", '
            f'ROUND("{y_code}", 2) AS "{y_code}" '
            f"FROM data "
            f'WHERE "{x_code}" IS NOT NULL AND "{y_code}" IS NOT NULL '
            f"LIMIT 300"
        )
        color_by = None
        title = f"{_titleize(y_name)} vs {_titleize(x_name)}"

    return {
        "matched": True,
        "invalid": False,
        "specs": [
            {
                "label": "Rule-Based Correlation",
                "approach": "deterministic",
                "chart_type": "scatter",
                "x_key": x_code,
                "y_key": y_code,
                "color_by": color_by,
                "sql": sql,
                "title": title,
                "insight": "",
                "category": "correlation",
                "aggregation": "avg" if dimension_column is not None else None,
            }
        ],
    }


def summarize_chart_data(
    question: str,
    chart_title: str,
    chart_type: str,
    data: list[dict[str, Any]],
    x_key: str,
    y_key: str,
) -> str:
    if not data:
        return "No data was returned for this query."

    numeric_rows = []
    for row in data:
        value = row.get(y_key)
        try:
            numeric_rows.append((row, float(value)))
        except (TypeError, ValueError):
            continue

    if not numeric_rows:
        return f"{chart_title} returned values, but they were not numeric enough to summarize reliably."

    if chart_type in {"bar", "pie"}:
        ranked = sorted(numeric_rows, key=lambda item: item[1], reverse=True)
        top_row, top_value = ranked[0]
        label = top_row.get(x_key, "Unknown")
        total = sum(value for _, value in ranked)
        message = f"{label} is the strongest segment at {_format_value(top_value)}."

        if chart_type == "pie" and total > 0:
            share = (top_value / total) * 100
            message += f" It contributes {share:.1f}% of the displayed total."
        elif len(ranked) > 1:
            second_label = ranked[1][0].get(x_key, "Unknown")
            second_value = ranked[1][1]
            gap = top_value - second_value
            message += f" It is ahead of {second_label} by {_format_value(gap)}."

        if total > 0 and len(ranked) > 1:
            message += f" Across the displayed groups, the total is {_format_value(total)}."
        return message

    if chart_type in {"line", "area"}:
        ordered = sorted(numeric_rows, key=lambda item: str(item[0].get(x_key, "")))
        start_row, start_value = ordered[0]
        end_row, end_value = ordered[-1]
        high_row, high_value = max(ordered, key=lambda item: item[1])
        change = _format_change(start_value, end_value)
        direction = "up" if end_value >= start_value else "down"
        return (
            f"{chart_title} moved {direction} from {_format_value(start_value)} in {start_row.get(x_key)} "
            f"to {_format_value(end_value)} in {end_row.get(x_key)} ({change}). "
            f"The peak in the displayed range is {_format_value(high_value)} at {high_row.get(x_key)}."
        )

    if chart_type == "scatter":
        x_values: list[float] = []
        y_values: list[float] = []
        for row in data:
            try:
                x_values.append(float(row.get(x_key)))
                y_values.append(float(row.get(y_key)))
            except (TypeError, ValueError):
                continue

        if len(x_values) < 2:
            return f"{chart_title} does not have enough numeric points to estimate a relationship."

        correlation = _pearson(x_values, y_values)
        if correlation >= 0.35:
            relation = "a positive relationship"
        elif correlation <= -0.35:
            relation = "a negative relationship"
        else:
            relation = "only a weak relationship"

        return (
            f"{chart_title} shows {relation} between {_titleize(x_key)} and {_titleize(y_key)} "
            f"(correlation {correlation:.2f})."
        )

    return f"{chart_title} returned {len(data)} rows of data."


def _pearson(x_values: list[float], y_values: list[float]) -> float:
    count = min(len(x_values), len(y_values))
    if count < 2:
        return 0.0

    mean_x = sum(x_values[:count]) / count
    mean_y = sum(y_values[:count]) / count
    numerator = sum((x - mean_x) * (y - mean_y) for x, y in zip(x_values[:count], y_values[:count]))
    denominator_x = math.sqrt(sum((x - mean_x) ** 2 for x in x_values[:count]))
    denominator_y = math.sqrt(sum((y - mean_y) ** 2 for y in y_values[:count]))

    if denominator_x == 0 or denominator_y == 0:
        return 0.0

    return numerator / (denominator_x * denominator_y)


def build_dashboard_fallback_specs(schema: dict[str, Any]) -> list[dict[str, Any]]:
    fallback_specs: list[dict[str, Any]] = []
    dimension_column = _pick_dimension_column(schema, "region category payment product")
    revenue_column = _pick_best_column(schema, "revenue sales total", REVENUE_ALIASES, dtype="numeric")
    quantity_column = _pick_best_column(schema, "quantity units sold", QUANTITY_ALIASES, dtype="numeric")
    rating_column = _pick_best_column(schema, "rating score", RATING_ALIASES, dtype="numeric")
    review_column = _pick_best_column(schema, "review reviews", REVIEW_ALIASES, dtype="numeric")
    discount_column = _pick_best_column(schema, "discount markdown", DISCOUNT_ALIASES, dtype="numeric")
    date_column = _pick_date_column(schema)

    if date_column is not None and revenue_column is not None:
        fallback_specs.extend(_build_time_plan("monthly revenue trend", schema).get("specs", []))

    if dimension_column is not None and revenue_column is not None:
        fallback_specs.extend(_build_group_plan("top 5 region by revenue", schema).get("specs", []))

    if _pick_best_column(schema, "product category", CATEGORY_ALIASES, dtype="categorical") is not None and quantity_column is not None:
        fallback_specs.extend(_build_group_plan("top 5 product category by quantity sold", schema).get("specs", []))

    if discount_column is not None and revenue_column is not None:
        fallback_specs.extend(_build_correlation_plan("revenue vs discount correlation by category", schema).get("specs", []))

    if rating_column is not None and dimension_column is not None:
        fallback_specs.extend(_build_group_plan("average rating by category", schema).get("specs", []))

    if review_column is not None and dimension_column is not None:
        fallback_specs.extend(_build_group_plan("top 5 category by review count", schema).get("specs", []))

    deduped: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str, str]] = set()
    for spec in fallback_specs:
        signature = (
            str(spec.get("chart_type")),
            str(spec.get("x_key")),
            str(spec.get("y_key")),
            str(spec.get("sql")),
        )
        if signature in seen:
            continue
        seen.add(signature)
        deduped.append(spec)

    return deduped[:6]
