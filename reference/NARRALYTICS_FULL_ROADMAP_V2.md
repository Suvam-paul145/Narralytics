# 🧠 NARRALYTICS — Full MVP Roadmap v2
## Conversational AI for Instant Business Intelligence Dashboards

> **Stack:** FastAPI (now) → AWS Lambda (later) · MongoDB · React · Gemini 1.5 Flash
> **Compatibility:** Every architectural decision in this roadmap works on both FastAPI locally AND AWS Lambda in production with zero code rewrites.
> **Status:** Google OAuth in progress → this roadmap picks up from there.

---

## 📋 Table of Contents

1. [Your 5 Direct Questions — Answered First](#1-your-5-direct-questions--answered-first)
2. [What You Are Building — Full Feature Map](#2-what-you-are-building--full-feature-map)
3. [Architecture Overview](#3-architecture-overview)
4. [Database Design — MongoDB](#4-database-design--mongodb)
5. [Folder Structure](#5-folder-structure)
6. [Phase 1 — Foundation (Auth + Upload + DB)](#6-phase-1--foundation-auth--upload--db)
7. [Phase 2 — Auto Dashboard Generation](#7-phase-2--auto-dashboard-generation)
8. [Phase 3 — Chat + Voice Assistant](#8-phase-3--chat--voice-assistant)
9. [Phase 4 — Multi-Output + Forecasting on Request](#9-phase-4--multi-output--forecasting-on-request)
10. [Phase 5 — PDF Report Generation](#10-phase-5--pdf-report-generation)
11. [Phase 6 — AWS Migration](#11-phase-6--aws-migration)
12. [All API Endpoints Reference](#12-all-api-endpoints-reference)
13. [LLM Prompt Design](#13-llm-prompt-design)
14. [Scoring Strategy — 110/100](#14-scoring-strategy--110100)
15. [FastAPI → AWS Compatibility Checklist](#15-fastapi--aws-compatibility-checklist)

---

## 1. Your 5 Direct Questions — Answered First

### Q1: Can I store user credentials in MongoDB?

**Yes. MongoDB is the right choice here.** Use it as your primary user store.

Here is what to store per user:

```python
# MongoDB collection: users
{
  "_id": ObjectId(),
  "google_sub": "google_oauth_unique_id",   # Primary lookup key
  "email": "user@example.com",
  "name": "Suvam Paul",
  "picture": "https://lh3.googleusercontent.com/...",
  "created_at": ISODate("2024-01-15T10:00:00Z"),
  "last_login": ISODate("2024-01-20T14:32:00Z"),
  "plan": "free",                            # For future monetization
  "datasets": [                              # References to uploaded files
    { "dataset_id": "uuid", "name": "sales_2023.csv", "uploaded_at": ISODate() }
  ]
}
```

**Why MongoDB over PostgreSQL for users:**
- Schema-flexible — you will keep adding fields as features grow
- `google_sub` as lookup key is a natural document ID
- No migrations needed when you add `plan`, `usage_count`, `preferences` later
- Atlas free tier handles thousands of users at zero cost

**What NOT to store in MongoDB:**
- Raw passwords (you are using OAuth, so no passwords at all — good)
- JWT tokens (those are stateless, verified on every request, not stored)
- The uploaded CSV data itself (store that in the filesystem or S3)

---

### Q2: MongoDB or AWS for conversation history?

**Use MongoDB for history right now. Switch to DynamoDB when you move to AWS.**

Here is the reasoning:

| Factor | MongoDB (now) | DynamoDB (AWS later) |
|---|---|---|
| Local dev | Works perfectly | Requires AWS credentials |
| Query flexibility | Rich queries, aggregation | Limited to key patterns |
| Cost | Free tier (Atlas) | Pay per request — near $0 |
| Migration effort | Low — same schema, different driver | One file change (history.py) |
| When to switch | After full local MVP is done | During Phase 6 (AWS migration) |

**The key insight:** Your `history.py` file is the only file that changes when you switch from MongoDB to DynamoDB. If you write it cleanly as a module with `save_interaction()` and `get_history()` functions, swapping the backend is a 30-minute job. The rest of your codebase never knows the difference.

**MongoDB history schema:**

```python
# MongoDB collection: conversation_history
{
  "_id": ObjectId(),
  "user_id": "google_sub",          # Foreign key to users collection
  "session_id": "uuid",             # Groups interactions in one session
  "timestamp": ISODate(),
  "type": "chart_query | chat_message | voice_query | pdf_request",
  "dataset_id": "uuid",             # Which dataset was being queried
  "payload": {
    "prompt": "original user text",
    "response_summary": "...",
    "chart_types": "bar / pie",
    "sql_generated": "SELECT ...",
    "output_count": 2               # How many outputs were requested
  }
}
```

---

### Q3: Voice assistant — where does it live?

**Voice assistant lives in the chat section only, not in the dashboard section.**

Two separate flows:

**Flow A — Dashboard section:**
- User uploads CSV → system auto-generates charts → user views dashboard
- No voice here. Text-only interaction for chart refinement.

**Flow B — Chat section (NLP + Voice):**
- User can type OR speak
- Both routes land in the same `/chat` endpoint
- Voice input: browser's Web Speech API (free, no backend needed for STT)
- Voice output: Web Speech API SpeechSynthesis OR Google TTS API
- The chat section also supports explicit forecasting requests

**Implementation approach:**
```javascript
// Frontend — Web Speech API (no backend cost)
const recognition = new window.SpeechRecognition();
recognition.onresult = (event) => {
  const transcript = event.results[0][0].transcript;
  sendToChat(transcript);   // Same function as text input
};
```

This means your backend does not need any speech processing library. The browser converts voice to text, sends text to `/chat`, gets a text response, and the browser reads it aloud. Zero additional backend complexity.

---

### Q4: Dashboard auto-generation — how does it work exactly?

**After upload: system analyzes the dataset and auto-generates ALL meaningful chart possibilities. User sees a full dashboard immediately without typing a single query.**

The flow:

```
User uploads CSV
  → Backend parses headers + dtypes + sample rows
    → LLM receives schema context
      → LLM returns 6-10 chart specifications
        → Backend executes all SQLs
          → Frontend renders full dashboard grid
            → User can then refine via chat
```

**What the LLM does in auto-generation mode:**
- Detects time columns → generates trend line charts automatically
- Detects categorical columns → generates bar/pie charts
- Detects numeric pairs → generates scatter/correlation charts
- Generates a business insight sentence for each chart
- Returns SQL query for each chart (shown as "View Query" toggle)

**No forecasting in the dashboard section.** All charts show historical data only. Forecasting is only available when the user explicitly asks for it in the chat section.

---

### Q5: Multiple outputs (1 or 2) per single prompt — how to implement?

**The user chooses before submitting: a toggle or a selector sets `output_count` to 1 or 2.**

When `output_count = 2`:
- LLM returns two different visual perspectives on the same question
- Frontend shows both side by side (this is your existing ChartSelector pattern)
- User selects one to add to their canvas

When `output_count = 1`:
- LLM returns the single most appropriate chart
- No selection needed — it goes directly to the canvas

**Backend: one field change in the request body:**
```python
class QueryRequest(BaseModel):
    prompt: str
    output_count: int = 1      # 1 or 2 — user-controlled
    history: List[ConversationTurn] = []
    dataset_id: str            # Which uploaded dataset to query
```

**Prompt engineering change:**
```python
# In llm_chart.py system prompt:
if request.output_count == 2:
    "Return EXACTLY TWO different chart specifications..."
else:
    "Return EXACTLY ONE chart specification..."
```

---

## 2. What You Are Building — Full Feature Map

```
NARRALYTICS
│
├── MODULE 1: Auth (IN PROGRESS)
│   ├── Google OAuth 2.0
│   ├── JWT token issuance
│   └── User profile stored in MongoDB
│
├── MODULE 2: Dataset Upload
│   ├── CSV/Excel file upload
│   ├── Schema detection (columns, dtypes, row count)
│   ├── SQLite database creation from CSV
│   ├── Dataset metadata stored in MongoDB
│   └── Multiple datasets per user (each isolated)
│
├── MODULE 3: Auto Dashboard Generation
│   ├── LLM analyzes uploaded schema
│   ├── Generates 6-10 chart specs automatically
│   ├── Executes SQL for each chart
│   ├── Renders full dashboard grid on first load
│   └── SQL/query shown as "View Query" toggle per chart
│
├── MODULE 4: Chat + NLP Interaction
│   ├── Text input
│   ├── Voice input (Web Speech API → text → same endpoint)
│   ├── Voice output (SpeechSynthesis reads AI response)
│   ├── Output count selector (1 or 2 charts per prompt)
│   ├── Conversational context (last 10 turns sent each time)
│   ├── Follow-up refinement ("Now filter to Asia only")
│   └── Historical queries saved to MongoDB
│
├── MODULE 5: Forecasting (Explicit Request Only)
│   ├── Available ONLY in chat section
│   ├── Triggered when user explicitly asks for prediction/forecast
│   ├── Uses statistical extrapolation (not ML model)
│   ├── Shows confidence range, not a single number
│   └── Clearly labeled as "Forecast — Not Historical Data"
│
└── MODULE 6: PDF Report Export
    ├── User clicks "Generate Report" button
    ├── Selects which charts to include
    ├── LLM writes executive summary paragraph
    ├── PDF includes: charts + summary + statistical calculations
    └── Download as filename: report_[dataset]_[date].pdf
```

---

## 3. Architecture Overview

```
BROWSER (React + Vite)
  │
  ├── Landing Page       (public)
  ├── Dashboard          (protected — chart grid + canvas)
  ├── Chat Section       (protected — NLP + voice)
  └── Report Builder     (protected — PDF export)
  │
  │  HTTPS + JWT Bearer Token
  │
API LAYER
  ├── FastAPI (local dev)           → uvicorn main:app
  └── AWS Lambda + API Gateway (prod) → handler = Mangum(app)
  │
  ├── /auth/*            Google OAuth + JWT
  ├── /datasets/*        Upload + manage CSV files
  ├── /dashboard/auto    Auto-generate charts from schema
  ├── /query             NLP → chart(s)
  ├── /chat              NLP → narrative + optional forecast
  ├── /history           MongoDB read
  └── /report            PDF generation
  │
DATA LAYER
  ├── MongoDB Atlas       Users + history + dataset metadata
  ├── SQLite (/tmp)       Per-dataset queryable tables
  └── Local filesystem    Uploaded CSV files (→ S3 on AWS)
  │
EXTERNAL
  ├── Google Gemini 1.5 Flash    LLM for all AI features
  ├── Google OAuth 2.0           Authentication
  └── ReportLab / WeasyPrint     PDF generation
```

**Why this architecture migrates to AWS with zero code changes:**
- `SQLite /tmp` path works on Lambda's ephemeral storage
- MongoDB Atlas is a cloud service — same connection string works everywhere
- Mangum wraps FastAPI for Lambda
- Local filesystem → S3 is the only change (one function in `storage.py`)

---

## 4. Database Design — MongoDB

### Collection 1: `users`

```python
{
  "_id": ObjectId(),
  "google_sub": str,          # Unique Google user ID — primary lookup
  "email": str,
  "name": str,
  "picture": str,             # Google profile photo URL
  "created_at": datetime,
  "last_login": datetime,
  "datasets": [               # Embedded array of dataset references
    {
      "dataset_id": str,      # UUID
      "name": str,            # Original filename
      "row_count": int,
      "columns": [str],       # Column names for quick access
      "uploaded_at": datetime,
      "db_path": str          # Path to SQLite file
    }
  ]
}

# Index:
db.users.create_index("google_sub", unique=True)
```

### Collection 2: `conversation_history`

```python
{
  "_id": ObjectId(),
  "user_id": str,             # google_sub
  "session_id": str,          # UUID — groups turns in one session
  "dataset_id": str,          # Which dataset was queried
  "timestamp": datetime,
  "type": str,                # "chart_query" | "chat" | "voice" | "auto_gen" | "pdf"
  "payload": {
    "prompt": str,
    "response_summary": str,  # First 400 chars of AI response
    "chart_types": str,       # e.g. "bar / pie" or "line"
    "sql_generated": str,
    "output_count": int,      # 1 or 2
    "was_forecast": bool,
    "execution_ms": int       # How long the query took
  }
}

# Indexes:
db.conversation_history.create_index([("user_id", 1), ("timestamp", -1)])
db.conversation_history.create_index("session_id")
```

### Collection 3: `datasets` (metadata only — actual data is SQLite)

```python
{
  "_id": ObjectId(),
  "dataset_id": str,          # UUID
  "user_id": str,             # Owner
  "original_filename": str,
  "row_count": int,
  "column_count": int,
  "columns": [
    {
      "name": str,
      "dtype": str,           # "string" | "integer" | "float" | "datetime"
      "sample_values": [str], # First 3 unique values — for LLM context
      "null_count": int
    }
  ],
  "date_columns": [str],      # Columns detected as dates
  "numeric_columns": [str],
  "categorical_columns": [str],
  "db_path": str,             # Local: /tmp/uuid.db | AWS: S3 key
  "file_size_bytes": int,
  "uploaded_at": datetime,
  "last_queried": datetime
}

# Index:
db.datasets.create_index([("user_id", 1), ("uploaded_at", -1)])
db.datasets.create_index("dataset_id", unique=True)
```

---

## 5. Folder Structure

```
narralytics/
│
├── backend/
│   ├── main.py                  ← FastAPI app entry + Mangum handler
│   ├── config.py                ← All env var loading in one place
│   │
│   ├── auth/
│   │   ├── oauth.py             ← Google OAuth exchange
│   │   ├── jwt_handler.py       ← Create + verify JWT
│   │   └── dependencies.py      ← get_current_user FastAPI dependency
│   │
│   ├── database/
│   │   ├── mongodb.py           ← MongoDB connection + collections
│   │   ├── users.py             ← User CRUD operations
│   │   ├── history.py           ← History save/read (swappable with DynamoDB)
│   │   └── datasets.py          ← Dataset metadata CRUD
│   │
│   ├── storage/
│   │   ├── local.py             ← Save/read CSV files locally
│   │   └── s3.py                ← Same interface, AWS S3 backend (Phase 6)
│   │
│   ├── sqlite/
│   │   ├── loader.py            ← CSV → SQLite table creation
│   │   ├── executor.py          ← Safe SQL runner
│   │   └── schema_detector.py   ← Detect column types + date formats
│   │
│   ├── llm/
│   │   ├── auto_dashboard.py    ← Generate all charts from schema
│   │   ├── chart_engine.py      ← NL → chart spec(s) (1 or 2)
│   │   ├── chat_engine.py       ← NL → narrative answer
│   │   ├── forecast_engine.py   ← Explicit forecast requests
│   │   └── report_engine.py     ← Generate PDF summary text
│   │
│   ├── pdf/
│   │   └── generator.py         ← ReportLab PDF builder
│   │
│   ├── models/
│   │   └── schemas.py           ← All Pydantic request/response models
│   │
│   ├── routers/
│   │   ├── auth.py              ← /auth/* routes
│   │   ├── datasets.py          ← /datasets/* routes
│   │   ├── dashboard.py         ← /dashboard/* routes
│   │   ├── query.py             ← /query route
│   │   ├── chat.py              ← /chat route
│   │   └── report.py            ← /report route
│   │
│   ├── uploads/                 ← Uploaded CSV files (gitignored)
│   ├── .env
│   └── requirements.txt
│
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── Landing.jsx      ← ✅ Generated
    │   │   ├── Dashboard.jsx    ← Protected: chart grid + canvas
    │   │   ├── Chat.jsx         ← Protected: NLP + voice
    │   │   └── AuthCallback.jsx ← OAuth redirect handler
    │   ├── components/
    │   │   ├── layout/
    │   │   │   ├── Sidebar.jsx  ← ✅ Generated (in NarralyticsDashboard)
    │   │   │   └── TopNav.jsx   ← ✅ Generated
    │   │   ├── upload/
    │   │   │   ├── UploadZone.jsx        ← Drag-drop CSV uploader
    │   │   │   └── DatasetSelector.jsx   ← Switch between datasets
    │   │   ├── charts/
    │   │   │   ├── ChartRenderer.jsx     ← Recharts switch by type
    │   │   │   ├── ChartSelector.jsx     ← Dual option UX
    │   │   │   ├── ChartCard.jsx         ← Confirmed chart on canvas
    │   │   │   └── AutoDashboard.jsx     ← Full auto-generated grid
    │   │   ├── chat/
    │   │   │   ├── ChatWindow.jsx        ← Conversation thread
    │   │   │   ├── ChatMessage.jsx       ← Single message bubble
    │   │   │   ├── VoiceButton.jsx       ← Web Speech API mic button
    │   │   │   └── OutputToggle.jsx      ← 1 or 2 output selector
    │   │   └── report/
    │   │       └── ReportBuilder.jsx     ← Chart selection + PDF trigger
    │   ├── hooks/
    │   │   ├── useAuth.js
    │   │   ├── useDashboard.js
    │   │   ├── useChat.js
    │   │   └── useVoice.js       ← Web Speech API hook
    │   └── context/AuthContext.jsx
    └── .env.development
```

---

## 6. Phase 1 — Foundation (Auth + Upload + DB)

**Goal:** Google OAuth working, user stored in MongoDB, CSV uploaded and queryable.
**This picks up from where you currently are (OAuth in progress).**

---

### Step 1 — Config module — `config.py`

Put all env loading here. Every other file imports from this — never from `os.getenv` directly.

```python
# backend/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Google OAuth
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    REDIRECT_URI: str
    FRONTEND_URL: str = "http://localhost:5173"

    # JWT
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_HOURS: int = 24

    # MongoDB
    MONGODB_URI: str                           # mongodb+srv://... from Atlas
    MONGODB_DB: str = "narralytics"

    # Gemini
    GEMINI_API_KEY: str

    # Storage
    UPLOAD_DIR: str = "./uploads"              # Local path
    # AWS_BUCKET: str = ""                     # Uncomment in Phase 6

    class Config:
        env_file = ".env"

settings = Settings()
```

---

### Step 2 — MongoDB connection — `database/mongodb.py`

```python
# backend/database/mongodb.py
from motor.motor_asyncio import AsyncIOMotorClient
from config import settings

client = None
db = None

async def connect_mongodb():
    global client, db
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    db = client[settings.MONGODB_DB]
    print(f"Connected to MongoDB: {settings.MONGODB_DB}")

async def close_mongodb():
    if client:
        client.close()

def get_db():
    return db
```

Add to `main.py`:
```python
from database.mongodb import connect_mongodb, close_mongodb

@app.on_event("startup")
async def startup():
    await connect_mongodb()

@app.on_event("shutdown")
async def shutdown():
    await close_mongodb()
```

Install: `pip install motor pymongo`

---

### Step 3 — User CRUD — `database/users.py`

```python
# backend/database/users.py
from database.mongodb import get_db
from datetime import datetime

async def upsert_user(google_profile: dict) -> dict:
    """
    Create user on first login, update last_login on subsequent logins.
    Returns the full user document.
    """
    db = get_db()
    user_data = {
        "google_sub":  google_profile["id"],
        "email":       google_profile["email"],
        "name":        google_profile["name"],
        "picture":     google_profile.get("picture", ""),
        "last_login":  datetime.utcnow(),
    }

    result = await db.users.find_one_and_update(
        {"google_sub": google_profile["id"]},
        {
            "$set": user_data,
            "$setOnInsert": {
                "created_at": datetime.utcnow(),
                "plan": "free",
                "datasets": []
            }
        },
        upsert=True,
        return_document=True
    )
    return result

async def get_user_by_sub(google_sub: str) -> dict:
    db = get_db()
    return await db.users.find_one({"google_sub": google_sub})

async def add_dataset_to_user(google_sub: str, dataset_meta: dict):
    db = get_db()
    await db.users.update_one(
        {"google_sub": google_sub},
        {"$push": {"datasets": dataset_meta}}
    )
```

---

### Step 4 — Auth routes (complete what you started) — `routers/auth.py`

```python
# backend/routers/auth.py
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from auth.oauth import get_google_auth_url, exchange_code_for_user
from auth.jwt_handler import create_jwt
from auth.dependencies import get_current_user
from database.users import upsert_user
from config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

@router.get("/google")
def login():
    return RedirectResponse(url=get_google_auth_url())

@router.get("/callback")
async def callback(code: str):
    try:
        google_user = await exchange_code_for_user(code)
        # Store/update user in MongoDB
        db_user = await upsert_user(google_user)
        token = create_jwt({
            "sub":     google_user["id"],
            "email":   google_user["email"],
            "name":    google_user["name"],
            "picture": google_user.get("picture", ""),
        })
        # JWT in URL fragment — never reaches server logs
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/auth/callback#token={token}")
    except Exception as e:
        print(f"Auth error: {e}")
        return RedirectResponse(url=f"{settings.FRONTEND_URL}?auth_error=true")

@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return {
        "sub":     user["sub"],
        "email":   user["email"],
        "name":    user["name"],
        "picture": user["picture"],
    }
```

---

### Step 5 — Schema detector — `sqlite/schema_detector.py`

This is the intelligence that tells the LLM what kind of dataset it is working with.

```python
# backend/sqlite/schema_detector.py
import pandas as pd
from io import StringIO

def detect_schema(df: pd.DataFrame) -> dict:
    """
    Analyze a DataFrame and return structured schema info for the LLM.
    This is sent with every query so the LLM knows exactly what columns exist.
    """
    schema = {
        "row_count": len(df),
        "columns": [],
        "date_columns": [],
        "numeric_columns": [],
        "categorical_columns": [],
    }

    for col in df.columns:
        col_info = {
            "name": col,
            "null_count": int(df[col].isna().sum()),
            "unique_count": int(df[col].nunique()),
            "sample_values": [str(v) for v in df[col].dropna().unique()[:3]],
        }

        # Detect column type
        if pd.api.types.is_numeric_dtype(df[col]):
            col_info["dtype"] = "numeric"
            col_info["min"] = float(df[col].min())
            col_info["max"] = float(df[col].max())
            col_info["mean"] = round(float(df[col].mean()), 2)
            schema["numeric_columns"].append(col)

        elif pd.api.types.is_datetime64_any_dtype(df[col]):
            col_info["dtype"] = "datetime"
            col_info["min_date"] = str(df[col].min().date())
            col_info["max_date"] = str(df[col].max().date())
            schema["date_columns"].append(col)

        else:
            # Try to parse as date
            try:
                parsed = pd.to_datetime(df[col], infer_datetime_format=True, errors="coerce")
                if parsed.notna().sum() > len(df) * 0.8:   # 80% parseable = date column
                    col_info["dtype"] = "datetime"
                    col_info["min_date"] = str(parsed.min().date())
                    col_info["max_date"] = str(parsed.max().date())
                    schema["date_columns"].append(col)
                else:
                    col_info["dtype"] = "categorical"
                    schema["categorical_columns"].append(col)
            except:
                col_info["dtype"] = "categorical"
                schema["categorical_columns"].append(col)

        schema["columns"].append(col_info)

    return schema
```

---

### Step 6 — CSV Upload route — `routers/datasets.py`

```python
# backend/routers/datasets.py
import uuid, os, pandas as pd
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from auth.dependencies import get_current_user
from sqlite.loader import load_csv_to_sqlite
from sqlite.schema_detector import detect_schema
from database.datasets import save_dataset_metadata
from database.users import add_dataset_to_user
from config import settings

router = APIRouter(prefix="/datasets", tags=["datasets"])

@router.post("/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    """
    Accept CSV or Excel upload.
    Parse → detect schema → create SQLite → save metadata to MongoDB.
    """
    # Validate file type
    if not file.filename.endswith((".csv", ".xlsx", ".xls")):
        raise HTTPException(400, "Only CSV and Excel files are supported")

    dataset_id = str(uuid.uuid4())
    contents = await file.read()

    # Parse file
    try:
        if file.filename.endswith(".csv"):
            df = pd.read_csv(pd.io.common.BytesIO(contents), encoding="latin1")
        else:
            df = pd.read_excel(pd.io.common.BytesIO(contents))
    except Exception as e:
        raise HTTPException(400, f"Could not parse file: {e}")

    # Detect schema
    schema = detect_schema(df)

    # Save SQLite database
    db_path = f"{settings.UPLOAD_DIR}/{dataset_id}.db"
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    load_csv_to_sqlite(df, db_path, table_name="data")

    # Save metadata to MongoDB
    meta = {
        "dataset_id":    dataset_id,
        "user_id":       user["sub"],
        "original_filename": file.filename,
        "row_count":     schema["row_count"],
        "column_count":  len(schema["columns"]),
        "columns":       schema["columns"],
        "date_columns":  schema["date_columns"],
        "numeric_columns": schema["numeric_columns"],
        "categorical_columns": schema["categorical_columns"],
        "db_path":       db_path,
        "file_size_bytes": len(contents),
    }
    await save_dataset_metadata(meta)
    await add_dataset_to_user(user["sub"], {
        "dataset_id": dataset_id,
        "name": file.filename,
        "row_count": schema["row_count"],
    })

    return {
        "dataset_id": dataset_id,
        "filename":   file.filename,
        "row_count":  schema["row_count"],
        "columns":    [c["name"] for c in schema["columns"]],
        "date_columns": schema["date_columns"],
        "numeric_columns": schema["numeric_columns"],
        "message":    "Dataset ready. Generating dashboard..."
    }

@router.get("/")
async def list_datasets(user: dict = Depends(get_current_user)):
    """List all datasets uploaded by this user."""
    from database.datasets import get_user_datasets
    datasets = await get_user_datasets(user["sub"])
    return {"datasets": datasets}

@router.delete("/{dataset_id}")
async def delete_dataset(dataset_id: str, user: dict = Depends(get_current_user)):
    """Delete a dataset and its SQLite file."""
    from database.datasets import delete_dataset_meta, get_dataset
    dataset = await get_dataset(dataset_id, user["sub"])
    if not dataset:
        raise HTTPException(404, "Dataset not found")
    # Delete SQLite file
    if os.path.exists(dataset["db_path"]):
        os.remove(dataset["db_path"])
    await delete_dataset_meta(dataset_id)
    return {"message": "Dataset deleted"}
```

---

## 7. Phase 2 — Auto Dashboard Generation

**Goal:** When a user uploads a dataset (or opens an existing one), the system immediately generates a full dashboard without any user prompt.

---

### Step 7 — Auto-dashboard LLM engine — `llm/auto_dashboard.py`

```python
# backend/llm/auto_dashboard.py
import google.generativeai as genai, json
from config import settings

genai.configure(api_key=settings.GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-1.5-flash")

def build_auto_dashboard_prompt(schema: dict) -> str:
    """
    Build a prompt from schema metadata.
    The LLM receives column names, types, ranges, and samples.
    It returns 6-10 chart specifications covering the most valuable insights.
    """
    cols_text = "\n".join([
        f"  - {c['name']} ({c['dtype']})"
        + (f" range: {c.get('min')} to {c.get('max')}" if c['dtype'] == 'numeric' else "")
        + (f" dates: {c.get('min_date')} to {c.get('max_date')}" if c['dtype'] == 'datetime' else "")
        + (f" samples: {', '.join(c['sample_values'][:3])}" if c['dtype'] == 'categorical' else "")
        for c in schema["columns"]
    ])

    return f"""
You are a senior BI analyst generating an automatic dashboard for a newly uploaded dataset.

=== DATASET INFO ===
Total rows: {schema['row_count']}
Columns:
{cols_text}

Date columns: {schema['date_columns']}
Numeric columns: {schema['numeric_columns']}
Categorical columns: {schema['categorical_columns']}

=== YOUR TASK ===
Generate between 6 and 10 chart specifications that cover the most valuable business insights
this dataset can reveal. Cover a variety of chart types.

Priority order:
1. Time-series trends (if date columns exist)
2. Category comparisons (if categorical + numeric exist)
3. Distributions and proportions
4. Correlations between numeric columns
5. Top-N rankings

=== RULES ===
- Only use columns listed above — exact names, no invention
- line chart: time-based X axis only
- bar chart: categorical X axis, numeric Y axis
- pie chart: max 6 categories, add LIMIT 6 to SQL
- scatter chart: two numeric columns (X and Y both numeric)
- All SQL queries against table named exactly: data
- Always ROUND aggregated floats: ROUND(SUM(col), 2) AS col
- Always alias aggregations
- DO NOT include forecasting or predictions
- DO NOT fabricate data or insights

=== OUTPUT — ONLY valid JSON ===
{{
  "charts": [
    {{
      "chart_id": "c1",
      "title": "Short executive title",
      "chart_type": "bar | line | pie | scatter",
      "sql": "SELECT ...",
      "x_key": "column_name",
      "y_key": "column_name",
      "color_by": null,
      "insight": "One sentence business finding with a specific number",
      "category": "trend | comparison | distribution | correlation | ranking"
    }}
  ]
}}
"""

def generate_auto_dashboard(schema: dict) -> list:
    prompt = build_auto_dashboard_prompt(schema)
    try:
        raw = model.generate_content(prompt).text.strip()
        if raw.startswith("```"):
            parts = raw.split("```")
            raw = parts[1] if len(parts) > 1 else raw
            if raw.startswith("json"): raw = raw[4:].strip()
        result = json.loads(raw)
        return result.get("charts", [])
    except Exception as e:
        print(f"Auto-dashboard generation failed: {e}")
        return []
```

---

### Step 8 — Auto-dashboard route — `routers/dashboard.py`

```python
# backend/routers/dashboard.py
from fastapi import APIRouter, Depends, HTTPException
from auth.dependencies import get_current_user
from database.datasets import get_dataset
from llm.auto_dashboard import generate_auto_dashboard
from sqlite.executor import execute_query
from database.history import save_interaction

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.post("/auto/{dataset_id}")
async def auto_generate_dashboard(
    dataset_id: str,
    user: dict = Depends(get_current_user)
):
    """
    Generate full dashboard charts automatically from dataset schema.
    Called immediately after upload AND when opening an existing dataset.
    """
    dataset = await get_dataset(dataset_id, user["sub"])
    if not dataset:
        raise HTTPException(404, "Dataset not found or access denied")

    # Build schema object from stored metadata
    schema = {
        "row_count":            dataset["row_count"],
        "columns":              dataset["columns"],
        "date_columns":         dataset["date_columns"],
        "numeric_columns":      dataset["numeric_columns"],
        "categorical_columns":  dataset["categorical_columns"],
    }

    # Ask LLM to generate chart specs
    chart_specs = generate_auto_dashboard(schema)

    # Execute each SQL and attach data
    results = []
    for spec in chart_specs:
        try:
            data = execute_query(dataset["db_path"], spec["sql"])
            results.append({
                "chart_id":   spec["chart_id"],
                "title":      spec["title"],
                "chart_type": spec["chart_type"],
                "x_key":      spec["x_key"],
                "y_key":      spec["y_key"],
                "color_by":   spec.get("color_by"),
                "insight":    spec.get("insight"),
                "category":   spec.get("category"),
                "sql":        spec["sql"],          # Shown via "View Query" toggle
                "data":       data,
                "error":      None
            })
        except Exception as e:
            results.append({
                "chart_id":   spec["chart_id"],
                "title":      spec["title"],
                "chart_type": spec["chart_type"],
                "data":       [],
                "error":      str(e)
            })

    # Save to history
    await save_interaction(user["sub"], "auto_gen", {
        "dataset_id": dataset_id,
        "charts_generated": len(results),
        "successful": sum(1 for r in results if not r["error"])
    })

    return {
        "dataset_id":  dataset_id,
        "chart_count": len(results),
        "charts":      results
    }
```

---

## 8. Phase 3 — Chat + Voice Assistant

**Goal:** NLP chat section with voice input/output, full conversation history, per-dataset context.

---

### Step 9 — Chat engine — `llm/chat_engine.py`

```python
# backend/llm/chat_engine.py
import google.generativeai as genai, json
from config import settings

genai.configure(api_key=settings.GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-1.5-flash")

def build_chat_system_prompt(schema: dict, dataset_filename: str) -> str:
    cols_summary = ", ".join([
        f"{c['name']} ({c['dtype']})" for c in schema["columns"]
    ])
    return f"""
You are a senior business analyst embedded in a BI platform.
You are answering questions about a dataset called "{dataset_filename}".

=== DATASET CONTEXT ===
Rows: {schema['row_count']}
Columns: {cols_summary}
Date range: {', '.join(schema['date_columns'])} (if any date columns exist)
Numeric columns: {', '.join(schema['numeric_columns'])}
Categorical columns: {', '.join(schema['categorical_columns'])}

SQL table name: data

=== YOUR BEHAVIOR ===
1. Answer in 2-4 sentences of confident executive-ready language
2. If the question requires specific numbers, generate a supporting SQL query
3. When you use SQL results, state the real numbers from those results
4. For explicit forecast/prediction requests: set needs_forecast=true (handled separately)
5. If the question cannot be answered from this dataset, say exactly what is missing
6. Maintain conversation context for natural follow-ups
7. Never invent statistics

=== OUTPUT — valid JSON only ===
{{
  "cannot_answer": false,
  "answer": "2-4 sentence response",
  "supporting_sql": "SELECT ... or null",
  "needs_data": true,
  "needs_forecast": false
}}
Or if cannot answer:
{{ "cannot_answer": true, "reason": "specific explanation" }}
"""

def get_chat_response(schema: dict, dataset_filename: str,
                       message: str, history: list) -> dict:
    system_prompt = build_chat_system_prompt(schema, dataset_filename)
    messages = [{"role": t["role"], "parts": [t["content"]]} for t in history[-10:]]
    messages.append({
        "role": "user",
        "parts": [f"{system_prompt}\n\nUser: {message}"]
    })
    try:
        raw = model.generate_content(messages).text.strip()
        if raw.startswith("```"):
            parts = raw.split("```")
            raw = parts[1] if len(parts) > 1 else raw
            if raw.startswith("json"): raw = raw[4:].strip()
        return json.loads(raw)
    except Exception as e:
        return {"cannot_answer": True, "reason": str(e)}
```

---

### Step 10 — Voice assistant — frontend only

The voice assistant requires **zero backend changes**. It lives entirely in the frontend as a React hook.

```javascript
// frontend/src/hooks/useVoice.js
import { useState, useRef } from "react";

export function useVoice({ onTranscript, onSpeakText }) {
  const [listening,  setListening]  = useState(false);
  const [speaking,   setSpeaking]   = useState(false);
  const recognitionRef = useRef(null);

  // ── VOICE INPUT — Speech to Text ───────────────────────────
  const startListening = () => {
    if (!("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
      alert("Your browser does not support voice input. Try Chrome.");
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.lang = "en-US";
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;

    recognitionRef.current.onstart = () => setListening(true);
    recognitionRef.current.onend   = () => setListening(false);

    recognitionRef.current.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onTranscript(transcript);    // Send to same chat submit function as text
    };

    recognitionRef.current.onerror = (e) => {
      console.error("Speech recognition error:", e.error);
      setListening(false);
    };

    recognitionRef.current.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  // ── VOICE OUTPUT — Text to Speech ──────────────────────────
  const speak = (text) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();    // Stop any current speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend   = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  return { listening, speaking, startListening, stopListening, speak, stopSpeaking };
}
```

**VoiceButton component:**

```jsx
// frontend/src/components/chat/VoiceButton.jsx
import { useVoice } from "../../hooks/useVoice";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";

export default function VoiceButton({ onTranscript, lastAiMessage, isDark }) {
  const { listening, speaking, startListening, stopListening, speak, stopSpeaking }
    = useVoice({ onTranscript });

  const t = { accent: isDark ? "#6366f1" : "#4338ca", text: isDark ? "#eeeef8" : "#07071c" };

  return (
    <div style={{ display: "flex", gap: 8 }}>
      {/* Microphone — voice INPUT */}
      <button
        onClick={listening ? stopListening : startListening}
        title={listening ? "Stop listening" : "Speak your question"}
        style={{
          width: 38, height: 38, borderRadius: 10,
          background: listening ? "#fb718520" : "transparent",
          border: `1px solid ${listening ? "#fb7185" : "rgba(255,255,255,0.1)"}`,
          color: listening ? "#fb7185" : t.text,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", transition: "all 0.2s",
          animation: listening ? "pulse 1.5s ease-in-out infinite" : "none",
        }}
      >
        {listening ? <MicOff size={16} /> : <Mic size={16} />}
      </button>

      {/* Speaker — voice OUTPUT */}
      <button
        onClick={speaking
          ? stopSpeaking
          : () => lastAiMessage && speak(lastAiMessage)
        }
        title={speaking ? "Stop speaking" : "Read last response aloud"}
        style={{
          width: 38, height: 38, borderRadius: 10,
          background: speaking ? `${t.accent}20` : "transparent",
          border: `1px solid ${speaking ? t.accent : "rgba(255,255,255,0.1)"}`,
          color: speaking ? t.accent : t.text,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", transition: "all 0.2s",
        }}
      >
        {speaking ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </button>
    </div>
  );
}
```

---

## 9. Phase 4 — Multi-Output + Forecasting on Request

### Step 11 — Chart query engine with output_count — `llm/chart_engine.py`

```python
# backend/llm/chart_engine.py
import google.generativeai as genai, json
from config import settings

genai.configure(api_key=settings.GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-1.5-flash")

def get_chart_specs(schema: dict, prompt: str,
                    history: list, output_count: int = 1) -> dict:
    """
    Generate 1 or 2 chart specs based on user's output_count preference.
    output_count is controlled by a toggle in the frontend.
    """
    cols_text = "\n".join([
        f"  {c['name']} ({c['dtype']})"
        + (f" | range: {c.get('min')} to {c.get('max')}" if c['dtype']=='numeric' else "")
        + (f" | dates: {c.get('min_date')} to {c.get('max_date')}" if c['dtype']=='datetime' else "")
        + (f" | samples: {', '.join(c['sample_values'][:3])}" if c['dtype']=='categorical' else "")
        for c in schema["columns"]
    ])

    count_instruction = (
        "Return EXACTLY TWO different chart specifications. Option A = most direct answer. "
        "Option B = different metric OR different grouping OR different chart type. "
        "Never return two charts of identical type with the same metric."
        if output_count == 2
        else "Return EXACTLY ONE chart specification — the single most appropriate visualization."
    )

    system_prompt = f"""
You are a senior BI analyst. {count_instruction}

=== DATASET SCHEMA ===
Rows: {schema['row_count']}
Table name: data
Columns:
{cols_text}

Date columns: {schema['date_columns']}
Numeric columns: {schema['numeric_columns']}
Categorical columns: {schema['categorical_columns']}

=== SQL RULES ===
- Use ONLY columns listed above
- Table name is always: data
- Always alias: SUM(col) AS col
- Always ROUND floats: ROUND(SUM(col), 2) AS col
- Pie charts: always add LIMIT 6
- line: X must be a date/time column
- bar: X is categorical, Y is numeric
- pie: shows proportions of a whole
- scatter: both X and Y must be numeric

=== OUTPUT — valid JSON only, no markdown ===
{
  "cannot_answer": false,
  "options": [
    {
      "label": "Option A",
      "approach": "one sentence why this chart type",
      "sql": "SELECT ...",
      "chart_type": "bar|line|pie|scatter",
      "x_key": "col_name",
      "y_key": "col_name",
      "color_by": null,
      "title": "Short executive title",
      "insight": "One finding with a real number"
    }
  ]
}
If output_count=1: options array has 1 item.
If output_count=2: options array has 2 items.
If cannot answer: { "cannot_answer": true, "reason": "specific explanation" }
"""
    messages = [{"role": t["role"], "parts": [t["content"]]} for t in history[-6:]]
    messages.append({"role": "user", "parts": [f"{system_prompt}\n\nQuery: {prompt}"]})

    try:
        raw = model.generate_content(messages).text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"): raw = raw[4:].strip()
        return json.loads(raw)
    except Exception as e:
        return {"cannot_answer": True, "reason": str(e)}
```

---

### Step 12 — Forecasting engine (explicit request only) — `llm/forecast_engine.py`

**Important design decision:** Forecasting is NOT part of the dashboard. It is ONLY triggered when the chat engine sets `needs_forecast: true` (i.e., the user explicitly says "predict", "forecast", "what will happen", etc.)

```python
# backend/llm/forecast_engine.py
import numpy as np
from sqlite.executor import execute_query

def generate_simple_forecast(db_path: str, historical_sql: str,
                               periods: int = 3) -> dict:
    """
    Simple linear extrapolation forecast.
    No ML model needed — uses numpy polyfit on historical aggregated data.
    Always labeled as estimate with confidence range, not a prediction.

    Only called when user explicitly requests forecast in chat.
    """
    try:
        data = execute_query(db_path, historical_sql)
        if len(data) < 4:
            return {
                "success": False,
                "reason": "Not enough historical data points for a reliable forecast (need at least 4)"
            }

        # Extract numeric values
        keys = list(data[0].keys())
        x_key = keys[0]    # Time dimension
        y_key = keys[1]    # Value to forecast

        x_vals = list(range(len(data)))
        y_vals = [float(row[y_key]) for row in data]

        # Linear regression
        coeffs = np.polyfit(x_vals, y_vals, 1)   # degree 1 = linear
        slope, intercept = coeffs

        # Forecast next N periods
        forecast_points = []
        for i in range(1, periods + 1):
            x_future = len(data) + i - 1
            y_forecast = slope * x_future + intercept

            # Simple confidence range: ±15% of forecast value
            margin = abs(y_forecast) * 0.15
            forecast_points.append({
                "period": f"Forecast +{i}",
                "value": round(y_forecast, 2),
                "lower_bound": round(y_forecast - margin, 2),
                "upper_bound": round(y_forecast + margin, 2),
            })

        return {
            "success":         True,
            "historical":      data,
            "forecast":        forecast_points,
            "method":          "Linear extrapolation",
            "confidence_note": "Estimate based on historical trend. ±15% confidence range shown.",
            "disclaimer":      "This is a statistical estimate, not a guaranteed prediction.",
            "y_key":           y_key,
            "x_key":           x_key,
        }
    except Exception as e:
        return {"success": False, "reason": str(e)}
```

**How forecast is triggered from chat:**

```python
# In routers/chat.py — after getting chat_result:
if chat_result.get("needs_forecast") and chat_result.get("supporting_sql"):
    forecast_data = generate_simple_forecast(
        db_path=dataset["db_path"],
        historical_sql=chat_result["supporting_sql"],
        periods=3
    )
    # Return both the narrative answer AND the forecast data
    return ChatResponse(
        answer=chat_result["answer"],
        forecast=forecast_data,
        is_forecast=True,
        disclaimer="Statistical estimate based on historical trend only."
    )
```

---

## 10. Phase 5 — PDF Report Generation

**Goal:** User selects charts from their canvas, clicks "Generate Report", gets a downloadable PDF with charts + executive summary + statistical calculations.

---

### Step 13 — Report LLM engine — `llm/report_engine.py`

```python
# backend/llm/report_engine.py
import google.generativeai as genai
from config import settings

genai.configure(api_key=settings.GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-1.5-flash")

def generate_report_summary(dataset_name: str, charts: list) -> str:
    """
    Generate the executive summary paragraph for the PDF.
    charts is a list of {title, insight, chart_type} dicts.
    """
    chart_descriptions = "\n".join([
        f"- {c['title']}: {c.get('insight', 'No insight available')}"
        for c in charts
    ])
    prompt = f"""
You are writing an executive summary for a business analytics report on: {dataset_name}

The report contains these charts and findings:
{chart_descriptions}

Write a 3-5 sentence executive summary paragraph that:
1. Opens with the most important finding
2. Connects the key insights into a coherent narrative
3. Ends with one clear business recommendation
4. Uses specific numbers from the insights where possible
5. Sounds like a senior management consultant wrote it

Return ONLY the paragraph text. No headers, no bullet points, no JSON.
"""
    try:
        return model.generate_content(prompt).text.strip()
    except:
        return "Executive summary unavailable. Please review the charts below for key insights."
```

---

### Step 14 — PDF generator — `pdf/generator.py`

```python
# backend/pdf/generator.py
import io, base64
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer,
                                  Table, TableStyle, Image, HRFlowable)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY

def build_pdf_report(
    dataset_name: str,
    executive_summary: str,
    charts: list,              # Each: {title, insight, chart_type, data, image_base64}
    stats: dict = None
) -> bytes:
    """
    Build a complete PDF report.
    charts list must include image_base64 — chart screenshots from frontend.
    Returns PDF as bytes for streaming download.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm,
        topMargin=2*cm, bottomMargin=2*cm
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle("Title",
        fontName="Helvetica-Bold", fontSize=20,
        textColor=colors.HexColor("#07071c"),
        spaceAfter=6, leading=24
    )
    subtitle_style = ParagraphStyle("Subtitle",
        fontName="Helvetica", fontSize=11,
        textColor=colors.HexColor("#3e4268"),
        spaceAfter=16
    )
    section_header_style = ParagraphStyle("SectionHeader",
        fontName="Helvetica-Bold", fontSize=13,
        textColor=colors.HexColor("#4338ca"),
        spaceBefore=16, spaceAfter=8
    )
    body_style = ParagraphStyle("Body",
        fontName="Helvetica", fontSize=10,
        textColor=colors.HexColor("#3e4268"),
        leading=16, alignment=TA_JUSTIFY, spaceAfter=8
    )
    insight_style = ParagraphStyle("Insight",
        fontName="Helvetica-Oblique", fontSize=9,
        textColor=colors.HexColor("#4338ca"),
        leftIndent=12, spaceAfter=8
    )
    chart_title_style = ParagraphStyle("ChartTitle",
        fontName="Helvetica-Bold", fontSize=11,
        textColor=colors.HexColor("#07071c"),
        spaceAfter=4
    )

    story = []

    # ── HEADER ─────────────────────────────────────────────────
    story.append(Paragraph("Narralytics", ParagraphStyle("Brand",
        fontName="Helvetica-Bold", fontSize=11,
        textColor=colors.HexColor("#4338ca"), spaceAfter=4
    )))
    story.append(Paragraph(f"Analytics Report: {dataset_name}", title_style))
    story.append(Paragraph(
        f"Generated: {datetime.now().strftime('%B %d, %Y at %H:%M')}",
        subtitle_style
    ))
    story.append(HRFlowable(width="100%", thickness=1,
        color=colors.HexColor("#e8e8f4"), spaceAfter=16))

    # ── EXECUTIVE SUMMARY ──────────────────────────────────────
    story.append(Paragraph("Executive Summary", section_header_style))
    story.append(Paragraph(executive_summary, body_style))
    story.append(Spacer(1, 12))

    # ── STATISTICAL OVERVIEW (if provided) ────────────────────
    if stats:
        story.append(Paragraph("Statistical Overview", section_header_style))
        table_data = [["Metric", "Value"]]
        for k, v in stats.items():
            table_data.append([str(k), str(v)])

        stat_table = Table(table_data, colWidths=[8*cm, 8*cm])
        stat_table.setStyle(TableStyle([
            ("BACKGROUND",   (0,0), (-1,0), colors.HexColor("#4338ca")),
            ("TEXTCOLOR",    (0,0), (-1,0), colors.white),
            ("FONTNAME",     (0,0), (-1,0), "Helvetica-Bold"),
            ("FONTSIZE",     (0,0), (-1,-1), 9),
            ("ROWBACKGROUNDS", (0,1), (-1,-1),
             [colors.HexColor("#f4f4fa"), colors.white]),
            ("GRID",         (0,0), (-1,-1), 0.5, colors.HexColor("#e8e8f4")),
            ("LEFTPADDING",  (0,0), (-1,-1), 8),
            ("RIGHTPADDING", (0,0), (-1,-1), 8),
            ("TOPPADDING",   (0,0), (-1,-1), 5),
            ("BOTTOMPADDING",(0,0), (-1,-1), 5),
        ]))
        story.append(stat_table)
        story.append(Spacer(1, 16))

    # ── CHARTS ─────────────────────────────────────────────────
    story.append(Paragraph("Dashboard Charts", section_header_style))

    for i, chart in enumerate(charts):
        story.append(Paragraph(f"{i+1}. {chart['title']}", chart_title_style))

        # Chart image (base64 encoded PNG from frontend)
        if chart.get("image_base64"):
            img_data = base64.b64decode(chart["image_base64"])
            img_buffer = io.BytesIO(img_data)
            img = Image(img_buffer, width=15*cm, height=8*cm)
            story.append(img)

        # Insight text below chart
        if chart.get("insight"):
            story.append(Paragraph(f"💡 {chart['insight']}", insight_style))

        story.append(Spacer(1, 12))

    # ── FOOTER ─────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=1,
        color=colors.HexColor("#e8e8f4"), spaceBefore=16))
    story.append(Paragraph(
        f"Generated by Narralytics · narralytics.vercel.app · {datetime.now().year}",
        ParagraphStyle("Footer", fontName="Helvetica", fontSize=8,
            textColor=colors.HexColor("#8888b0"), alignment=TA_CENTER)
    ))

    doc.build(story)
    return buffer.getvalue()
```

---

### Step 15 — Report route — `routers/report.py`

```python
# backend/routers/report.py
from fastapi import APIRouter, Depends
from fastapi.responses import Response
from auth.dependencies import get_current_user
from database.datasets import get_dataset
from llm.report_engine import generate_report_summary
from pdf.generator import build_pdf_report
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

router = APIRouter(prefix="/report", tags=["report"])

class ChartForReport(BaseModel):
    title: str
    insight: Optional[str] = None
    chart_type: str
    image_base64: Optional[str] = None   # PNG screenshot from frontend

class ReportRequest(BaseModel):
    dataset_id: str
    charts: List[ChartForReport]
    include_stats: bool = True

@router.post("/generate")
async def generate_report(
    req: ReportRequest,
    user: dict = Depends(get_current_user)
):
    dataset = await get_dataset(req.dataset_id, user["sub"])
    if not dataset:
        from fastapi import HTTPException
        raise HTTPException(404, "Dataset not found")

    # Generate executive summary from LLM
    summary = generate_report_summary(
        dataset_name=dataset["original_filename"],
        charts=[c.dict() for c in req.charts]
    )

    # Build statistical overview if requested
    stats = None
    if req.include_stats:
        stats = {
            "Dataset": dataset["original_filename"],
            "Total Rows": f"{dataset['row_count']:,}",
            "Total Columns": dataset["column_count"],
            "Numeric Columns": len(dataset["numeric_columns"]),
            "Date Columns": len(dataset["date_columns"]),
            "Categorical Columns": len(dataset["categorical_columns"]),
            "Charts in Report": len(req.charts),
            "Report Generated": datetime.now().strftime("%Y-%m-%d %H:%M"),
        }

    # Build PDF
    pdf_bytes = build_pdf_report(
        dataset_name=dataset["original_filename"],
        executive_summary=summary,
        charts=[c.dict() for c in req.charts],
        stats=stats
    )

    filename = f"narralytics_report_{dataset['original_filename'].replace('.csv','').replace(' ','_')}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
```

Install: `pip install reportlab`

---

## 11. Phase 6 — AWS Migration

**When to do this:** After all features work locally and the demo is stable.
**Time estimate:** 4-6 hours for a clean migration.

### What changes vs what stays the same

| Component | Local | AWS | Change needed |
|---|---|---|---|
| FastAPI app | uvicorn | Mangum + Lambda | Add `handler = Mangum(app)` to main.py |
| MongoDB | Atlas (already cloud) | Atlas (same) | **Nothing** — Atlas works everywhere |
| SQLite | `/tmp/uuid.db` | `/tmp/uuid.db` | **Nothing** — Lambda's /tmp works the same |
| File storage | `./uploads/` | S3 bucket | Swap `storage/local.py` for `storage/s3.py` |
| History | MongoDB | MongoDB (or DynamoDB) | Optional: swap `history.py` driver |
| Env vars | `.env` file | Lambda env vars | Copy paste |
| CORS | `localhost:5173` | Vercel URL | Update FRONTEND_URL |

### Step 16 — Add Mangum to main.py (5 min)

```python
# backend/main.py — add ONE line at the bottom
from mangum import Mangum
# ... all your existing code ...

handler = Mangum(app)    # This is ALL that changes for Lambda compatibility
```

### Step 17 — File storage abstraction — `storage/local.py` and `storage/s3.py`

Write your file operations behind a clean interface so swapping is one import change:

```python
# storage/local.py  (used now)
import os, shutil

def save_upload(file_bytes: bytes, filename: str, upload_dir: str) -> str:
    """Save uploaded file, return full path."""
    os.makedirs(upload_dir, exist_ok=True)
    path = os.path.join(upload_dir, filename)
    with open(path, "wb") as f:
        f.write(file_bytes)
    return path

def get_file_path(filename: str, upload_dir: str) -> str:
    return os.path.join(upload_dir, filename)
```

```python
# storage/s3.py  (Phase 6 — swap this in)
import boto3, os

s3 = boto3.client("s3", region_name=os.getenv("AWS_REGION"))
BUCKET = os.getenv("AWS_BUCKET")

def save_upload(file_bytes: bytes, filename: str, upload_dir: str = None) -> str:
    """Upload to S3, return S3 key."""
    key = f"uploads/{filename}"
    s3.put_object(Bucket=BUCKET, Key=key, Body=file_bytes)
    return key

def get_file_path(filename: str, upload_dir: str = None) -> str:
    """Download from S3 to Lambda /tmp, return local path."""
    local_path = f"/tmp/{filename}"
    if not os.path.exists(local_path):
        s3.download_file(BUCKET, f"uploads/{filename}", local_path)
    return local_path
```

In `routers/datasets.py` — change just this import:
```python
# Phase 1-5: from storage.local import save_upload, get_file_path
# Phase 6:   from storage.s3 import save_upload, get_file_path
```

### Step 18 — History module swap — `database/history.py`

```python
# database/history.py — current (MongoDB)
from database.mongodb import get_db
from datetime import datetime

async def save_interaction(user_id: str, interaction_type: str, payload: dict):
    try:
        db = get_db()
        await db.conversation_history.insert_one({
            "user_id": user_id, "type": interaction_type,
            "timestamp": datetime.utcnow(), "payload": payload
        })
    except Exception as e:
        print(f"History save failed (non-fatal): {e}")

async def get_history(user_id: str, limit: int = 50) -> list:
    try:
        db = get_db()
        cursor = db.conversation_history.find(
            {"user_id": user_id},
            sort=[("timestamp", -1)],
            limit=limit
        )
        return await cursor.to_list(length=limit)
    except:
        return []
```

To switch to DynamoDB in Phase 6, only this file changes. The rest of the codebase calls `save_interaction()` and `get_history()` — both function signatures stay identical.

### Step 19 — Lambda deployment package

```bash
cd backend
pip install -r requirements.txt --target ./package --upgrade
cp -r auth database llm pdf routers sqlite storage models *.py ./package/
cd package && zip -r ../narralytics_lambda.zip . && cd ..
```

Lambda settings:
- Runtime: Python 3.11
- Handler: `main.handler`
- Timeout: **30 seconds** (Gemini + PDF generation needs this)
- Memory: **512 MB** (pandas + reportlab needs this)

---

## 12. All API Endpoints Reference

| Method | Path | Auth | Phase | Purpose |
|---|---|---|---|---|
| GET | `/health` | None | 1 | Status check |
| GET | `/auth/google` | None | 1 | Redirect to Google OAuth |
| GET | `/auth/callback` | None | 1 | Exchange code, issue JWT |
| GET | `/auth/me` | JWT | 1 | Return user profile |
| POST | `/datasets/upload` | JWT | 1 | Upload CSV/Excel |
| GET | `/datasets/` | JWT | 1 | List user's datasets |
| DELETE | `/datasets/{id}` | JWT | 1 | Delete dataset |
| POST | `/dashboard/auto/{dataset_id}` | JWT | 2 | Auto-generate full dashboard |
| POST | `/query` | JWT | 2 | NL → 1 or 2 chart specs + data |
| POST | `/chat` | JWT | 3 | NL → narrative + optional forecast |
| GET | `/history/{dataset_id}` | JWT | 3 | Conversation history |
| POST | `/report/generate` | JWT | 5 | Generate PDF report |

---

## 13. LLM Prompt Design

### Three separate LLM modules — never combined

| Module | Input | Output | Prompt style |
|---|---|---|---|
| `auto_dashboard.py` | Schema only | 6-10 chart specs | Schema analysis + variety rules |
| `chart_engine.py` | Schema + NL query + output_count | 1 or 2 chart specs | SQL generation + chart selection rules |
| `chat_engine.py` | Schema + NL question + history | Narrative answer + optional SQL | Analyst persona + needs_forecast flag |
| `forecast_engine.py` | Historical SQL result | Statistical extrapolation | No LLM — numpy only |
| `report_engine.py` | Chart titles + insights | Executive summary paragraph | Management consultant persona |

### The cannot_answer gate — critical for scoring

Both `chart_engine.py` and `chat_engine.py` must return `cannot_answer: true` for:
- Columns not in the uploaded schema
- Questions requiring data not present (profit, inventory, customer PII)
- Questions about completely different datasets

This is tested explicitly in the Hallucination Handling category (10 pts).

### Schema injection strategy

Every LLM call receives the full detected schema. This prevents column name hallucination. The schema includes:
- Exact column names (from `schema_detector.py`)
- Data type per column
- Value ranges for numerics
- Sample values for categoricals
- Date ranges for datetime columns

The LLM cannot invent a column that was not listed.

---

## 14. Scoring Strategy — 110/100

| Category | Points | Your Strategy |
|---|---|---|
| Data Retrieval Accuracy | 15 | Schema injection in every prompt. Exact column names. cannot_answer gate. |
| Contextual Chart Selection | 15 | Explicit rules: line=time, bar=comparison, pie=proportion, scatter=correlation. |
| Error Handling | 10 | cannot_answer tested with 5 out-of-scope queries. Graceful error cards in UI. |
| Visual Design | 10 | Generated Landing + Dashboard JSX files — already fixed text visibility. |
| Interactivity | 10 | Recharts tooltips, View Query toggle, voice input/output, output count selector. |
| User Flow | 10 | Upload → Auto-dash → Chat → PDF. Skeleton loaders. Empty states. |
| Architecture | 10 | MongoDB + SQLite + Gemini + FastAPI → AWS clean migration path. |
| Prompt Engineering | 10 | 5 separate LLM modules each optimized for one task. Cannot_answer gate. |
| Follow-up Bonus | +10 | History array on every call. Session context maintained. |
| CSV Upload Bonus | +20 | Full CSV upload with schema detection, SQLite creation, per-user isolation. |
| **TOTAL** | **120** | All base + both bonuses |

---

## 15. FastAPI → AWS Compatibility Checklist

Run through this before starting Phase 6:

```
☐  handler = Mangum(app) added to bottom of main.py
☐  All file paths use /tmp/ prefix (not relative paths)
☐  DB_PATH uses /tmp/uuid.db (not ./uploads/)
☐  MongoDB Atlas URI is in Lambda environment variables
☐  UPLOAD_DIR is not used — replaced by S3 functions
☐  storage/s3.py imported instead of storage/local.py
☐  CORS allow_origins includes Vercel URL, not just localhost
☐  Google OAuth REDIRECT_URI updated to API Gateway URL
☐  FRONTEND_URL updated to Vercel URL
☐  Lambda timeout set to 30 seconds
☐  Lambda memory set to 512 MB
☐  requirements.txt includes mangum, motor, reportlab
☐  .env values copied to Lambda environment variables
☐  DynamoDB table created (if switching from MongoDB history)
☐  API Gateway route: ANY /{proxy+} → Lambda
```

---

## requirements.txt — Complete

```
fastapi
uvicorn
mangum
motor
pymongo
pandas
openpyxl
google-generativeai
python-dotenv
pydantic
pydantic-settings
authlib
httpx
python-jose[cryptography]
boto3
reportlab
numpy
python-multipart
```

---

## .env — Complete Template

```
# Google OAuth
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
REDIRECT_URI=http://localhost:8000/auth/callback
FRONTEND_URL=http://localhost:5173

# JWT
JWT_SECRET=run: python -c "import secrets; print(secrets.token_hex(32))"

# MongoDB (get from MongoDB Atlas → Connect → Drivers)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
MONGODB_DB=narralytics

# Gemini (from aistudio.google.com)
GEMINI_API_KEY=AIza...

# Storage
UPLOAD_DIR=./uploads

# AWS (Phase 6 only — leave empty for now)
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# AWS_REGION=us-east-1
# AWS_BUCKET=narralytics-uploads
# DYNAMODB_TABLE=narralytics_history
```

---

*Narralytics · github.com/Suvam-paul145/narralytics*
*FastAPI → AWS Migration Ready · MongoDB + Gemini 1.5 Flash*
