
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import API_BASE_URL from "../config/api";
import { useAuth } from "../context/AuthContext";
import { CHART_COLORS } from "../utils/chartColors";

const API_BASE = API_BASE_URL || import.meta.env.VITE_API_URL || "http://localhost:8000";
const SUPPORTED_CHARTS = new Set(["bar", "line", "pie", "scatter", "area"]);
const ACTIVE_DATASET_STORAGE_KEY = "narralytics.activeDatasetId";

const SUGGESTION_CHIPS = [
  "Show top 5 regions by total revenue",
  "Top 10 customers and their total revenue",
  "Top 10 products by quantity sold",
  "Which product category generates highest revenue?",
  "Revenue vs discount correlation by category"
];

const nowIso = () => new Date().toISOString();
const clone = (value) => JSON.parse(JSON.stringify(value));
// Error messages — specific and actionable instead of one generic fallback
const ERROR_NO_DATASET = "Please upload a dataset first (CSV or Excel) so I can analyze your data.";
const ERROR_BACKEND_FAIL = "Something went wrong while processing your query. Please try rephrasing or check if the server is running.";
const ERROR_NO_RESULTS = "No results were returned for this query. Try rephrasing your question or check if the dataset has the relevant columns.";

const getAuthHeaders = (json = false) => {
  const token = localStorage.getItem("authToken");
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (json) headers["Content-Type"] = "application/json";
  return headers;
};

const persistActiveDatasetId = (datasetId) => {
  if (!datasetId) return;
  localStorage.setItem(ACTIVE_DATASET_STORAGE_KEY, datasetId);
};

const readActiveDatasetId = () => localStorage.getItem(ACTIVE_DATASET_STORAGE_KEY);

const fetchJsonWithTimeout = async (url, options = {}, timeoutMs = 30000) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const payload = await response.json();
        if (payload?.detail) detail = payload.detail;
      } catch {
        // Keep default message.
      }
      throw new Error(detail);
    }

    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
};

const normalizeChartPayload = (rawChart) => {
  const spec = rawChart?.spec || rawChart || {};
  const rawType = (spec.chart_type || spec.chartType || "bar").toLowerCase();
  const chartType = SUPPORTED_CHARTS.has(rawType) ? rawType : "bar";
  const data = Array.isArray(rawChart?.data)
    ? clone(rawChart.data)
    : Array.isArray(spec.data)
      ? clone(spec.data)
      : [];

  return {
    title: spec.title || "Analytics View",
    chartType,
    xKey: spec.x_key || spec.xKey || "x",
    yKey: spec.y_key || spec.yKey || "y",
    data,
    insight: spec.insight || "",
    sql: spec.sql || rawChart?.raw_sql || "",
  };
};

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "10px 12px",
        boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
      }}
    >
      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 6 }}>{label}</div>
      {payload.map((entry, index) => (
        <div
          key={`${entry.dataKey}-${index}`}
          style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "0.78rem", marginBottom: 3 }}
        >
          <span style={{ width: 8, height: 8, borderRadius: 2, background: entry.color }} />
          <span>{typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}</span>
        </div>
      ))}
    </div>
  );
}

function AssistantChartCard({ chart, chartId }) {
  const [showSql, setShowSql] = useState(false);
  const gradientId = useMemo(() => `ai-fill-${chartId}-${Math.random().toString(36).slice(2, 9)}`, [chartId]);

  const scatterData = useMemo(
    () =>
      chart.chartType !== "scatter"
        ? []
        : chart.data
            .map((row) => ({ x: Number(row[chart.xKey]), y: Number(row[chart.yKey]) }))
            .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
    [chart],
  );

  const renderChart = () => {
    if (!Array.isArray(chart.data) || chart.data.length === 0) {
      return (
        <div
          style={{
            border: "1px dashed var(--border)",
            borderRadius: 12,
            color: "var(--text-muted)",
            height: 240,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.8rem",
          }}
        >
          No chart data available.
        </div>
      );
    }

    if (chart.chartType === "pie") {
      return (
        <>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={chart.data}
                dataKey={chart.yKey}
                nameKey={chart.xKey}
                cx="50%"
                cy="50%"
                innerRadius={54}
                outerRadius={86}
                paddingAngle={3}
              >
                {chart.data.map((entry, index) => (
                  <Cell
                    key={`pie-${entry[chart.xKey]}-${index}`}
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8 }}>
            {chart.data.map((item, index) => (
              <div
                key={`${item[chart.xKey]}-${index}`}
                style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "0.72rem", color: "var(--text-muted)" }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: CHART_COLORS[index % CHART_COLORS.length],
                  }}
                />
                <span>{item[chart.xKey]}</span>
              </div>
            ))}
          </div>
        </>
      );
    }

    if (chart.chartType === "scatter") {
      return (
        <ResponsiveContainer width="100%" height={240}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis type="number" dataKey="x" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis type="number" dataKey="y" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Scatter data={scatterData} fill={CHART_COLORS[0]} />
          </ScatterChart>
        </ResponsiveContainer>
      );
    }

    if (chart.chartType === "bar") {
      return (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chart.data} margin={{ top: 10, right: 16, bottom: 8, left: 2 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey={chart.xKey} tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey={chart.yKey} radius={[8, 8, 0, 0]}>
              {chart.data.map((entry, index) => (
                <Cell
                  key={`bar-${entry[chart.xKey]}-${index}`}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={chart.data} margin={{ top: 10, right: 16, bottom: 8, left: 2 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS[0]} stopOpacity={0.28} />
              <stop offset="95%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey={chart.xKey} tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="monotone"
            dataKey={chart.yKey}
            stroke={CHART_COLORS[0]}
            strokeWidth={2.4}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 4, fill: CHART_COLORS[0] }}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: 20,
        boxShadow: "0 12px 46px rgba(0,0,0,0.52)",
      }}
    >
      <h4 style={{ margin: "0 0 14px", fontSize: "0.9rem", fontWeight: 600 }}>{chart.title}</h4>
      {renderChart()}
      {!!chart.insight && (
        <p style={{ margin: "10px 0 0", color: "var(--accent)", fontSize: "0.78rem", fontStyle: "italic", lineHeight: 1.58 }}>
          {chart.insight}
        </p>
      )}
      {!!chart.sql && (
        <>
          <button
            style={{
              marginTop: 10,
              border: "1px solid var(--border)",
              background: "var(--bg-card-2)",
              color: "var(--text-muted)",
              borderRadius: 8,
              height: 28,
              padding: "0 10px",
              cursor: "pointer",
              fontSize: "0.72rem",
              fontFamily: "var(--font-mono)",
            }}
            onClick={() => setShowSql((previous) => !previous)}
          >
            {showSql ? "Hide SQL" : "View SQL"}
          </button>
          {showSql && (
            <pre
              style={{
                margin: "9px 0 0",
                background: "#080818",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: 12,
                color: "#9fd0ff",
                fontSize: "0.72rem",
                fontFamily: "var(--font-mono)",
                whiteSpace: "pre-wrap",
                lineHeight: 1.55,
                overflowX: "auto",
              }}
            >
              <code>{chart.sql}</code>
            </pre>
          )}
        </>
      )}
    </div>
  );
}
function MessageItem({ message }) {
  const isUser = message.role === "user";
  const charts = Array.isArray(message.charts) ? message.charts : [];

  if (isUser) {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", width: "100%" }}>
        <div
          style={{
            maxWidth: "72%",
            padding: "11px 15px",
            borderRadius: "18px 18px 6px 18px",
            background: "linear-gradient(135deg, rgba(91,106,249,0.9), rgba(91,106,249,0.64))",
            color: "#f7f8ff",
            fontSize: "0.9rem",
            lineHeight: 1.55,
            border: "1px solid rgba(140,150,255,0.45)",
            boxShadow: "0 6px 18px rgba(91,106,249,0.24)",
          }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", justifyContent: "flex-start", width: "100%" }}>
      <div style={{ width: "min(900px, 88%)", display: "flex", flexDirection: "column", gap: 10 }}>
        {!!message.content && (
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.88rem", lineHeight: 1.72, padding: "2px 4px" }}>
            {message.content}
          </p>
        )}
        {!!message.alert && (
          <div
            style={{
              borderRadius: 12,
              border: "1px solid rgba(245,166,35,0.32)",
              background: "rgba(245,166,35,0.08)",
              color: "#f8c066",
              fontSize: "0.8rem",
              padding: "11px 13px",
              lineHeight: 1.55,
            }}
          >
            {message.alert}
          </div>
        )}
        {charts.map((chart, index) => (
          <AssistantChartCard
            key={`${message.id || "ai"}-${index}`}
            chart={normalizeChartPayload(chart)}
            chartId={`${message.id || "ai"}-${index}`}
          />
        ))}
      </div>
    </div>
  );
}

const toTurnHistory = (items) =>
  items
    .filter((item) => typeof item.content === "string" && item.content.trim())
    .map((item) => ({ role: item.role, content: item.content }));

const formatRelativeTime = (isoText) => {
  if (!isoText) return "now";
  const timestamp = new Date(isoText).getTime();
  if (Number.isNaN(timestamp)) return "now";

  const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (diffMinutes < 1) return "now";
  if (diffMinutes < 60) return `${diffMinutes}m`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;

  return `${Math.round(diffHours / 24)}d`;
};

export default function Chat() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  const [activeSessionId, setActiveSessionId] = useState(() => crypto.randomUUID());
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [dataset, setDataset] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadFilename, setUploadFilename] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);

  const hasMessages = messages.length > 0;
  const suggestionChips = useMemo(() => {
    const dynamic = dataset?.profile?.recommended_questions;
    if (Array.isArray(dynamic) && dynamic.length > 0) {
      return dynamic.slice(0, 6);
    }
    return SUGGESTION_CHIPS;
  }, [dataset]);

  const refreshSessions = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/chat/history/sessions?limit=200`, { headers: getAuthHeaders() });
      if (!response.ok) return [];
      const payload = await response.json();
      const items = Array.isArray(payload.sessions) ? payload.sessions : [];
      setSessions(items);
      return items;
    } catch {
      return [];
    }
  }, []);

  const fetchPreferredDataset = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/datasets/`, { headers: getAuthHeaders() });
      if (!response.ok) return null;
      const payload = await response.json();
      const items = Array.isArray(payload.datasets) ? payload.datasets : [];
      if (!items.length) return null;

      const savedId = readActiveDatasetId();
      const savedMatch = savedId ? items.find((item) => item.dataset_id === savedId) : null;
      const amazonMatch = items.find((item) =>
        String(item.original_filename || item.name || item.filename || "")
          .toLowerCase()
          .includes("amazon_sales"),
      );
      const selected = savedMatch || amazonMatch || items[0];
      persistActiveDatasetId(selected.dataset_id);
      return {
        dataset_id: selected.dataset_id,
        filename:
          selected.original_filename ||
          selected.name ||
          selected.filename ||
          "Attached Dataset",
        columns: Array.isArray(selected.columns) ? selected.columns : [],
        row_count: selected.row_count,
        profile: selected.profile || null,
        cleaning_report: selected.cleaning_report || null,
      };
    } catch {
      return null;
    }
  }, []);

  const resolveDatasetForSession = useCallback(async (datasetId, fallbackName) => {
    if (!datasetId) {
      return null;
    }

    try {
      const response = await fetch(`${API_BASE}/datasets/`, { headers: getAuthHeaders() });
      if (response.ok) {
        const payload = await response.json();
        const items = Array.isArray(payload.datasets) ? payload.datasets : [];
        const match = items.find((item) => item.dataset_id === datasetId);
        if (match) {
          return {
            dataset_id: match.dataset_id,
            filename: match.name || fallbackName || "Attached Dataset",
            columns: Array.isArray(match.columns) ? match.columns : [],
            row_count: match.row_count,
            profile: match.profile || null,
            cleaning_report: match.cleaning_report || null,
          };
        }
      }
    } catch {
      // Best-effort lookup for richer context.
    }

    return {
      dataset_id: datasetId,
      filename: fallbackName || "Attached Dataset",
      columns: [],
      profile: null,
      cleaning_report: null,
    };
  }, []);

  const loadSession = useCallback(async (sessionId) => {
    try {
      const response = await fetch(`${API_BASE}/chat/history/session/${sessionId}`, { headers: getAuthHeaders() });
      if (!response.ok) return false;

      const payload = await response.json();
      const session = payload.session || {};
      const loadedMessages = Array.isArray(session.messages)
        ? session.messages.map((item) => ({ ...item, charts: Array.isArray(item.charts) ? item.charts : [] }))
        : [];

      setActiveSessionId(session.session_id || sessionId);
      setMessages(loadedMessages);
      setQuery("");
      if (session.dataset_id) {
        const resolvedDataset = await resolveDatasetForSession(session.dataset_id, session.dataset_name);
        setDataset(resolvedDataset);
        if (resolvedDataset?.dataset_id) {
          persistActiveDatasetId(resolvedDataset.dataset_id);
        }
      } else {
        const fallbackDataset = await fetchPreferredDataset();
        setDataset(fallbackDataset);
      }
      return true;
    } catch {
      return false;
    }
  }, [fetchPreferredDataset, resolveDatasetForSession]);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      setLoadingSessions(true);
      const items = await refreshSessions();
      if (!mounted) return;
      if (items.length > 0) await loadSession(items[0].session_id);
      if (mounted && !dataset) {
        const fallbackDataset = await fetchPreferredDataset();
        if (fallbackDataset) setDataset(fallbackDataset);
      }
      setLoadingSessions(false);
    };

    bootstrap();
    return () => {
      mounted = false;
    };
  }, [refreshSessions, loadSession, fetchPreferredDataset, dataset]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const upsertSessionMeta = useCallback(async ({ sessionId, title, datasetId, datasetName }) => {
    try {
      const response = await fetch(`${API_BASE}/chat/history/session`, {
        method: "POST",
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          session_id: sessionId,
          title,
          dataset_id: datasetId || null,
          dataset_name: datasetName || null,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save session: ${response.status}`);
      }
    } catch (err) {
      console.error("Session metadata update failed:", err);
    }
  }, []);

  // ── Video Export (Screen Record) ─────────────────────────────────────────
  const handleExportVideo = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { displaySurface: "browser" }, 
        audio: false 
      });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      mediaRecorderRef.current = mediaRecorder;
      const chunks = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Narralytics_Chat_Session_${new Date().toISOString().split('T')[0]}.webm`;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        setIsRecording(false);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      
      // Handle user clicking "Stop sharing" in the browser UI
      stream.getVideoTracks()[0].onended = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
      };
    } catch (err) {
      console.error("Video export error:", err);
      // User likely cancelled the picker
    }
  };


  const persistExchange = useCallback(
    async ({ sessionId, userMessage, aiMessage, exchangeMeta = {} }) => {
      try {
        await fetch(`${API_BASE}/chat/history/message`, {
          method: "POST",
          headers: getAuthHeaders(true),
          body: JSON.stringify({
            session_id: sessionId,
            user_message: { ...userMessage, meta: { ...(userMessage?.meta || {}), ...exchangeMeta } },
            ai_message: { ...aiMessage, meta: { ...(aiMessage?.meta || {}), ...exchangeMeta } },
            dataset_id: dataset?.dataset_id || null,
            dataset_name: dataset?.filename || null,
          }),
        });
      } catch {
        // Non-fatal.
      } finally {
        await refreshSessions();
      }
    },
    [dataset, refreshSessions],
  );
  const createNewChat = useCallback(async () => {
    const newSessionId = crypto.randomUUID();
    setActiveSessionId(newSessionId);
    setMessages([]);
    setQuery("");
    setUploadError("");
    await upsertSessionMeta({ sessionId: newSessionId, title: "New Chat" });
    await refreshSessions();
  }, [refreshSessions, upsertSessionMeta]);

  const handleFileUpload = useCallback(
    async (file) => {
      if (!file) return;

      setUploading(true);
      setUploadFilename(file.name);
      setUploadProgress(8);
      setUploadError("");

      let timerId;
      try {
        timerId = window.setInterval(() => setUploadProgress((previous) => Math.min(previous + 9, 92)), 180);

        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(`${API_BASE}/datasets/upload`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: formData,
        });

        if (!response.ok) {
          const errorPayload = await response.json().catch(() => ({}));
          throw new Error(errorPayload.detail || "Dataset upload failed");
        }

        const uploaded = await response.json();
        setUploadProgress(100);
        setDataset(uploaded);
        persistActiveDatasetId(uploaded?.dataset_id);

        const existingTitle =
          sessions.find((session) => session.session_id === activeSessionId)?.title ||
          (messages[0]?.content ? messages[0].content.slice(0, 80) : "New Chat");

        await upsertSessionMeta({
          sessionId: activeSessionId,
          title: existingTitle,
          datasetId: uploaded.dataset_id,
          datasetName: uploaded.filename,
        });
        await refreshSessions();
      } catch (error) {
        setUploadError(error.message || "Upload failed");
      } finally {
        if (timerId) clearInterval(timerId);
        setUploading(false);
        window.setTimeout(() => setUploadProgress(0), 700);
      }
    },
    [activeSessionId, messages, refreshSessions, sessions, upsertSessionMeta],
  );

  const handleSubmit = useCallback(
    async (forcedText) => {
      const text = (forcedText ?? query).trim();
      if (!text || isLoading) return;

      const sessionId = activeSessionId || crypto.randomUUID();
      if (!activeSessionId) setActiveSessionId(sessionId);

      const userMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
        timestamp: nowIso(),
      };

      setMessages((previous) => [...previous, userMessage]);
      setQuery("");
      setIsLoading(true);
      const pattern = null;

      const complete = async (aiMessage, exchangeMeta = {}) => {
        setMessages((previous) => [...previous, aiMessage]);
        setIsLoading(false);
        void persistExchange({ sessionId, userMessage, aiMessage, exchangeMeta });
      };

      if (messages.length === 0) {
        void upsertSessionMeta({
          sessionId,
          title: text.slice(0, 80),
          datasetId: dataset?.dataset_id || null,
          datasetName: dataset?.filename || null,
        });
      }



      try {


        if (!dataset?.dataset_id) {
          const aiMessage = {
            id: `assistant-${Date.now() + 2}`,
            role: "assistant",
            content: ERROR_NO_DATASET,
            timestamp: nowIso(),
            meta: { mode: "no_dataset", pattern, reason: "missing_dataset" },
          };
          await complete(aiMessage, { pattern, mode: "no_dataset", source: "dataset_guard" });
          return;
        }

        const history = toTurnHistory([...messages, userMessage]);
        const headers = getAuthHeaders(true);
        const backendResults = await Promise.allSettled([
          fetchJsonWithTimeout(
            `${API_BASE}/chat`,
            {
              method: "POST",
              headers,
              body: JSON.stringify({
                message: text,
                dataset_id: dataset.dataset_id,
                history,
                session_id: sessionId,
              }),
            },
          ),
          fetchJsonWithTimeout(
            `${API_BASE}/query`,
            {
              method: "POST",
              headers,
              body: JSON.stringify({
                prompt: text,
                dataset_id: dataset.dataset_id,
                output_count: 1,
                history,
                session_id: sessionId,
              }),
            },
          ),
        ]);

        const chatPayload = backendResults[0].status === "fulfilled" ? backendResults[0].value : null;
        const queryPayload = backendResults[1].status === "fulfilled" ? backendResults[1].value : null;

        // Prefer charts from /chat because that route already applies deterministic
        // matching + SQL execution for the current prompt. Fall back to /query only
        // when /chat didn't return any charts.
        const primaryCharts = Array.isArray(chatPayload?.charts) ? chatPayload.charts : [];
        const fallbackCharts = Array.isArray(queryPayload?.options) ? queryPayload.options : [];
        const mergedCharts = (primaryCharts.length > 0 ? primaryCharts : fallbackCharts)
          .map(normalizeChartPayload)
          .filter((chart) => Array.isArray(chart.data) && chart.data.length > 0);

        const aiMessage = {
          id: `assistant-${Date.now() + 3}`,
          role: "assistant",
          content: chatPayload?.answer || "",
          charts: mergedCharts,
          timestamp: nowIso(),
          meta: { mode: "backend", pattern, chart_source: "backend_engine" },
        };

        if (chatPayload?.cannot_answer && queryPayload?.cannot_answer && mergedCharts.length === 0) {
          // Both engines explicitly say they can't answer — show the reason
          aiMessage.content = chatPayload?.reason || queryPayload?.reason || ERROR_NO_RESULTS;
          aiMessage.charts = [];
          aiMessage.meta = { ...aiMessage.meta, mode: "cannot_answer" };
        } else if ((!aiMessage.content || chatPayload?.cannot_answer) && mergedCharts.length > 0) {
          aiMessage.content = mergedCharts[0]?.insight || "I generated the relevant chart from your dataset.";
          aiMessage.meta = { ...aiMessage.meta, mode: "chart_backed" };
        } else if (!aiMessage.content && mergedCharts.length === 0) {
          // No text and no charts at all — generic fallback
          aiMessage.content = ERROR_NO_RESULTS;
          aiMessage.meta = { ...aiMessage.meta, mode: "no_results" };
        }

        await complete(aiMessage, { pattern, mode: aiMessage?.meta?.mode || "backend", source: "backend" });
      } catch (error) {
        console.error("Chat request failed:", error);
        const aiMessage = {
          id: `assistant-${Date.now() + 4}`,
          role: "assistant",
          content: `${ERROR_BACKEND_FAIL} (${error.message})`,
          timestamp: nowIso(),
          meta: { mode: "error", pattern, reason: "request_failed", error: error.message },
        };
        await complete(aiMessage, { pattern, mode: "error", source: "backend_error" });
      }
    },
    [
      activeSessionId,
      dataset,
      isLoading,
      messages,
      persistExchange,
      query,
      upsertSessionMeta,
    ],
  );

  const onFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const onDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) handleFileUpload(file);
  };

  return (
    <>
      <style>{`
        :root {
          --bg: #05050f;
          --bg-card: #0c0c1e;
          --bg-card-2: #111128;
          --border: rgba(255,255,255,0.07);
          --text: #eeeef8;
          --text-muted: #9090c0;
          --accent: #5b6af9;
          --accent-soft: rgba(91,106,249,0.14);
          --font-mono: 'JetBrains Mono', monospace;
        }

        body { margin: 0; }

        @keyframes pulse-border {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(1.18); }
        }

        @media (max-width: 900px) {
          .chat-session-title { font-size: 0.74rem !important; }
          .chat-user-bubble-mobile { max-width: 86% !important; }
        }
      `}</style>
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          background: "radial-gradient(circle at 20% 0%, rgba(91,106,249,0.12), transparent 45%), var(--bg)",
          overflow: "hidden",
          color: "var(--text)",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <aside
          style={{
            width: sidebarExpanded ? 300 : 76,
            height: "100%",
            background: "rgba(8,8,24,0.94)",
            borderRight: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            transition: "width 0.25s ease",
            backdropFilter: "blur(14px)",
            zIndex: 2,
          }}
        >
          <div style={{ borderBottom: "1px solid var(--border)", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                style={{
                  border: "1px solid var(--border)",
                  background: "var(--bg-card)",
                  color: "var(--text)",
                  borderRadius: 10,
                  height: 34,
                  minWidth: 34,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
                title="Back to dashboard"
                onClick={() => navigate("/dashboard")}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>

              {sidebarExpanded && (
                <button
                  style={{
                    border: "1px solid var(--accent)",
                    background: "var(--accent)",
                    color: "white",
                    borderRadius: 10,
                    height: 34,
                    minWidth: 34,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    padding: "0 10px",
                  }}
                  onClick={createNewChat}
                >
                  New Chat
                </button>
              )}

              <button
                style={{
                  border: "1px solid var(--border)",
                  background: "var(--bg-card)",
                  color: "var(--text)",
                  borderRadius: 10,
                  height: 34,
                  minWidth: 34,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
                title={sidebarExpanded ? "Collapse" : "Expand"}
                onClick={() => setSidebarExpanded((previous) => !previous)}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                </svg>
              </button>
            </div>

            {sidebarExpanded && <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", padding: "0 2px" }}>{user?.name || "Analyst"}</div>}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 7 }}>
            {loadingSessions && sidebarExpanded && (
              <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", padding: "6px 4px" }}>Loading sessions...</div>
            )}

            {!loadingSessions && sessions.length === 0 && sidebarExpanded && (
              <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", padding: "6px 4px" }}>No previous sessions yet.</div>
            )}

            {sessions.map((session) => {
              const isActive = session.session_id === activeSessionId;
              return (
                <button
                  key={session.session_id}
                  style={{
                    border: isActive ? "1px solid rgba(91,106,249,0.48)" : "1px solid transparent",
                    background: isActive ? "var(--accent-soft)" : "transparent",
                    color: "var(--text)",
                    borderRadius: 10,
                    textAlign: "left",
                    padding: 10,
                    cursor: "pointer",
                    width: "100%",
                  }}
                  onClick={() => loadSession(session.session_id)}
                  title={session.title || "Session"}
                >
                  {sidebarExpanded ? (
                    <>
                      <div className="chat-session-title" style={{ fontSize: "0.8rem", fontWeight: 600, lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.title || "Untitled Session"}</div>
                      <div style={{ marginTop: 4, fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.4, maxHeight: "2.8em", overflow: "hidden" }}>{session.preview || "No preview available"}</div>
                      <div style={{ marginTop: 6, fontSize: "0.65rem", color: "var(--text-muted)", display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)" }}>
                        <span>{Math.max(0, Number(session.message_count || 0))} msg</span>
                        <span>{formatRelativeTime(session.updated_at)}</span>
                      </div>
                    </>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        <main style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", minWidth: 0 }}>
          <div style={{ height: 56, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px" }}>
            <div>
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.2rem", letterSpacing: "0.01em" }}>Narralytics Copilot</div>
              <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: 2 }}>Deterministic analytics matching with live-model fallback</div>
            </div>
            <button
              style={{
                border: "1px solid var(--border)",
                background: "var(--bg-card)",
                color: "var(--text)",
                borderRadius: 10,
                height: 34,
                minWidth: 34,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                padding: "0 10px",
              }}
              onClick={createNewChat}
            >
              Reset
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 10px", display: "flex", flexDirection: "column", gap: 12 }}>
            {!hasMessages && (
              <div style={{ margin: "48px auto auto", maxWidth: 700, textAlign: "center", display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
                <h2 style={{ margin: 0, fontFamily: "'DM Serif Display', serif", fontSize: "clamp(1.8rem,4vw,2.8rem)", fontWeight: 400, lineHeight: 1.15 }}>Ask your analytics question.</h2>
                <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.9rem", maxWidth: 540, lineHeight: 1.6 }}>
                  {dataset?.profile?.summary || "Narralytics sends your question to the backend analytics pipeline, where Groq generates chart plans and answers directly from your uploaded dataset."}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                  {suggestionChips.map((chip) => (
                    <button
                      key={chip}
                      style={{
                        border: "1px solid var(--border)",
                        background: "var(--bg-card)",
                        color: "var(--text-muted)",
                        borderRadius: 999,
                        padding: "8px 13px",
                        fontSize: "0.77rem",
                        cursor: "pointer",
                      }}
                      onClick={() => handleSubmit(chip)}
                      disabled={isLoading}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {hasMessages && messages.map((message) => <MessageItem key={message.id || `${message.role}-${message.timestamp}`} message={message} />)}
            {isLoading && (
              <div style={{ display: "flex", justifyContent: "flex-start", width: "100%" }}>
                <div
                  style={{
                    marginTop: 3,
                    borderRadius: 14,
                    border: "1px solid var(--border)",
                    background: "var(--bg-card)",
                    width: "min(520px, 90%)",
                    padding: "14px 16px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: "var(--accent)",
                        boxShadow: "0 0 18px rgba(91,106,249,0.65)",
                        animation: "pulse-border 1.5s infinite",
                      }}
                    />
                    <div style={{ fontSize: "0.82rem", color: "var(--text)", fontWeight: 600 }}>
                      Analyzing your dataset
                    </div>
                  </div>
                  <div style={{ fontSize: "0.77rem", color: "var(--text-muted)", lineHeight: 1.65 }}>
                    Narralytics is checking the uploaded schema, generating the answer, and preparing the chart if your question matches the dataset.
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div style={{ padding: "8px 20px 16px", display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid var(--border)", background: "var(--bg)", zIndex: 10 }}>
            {/* Dataset chip / upload progress */}
            {(dataset || uploading) && (
              <div className="chat-meta-row" style={{ justifyContent: "space-between", width: "100%" }}>
                <div style={{ display: "flex", gap: "8px" }}>
                  {uploading && (
                    <div
                      style={{
                        borderRadius: 999,
                        border: "1px solid var(--border)",
                        background: "var(--bg-card)",
                        padding: "6px 11px",
                        fontSize: "0.73rem",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 7,
                        color: "var(--text-muted)",
                      }}
                    >
                      <span>{uploadProgress}%</span>
                      <strong
                        style={{
                          color: "var(--text)",
                          maxWidth: 220,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontWeight: 500,
                        }}
                      >
                        {uploadFilename}
                      </strong>
                    </div>
                  )}
                  {dataset && !uploading && (
                    <div
                      style={{
                        borderRadius: 999,
                        border: "1px solid var(--border)",
                        background: "var(--bg-card)",
                        padding: "6px 11px",
                        fontSize: "0.73rem",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 7,
                        color: "var(--text-muted)",
                      }}
                    >
                      <span>Dataset</span>
                      <strong
                        style={{
                          color: "var(--text)",
                          maxWidth: 220,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontWeight: 500,
                        }}
                      >
                        {dataset.filename || "Attached Dataset"}
                      </strong>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        title="Replace dataset"
                        style={{
                          border: "1px solid var(--border)",
                          background: "transparent",
                          color: "var(--text-muted)",
                          borderRadius: 999,
                          padding: "2px 6px",
                          cursor: "pointer",
                          fontSize: "0.65rem",
                        }}
                      >
                        Replace
                      </button>
                    </div>
                  )}
                </div>
                {dataset && (
                  <button 
                    onClick={handleExportVideo}
                    title={isRecording ? "Stop Recording" : "Record Chat to Video"}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 14px",
                      background: isRecording ? "rgba(239, 68, 68, 0.12)" : "rgba(99, 102, 241, 0.12)",
                      border: `1px solid ${isRecording ? "rgba(239, 68, 68, 0.3)" : "rgba(99, 102, 241, 0.3)"}`,
                      borderRadius: "100px",
                      color: isRecording ? "#ef4444" : "#818cf8",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = isRecording ? "rgba(239, 68, 68, 0.2)" : "rgba(99, 102, 241, 0.2)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = isRecording ? "rgba(239, 68, 68, 0.12)" : "rgba(99, 102, 241, 0.12)"; }}
                  >
                    <div style={{
                      width: "6px", height: "6px", borderRadius: "50%",
                      background: isRecording ? "#ef4444" : "#6366f1",
                      boxShadow: isRecording ? "0 0 6px #ef4444" : "0 0 6px #6366f1",
                      animation: isRecording ? "pulse-border 1.5s infinite" : "none"
                    }} />
                    {isRecording ? "Stop Recording" : "Export Video"}
                  </button>
                )}
              </div>
            )}

            {!!uploadError && (
              <div
                style={{
                  borderRadius: 12,
                  border: "1px solid rgba(255,107,138,0.28)",
                  background: "rgba(255,107,138,0.08)",
                  color: "#ff9eb3",
                  fontSize: "0.78rem",
                  padding: "10px 12px",
                  lineHeight: 1.55,
                }}
              >
                {uploadError}
              </div>
            )}

            <div
              style={{
                border: dragActive ? "1.5px solid rgba(45,212,160,0.62)" : "1.5px solid var(--border)",
                boxShadow: dragActive ? "0 0 0 3px rgba(45,212,160,0.16)" : "none",
                background: "var(--bg-card)",
                borderRadius: 16,
                overflow: "hidden",
                transition: "all 0.18s ease",
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setDragActive(false);
              }}
              onDrop={onDrop}
            >
              <textarea
                style={{ width: "100%", minHeight: 62, maxHeight: 180, padding: "13px 14px 9px", border: "none", resize: "vertical", background: "transparent", outline: "none", color: "var(--text)", fontSize: "0.95rem", lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}
                placeholder="Ask about your data..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleSubmit();
                  }
                }}
                disabled={isLoading}
                rows={2}
              />

              <div style={{ borderTop: "1px solid var(--border)", padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid var(--border)", background: "var(--bg-card-2)", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                    title="Attach dataset"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                  </button>
                  <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }} onChange={onFileChange} disabled={uploading} />

                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.66rem",
                      borderRadius: 8,
                      border: dataset ? "1px solid rgba(45,212,160,0.34)" : "1px solid var(--border)",
                      background: dataset ? "rgba(45,212,160,0.08)" : "var(--bg-card-2)",
                      color: dataset ? "#2dd4a0" : "var(--text-muted)",
                      padding: "4px 8px",
                    }}
                  >
                    {dataset ? "Online" : "Offline"}
                  </span>
                </div>

                <button
                  type="button"
                  style={{
                    border: "none",
                    width: 36,
                    height: 36,
                    borderRadius: 11,
                    background: "var(--accent)",
                    color: "white",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: "0 0 16px rgba(91,106,249,0.4)",
                    opacity: !query.trim() || isLoading ? 0.45 : 1,
                  }}
                  onClick={() => handleSubmit()}
                  disabled={!query.trim() || isLoading}
                  title="Send"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
                  </svg>
                </button>
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {suggestionChips.map((chip) => (
                <button
                  key={`footer-${chip}`}
                  style={{ border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-muted)", borderRadius: 999, padding: "8px 13px", fontSize: "0.77rem", cursor: "pointer" }}
                  onClick={() => handleSubmit(chip)}
                  disabled={isLoading}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
