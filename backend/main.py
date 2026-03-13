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
import google.generativeai as genai

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
    except Exception as e:
        print(f"Auth error: {e}")
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
        except Exception as e:
            print(f"Chat data query failed: {e}")
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
        m = genai.GenerativeModel("gemini-1.5-flash")
        return m.generate_content(prompt).text.strip()
    except Exception as e:
        print(f"Refinement failed: {e}")
        return ""

# ─── LAMBDA HANDLER ────────────────────────────────────
handler = Mangum(app)          # This single line makes FastAPI work on Lambda
