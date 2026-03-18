
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
import { detectQueryPattern, isDatasetRelevantToQuery, matchQuery } from "../utils/queryMatcher";

const API_BASE = API_BASE_URL || import.meta.env.VITE_API_URL || "http://localhost:8000";
const SUPPORTED_CHARTS = new Set(["bar", "line", "pie", "scatter", "area"]);
const PIPELINE_DURATION_MS = 5000;
const PIPELINE_TRACKS = [
  { id: "preprocess", label: "Pre-processing Data", start: 0.0, end: 0.62, color: "#38bdf8" },
  { id: "reasoning", label: "Reasoning Engine", start: 0.08, end: 0.86, color: "#5b6af9" },
  { id: "llm_a", label: "LLM Worker A", start: 0.16, end: 0.9, color: "#a78bfa" },
  { id: "llm_b", label: "LLM Worker B", start: 0.16, end: 0.9, color: "#f59e0b" },
  { id: "chart", label: "Chart Composer", start: 0.42, end: 0.96, color: "#2dd4a0" },
  { id: "response", label: "Response Synthesis", start: 0.72, end: 1.0, color: "#f97316" },
];

const SUGGESTION_CHIPS = [
  "Revenue by category and product",
  "Regional geography performance",
  "Monthly time-series trend",
  "Weekly sessions by days",
  "Discount strategy impact",
  "Top best performing products",
  "Payment method contribution",
  "Customer rating and satisfaction",
];

const nowIso = () => new Date().toISOString();
const clone = (value) => JSON.parse(JSON.stringify(value));
const INSUFFICIENT_DATA_MESSAGE = "Data is insufficient for this request.";
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getAuthHeaders = (json = false) => {
  const token = localStorage.getItem("authToken");
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (json) headers["Content-Type"] = "application/json";
  return headers;
};

const fetchJsonWithTimeout = async (url, options = {}, timeoutMs = 4500) => {
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

const buildPipelineState = (normalizedProgress) => {
  const progress = clamp(normalizedProgress, 0, 1);
  const tracks = PIPELINE_TRACKS.map((track) => {
    const local = clamp((progress - track.start) / (track.end - track.start), 0, 1);
    const percent = Math.round(local * 100);
    const status = percent >= 100 ? "done" : percent > 0 ? "running" : "queued";
    return { ...track, percent, status };
  });

  return {
    progress: Math.round(progress * 100),
    tracks,
  };
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
  const pipelineIntervalRef = useRef(null);
  const pipelineTimeoutRef = useRef(null);

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
  const [pipelineState, setPipelineState] = useState(null);

  const hasMessages = messages.length > 0;

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
      } else {
        setDataset(null);
      }
      return true;
    } catch {
      return false;
    }
  }, [resolveDatasetForSession]);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      setLoadingSessions(true);
      const items = await refreshSessions();
      if (!mounted) return;
      if (items.length > 0) await loadSession(items[0].session_id);
      setLoadingSessions(false);
    };

    bootstrap();
    return () => {
      mounted = false;
    };
  }, [refreshSessions, loadSession]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(
    () => () => {
      if (pipelineIntervalRef.current) {
        clearInterval(pipelineIntervalRef.current);
      }
      if (pipelineTimeoutRef.current) {
        clearTimeout(pipelineTimeoutRef.current);
      }
    },
    [],
  );

  const runDummyPipeline = useCallback(() => {
    if (pipelineIntervalRef.current) {
      clearInterval(pipelineIntervalRef.current);
      pipelineIntervalRef.current = null;
    }
    if (pipelineTimeoutRef.current) {
      clearTimeout(pipelineTimeoutRef.current);
      pipelineTimeoutRef.current = null;
    }

    const startedAt = Date.now();
    setPipelineState(buildPipelineState(0));

    return new Promise((resolve) => {
      let completed = false;
      const finalize = () => {
        if (completed) return;
        completed = true;
        if (pipelineIntervalRef.current) {
          clearInterval(pipelineIntervalRef.current);
          pipelineIntervalRef.current = null;
        }
        if (pipelineTimeoutRef.current) {
          clearTimeout(pipelineTimeoutRef.current);
          pipelineTimeoutRef.current = null;
        }
        setPipelineState(buildPipelineState(1));
        resolve();
      };

      pipelineIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const normalized = clamp(elapsed / PIPELINE_DURATION_MS, 0, 0.99);
        setPipelineState(buildPipelineState(normalized));
      }, 80);

      pipelineTimeoutRef.current = setTimeout(finalize, PIPELINE_DURATION_MS);
    });
  }, []);

  const upsertSessionMeta = useCallback(async ({ sessionId, title, datasetId, datasetName }) => {
    try {
      await fetch(`${API_BASE}/chat/history/session`, {
        method: "POST",
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          session_id: sessionId,
          title,
          dataset_id: datasetId || null,
          dataset_name: datasetName || null,
        }),
      });
    } catch {
      // Non-fatal.
    }
  }, []);

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
    setDataset(null);
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
      const pipelinePromise = runDummyPipeline();
      const pattern = detectQueryPattern(text);

      const complete = async (aiMessage, exchangeMeta = {}) => {
        await pipelinePromise;
        setMessages((previous) => [...previous, aiMessage]);
        setIsLoading(false);
        setPipelineState(null);
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
        const matched = matchQuery(text);

        if (matched) {
          const datasetColumns = Array.isArray(dataset?.columns) ? dataset.columns : [];
          const hasDataset = Boolean(dataset?.dataset_id);
          const hasDatasetColumns = datasetColumns.length > 0;

          if (hasDataset && hasDatasetColumns && !isDatasetRelevantToQuery(text, datasetColumns)) {
            const aiMessage = {
              id: `assistant-${Date.now() + 1}`,
              role: "assistant",
              content: INSUFFICIENT_DATA_MESSAGE,
              charts: [],
              timestamp: nowIso(),
              meta: { mode: "insufficient", pattern, reason: "dataset_irrelevant" },
            };
            await complete(aiMessage, { pattern, mode: "insufficient", source: "deterministic_guard" });
            return;
          }

          let aiMessage = {
            id: `assistant-${Date.now() + 1}`,
            role: "assistant",
            content: matched.answer,
            charts: [matched],
            timestamp: nowIso(),
            meta: { mode: "deterministic", pattern, chart_source: "hardcoded_matcher" },
          };

          if (hasDataset) {
            const history = toTurnHistory([...messages, userMessage]);
            try {
              const chatPayload = await fetchJsonWithTimeout(
                `${API_BASE}/chat`,
                {
                  method: "POST",
                  headers: getAuthHeaders(true),
                  body: JSON.stringify({
                    message: text,
                    dataset_id: dataset.dataset_id,
                    history,
                    session_id: sessionId,
                  }),
                },
                4200,
              );

              if (chatPayload?.cannot_answer) {
                aiMessage = {
                  id: `assistant-${Date.now() + 1}`,
                  role: "assistant",
                  content: INSUFFICIENT_DATA_MESSAGE,
                  charts: [],
                  timestamp: nowIso(),
                  meta: { mode: "insufficient", pattern, reason: "backend_cannot_answer" },
                };
              } else if (chatPayload?.answer) {
                aiMessage = {
                  ...aiMessage,
                  content: chatPayload.answer,
                  meta: { ...aiMessage.meta, mode: "hybrid", description_source: "backend_llm" },
                };
              }
            } catch {
              // Keep deterministic chart + answer as fallback.
            }
          }

          await complete(aiMessage, {
            pattern,
            mode: aiMessage?.meta?.mode || "deterministic",
            source: "matcher",
          });
          return;
        }

        if (!dataset?.dataset_id) {
          const aiMessage = {
            id: `assistant-${Date.now() + 2}`,
            role: "assistant",
            content: INSUFFICIENT_DATA_MESSAGE,
            timestamp: nowIso(),
            meta: { mode: "insufficient", pattern, reason: "missing_dataset" },
          };
          await complete(aiMessage, { pattern, mode: "insufficient", source: "dataset_guard" });
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
            4200,
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
            4200,
          ),
        ]);

        const chatPayload = backendResults[0].status === "fulfilled" ? backendResults[0].value : null;
        const queryPayload = backendResults[1].status === "fulfilled" ? backendResults[1].value : null;

        const mergedCharts = [
          ...(Array.isArray(chatPayload?.charts) ? chatPayload.charts : []),
          ...(Array.isArray(queryPayload?.options) ? queryPayload.options : []),
        ]
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

        if (chatPayload?.cannot_answer) {
          aiMessage.content = INSUFFICIENT_DATA_MESSAGE;
          aiMessage.charts = [];
          aiMessage.meta = { ...aiMessage.meta, mode: "insufficient", reason: "chat_cannot_answer" };
        } else if (queryPayload?.cannot_answer && !aiMessage.content && mergedCharts.length === 0) {
          aiMessage.content = INSUFFICIENT_DATA_MESSAGE;
          aiMessage.charts = [];
          aiMessage.meta = { ...aiMessage.meta, mode: "insufficient", reason: "query_cannot_answer" };
        } else if (!aiMessage.content && mergedCharts.length === 0) {
          aiMessage.content = INSUFFICIENT_DATA_MESSAGE;
          aiMessage.meta = { ...aiMessage.meta, mode: "insufficient", reason: "no_relevant_result" };
        }

        await complete(aiMessage, { pattern, mode: aiMessage?.meta?.mode || "backend", source: "backend" });
      } catch (error) {
        const aiMessage = {
          id: `assistant-${Date.now() + 4}`,
          role: "assistant",
          content: INSUFFICIENT_DATA_MESSAGE,
          timestamp: nowIso(),
          meta: { mode: "insufficient", pattern, reason: "request_failed", error: error.message },
        };
        await complete(aiMessage, { pattern, mode: "insufficient", source: "backend_error" });
      }
    },
    [
      activeSessionId,
      dataset,
      isLoading,
      messages,
      persistExchange,
      query,
      runDummyPipeline,
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
              <div style={{ margin: "auto", maxWidth: 700, textAlign: "center", display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
                <h2 style={{ margin: 0, fontFamily: "'DM Serif Display', serif", fontSize: "clamp(1.8rem,4vw,2.8rem)", fontWeight: 400, lineHeight: 1.15 }}>Ask your analytics question.</h2>
                <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.9rem", maxWidth: 540, lineHeight: 1.6 }}>
                  Deterministic query matching powers instant chart responses for the demo. When a query is outside the matcher scope, Narralytics falls back to the backend AI pipeline.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                  {SUGGESTION_CHIPS.map((chip) => (
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
                    width: "min(560px, 90%)",
                    padding: "12px 14px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ fontSize: "0.78rem", color: "var(--text)", fontWeight: 600 }}>
                      Thinking • Reasoning • Pre-processing
                    </div>
                    <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                      {pipelineState?.progress ?? 0}%
                    </div>
                  </div>

                  <div
                    style={{
                      width: "100%",
                      height: 7,
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.08)",
                      overflow: "hidden",
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${pipelineState?.progress ?? 0}%`,
                        background: "linear-gradient(90deg,#5b6af9,#a78bfa,#2dd4a0)",
                        transition: "width 0.12s linear",
                      }}
                    />
                  </div>

                  <div style={{ display: "grid", gap: 8 }}>
                    {(pipelineState?.tracks || PIPELINE_TRACKS.map((track) => ({ ...track, percent: 0, status: "queued" }))).map((track) => (
                      <div key={track.id}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: "0.71rem", color: "var(--text-muted)" }}>{track.label}</span>
                          <span style={{ fontSize: "0.68rem", color: track.color, fontFamily: "var(--font-mono)" }}>
                            {track.status === "done" ? "done" : track.status === "running" ? "running" : "queued"}
                          </span>
                        </div>
                        <div
                          style={{
                            width: "100%",
                            height: 5,
                            borderRadius: 999,
                            background: "rgba(255,255,255,0.06)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${track.percent}%`,
                              background: track.color,
                              opacity: track.percent > 0 ? 1 : 0.45,
                              transition: "width 0.12s linear",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div style={{ borderTop: "1px solid var(--border)", padding: "12px 16px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
            {!!uploadError && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, color: "#ff9a9a", fontSize: "0.79rem", padding: "9px 12px" }}>
                {uploadError}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {uploading && (
                <div style={{ borderRadius: 999, border: "1px solid var(--border)", background: "var(--bg-card)", padding: "6px 11px", fontSize: "0.73rem", display: "inline-flex", alignItems: "center", gap: 7, color: "var(--text-muted)" }}>
                  <span>{uploadProgress}%</span>
                  <strong style={{ color: "var(--text)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>{uploadFilename}</strong>
                </div>
              )}
              {dataset && !uploading && (
                <div style={{ borderRadius: 999, border: "1px solid var(--border)", background: "var(--bg-card)", padding: "6px 11px", fontSize: "0.73rem", display: "inline-flex", alignItems: "center", gap: 7, color: "var(--text-muted)" }}>
                  <span>Dataset</span>
                  <strong style={{ color: "var(--text)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>{dataset.filename || "Attached Dataset"}</strong>
                </div>
              )}
            </div>

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
                placeholder="Ask for revenue, region, trend, sessions, discount strategy, payment method, or rating insights..."
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
              {SUGGESTION_CHIPS.map((chip) => (
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
