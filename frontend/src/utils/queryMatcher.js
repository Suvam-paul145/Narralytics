/**
 * queryMatcher.js
 *
 * Utility for analyzing user queries and detecting intent patterns.
 * All actual data comes from the backend via Groq API — there is
 * NO hardcoded chart data in this file.
 */

const containsAny = (text, keywords) =>
  keywords.some((keyword) => text.includes(keyword));

const PATTERN_KEYWORDS = {
  top_products: ["top", "best", "best performing", "performing", "highest", "leading"],
  top_products_entities: ["product", "products", "category", "categories", "item", "items"],
  payment_method: ["payment method", "payment", "upi", "card", "wallet", "net banking", "cod"],
  rating_quality: ["rating", "satisfaction", "quality", "review", "feedback"],
  discount_strategy: ["discount", "strategy", "coupon", "promo", "offer"],
  weekly_sessions: ["weekly", "sessions", "days", "day-wise", "day wise", "weekday"],
  monthly_trend: ["monthly", "trend", "time-series", "time series", "timeseries", "over time"],
  region_geo: ["region", "geography", "location", "city", "state", "country"],
  revenue_category: ["revenue", "sales", "amount", "income"],
};

const PATTERN_COLUMN_HINTS = {
  top_products: ["product", "item", "sku", "name", "sales", "revenue", "profit", "category"],
  payment_method: ["payment", "method", "upi", "card", "wallet", "bank", "transaction", "cod"],
  rating_quality: ["rating", "review", "satisfaction", "quality", "score", "feedback", "nps"],
  discount_strategy: ["discount", "coupon", "promo", "promotion", "markdown", "offer"],
  weekly_sessions: ["day", "weekday", "session", "visit", "traffic", "bounce"],
  monthly_trend: ["date", "month", "time", "year", "period", "week"],
  region_geo: ["region", "country", "state", "city", "location", "geo"],
  revenue_category: ["revenue", "sales", "amount", "price", "category", "product", "item"],
};

/**
 * Detect the intent pattern from a natural language query.
 * Returns a string like "top_products" or null if no pattern matches.
 */
export function detectQueryPattern(input) {
  if (typeof input !== "string") return null;

  const text = input.trim().toLowerCase();
  if (!text) return null;

  if (
    containsAny(text, PATTERN_KEYWORDS.top_products) &&
    containsAny(text, PATTERN_KEYWORDS.top_products_entities)
  ) {
    return "top_products";
  }

  if (containsAny(text, PATTERN_KEYWORDS.payment_method)) return "payment_method";
  if (containsAny(text, PATTERN_KEYWORDS.rating_quality)) return "rating_quality";
  if (containsAny(text, PATTERN_KEYWORDS.discount_strategy)) return "discount_strategy";
  if (containsAny(text, PATTERN_KEYWORDS.weekly_sessions)) return "weekly_sessions";
  if (containsAny(text, PATTERN_KEYWORDS.monthly_trend)) return "monthly_trend";
  if (containsAny(text, PATTERN_KEYWORDS.region_geo)) return "region_geo";
  if (containsAny(text, PATTERN_KEYWORDS.revenue_category)) return "revenue_category";

  return null;
}

/**
 * Check if the user's query is relevant to the dataset columns.
 * Returns true if the dataset has columns matching the query intent.
 */
export function isDatasetRelevantToQuery(input, columns = []) {
  if (!Array.isArray(columns) || columns.length === 0) return true;

  const pattern = detectQueryPattern(input);
  if (!pattern) return true;

  const hints = PATTERN_COLUMN_HINTS[pattern] || [];
  if (hints.length === 0) return true;

  const normalizedColumns = columns.map((col) => String(col).toLowerCase());
  return hints.some((hint) =>
    normalizedColumns.some((column) => column.includes(hint))
  );
}

/**
 * matchQuery is now a no-op — all chart data comes from the backend.
 * Kept for backward compatibility with existing imports.
 */
export function matchQuery() {
  return null;
}

export default matchQuery;
