import sqlite3
from database import get_connection

def execute_query(sql: str) -> list[dict]:
    conn = get_connection()
    conn.row_factory = sqlite3.Row
    try:
        cursor = conn.cursor()
        cursor.execute(sql)
        return [dict(row) for row in cursor.fetchall()]
    except sqlite3.OperationalError as e:
        raise ValueError(f"SQL error: {str(e)}")
    finally:
        conn.close()
