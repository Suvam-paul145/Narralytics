import sqlite3, pandas as pd, os
from io import StringIO

DB_PATH = "/tmp/amazon_sales.db"  # /tmp is writable in Lambda

def get_connection():
    return sqlite3.connect(DB_PATH)

def init_db():
    if os.path.exists(DB_PATH):
        return

    csv_path = os.path.join(os.path.dirname(__file__), "data", "amazon_sales.csv")
    with open(csv_path, "rb") as f:
        raw = f.read().decode("latin1")

    start = raw.find("order_id")
    end   = raw.find("</pre>")
    csv_text = raw[start:end] if end > 0 else raw[start:]

    df = pd.read_csv(StringIO(csv_text))
    df.columns = [c.strip().replace('"', '') for c in df.columns]
    df["order_date"]    = pd.to_datetime(df["order_date"], dayfirst=True)
    df["order_year"]    = df["order_date"].dt.year
    df["order_month"]   = df["order_date"].dt.to_period("M").astype(str)
    df["order_quarter"] = "Q" + df["order_date"].dt.quarter.astype(str) + \
                          "-" + df["order_year"].astype(str)

    conn = get_connection()
    df.to_sql("amazon_sales", conn, if_exists="replace", index=False)
    conn.close()
    print(f"✅ Loaded {len(df):,} rows into SQLite at {DB_PATH}")