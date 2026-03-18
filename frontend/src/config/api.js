// API configuration — single source of truth for all endpoint URLs
const runtimeOrigin = typeof window !== "undefined" ? window.location.origin : undefined;
const allowedRuntimeOrigins = (import.meta.env.VITE_ALLOWED_API_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const resolveApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;

  const isLocalOrigin = (origin) =>
    origin?.startsWith("http://localhost") ||
    origin?.startsWith("http://127.0.0.1") ||
    origin?.startsWith("https://localhost") ||
    origin?.startsWith("https://127.0.0.1");

  const isAllowedRuntimeOrigin = runtimeOrigin && (isLocalOrigin(runtimeOrigin) || allowedRuntimeOrigins.includes(runtimeOrigin));
  if (isAllowedRuntimeOrigin) return runtimeOrigin;

  return "http://localhost:8000";
};

const API_BASE_URL = resolveApiBaseUrl();

export const API_ENDPOINTS = {
  HEALTH: `${API_BASE_URL}/api/health`,
  AUTH: `${API_BASE_URL}/auth`,
  DATASETS: `${API_BASE_URL}/datasets`,
  DASHBOARD: `${API_BASE_URL}/dashboard`,
  QUERY: `${API_BASE_URL}/query`,
  CHAT: `${API_BASE_URL}/chat`,
  REPORTS: `${API_BASE_URL}/reports`,
  REPORT: `${API_BASE_URL}/report`,
};

export default API_BASE_URL;
