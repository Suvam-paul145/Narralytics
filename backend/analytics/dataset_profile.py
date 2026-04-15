from __future__ import annotations

from io import StringIO
import re
from typing import Any

import pandas as pd

from analytics.deterministic_engine import (
    build_dashboard_fallback_specs,
    plan_rule_based_query,
)


EMBEDDED_CSV_HEADER_HINTS = (
    "order",
    "date",
    "revenue",
    "sales",
    "price",
    "quantity",
    "region",
    "category",
    "customer",
    "payment",
    "rating",
    "review",
)


def _sanitize_candidate_csv_line(line: str) -> str:
    cleaned = line.strip().strip("\x00")
    lowered = cleaned.lower()

    # Common HTML-webarchive wrappers where CSV begins after a quoted pre block.
    for marker in ('">', "</pre>"):
        if marker in cleaned:
            cleaned = cleaned.split(marker)[-1].strip()
    if "<pre" in lowered and ">" in cleaned:
        cleaned = cleaned.split(">")[-1].strip()

    return cleaned


def _looks_like_header_token(token: str) -> bool:
    value = token.strip().strip('"').strip()
    if not value:
        return False
    lowered = value.lower()

    # Exclude obvious data-like tokens.
    if re.fullmatch(r"\d+(\.\d+)?", lowered):
        return False
    if re.fullmatch(r"\d{1,2}[-/]\d{1,2}[-/]\d{2,4}", lowered):
        return False
    if re.fullmatch(r"\d{4}[-/]\d{1,2}[-/]\d{1,2}", lowered):
        return False

    return bool(re.fullmatch(r"[A-Za-z_][A-Za-z0-9_ %:/().-]*", value))


def _is_likely_bad_header(columns: list[str]) -> bool:
    if not columns:
        return True

    parsed = [str(column).strip() for column in columns]
    numeric_like = 0
    date_like = 0
    unnamed_like = 0

    for column in parsed:
        lowered = column.lower()
        if lowered.startswith("unnamed"):
            unnamed_like += 1
        if re.fullmatch(r"\d+(\.\d+)?", lowered):
            numeric_like += 1
        if re.fullmatch(r"\d{1,2}[-/]\d{1,2}[-/]\d{2,4}", lowered) or re.fullmatch(
            r"\d{4}[-/]\d{1,2}[-/]\d{1,2}",
            lowered,
        ):
            date_like += 1

    total = len(parsed)
    if unnamed_like >= max(2, total // 2):
        return True
    if numeric_like >= max(2, total // 2):
        return True
    if date_like >= max(2, total // 3):
        return True

    return False


def extract_embedded_csv_text(content: bytes) -> str | None:
    """Recover CSV text when the uploaded file is wrapped in a web archive or noisy text blob."""
    decoded = content.decode("utf-8", errors="ignore")
    if not decoded.strip():
        decoded = content.decode("latin1", errors="ignore")

    lines = [_sanitize_candidate_csv_line(line) for line in decoded.splitlines()]
    best_index = None
    best_score = -1

    for index, line in enumerate(lines):
        if line.count(",") < 2:
            continue

        sanitized = line.strip().strip('"')
        lowered = sanitized.lower()
        tokens = [token.strip().strip('"') for token in sanitized.split(",")]
        if len(tokens) < 3:
            continue

        token_score = 0
        header_like_count = sum(1 for token in tokens if _looks_like_header_token(token))
        data_like_count = len(tokens) - header_like_count

        if any(any(hint in token.lower() for hint in EMBEDDED_CSV_HEADER_HINTS) for token in tokens):
            token_score += 10
        if header_like_count >= max(3, len(tokens) // 2):
            token_score += 10
        if data_like_count >= max(3, len(tokens) // 2):
            token_score -= 8
        if all(re.fullmatch(r"[A-Za-z0-9_ %:/().-]+", token or "") for token in tokens[: min(len(tokens), 10)]):
            token_score += 6
        if "webresourcedata" in lowered or "bplist00" in lowered:
            token_score -= 20

        similar_rows = 0
        for probe in lines[index + 1 : index + 6]:
            if not probe:
                continue
            if abs(probe.count(",") - line.count(",")) <= 2:
                similar_rows += 1
        token_score += similar_rows * 3

        if token_score > best_score:
            best_score = token_score
            best_index = index

    if best_index is None or best_score < 8:
        return None

    extracted = "\n".join(line for line in lines[best_index:] if line)
    return extracted.strip() or None


def parse_csv_text(csv_text: str) -> pd.DataFrame:
    return pd.read_csv(StringIO(csv_text))


def is_suspicious_dataframe(df: pd.DataFrame) -> bool:
    if df.empty or len(df.columns) == 0:
        return True

    column_names = [str(column) for column in df.columns]
    if _is_likely_bad_header(column_names):
        return True

    unnamed_count = sum(name.lower().startswith("unnamed") for name in column_names)
    weird_count = sum(
        "bplist00" in name.lower()
        or "webresourcedata" in name.lower()
        or name.count(",") > 4
        for name in column_names
    )

    if unnamed_count >= max(2, len(column_names) // 2):
        return True
    if weird_count > 0:
        return True

    return False


def clean_uploaded_dataframe(df: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, Any]]:
    cleaned = df.copy()
    original_column_count = len(cleaned.columns)
    dropped_columns: list[str] = []

    # Drop empty rows first.
    cleaned = cleaned.dropna(axis=0, how="all")

    empty_columns = [str(column) for column in cleaned.columns if cleaned[column].isna().all()]
    if empty_columns:
        dropped_columns.extend(empty_columns)
        cleaned = cleaned.drop(columns=empty_columns, errors="ignore")

    kept_columns = []
    for column in cleaned.columns:
        name = str(column).strip()
        if not name:
            dropped_columns.append(str(column))
            continue
        if name.lower().startswith("unnamed"):
            series = cleaned[column]
            if series.isna().all() or series.nunique(dropna=True) <= 1:
                dropped_columns.append(name)
                continue
        kept_columns.append(column)

    if kept_columns:
        cleaned = cleaned[kept_columns]

    cleaned.columns = [str(column).strip() for column in cleaned.columns]

    report = {
        "original_column_count": original_column_count,
        "cleaned_column_count": len(cleaned.columns),
        "dropped_columns": dropped_columns,
        "dropped_column_count": len(dropped_columns),
        "row_count_after_cleaning": int(len(cleaned)),
    }
    return cleaned, report


def build_dataset_profile(schema: dict[str, Any], dataset_name: str | None = None) -> dict[str, Any]:
    columns = schema.get("columns", [])
    numeric_columns = [column for column in columns if column.get("dtype") == "numeric"]
    categorical_columns = [column for column in columns if column.get("dtype") == "categorical"]
    date_columns = [column for column in columns if column.get("dtype") == "datetime"]

    primary_metric = numeric_columns[0]["name"] if numeric_columns else None
    primary_dimension = categorical_columns[0]["name"] if categorical_columns else None
    primary_time = date_columns[0]["name"] if date_columns else None

    recommended_questions = _build_recommended_questions(schema)
    dashboard_specs = _build_profile_dashboard_specs(schema, recommended_questions, requirements=None)
    focus_areas = _infer_focus_areas(schema)
    relationships = _infer_relationships(schema)

    dataset_label = dataset_name or "the uploaded dataset"
    summary_parts = [
        f"{dataset_label} contains {schema.get('row_count', 0):,} rows",
        f"{len(numeric_columns)} numeric fields",
        f"{len(categorical_columns)} categorical fields",
    ]
    if primary_time:
        summary_parts.append(f"and tracks time through {primary_time}")

    business_summary = ". ".join(summary_parts) + "."
    if primary_metric and primary_dimension:
        business_summary += (
            f" The strongest starting analysis is usually {primary_metric} by {primary_dimension}."
        )

    return {
        "summary": business_summary,
        "primary_metric": primary_metric,
        "primary_dimension": primary_dimension,
        "primary_time_dimension": primary_time,
        "focus_areas": focus_areas,
        "recommended_questions": recommended_questions,
        "relationships": relationships,
        "recommended_dashboard_requirements": _recommended_briefs(focus_areas),
        "dashboard_seed_specs": dashboard_specs,
    }


def build_profile_dashboard_specs(
    schema: dict[str, Any],
    profile: dict[str, Any] | None,
    requirements: str | None,
) -> list[dict[str, Any]]:
    recommended_questions = []
    if profile and isinstance(profile.get("recommended_questions"), list):
        recommended_questions = [str(question) for question in profile["recommended_questions"]]

    return _build_profile_dashboard_specs(schema, recommended_questions, requirements=requirements)


def _build_profile_dashboard_specs(
    schema: dict[str, Any],
    recommended_questions: list[str],
    requirements: str | None,
) -> list[dict[str, Any]]:
    candidate_questions = list(recommended_questions)
    requirement_text = str(requirements or "").lower().strip()
    dynamic_questions = _build_requirement_driven_questions(schema, requirement_text)
    candidate_questions = [*dynamic_questions, *candidate_questions]

    if requirement_text:
        for extra in _build_requirement_driven_questions(schema, requirement_text):
            if extra not in candidate_questions:
                candidate_questions.append(extra)

    specs: list[dict[str, Any]] = []
    seen_sql: set[str] = set()

    for question in candidate_questions:
        planned = plan_rule_based_query(question, schema)
        for spec in planned.get("specs", []):
            sql = str(spec.get("sql") or "")
            if not sql or sql in seen_sql:
                continue
            seen_sql.add(sql)
            specs.append(spec)

    for spec in build_dashboard_fallback_specs(schema):
        sql = str(spec.get("sql") or "")
        if not sql or sql in seen_sql:
            continue
        seen_sql.add(sql)
        specs.append(spec)

    return specs[:8]


def _build_recommended_questions(schema: dict[str, Any]) -> list[str]:
    base_questions = _build_schema_driven_questions(schema)

    valid_questions: list[str] = []
    seen: set[str] = set()
    for question in base_questions:
        planned = plan_rule_based_query(question, schema)
        if planned.get("matched") and question not in seen:
            valid_questions.append(question)
            seen.add(question)

    return valid_questions[:6]


def _pick_primary_metric(schema: dict[str, Any]) -> str | None:
    numeric_columns = [str(column.get("name", "")) for column in schema.get("columns", []) if column.get("dtype") == "numeric"]
    if not numeric_columns:
        return None

    priority_tokens = ("revenue", "sales", "amount", "profit", "value", "price", "quantity", "count")
    for token in priority_tokens:
        for column in numeric_columns:
            if token in column.lower():
                return column

    return numeric_columns[0]


def _pick_dimension(schema: dict[str, Any], preferred_tokens: tuple[str, ...] = ()) -> str | None:
    categorical_columns = [str(column.get("name", "")) for column in schema.get("columns", []) if column.get("dtype") == "categorical"]
    if not categorical_columns:
        return None

    for token in preferred_tokens:
        for column in categorical_columns:
            if token in column.lower():
                return column

    return categorical_columns[0]


def _pick_time_dimension(schema: dict[str, Any]) -> str | None:
    date_columns = [str(column.get("name", "")) for column in schema.get("columns", []) if column.get("dtype") == "datetime"]
    return date_columns[0] if date_columns else None


def _build_schema_driven_questions(schema: dict[str, Any]) -> list[str]:
    metric = _pick_primary_metric(schema)
    dimension = _pick_dimension(schema)
    time_dimension = _pick_time_dimension(schema)
    region_dimension = _pick_dimension(schema, ("region", "country", "state", "city", "market", "territory"))
    category_dimension = _pick_dimension(schema, ("category", "segment", "product", "brand", "type", "channel"))

    questions: list[str] = []
    if metric and time_dimension:
        questions.append(f"Show {metric} trend over {time_dimension}")
    if metric and region_dimension:
        questions.append(f"Show top 5 {region_dimension} by total {metric}")
    if metric and category_dimension:
        questions.append(f"Which {category_dimension} drives the highest {metric}?")
    if metric and dimension:
        questions.append(f"Compare {metric} across {dimension}")
    if len(schema.get("numeric_columns", [])) >= 2:
        numeric_columns = [str(value) for value in schema.get("numeric_columns", [])]
        questions.append(f"Show correlation between {numeric_columns[0]} and {numeric_columns[1]}")
    if dimension:
        questions.append(f"Show distribution of records by {dimension}")

    if not questions:
        questions.append("Show top insights from this dataset")

    return questions


def _build_requirement_driven_questions(schema: dict[str, Any], requirement_text: str) -> list[str]:
    if not requirement_text:
        return []

    metric = _pick_primary_metric(schema)
    time_dimension = _pick_time_dimension(schema)
    region_dimension = _pick_dimension(schema, ("region", "country", "state", "city", "market", "territory"))
    category_dimension = _pick_dimension(schema, ("category", "segment", "product", "brand", "type", "channel"))
    generic_dimension = _pick_dimension(schema)

    dynamic_questions: list[str] = []
    if metric and time_dimension and any(token in requirement_text for token in ("trend", "growth", "time", "monthly", "daily", "weekly", "forecast")):
        dynamic_questions.append(f"Show {metric} trend over {time_dimension}")
    if metric and region_dimension and any(token in requirement_text for token in ("region", "market", "geo", "geography", "location")):
        dynamic_questions.append(f"Show top 5 {region_dimension} by total {metric}")
    if metric and category_dimension and any(token in requirement_text for token in ("category", "product", "segment", "mix", "ranking", "rank")):
        dynamic_questions.append(f"Show top 5 {category_dimension} by total {metric}")
    if generic_dimension and any(token in requirement_text for token in ("distribution", "composition", "share", "split")):
        dynamic_questions.append(f"Show distribution of records by {generic_dimension}")
    if len(schema.get("numeric_columns", [])) >= 2 and any(token in requirement_text for token in ("correlation", "relationship", "impact", "outlier")):
        numeric_columns = [str(value) for value in schema.get("numeric_columns", [])]
        dynamic_questions.append(f"Show correlation between {numeric_columns[0]} and {numeric_columns[1]}")

    return dynamic_questions


def _infer_focus_areas(schema: dict[str, Any]) -> list[str]:
    focus_areas: list[str] = []
    column_names = " ".join(str(column.get("name", "")).lower() for column in schema.get("columns", []))

    if schema.get("date_columns"):
        focus_areas.append("trend")
    if "region" in column_names:
        focus_areas.append("regional performance")
    if "category" in column_names or "product" in column_names:
        focus_areas.append("product mix")
    if "payment" in column_names:
        focus_areas.append("payment behavior")
    if "rating" in column_names or "review" in column_names:
        focus_areas.append("customer feedback")
    if "discount" in column_names:
        focus_areas.append("pricing and discount impact")

    return focus_areas[:5]


def _infer_relationships(schema: dict[str, Any]) -> list[str]:
    relationships: list[str] = []
    column_names = " ".join(str(column.get("name", "")).lower() for column in schema.get("columns", []))

    if "discount" in column_names and ("revenue" in column_names or "sales" in column_names):
        relationships.append("Discount levels can be compared against revenue to study pricing impact.")
    if "rating" in column_names and "review" in column_names:
        relationships.append("Ratings and review volume can be analyzed together to understand feedback quality.")
    if "region" in column_names and ("revenue" in column_names or "sales" in column_names):
        relationships.append("Regional segments can be ranked by revenue contribution.")
    if "category" in column_names and ("quantity" in column_names or "revenue" in column_names):
        relationships.append("Product categories can be compared on volume and revenue performance.")

    return relationships[:4]


def _recommended_briefs(focus_areas: list[str]) -> list[str]:
    briefs = [
        "Executive overview with trends and top drivers",
        "Regional performance and top categories",
        "Growth patterns, rankings, and outliers",
    ]

    if "customer feedback" in focus_areas:
        briefs.append("Customer feedback quality with rating and review patterns")
    if "pricing and discount impact" in focus_areas:
        briefs.append("Pricing, discount impact, and revenue trade-offs")

    return briefs[:4]
