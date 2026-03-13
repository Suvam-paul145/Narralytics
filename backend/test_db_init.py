import sys, os
from database import init_db

# Mock DB_PATH for Windows testing
import database
database.DB_PATH = "C:\\tmp\\amazon_sales.db"

try:
    init_db()
    print("Success: Database initialized.")
except Exception as e:
    print(f"Error: {e}")
    # Let's see some of the raw file content if it fails
    try:
        csv_path = os.path.join(os.path.dirname(database.__file__), "data", "amazon_sales.csv")
        with open(csv_path, "rb") as f:
            raw = f.read(1000).decode("latin1")
            print(f"Raw head (1000 bytes): {raw!r}")
    except:
        pass
