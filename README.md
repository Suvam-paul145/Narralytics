# Narralytics

> **AI-powered Business Intelligence — Ask questions, get charts, uncover narratives.**

---

## Why I Built This

Most business intelligence tools require you to already know what you're looking for. You open a dashboard, pick a chart type, drag in a dimension, and apply a filter — only to realize the insight you actually needed was hiding in a completely different angle of the data.

The real problem isn't access to data. It's the **translation layer between a business question and a meaningful answer.**

Analysts ask questions in natural language: *"Is our discount strategy actually working?"* or *"Why is Electronics outperforming every other category?"* — but traditional BI tools force them to translate those questions into SQL, select chart types manually, and interpret raw outputs themselves. For most people, that gap is too wide.

**Narralytics closes that gap.**

It lets you ask your data questions the same way you'd ask a colleague — and get back either a ready-to-present chart or a concise, data-backed narrative. No SQL. No manual chart selection. No guessing.

I built this as a hackathon project to demonstrate that modern LLMs, when paired with a structured execution layer, can genuinely replace the "analyst-as-middleware" role for a large class of business questions.

---

## Approach & Solution

### Two Modes, One Interface

Narralytics is built around a single core insight: **not every business question needs a chart, and not every chart needs a narrative.** So instead of forcing one format, the app offers two distinct, purpose-built modes behind a shared natural-language input.

**Chart Mode** — *For questions that are best understood visually.*

When you type a data question in Chart Mode, the app doesn't just generate one chart and hope it's right. It uses the LLM to derive **two different chart specifications** from your query — for example, a bar chart and a pie chart — executes both against the live dataset, and presents both side-by-side as preview options. You pick the one that communicates your point best, and it gets pinned to your dashboard canvas. This dual-option approach keeps the human in control of the visual decision while fully automating the data layer.

**Chat Mode** — *For questions that are best understood as insight.*

When you switch to Chat Mode, the LLM acts as a data analyst. It reads your question, generates a supporting SQL query to ground its answer in real numbers, and returns a short narrative response — 3 to 5 sentences, written like an analyst wrote it, backed by actual figures from the dataset. No hallucination: if the data doesn't support an answer, the model says so explicitly.

Both modes share the same input bar, the same session history, and the same DynamoDB-backed persistence. Your conversation is always there when you come back.

---

## Architecture

```
[React + Vite — Vercel]
        │
        │  HTTPS
        ▼
[AWS API Gateway — HTTP API]
        │
        │  Proxy (ANY /{proxy+})
        ▼
[AWS Lambda — FastAPI + Mangum]
        │
        ├── /auth/*      →  Google OAuth 2.0 + JWT issuance
        ├── /query       →  Gemini → Dual chart specs → SQLite execution
        ├── /chat        →  Gemini → Natural text answer → SQLite (supporting query)
        └── /history     →  DynamoDB read / write
        │
        ├── [Google Gemini 1.5 Flash]   LLM for both chart and chat modes
        ├── [SQLite in Lambda /tmp]     50,000-row Amazon Sales dataset (2022–2023)
        └── [AWS DynamoDB]             Persistent conversation history, per user
```

### Key Design Decisions

**FastAPI on Lambda via Mangum** — The entire backend is a standard FastAPI app wrapped with Mangum, which translates AWS Lambda's event format into ASGI. This means the backend is fully testable locally with `uvicorn` and deploys to Lambda without any restructuring.

**SQLite bundled in the Lambda zip** — The dataset (50K rows, Amazon Sales 2022–2023) is loaded from a bundled CSV into SQLite on Lambda's first cold start, then held in `/tmp` for the lifetime of the warm container. This avoids external database costs and keeps query latency under 100ms for all analytical queries.

**Dual chart spec generation** — Rather than asking the LLM to pick a chart type, the prompt explicitly requests two distinct SQL-backed chart specifications per query. Both are executed, both are rendered as previews, and the user makes the final visual decision. This keeps accuracy high and removes a judgment call from the model.

**Hallucination guard** — Both the chart and chat prompts include an explicit `cannot_answer` instruction. If the dataset schema doesn't support the question — for example, questions about employee counts, profit margins, or customer ages that don't exist in the data — the model returns a structured out-of-scope response rather than fabricating an answer.

**DynamoDB for history** — Every interaction (chart query or chat message) is written to DynamoDB under the user's Google ID and a UTC timestamp sort key. History is non-blocking: a write failure is logged but never surfaces to the user. The sidebar loads the last 50 interactions on dashboard mount.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, Recharts, React Router |
| Hosting | Vercel |
| Backend | FastAPI, Mangum |
| Compute | AWS Lambda (Python 3.11, 512 MB) |
| API Gateway | AWS HTTP API (ANY /{proxy+}) |
| LLM | Google Gemini 1.5 Flash |
| Dataset | Amazon Sales 2022–2023 (50K rows, SQLite) |
| History | AWS DynamoDB |
| Auth | Google OAuth 2.0 + JWT |

---

## Dataset

Amazon Sales 2022–2023 · 50,000 rows · Bundled with Lambda deployment

Key columns: `order_id`, `order_date`, `product_category`, `region`, `revenue`, `discount_percent`, `units_sold`, `order_year`, `order_month`, `order_quarter`

---

*Narralytics · Built for hackathon · AWS Lambda + Gemini + React · Built to win 🏆
