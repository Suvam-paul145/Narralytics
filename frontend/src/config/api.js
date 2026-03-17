// API configuration — single source of truth for all endpoint URLs
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

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