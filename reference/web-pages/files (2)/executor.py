"""
backend/sqlite/executor.py
──────────────────────────
Safe, read-only SQLite query execution with pre-execution SQL sanitization.

Key fix: sanitize() strips ISO-8601 T-separators and named parameters that
cause SQLite's "unrecognized token: ':'" error when LLM-generated SQL is run.
"""

import os
import re
import sqlite3


# ── SQL Sanitizer ─────────────────────────────────────────────────────────────

def _sanitize_sql(sql: str) -> str:
    """
    Fix common LLM SQL generation mistakes before execution:

    1. ISO-8601 datetime T-separator:
       '2022-01-01T10:00:00' → '2022-01-01 10:00:00'
       SQLite datetime() works with space separator, not T.

    2. Named bind parameters (:param_name):
       WHERE x = :value → WHERE x = ''
       LLM sometimes generates Python-style named params that SQLite
       rejects with "unrecognized token ':'".

    3. Strip trailing semicolons (multi-statement guard).
    """
    # Fix 1: ISO datetime T-separator inside string literals
    # Pattern: single-quoted string containing T between date and time
    sql = re.sub(
        r"'(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2}(?:\.\d+)?)'",
        r"'\1 \2'",
        sql
    )

    # Fix 2: Named parameters like :param or :param_name
    # Replace with empty string (safe neutral value)
    sql = re.sub(r':\b[a-zA-Z_][a-zA-Z0-9_]*\b', "''", sql)

    # Fix 3: Strip trailing semicolon
    sql = sql.strip().rstrip(";")

    return sql


# ── Main Executor ─────────────────────────────────────────────────────────────

def execute_query(db_path: str, sql: str) -> list[dict]:
    """
    Execute a SELECT query against a SQLite database.
    Returns list of row dicts. Raises ValueError on any error.
    """
    if not sql or not isinstance(sql, str):
        raise ValueError("SQL query is required")

    # Sanitize before validation
    sanitized = _sanitize_sql(sql)

    if not sanitized.lower().startswith("select"):
        raise ValueError("Only SELECT queries are allowed")

    if ";" in sanitized:
        raise ValueError("Multiple SQL statements are not allowed")

    if not os.path.exists(db_path):
        raise ValueError(f"SQLite database not found: {db_path}")

    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row

    try:
        # Enforce read-only mode
        connection.execute("PRAGMA query_only = ON")
        cursor = connection.cursor()
        cursor.execute(sanitized)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    except sqlite3.OperationalError as exc:
        raise ValueError(f"SQL error: {exc}") from exc
    finally:
        connection.close()


def get_table_columns(db_path: str) -> list[str]:
    """
    Return actual column names in the 'data' table.
    Used to validate LLM-generated column names before execution.
    """
    if not os.path.exists(db_path):
        return []
    connection = sqlite3.connect(db_path)
    try:
        cursor = connection.cursor()
        cursor.execute("PRAGMA table_info(data)")
        return [row[1] for row in cursor.fetchall()]
    except sqlite3.Error:
        return []
    finally:
        connection.close()
