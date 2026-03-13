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
