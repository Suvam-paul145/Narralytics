const revenueData = [
  { month: "Jan", revenue: 42000, queries: 1240, users: 320 },
  { month: "Feb", revenue: 51000, queries: 1680, users: 410 },
  { month: "Mar", revenue: 47000, queries: 1420, users: 380 },
  { month: "Apr", revenue: 63000, queries: 2100, users: 520 },
  { month: "May", revenue: 58000, queries: 1930, users: 490 },
  { month: "Jun", revenue: 72000, queries: 2450, users: 610 },
  { month: "Jul", revenue: 81000, queries: 2890, users: 720 },
  { month: "Aug", revenue: 76000, queries: 2640, users: 680 },
  { month: "Sep", revenue: 89000, queries: 3120, users: 810 },
  { month: "Oct", revenue: 95000, queries: 3480, users: 890 },
  { month: "Nov", revenue: 104000, queries: 3820, users: 960 },
  { month: "Dec", revenue: 118000, queries: 4210, users: 1080 },
];

const categoryData = [
  { name: "Electronics", value: 38000, prev: 31000 },
  { name: "Fashion", value: 27000, prev: 29000 },
  { name: "Books", value: 18000, prev: 15000 },
  { name: "Sports", value: 22000, prev: 19000 },
  { name: "Beauty", value: 14000, prev: 12000 },
  { name: "Home", value: 19000, prev: 17000 },
];

const regionData = [
  { name: "North America", value: 38, color: "#5b6af9" },
  { name: "Asia", value: 28, color: "#f5a623" },
  { name: "Europe", value: 22, color: "#2dd4a0" },
  { name: "Middle East", value: 12, color: "#ff6b8a" },
];

const weeklyData = [
  { day: "Mon", sessions: 840, bounce: 32 },
  { day: "Tue", sessions: 920, bounce: 28 },
  { day: "Wed", sessions: 1140, bounce: 25 },
  { day: "Thu", sessions: 1080, bounce: 30 },
  { day: "Fri", sessions: 1320, bounce: 22 },
  { day: "Sat", sessions: 760, bounce: 38 },
  { day: "Sun", sessions: 680, bounce: 41 },
];

const paymentWeights = [
  { method: "Card", weight: 0.44 },
  { method: "UPI", weight: 0.24 },
  { method: "Net Banking", weight: 0.14 },
  { method: "Wallet", weight: 0.1 },
  { method: "Cash on Delivery", weight: 0.08 },
];

const clone = (value) => JSON.parse(JSON.stringify(value));
const sum = (arr, key) => arr.reduce((total, item) => total + Number(item[key] || 0), 0);

const makeRevenueCategory = () => {
  const total = sum(categoryData, "value");
  const top = [...categoryData].sort((a, b) => b.value - a.value)[0];

  return {
    title: "Revenue by Category",
    chartType: "bar",
    xKey: "name",
    yKey: "value",
    data: clone(categoryData),
    insight: `Electronics contributes $${top.value.toLocaleString()} and leads all categories. Total category revenue in scope is $${total.toLocaleString()}.`,
    sql: "SELECT category AS name, SUM(revenue) AS value FROM amazon_sales GROUP BY category ORDER BY value DESC;",
    answer:
      "Category-level performance is concentrated in Electronics, with Fashion as the second largest contributor. The distribution indicates a strong high-ticket mix, while long-tail categories still add meaningful incremental revenue.",
  };
};

const makeRegion = () => {
  const top = [...regionData].sort((a, b) => b.value - a.value)[0];

  return {
    title: "Regional Revenue Share",
    chartType: "pie",
    xKey: "name",
    yKey: "value",
    data: clone(regionData),
    insight: `${top.name} holds the largest share at ${top.value}%, while the smallest region contributes 12%.`,
    sql: "SELECT region AS name, ROUND(SUM(revenue) * 100.0 / SUM(SUM(revenue)) OVER (), 2) AS value FROM amazon_sales GROUP BY region ORDER BY value DESC;",
    answer:
      "Geographic concentration remains healthy, with North America as the anchor market and Asia as a strong secondary growth engine. Europe and the Middle East provide diversification, but they are currently under-leveraged relative to their expansion potential.",
  };
};

const makeMonthlyTrend = () => {
  const first = revenueData[0].revenue;
  const last = revenueData[revenueData.length - 1].revenue;
  const growthPct = (((last - first) / first) * 100).toFixed(1);

  return {
    title: "Monthly Revenue Trend",
    chartType: "area",
    xKey: "month",
    yKey: "revenue",
    data: clone(revenueData),
    insight: `Revenue rises from $${first.toLocaleString()} in Jan to $${last.toLocaleString()} in Dec, a ${growthPct}% increase across the year.`,
    sql: "SELECT strftime('%b', order_date) AS month, SUM(revenue) AS revenue FROM amazon_sales GROUP BY strftime('%Y-%m', order_date) ORDER BY strftime('%Y-%m', order_date);",
    answer:
      "The time-series shows a stable upward trajectory with stronger acceleration in the final quarter. This profile is consistent with compounding demand and seasonal amplification, not a one-off spike.",
  };
};

const makeWeeklySessions = () => {
  const top = [...weeklyData].sort((a, b) => b.sessions - a.sessions)[0];
  const avgBounce = (sum(weeklyData, "bounce") / weeklyData.length).toFixed(1);

  return {
    title: "Weekly Sessions by Day",
    chartType: "line",
    xKey: "day",
    yKey: "sessions",
    data: clone(weeklyData),
    insight: `${top.day} leads with ${top.sessions.toLocaleString()} sessions, while average bounce rate across the week is ${avgBounce}%.`,
    sql: "SELECT day_of_week AS day, COUNT(*) AS sessions, ROUND(AVG(bounce_rate), 2) AS bounce FROM amazon_sales GROUP BY day_of_week ORDER BY day_index;",
    answer:
      "User traffic peaks near the end of the work week and softens over the weekend. Operationally, this is the right pattern for concentration of promotions and paid spend in the Thursday to Friday window.",
  };
};

const makeDiscountStrategy = () => {
  const data = categoryData.map((item) => {
    const lift = item.value - item.prev;
    const discountPct = Math.max(6, Math.round((item.prev / item.value) * 12));
    return {
      category: item.name,
      discount_pct: discountPct,
      revenue_lift: lift,
    };
  });

  const best = [...data].sort((a, b) => b.revenue_lift - a.revenue_lift)[0];

  return {
    title: "Discount Strategy Impact",
    chartType: "scatter",
    xKey: "discount_pct",
    yKey: "revenue_lift",
    data: clone(data),
    insight: `${best.category} shows the strongest lift at +$${best.revenue_lift.toLocaleString()} around a ${best.discount_pct}% discount band.`,
    sql: "SELECT category, ROUND(AVG(discount_pct), 2) AS discount_pct, SUM(revenue) - SUM(prev_period_revenue) AS revenue_lift FROM amazon_sales GROUP BY category;",
    answer:
      "Discount elasticity is not uniform across categories, and the scatter confirms that moderate discount depth can produce outsized lift in selected segments. The strategy should remain targeted rather than broad-based to protect margin quality.",
  };
};

const makeTopProducts = () => {
  const data = [...categoryData]
    .sort((a, b) => b.value - a.value)
    .map((item) => ({ product: `${item.name} Prime`, revenue: item.value }));

  const leader = data[0];

  return {
    title: "Top Performing Products",
    chartType: "bar",
    xKey: "product",
    yKey: "revenue",
    data: clone(data),
    insight: `${leader.product} ranks first with $${leader.revenue.toLocaleString()} in modeled revenue contribution.`,
    sql: "SELECT product_name AS product, SUM(revenue) AS revenue FROM amazon_sales GROUP BY product_name ORDER BY revenue DESC LIMIT 10;",
    answer:
      "The top performers are concentrated in high-demand product families, which is driving a disproportionate share of revenue. Prioritizing inventory and ad allocation toward these leaders should sustain short-term efficiency.",
  };
};

const makePaymentMethods = () => {
  const yearlyRevenue = sum(revenueData, "revenue");
  const data = paymentWeights.map((item) => ({
    method: item.method,
    value: Math.round(yearlyRevenue * item.weight),
  }));

  const top = [...data].sort((a, b) => b.value - a.value)[0];

  return {
    title: "Payment Method Contribution",
    chartType: "pie",
    xKey: "method",
    yKey: "value",
    data: clone(data),
    insight: `${top.method} contributes the highest volume at $${top.value.toLocaleString()} in annualized value.`,
    sql: "SELECT payment_method AS method, SUM(revenue) AS value FROM amazon_sales GROUP BY payment_method ORDER BY value DESC;",
    answer:
      "Payment concentration remains anchored in card-based transactions, with UPI as a strong secondary rail. This mix suggests checkout optimization should focus on reducing card failure friction while preserving UPI speed.",
  };
};

const makeRatings = () => {
  const data = weeklyData.map((row) => ({
    day: row.day,
    satisfaction: Number((100 - row.bounce).toFixed(1)),
    quality: Number((3.4 + row.sessions / 1000).toFixed(2)),
  }));

  const best = [...data].sort((a, b) => b.satisfaction - a.satisfaction)[0];

  return {
    title: "Customer Satisfaction and Quality",
    chartType: "area",
    xKey: "day",
    yKey: "satisfaction",
    data: clone(data),
    insight: `${best.day} records the strongest satisfaction score at ${best.satisfaction} with a quality index of ${best.quality}.`,
    sql: "SELECT day_of_week AS day, ROUND(AVG(customer_satisfaction), 2) AS satisfaction, ROUND(AVG(quality_score), 2) AS quality FROM amazon_sales GROUP BY day_of_week ORDER BY day_index;",
    answer:
      "Satisfaction signals are strongest on high-intent days, which usually coincide with better operational throughput and conversion quality. The pattern indicates quality control is holding under peak traffic rather than degrading.",
  };
};

const containsAny = (text, keywords) => keywords.some((keyword) => text.includes(keyword));

const PATTERN_KEYWORDS = {
  top_products: ["top", "best", "best performing", "performing"],
  top_products_entities: ["product", "products", "category", "categories"],
  payment_method: ["payment method", "payment", "upi", "card", "wallet", "net banking", "cod"],
  rating_quality: ["rating", "satisfaction", "quality", "review"],
  discount_strategy: ["discount", "strategy"],
  weekly_sessions: ["weekly", "sessions", "days", "day-wise", "day wise"],
  monthly_trend: ["monthly", "trend", "time-series", "time series", "timeseries"],
  region_geo: ["region", "geography", "location"],
  revenue_category: ["revenue", "category", "product"],
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

export function detectQueryPattern(input) {
  if (typeof input !== "string") {
    return null;
  }

  const text = input.trim().toLowerCase();
  if (!text) {
    return null;
  }

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

export function isDatasetRelevantToQuery(input, columns = []) {
  if (!Array.isArray(columns) || columns.length === 0) {
    return true;
  }

  const pattern = detectQueryPattern(input);
  if (!pattern) {
    return true;
  }

  const hints = PATTERN_COLUMN_HINTS[pattern] || [];
  if (hints.length === 0) {
    return true;
  }

  const normalizedColumns = columns.map((col) => String(col).toLowerCase());
  return hints.some((hint) => normalizedColumns.some((column) => column.includes(hint)));
}

export function matchQuery(input) {
  if (typeof input !== "string") {
    return null;
  }

  const text = input.trim().toLowerCase();
  if (!text) {
    return null;
  }

  const pattern = detectQueryPattern(text);
  if (pattern === "top_products") {
    return makeTopProducts();
  }

  if (pattern === "payment_method") {
    return makePaymentMethods();
  }

  if (pattern === "rating_quality") {
    return makeRatings();
  }

  if (pattern === "discount_strategy") {
    return makeDiscountStrategy();
  }

  if (pattern === "weekly_sessions") {
    return makeWeeklySessions();
  }

  if (pattern === "monthly_trend") {
    return makeMonthlyTrend();
  }

  if (pattern === "region_geo") {
    return makeRegion();
  }

  if (pattern === "revenue_category") {
    return makeRevenueCategory();
  }

  return null;
}

export default matchQuery;
