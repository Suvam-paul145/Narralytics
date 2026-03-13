# 🧠 Narralytics — Final Hackathon Roadmap
### AWS Lambda Backend · Dual Chart Generation · Natural Business Chat · DynamoDB History

> **Dataset:** Amazon Sales (50,000 rows · 2022–2023 · Hardcoded SQLite in Lambda)
> **Backend:** FastAPI on AWS Lambda + API Gateway
> **Frontend:** React + Vite on Vercel
> **Auth:** Google OAuth 2.0 + JWT
> **LLM:** Google Gemini 1.5 Flash
> **History:** AWS DynamoDB (persistent across sessions)
> **Timeline:** 3 Days · **Target Score:** 110/100

---

## 🗺️ Complete User Journey

```
[Landing Page]
      │
      │ Click "Get Started"
      ▼
[Google OAuth → JWT issued]
      │
      ▼
[Dashboard — Protected Route]
      │
      ├──────────────────────────────────────────────────────┐
      │                                                      │
      ▼                                                      ▼
[📊 CHART MODE]                                    [💬 CHAT MODE]
User types a data question                   User asks any business question
      │                                                      │
      ▼                                                      ▼
[Gemini → 2 SQL specs]                    [Gemini → plain text answer]
[SQLite executes both]                    [SQLite runs supporting query]
[Two chart previews shown]                [Narrative response shown]
[User selects one]                        [No chart generated]
      │                                                      │
      └──────────────────┬───────────────────────────────────┘
                         │
                         ▼
              [DynamoDB — Full history saved]
              (persists across sessions, shown in sidebar)
```

---

## 📁 Final Project Structure

```
Narralytics/
├── backend/
│   ├── main.py                   # FastAPI app + Mangum Lambda wrapper
│   ├── database.py               # SQLite init from bundled CSV
│   ├── llm_chart.py              # Gemini → dual chart spec (JSON)
│   ├── llm_chat.py               # Gemini → natural text answer
│   ├── auth.py                   # Google OAuth + JWT
│   ├── history.py                # DynamoDB read/write helpers
│   ├── models.py                 # Pydantic schemas
│   ├── query_executor.py         # SQL runner
│   ├── data/
│   │   └── amazon_sales.csv      # Bundled with Lambda zip
│   ├── requirements.txt
│   └── .env
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx               # React Router routes
│   │   ├── pages/
│   │   │   ├── Landing.jsx           # Public marketing page
│   │   │   ├── Dashboard.jsx         # Protected app shell
│   │   │   └── AuthCallback.jsx      # OAuth redirect handler
│   │   ├── components/
│   │   │   ├── ModeToggle.jsx         # ★ Switch: Chart Mode / Chat Mode
│   │   │   ├── ChartSelector.jsx      # Two side-by-side chart previews
│   │   │   ├── ChartRenderer.jsx      # Recharts: bar/line/pie/scatter
│   │   │   ├── InsightCard.jsx        # Confirmed chart card
│   │   │   ├── DashboardCanvas.jsx    # Grid of confirmed charts
│   │   │   ├── ChatWindow.jsx         # ★ Natural chat conversation UI
│   │   │   ├── ChatMessage.jsx        # Single chat bubble component
│   │   │   ├── HistorySidebar.jsx     # Full history from DynamoDB
│   │   │   ├── ChatInput.jsx          # Shared input bar (both modes)
│   │   │   ├── SkeletonLoader.jsx
│   │   │   └── NavBar.jsx
│   │   ├── hooks/
│   │   │   ├── useDashboard.js        # Chart mode state + API
│   │   │   ├── useChat.js             # ★ Chat mode state + API
│   │   │   └── useAuth.js
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   └── styles/globals.css
│   └── package.json
│
└── README.md
```

---

## 🗓️ DAY 1 — Full Backend (Local → Lambda-Ready)

**Goal:** Every backend endpoint works perfectly on localhost.
Build locally first. Do NOT touch AWS until Day 3.

---

### ✅ Step 1 · Bootstrap + AWS Account Prep (30 min)

```bash
mkdir Narralytics && cd Narralytics
mkdir backend && cd backend
python3 -m venv venv && source venv/bin/activate
pip install fastapi uvicorn mangum pandas google-generativeai \
    python-dotenv pydantic authlib httpx python-jose[cryptography] boto3
```

**`.env` file:**
```
GEMINI_API_KEY=your_gemini_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
REDIRECT_URI=http://localhost:8000/auth/callback
FRONTEND_URL=http://localhost:5173
JWT_SECRET=your_256bit_random_secret

# AWS — fill these on Day 3 before Lambda deploy
AWS_REGION=us-east-1
DYNAMODB_TABLE=Narralytics_history
```

**AWS prep (do this now, takes 10 min):**
1. Log in to AWS Console
2. Create IAM user with `AmazonDynamoDBFullAccess` + `AWSLambda_FullAccess` + `AmazonAPIGatewayAdministrator`
3. Download access keys → save them
4. Create DynamoDB table: name = `Narralytics_history`, Partition key = `user_id` (String), Sort key = `timestamp` (String)
5. That's it. Don't touch Lambda yet.

---

### ✅ Step 2 · SQLite Database Loader (45 min)

**`backend/database.py`**
```python
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
```

> **Note on Lambda:** Lambda's `/tmp` directory is 512 MB and persists for the lifetime of a warm container. SQLite loads once on cold start and stays warm for all subsequent requests in the same container. This is perfectly reliable for your use case.

---

### ✅ Step 3 · DynamoDB History Manager (1 hr)

**`backend/history.py`**

This stores every interaction — both chart queries and chat messages — under the user's Google ID. When the frontend loads, it fetches the last 50 entries to populate the sidebar.

```python
import boto3, os
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

dynamodb = boto3.resource(
    "dynamodb",
    region_name=os.getenv("AWS_REGION", "us-east-1")
)
table = dynamodb.Table(os.getenv("DYNAMODB_TABLE", "Narralytics_history"))

def save_interaction(user_id: str, interaction_type: str, payload: dict):
    """
    interaction_type: "chart_query" | "chat_message"
    payload: { prompt, response_summary, chart_type (if chart), etc. }
    """
    timestamp = datetime.now(timezone.utc).isoformat()
    try:
        table.put_item(Item={
            "user_id":   user_id,
            "timestamp": timestamp,
            "type":      interaction_type,
            "payload":   payload
        })
    except Exception as e:
        print(f"DynamoDB write failed (non-fatal): {e}")
        # Non-fatal — never let history failure break the main flow

def get_history(user_id: str, limit: int = 50) -> list:
    """Fetch last N interactions for this user."""
    try:
        response = table.query(
            KeyConditionExpression="user_id = :uid",
            ExpressionAttributeValues={":uid": user_id},
            ScanIndexForward=False,  # Most recent first
            Limit=limit
        )
        return response.get("Items", [])
    except Exception as e:
        print(f"DynamoDB read failed (non-fatal): {e}")
        return []
```

---

### ✅ Step 4 · Pydantic Models (30 min)

**`backend/models.py`**
```python
from pydantic import BaseModel
from typing import Optional, List

class ConversationTurn(BaseModel):
    role: str       # "user" | "assistant"
    content: str

class QueryRequest(BaseModel):
    prompt:  str
    history: List[ConversationTurn] = []

class ChatRequest(BaseModel):
    message: str
    history: List[ConversationTurn] = []

class ChartSpec(BaseModel):
    cannot_answer: bool          = False
    reason:        Optional[str] = None
    sql:           Optional[str] = None
    chart_type:    Optional[str] = None
    x_key:         Optional[str] = None
    y_key:         Optional[str] = None
    color_by:      Optional[str] = None
    title:         Optional[str] = None
    label:         Optional[str] = None
    approach:      Optional[str] = None
    insight:       Optional[str] = None

class DualChartOption(BaseModel):
    spec:    ChartSpec
    data:    list      = []
    raw_sql: Optional[str] = None
    error:   Optional[str] = None

class DualDashboardResponse(BaseModel):
    cannot_answer: bool               = False
    reason:        Optional[str]      = None
    option_a:      Optional[DualChartOption] = None
    option_b:      Optional[DualChartOption] = None

class ChatResponse(BaseModel):
    answer:        str
    supporting_sql: Optional[str] = None
    data_used:     list           = []
    cannot_answer: bool           = False
```

---

### ✅ Step 5 · LLM — Dual Chart Spec (1.5 hrs)

**`backend/llm_chart.py`**
```python
import google.generativeai as genai, json, os
from models import QueryRequest, ChartSpec
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-1.5-flash")

CHART_SYSTEM_PROMPT = """
You are a senior BI analyst. Convert a business question into EXACTLY TWO different
chart specifications — two genuinely different visual perspectives on the same question.

=== DATABASE SCHEMA ===
Table: amazon_sales
  order_id, order_date (YYYY-MM-DD), order_month (YYYY-MM), order_quarter (Q1-2022),
  order_year (INT), product_id, product_category (Books|Fashion|Sports|Beauty|
  Electronics|Home & Kitchen), price (FLOAT), discount_percent (INT),
  quantity_sold (INT), customer_region (North America|Asia|Europe|Middle East),
  payment_method (UPI|Credit Card|Wallet|Cash on Delivery|Debit Card),
  rating (FLOAT 0-5), review_count (INT), discounted_price (FLOAT),
  total_revenue (FLOAT = discounted_price × quantity_sold)
Data range: 2022-01-01 to 2023-12-31

=== BUSINESS RULES ===
- "revenue" = total_revenue | "avg order value" = AVG(total_revenue)
- Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec
- Use order_month for monthly grouping, order_year for year filter
- Always ROUND(float, 2) | Pie charts: LIMIT 6 | TOP-N: ORDER BY metric DESC LIMIT N

=== CHART RULES ===
line → time trends (month/quarter on X)
bar  → category/region comparisons
pie  → proportional share (max 6 slices)
scatter → correlation between 2 numeric columns
Option A = most direct answer | Option B = different metric OR different grouping

=== OUTPUT — ONLY valid JSON, no markdown ===
{
  "cannot_answer": false,
  "options": [
    {
      "label": "Option A",
      "approach": "why this chart for this question",
      "sql": "SELECT ...",
      "chart_type": "bar|line|pie|scatter",
      "x_key": "col", "y_key": "col", "color_by": null,
      "title": "Executive title",
      "insight": "Key business finding sentence"
    },
    { ...same structure for Option B... }
  ]
}
OR if cannot answer:
{ "cannot_answer": true, "reason": "what data is missing" }
"""

def get_dual_chart_specs(request: QueryRequest) -> dict:
    messages = [{"role": t.role, "parts": [t.content]}
                for t in request.history[-6:]]
    messages.append({
        "role": "user",
        "parts": [f"{CHART_SYSTEM_PROMPT}\n\nQuestion: {request.prompt}"]
    })
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

### ✅ Step 6 · LLM — Natural Business Chat (1.5 hrs)

**`backend/llm_chat.py`**

This is the new core feature. The user asks any business question in plain English — "Why are Electronics performing better than Books?", "What should we do about the Middle East region?", "Is the discount strategy working?" — and Gemini answers like a senior business analyst. If it needs numbers to support the answer, it generates a supporting SQL query, runs it silently, and weaves the real data into the narrative.

```python
import google.generativeai as genai, json, os
from models import ChatRequest
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-1.5-flash")

CHAT_SYSTEM_PROMPT = """
You are a senior business analyst and data strategist. You have access to an
Amazon e-commerce sales dataset (50,000 transactions, 2022–2023).

Your job: answer business questions in clear, confident, executive-ready language.
You are NOT generating charts. You are giving a narrative answer.

=== DATASET CONTEXT ===
Table: amazon_sales
Categories: Books, Fashion, Sports, Beauty, Electronics, Home & Kitchen
Regions: North America, Asia, Europe, Middle East
Payment: UPI, Credit Card, Wallet, Cash on Delivery, Debit Card
Metrics: price, discount_percent, quantity_sold, rating, review_count,
         discounted_price, total_revenue
Date range: Jan 2022 – Dec 2023

=== YOUR BEHAVIOR ===
1. If the question requires data to answer precisely, generate a supporting SQL query.
2. Always answer in 2-4 sentences of clear business language.
3. If you use data, state the numbers confidently in your answer.
4. If the question is completely outside this dataset scope, say so honestly.
5. Maintain context from conversation history for follow-up questions.

=== OUTPUT — ONLY valid JSON ===
{
  "cannot_answer": false,
  "answer": "Your 2-4 sentence business analyst response here.",
  "supporting_sql": "SELECT ... (or null if no data needed)",
  "needs_data": true
}
OR:
{ "cannot_answer": true, "reason": "This question is outside the available data." }
"""

def get_chat_answer(request: ChatRequest) -> dict:
    messages = [{"role": t.role, "parts": [t.content]}
                for t in request.history[-10:]]  # More history for chat context
    messages.append({
        "role": "user",
        "parts": [f"{CHAT_SYSTEM_PROMPT}\n\nUser question: {request.message}"]
    })
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

### ✅ Step 7 · Google OAuth + JWT (45 min)

**`backend/auth.py`** — same as previous roadmap, no changes needed here.
Covers: `get_google_auth_url()`, `exchange_code_for_user()`, `create_jwt()`, `get_current_user()`.

---

### ✅ Step 8 · SQL Executor (20 min)

**`backend/query_executor.py`**
```python
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
```

---

### ✅ Step 9 · FastAPI Main App — All Routes (1.5 hrs)

**`backend/main.py`**
```python
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from mangum import Mangum                        # ← Lambda adapter
from database import init_db
from llm_chart import get_dual_chart_specs
from llm_chat import get_chat_answer
from query_executor import execute_query
from history import save_interaction, get_history
from auth import get_google_auth_url, exchange_code_for_user, create_jwt, get_current_user
from models import (QueryRequest, ChatRequest, DualDashboardResponse,
                    DualChartOption, ChartSpec, ChatResponse)
import os

app = FastAPI(title="Narralytics API")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "https://your-app.vercel.app"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    init_db()

# ─── AUTH ──────────────────────────────────────────────
@app.get("/auth/google")
def login():
    return RedirectResponse(url=get_google_auth_url())

@app.get("/auth/callback")
async def callback(code: str):
    try:
        user  = await exchange_code_for_user(code)
        token = create_jwt(user)
        return RedirectResponse(url=f"{FRONTEND_URL}/auth/callback#token={token}")
    except:
        return RedirectResponse(url=f"{FRONTEND_URL}?auth_error=true")

@app.get("/auth/me")
def me(current_user: dict = Depends(get_current_user)):
    return {"email": current_user["email"],
            "name":  current_user["name"],
            "picture": current_user["picture"]}

# ─── HISTORY ───────────────────────────────────────────
@app.get("/history")
def fetch_history(current_user: dict = Depends(get_current_user)):
    """Load full conversation history for sidebar."""
    items = get_history(current_user["sub"])
    return {"history": items}

# ─── CHART QUERY ───────────────────────────────────────
@app.post("/query")
def chart_query(request: QueryRequest,
                current_user: dict = Depends(get_current_user)):
    result = get_dual_chart_specs(request)

    if result.get("cannot_answer"):
        save_interaction(current_user["sub"], "chart_query", {
            "prompt": request.prompt,
            "result": "cannot_answer",
            "reason": result.get("reason")
        })
        return DualDashboardResponse(cannot_answer=True, reason=result.get("reason"))

    options = result.get("options", [])
    if len(options) < 2:
        return DualDashboardResponse(cannot_answer=True,
                                     reason="Incomplete AI response. Please rephrase.")

    def build_option(raw: dict) -> DualChartOption:
        spec = ChartSpec(**{k: v for k, v in raw.items()
                            if k in ChartSpec.model_fields})
        try:
            data = execute_query(spec.sql)
            return DualChartOption(spec=spec, data=data, raw_sql=spec.sql)
        except ValueError as e:
            return DualChartOption(spec=spec, data=[], error=str(e))

    option_a = build_option(options[0])
    option_b = build_option(options[1])

    # Save to DynamoDB
    save_interaction(current_user["sub"], "chart_query", {
        "prompt":        request.prompt,
        "option_a_title": option_a.spec.title,
        "option_b_title": option_b.spec.title,
        "chart_types":   f"{option_a.spec.chart_type} / {option_b.spec.chart_type}"
    })

    return DualDashboardResponse(cannot_answer=False,
                                 option_a=option_a, option_b=option_b)

# ─── NATURAL CHAT ──────────────────────────────────────
@app.post("/chat")
def business_chat(request: ChatRequest,
                  current_user: dict = Depends(get_current_user)):
    result = get_chat_answer(request)

    if result.get("cannot_answer"):
        save_interaction(current_user["sub"], "chat_message", {
            "message": request.message,
            "result":  "cannot_answer"
        })
        return ChatResponse(
            answer="I don't have data to answer that question. " + result.get("reason", ""),
            cannot_answer=True
        )

    answer      = result.get("answer", "")
    sql         = result.get("supporting_sql")
    data_used   = []

    # If LLM requested a SQL to support its answer, run it silently
    if sql and result.get("needs_data"):
        try:
            data_used = execute_query(sql)
            # Re-prompt Gemini with actual data to refine the answer
            if data_used:
                refinement = f"""
                Here is the actual data from the database: {str(data_used[:10])}
                Original answer draft: {answer}
                Now rewrite the answer incorporating these exact numbers. 
                Return ONLY the final answer text, no JSON.
                """
                refined = model_chat_refine(refinement)
                if refined:
                    answer = refined
        except:
            pass  # Use original LLM answer if SQL fails

    save_interaction(current_user["sub"], "chat_message", {
        "message":  request.message,
        "answer":   answer[:200],  # Store summary only
        "had_data": len(data_used) > 0
    })

    return ChatResponse(answer=answer, supporting_sql=sql,
                        data_used=data_used[:5], cannot_answer=False)

def model_chat_refine(prompt: str) -> str:
    try:
        import google.generativeai as genai
        m = genai.GenerativeModel("gemini-1.5-flash")
        return m.generate_content(prompt).text.strip()
    except:
        return ""

# ─── LAMBDA HANDLER ────────────────────────────────────
handler = Mangum(app)          # This single line makes FastAPI work on Lambda
```

**Test everything locally before Day 2:**
```bash
uvicorn main:app --reload --port 8000
# Test /auth/google, /query, /chat, /history in Swagger at localhost:8000/docs
```

---

## 🗓️ DAY 2 — Full Frontend

**Goal:** Complete working UI end-to-end on localhost. Both chart mode and chat mode fully functional.

---

### ✅ Step 10 · React Setup + Global Styles (30 min)

```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install recharts axios lucide-react react-router-dom react-markdown
```

`globals.css` — same dark theme as previous roadmap:
- Background `#020204`, Card `#0d0d1a`, Accent `#6366f1`
- Fonts: Syne (headings), Outfit (body), JetBrains Mono (code/SQL)

---

### ✅ Step 11 · Landing Page (2 hrs)

Same 5-section structure as previous roadmap — Hero, How It Works, Features, Services, CTA — with one update to the "How It Works" section to include the chat mode:

**Updated step cards:**
- Step 01: "Ask in plain English — as a chart question or a business question"
- Step 02: "Chart mode gives you two visual options. Chat mode gives you a narrative answer from a senior analyst."
- Step 03: "Select your chart, or read your answer. Ask follow-ups. Full history saved."

**Get Started button** → `window.location.href = API_BASE + "/auth/google"`

---

### ✅ Step 12 · Auth Context + Callback (45 min)

Same as previous roadmap. `AuthContext.jsx` stores JWT in `sessionStorage`, `AuthCallback.jsx` reads token from URL fragment and redirects to `/dashboard`.

---

### ✅ Step 13 · Mode Toggle Component (30 min)

**`frontend/src/components/ModeToggle.jsx`**

This is the top-of-dashboard switch that toggles between Chart Mode and Chat Mode. Simple two-button toggle that updates a `mode` state in the Dashboard page.

```jsx
export default function ModeToggle({ mode, onChange }) {
  const btn = (label, value, icon) => (
    <button onClick={() => onChange(value)} style={{
      padding: "10px 24px", borderRadius: 10, cursor: "pointer",
      fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 13,
      border: "none", transition: "all 0.2s",
      background: mode === value
        ? (value === "chart" ? "var(--accent)" : "#f59e0b")
        : "transparent",
      color: mode === value ? "#fff" : "var(--text-muted)",
    }}>
      {icon} {label}
    </button>
  );
  return (
    <div style={{ display: "inline-flex", background: "var(--bg-card)",
      border: "1px solid var(--border)", borderRadius: 14, padding: 4, gap: 4 }}>
      {btn("Chart Mode",  "chart", "📊")}
      {btn("Chat Mode",   "chat",  "💬")}
    </div>
  );
}
```

---

### ✅ Step 14 · Chart Mode Components (2 hrs)

These are the same as the previous roadmap:
- **`ChartSelector.jsx`** — Two side-by-side preview cards with "Select This Chart →" button
- **`ChartRenderer.jsx`** — Recharts switch: bar/line/pie/scatter with compact prop
- **`InsightCard.jsx`** — Confirmed chart with title, insight, SQL toggle
- **`DashboardCanvas.jsx`** — Responsive grid of confirmed charts

One small addition to `InsightCard`: show a tiny "💬 Ask about this" link that switches to Chat Mode with a pre-filled question about that specific chart's topic.

---

### ✅ Step 15 · Chat Mode Components (2 hrs)

**`frontend/src/components/ChatWindow.jsx`**

This is the new core component. It renders a conversation thread — user messages on the right, AI analyst responses on the left. Each AI response is rendered as markdown so it can use **bold**, bullet points, and numbers cleanly.

```jsx
import ChatMessage from "./ChatMessage";

export default function ChatWindow({ messages, loading }) {
  return (
    <div style={{
      flex: 1, overflowY: "auto", padding: "24px 32px",
      display: "flex", flexDirection: "column", gap: 16
    }}>
      {messages.length === 0 && (
        <div style={{ textAlign: "center", marginTop: "15vh",
          color: "var(--text-muted)" }}>
          <p style={{ fontSize: 48, marginBottom: 16 }}>💬</p>
          <p style={{ fontFamily: "var(--font-heading)", fontSize: "1.3rem",
            fontWeight: 700, marginBottom: 12 }}>
            Ask your Business Analyst
          </p>
          <p style={{ fontSize: 14, maxWidth: 420, margin: "0 auto", lineHeight: 1.7 }}>
            Ask anything about the sales data in plain English.
            "Why is Asia outperforming Europe?",
            "Is the discount strategy working?",
            "What should we focus on in Q1 next year?"
          </p>
          <div style={{ marginTop: 24, display: "flex", flexDirection: "column",
            gap: 8, maxWidth: 380, margin: "24px auto 0" }}>
            {[
              "Why are Electronics performing better than Books?",
              "Is our discount strategy actually increasing revenue?",
              "Which region should we invest more marketing in?",
              "What payment method should we prioritize?",
            ].map((q, i) => (
              <div key={i} style={{
                padding: "8px 14px", borderRadius: 8, background: "var(--bg-card)",
                border: "1px solid var(--border)", fontSize: 13,
                color: "var(--text-muted)", fontFamily: "var(--font-mono)",
                textAlign: "left"
              }}>"{q}"</div>
            ))}
          </div>
        </div>
      )}
      {messages.map((msg, i) => <ChatMessage key={i} message={msg} />)}
      {loading && (
        <div style={{ display: "flex", gap: 8, alignItems: "center",
          color: "var(--text-muted)", fontSize: 13 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%",
            background: "var(--accent)", animation: "pulse 1s infinite" }} />
          Analyst is thinking...
        </div>
      )}
    </div>
  );
}
```

**`frontend/src/components/ChatMessage.jsx`**
```jsx
import ReactMarkdown from "react-markdown";

export default function ChatMessage({ message }) {
  const isUser = message.role === "user";
  return (
    <div style={{
      display: "flex", justifyContent: isUser ? "flex-end" : "flex-start"
    }}>
      <div style={{
        maxWidth: "75%", padding: "14px 18px", borderRadius: isUser
          ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
        background: isUser ? "var(--accent)" : "var(--bg-card)",
        border: isUser ? "none" : "1px solid var(--border)",
        fontSize: 14, lineHeight: 1.7,
        color: isUser ? "#fff" : "var(--text-primary)",
        fontFamily: "var(--font-body)"
      }}>
        {isUser
          ? <p>{message.content}</p>
          : <ReactMarkdown>{message.content}</ReactMarkdown>
        }
        {message.cannot_answer && (
          <p style={{ color: "#ef4444", fontSize: 12, marginTop: 8 }}>
            ⚠️ Outside available data scope
          </p>
        )}
      </div>
    </div>
  );
}
```

---

### ✅ Step 16 · Chat Mode Hook (45 min)

**`frontend/src/hooks/useChat.js`**
```javascript
import { useState } from "react";
import axios from "axios";
import { useAuth } from "./useAuth";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export function useChat() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(false);
  const { token } = useAuth();

  const sendMessage = async (text) => {
    const userMsg = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    // Build history from messages for context
    const history = messages.map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await axios.post(
        `${API_BASE}/chat`,
        { message: text, history },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const { answer, cannot_answer } = res.data;
      setMessages(prev => [...prev, {
        role: "assistant",
        content: answer,
        cannot_answer
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, I couldn't connect to the server. Please try again.",
        cannot_answer: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => setMessages([]);

  return { messages, loading, sendMessage, clearChat };
}
```

---

### ✅ Step 17 · History Sidebar (45 min)

**`frontend/src/components/HistorySidebar.jsx`**

Loads from DynamoDB via `/history` on mount. Shows both chart queries and chat messages in a unified timeline.

```jsx
import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function HistorySidebar() {
  const [items, setItems] = useState([]);
  const { token } = useAuth();

  useEffect(() => {
    if (!token) return;
    axios.get(`${API_BASE}/history`,
      { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setItems(res.data.history || []))
      .catch(() => {});
  }, [token]);

  return (
    <div style={{ width: 240, background: "var(--bg-sidebar)",
      borderRight: "1px solid var(--border)", display: "flex",
      flexDirection: "column", padding: "16px 12px",
      overflowY: "auto", flexShrink: 0 }}>
      <p style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700,
        letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>
        History
      </p>
      {items.length === 0 && (
        <p style={{ fontSize: 12, color: "#2d3748" }}>
          Your queries will appear here...
        </p>
      )}
      {items.map((item, i) => (
        <div key={i} style={{ padding: "8px 10px", borderRadius: 8,
          background: "var(--bg-card)", border: "1px solid var(--border)",
          marginBottom: 6, fontSize: 11, color: "#94a3b8" }}>
          <span style={{ color: item.type === "chart_query" ? "#6366f1" : "#f59e0b",
            marginRight: 6 }}>
            {item.type === "chart_query" ? "📊" : "💬"}
          </span>
          {item.payload?.prompt || item.payload?.message || "Query"}
        </div>
      ))}
    </div>
  );
}
```

---

### ✅ Step 18 · Dashboard Page Assembly (1 hr)

**`frontend/src/pages/Dashboard.jsx`**
```jsx
import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useDashboard } from "../hooks/useDashboard";
import { useChat } from "../hooks/useChat";
import NavBar from "../components/NavBar";
import ModeToggle from "../components/ModeToggle";
import HistorySidebar from "../components/HistorySidebar";
import ChartSelector from "../components/ChartSelector";
import DashboardCanvas from "../components/DashboardCanvas";
import ChatWindow from "../components/ChatWindow";
import ChatInput from "../components/ChatInput";
import SkeletonLoader from "../components/SkeletonLoader";

export default function Dashboard() {
  const [mode, setMode] = useState("chart");   // "chart" | "chat"
  const { user, logout } = useAuth();
  const chartState = useDashboard();
  const chatState  = useChat();

  const handleSubmit = (text) => {
    if (mode === "chart") chartState.submitQuery(text);
    else                  chatState.sendMessage(text);
  };

  const isLoading = mode === "chart" ? chartState.loading : chatState.loading;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <NavBar user={user} onLogout={logout} />
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <HistorySidebar />
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>

          {/* Mode Toggle */}
          <div style={{ padding: "16px 32px", borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", gap: 16 }}>
            <ModeToggle mode={mode} onChange={setMode} />
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {mode === "chart"
                ? "Generate interactive charts from your data"
                : "Ask business questions — get analyst-grade answers"}
            </span>
          </div>

          {/* Content area */}
          <div style={{ flex: 1, overflow: "hidden", display: "flex",
            flexDirection: "column" }}>
            {mode === "chart" ? (
              <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
                {chartState.pending && (
                  <ChartSelector
                    pending={chartState.pending}
                    onSelect={chartState.selectChart}
                    onDismiss={chartState.dismissPending}
                  />
                )}
                {chartState.loading && <SkeletonLoader />}
                {chartState.error && (
                  <div style={{ padding: 20, background: "#1a0a0a",
                    border: "1px solid #3f1f1f", borderRadius: 16, marginBottom: 20 }}>
                    <p style={{ color: "#ef4444", fontWeight: 600 }}>⚠️ Cannot Answer</p>
                    <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 8 }}>
                      {chartState.error}
                    </p>
                  </div>
                )}
                <DashboardCanvas confirmed={chartState.confirmed} />
              </div>
            ) : (
              <ChatWindow messages={chatState.messages} loading={chatState.loading} />
            )}
          </div>

          {/* Shared input bar */}
          <ChatInput
            onSubmit={handleSubmit}
            loading={isLoading}
            mode={mode}
            placeholder={
              mode === "chart"
                ? "Ask a data question to generate charts..."
                : "Ask any business question — 'Why is Asia growing faster?'"
            }
          />
        </div>
      </div>
    </div>
  );
}
```

---

## 🗓️ DAY 3 — Lambda Deploy + Polish + Presentation

---

### ✅ Step 19 · Prepare Lambda Deployment Package (1 hr)

```bash
cd backend

# Install dependencies into a package folder
pip install -r requirements.txt --target ./package

# Copy your app files into the package
cp main.py database.py llm_chart.py llm_chat.py \
   auth.py history.py models.py query_executor.py ./package/
cp -r data ./package/data/

# Zip it all up
cd package
zip -r ../lambda_deployment.zip .
cd ..
```

**`requirements.txt`:**
```
fastapi
mangum
pandas
google-generativeai
python-dotenv
pydantic
authlib
httpx
python-jose[cryptography]
boto3
```

> **Important:** The zip file will be around 50–80 MB with pandas. This is fine for Lambda — the 250 MB unzipped limit is what matters.

---

### ✅ Step 20 · Deploy to AWS Lambda + API Gateway (1.5 hrs)

**In AWS Console:**

**Step A — Create Lambda Function:**
1. Go to Lambda → Create Function
2. Name: `Narralytics-backend`
3. Runtime: Python 3.11
4. Architecture: x86_64
5. Upload `lambda_deployment.zip` (if >10MB, upload via S3 first)
6. Handler: `main.handler` (the `handler = Mangum(app)` line)
7. Timeout: set to **30 seconds** (Gemini API calls need time)
8. Memory: **512 MB** (pandas needs this on cold start)

**Step B — Add Environment Variables in Lambda Console:**
All the same variables from your `.env` file — GEMINI_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET, DYNAMODB_TABLE, FRONTEND_URL (set to your Vercel URL once deployed).

**Step C — Add Lambda Execution Role permissions:**
Attach `AmazonDynamoDBFullAccess` to the Lambda's execution role so it can read/write DynamoDB.

**Step D — Create API Gateway:**
1. API Gateway → Create API → HTTP API (not REST — HTTP is simpler and cheaper)
2. Add integration → Lambda → select `Narralytics-backend`
3. Route: `ANY /{proxy+}` → this routes all paths to FastAPI/Mangum
4. Deploy → Stage: `prod`
5. Copy the API Gateway URL: `https://xxxxxxx.execute-api.us-east-1.amazonaws.com`

**Step E — Update Google OAuth:**
Go to Google Cloud Console → Your OAuth Client → Add to Authorized Redirect URIs:
`https://xxxxxxx.execute-api.us-east-1.amazonaws.com/auth/callback`

**Step F — Test Lambda endpoint:**
```bash
curl https://xxxxxxx.execute-api.us-east-1.amazonaws.com/health
# Should return: {"status": "ok", "dataset": "Amazon Sales 2022-2023"}
```

---

### ✅ Step 21 · Deploy Frontend to Vercel (30 min)

```bash
# frontend/.env.production
VITE_API_URL=https://xxxxxxx.execute-api.us-east-1.amazonaws.com
```

1. Push `frontend/` to GitHub
2. Vercel → New Project → Import → Set `VITE_API_URL` environment variable
3. Deploy → Get Vercel URL
4. Go back to Lambda → Update `FRONTEND_URL` env var to your Vercel URL
5. Update CORS in `main.py` allow_origins with the Vercel URL → redeploy Lambda

---

### ✅ Step 22 · Cold Start Warm-Up Strategy (15 min)

Lambda cold starts with your dependencies will take 3-5 seconds on the first hit after idle. Before the demo:

1. Hit your `/health` endpoint once 2 minutes before judges watch
2. Run one test chart query and one test chat message
3. Lambda is now warm — subsequent requests will be 2-3 seconds total (dominated by Gemini API, not Lambda)

Optional but recommended: set Lambda **Provisioned Concurrency = 1** if you want zero cold start risk. Costs ~$15/month but keeps one instance permanently warm.

---

### ✅ Step 23 · Hallucination Testing (30 min)

**Chart mode — these must return cannot_answer:**
- "What is the average customer age?"
- "Show customer names who bought Electronics"
- "What is our profit margin?"

**Chat mode — these must return a polite out-of-scope message:**
- "How many employees does this company have?"
- "What is the stock price?"
- "Show me the CEO's email"

**Chat mode — these must return real data-backed answers:**
- "Why are Electronics performing better than Books?"
- "Is the discount strategy actually increasing revenue?"
- "Which region is growing fastest?"

---

### ✅ Step 24 · Presentation Script (1 hr)

| Time | What to show |
|------|---|
| 0:00–1:30 | Live landing page — Hero, How It Works, Services sections |
| 1:30–2:30 | Click Get Started → Google OAuth → land on dashboard |
| 2:30–3:30 | **Chart Mode:** "Revenue by product category" → Two options appear → Select bar chart |
| 3:30–5:00 | **Chart Mode:** "Monthly revenue trend for 2023 by region" → Select multi-line chart |
| 5:00–6:00 | **Follow-up:** "Now filter this to Asia only" → proves conversational context |
| 6:00–7:30 | **Switch to Chat Mode:** "Why is Electronics outperforming all other categories?" → AI gives narrative answer with real numbers |
| 7:30–8:30 | **Chat follow-up:** "What should we do about the Middle East region?" → contextual answer |
| 8:30–9:00 | Show SQL debug toggle on a chart card → transparency/accuracy |
| 9:00–9:30 | Show cannot_answer card from an out-of-scope question → hallucination protection |
| 9:30–10:00 | Architecture: Vercel → API Gateway → Lambda → Gemini + SQLite + DynamoDB |

---

## 🏗️ Final Architecture Summary

```
[React on Vercel]
      │
      │ HTTPS
      ▼
[AWS API Gateway — HTTP API]
      │
      │ Proxy all routes
      ▼
[AWS Lambda — FastAPI + Mangum]
      │
      ├─── /auth/*     → Google OAuth 2.0 + JWT
      ├─── /query      → Gemini (dual chart spec) → SQLite
      ├─── /chat       → Gemini (text answer) → SQLite (supporting data)
      └─── /history    → DynamoDB (read/write)
      │
      ├── [Google Gemini 1.5 Flash]   — LLM for both modes
      ├── [SQLite in /tmp]            — 50K row Amazon dataset
      └── [AWS DynamoDB]             — Persistent conversation history
```

---

## 🎯 Final Scoring Checklist

| Category | Points | Coverage |
|----------|--------|----------|
| Data Retrieval Accuracy | 15 | Schema-rich prompts, SQLite execution |
| Chart Selection | 15 | Chart rules in LLM prompt, dual options |
| Error Handling | 10 | `cannot_answer` in both chart + chat modes |
| Design | 10 | Dark theme, Syne+Outfit, indigo palette |
| Interactivity | 10 | Recharts tooltips, chart selection UX, chat bubbles |
| User Flow | 10 | Landing → OAuth → Mode Toggle → Dual flow |
| Architecture | 10 | Lambda + API Gateway + DynamoDB = production-grade |
| Prompt Engineering | 10 | Two separate system prompts, business glossary |
| Hallucination Handling | 10 | Tested both modes for out-of-scope queries |
| **Follow-up Bonus** | **+10** | Conversation history in both chart + chat modes |
| **TOTAL** | **110** | |

---

## ⚡ 3 Queries to Perfect Before Demo Day

```
CHART QUERY 1 (simple):
"Show total revenue by product category"
→ Option A: bar chart | Option B: pie chart share

CHART QUERY 2 (complex + follow-up):
"Show monthly revenue for 2023 broken down by region"
→ Select multi-line chart
→ Follow-up: "Now show only Asia"

CHAT QUERY (star of the show):
"Is our discount strategy actually working, or are we just giving money away?"
→ AI runs SQL to get revenue correlation with discount_percent
→ Returns 3-4 sentence analyst answer with real numbers
→ Follow-up: "Which category benefits most from discounts?"
```

---

*Narralytics · AWS Lambda · Google OAuth · Gemini · DynamoDB · Built to win 🏆*
