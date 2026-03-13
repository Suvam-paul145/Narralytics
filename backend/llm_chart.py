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
