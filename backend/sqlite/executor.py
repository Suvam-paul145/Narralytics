import os
import sqlite3


def execute_query(db_path: str, sql: str) -> list[dict]:
    if not sql or not isinstance(sql, str):
        raise ValueError("SQL query is required")

    normalized_sql = sql.strip().rstrip(";")
    if not normalized_sql.lower().startswith("select"):
        raise ValueError("Only SELECT queries are allowed")
    if ";" in normalized_sql:
        raise ValueError("Multiple SQL statements are not allowed")
    if not os.path.exists(db_path):
        raise ValueError(f"SQLite database not found: {db_path}")

    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row

    try:
        connection.execute("PRAGMA query_only = ON")
        cursor = connection.cursor()
        
        # Automatic protection limit
        if "limit" not in normalized_sql.lower():
            safe_sql = f"{normalized_sql} LIMIT 5000"
        else:
            safe_sql = normalized_sql
            
        cursor.execute(safe_sql)
        return [dict(row) for row in cursor.fetchall()]
    except sqlite3.Error as exc:
        raise ValueError(f"SQL error: {exc}") from exc
    finally:
        connection.close()
    
    return []
