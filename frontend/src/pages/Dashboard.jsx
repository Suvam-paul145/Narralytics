import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  BarChart2,
  Brain,
  Database,
  FileSpreadsheet,
  LogOut,
  MessageSquare,
  Moon,
  RefreshCw,
  Sparkles,
  Sun,
  Upload,
} from "lucide-react";
import { API_ENDPOINTS } from "../config/api";
import { useAuth } from "../context/AuthContext";
import { CHART_COLORS } from "../utils/chartColors";

const SUPPORTED = new Set(["bar", "line", "pie", "scatter", "area"]);
const ACTIVE_DATASET_STORAGE_KEY = "narralytics.activeDatasetId";
const BRIEFS = [
  "Executive overview with trends and top drivers",
  "Regional performance and top categories",
  "Growth patterns, rankings, and outliers",
];

const THEMES = {
  dark: {
    "--bg": "#060610",
    "--panel": "#0f1021",
    "--panel2": "#15162b",
    "--border": "rgba(255,255,255,0.08)",
    "--text": "#eef0ff",
    "--muted": "#98a0c7",
    "--soft": "#697198",
    "--accent": "#5b6af9",
    "--accent2": "#2dd4a0",
    "--warn": "#ff6b8a",
  },
  light: {
    "--bg": "#f4f5fb",
    "--panel": "#ffffff",
    "--panel2": "#f7f8fd",
    "--border": "rgba(15,23,42,0.08)",
    "--text": "#12182f",
    "--muted": "#5f6787",
    "--soft": "#8b93b1",
    "--accent": "#4338ca",
    "--accent2": "#047857",
    "--warn": "#be123c",
  },
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&family=JetBrains+Mono:wght@400;500&display=swap');
  *{box-sizing:border-box} body{margin:0;font-family:'DM Sans',sans-serif;background:var(--bg);color:var(--text)}
  button,input,textarea{font:inherit} .shell{min-height:100vh;background:radial-gradient(circle at top left,rgba(91,106,249,.14),transparent 28%),var(--bg)}
  .card{background:var(--panel);border:1px solid var(--border);border-radius:22px;box-shadow:0 16px 46px rgba(0,0,0,.18)}
  .sub{background:var(--panel2);border:1px solid var(--border);border-radius:16px}
  .btn{border:none;border-radius:14px;cursor:pointer;transition:transform .18s ease}.btn:hover{transform:translateY(-1px)}
  .input{width:100%;background:var(--panel2);color:var(--text);border:1px solid var(--border);border-radius:14px;outline:none}
  .grid{display:grid;grid-template-columns:340px minmax(0,1fr);gap:20px}.charts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
  @media (max-width:1150px){.grid{grid-template-columns:1fr}} @media (max-width:900px){.charts{grid-template-columns:1fr}}
`;

function Styles() {
  useEffect(() => {
    const id = "dashboard-css";
    if (!document.getElementById(id)) {
      const style = document.createElement("style");
      style.id = id;
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    return () => document.getElementById(id)?.remove();
  }, []);
  return null;
}

function applyTheme(isDark) {
  Object.entries(isDark ? THEMES.dark : THEMES.light).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });
}

function headers(json = false) {
  const token = localStorage.getItem("authToken");
  const base = token ? { Authorization: `Bearer ${token}` } : {};
  if (json) base["Content-Type"] = "application/json";
  return base;
}

async function fetchJson(url, options = {}, timeoutMs = 45000) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const payload = await response.json();
        if (payload?.detail) detail = payload.detail;
      } catch {}
      throw new Error(detail);
    }
    return await response.json();
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function relativeTime(iso) {
  if (!iso) return "just now";
  const diffMin = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}

function normalizeChart(raw) {
  const type = String(raw?.chart_type || raw?.chartType || "bar").toLowerCase();
  return {
    title: raw?.title || "Analytics View",
    chartType: SUPPORTED.has(type) ? type : "bar",
    xKey: raw?.x_key || raw?.xKey || "x",
    yKey: raw?.y_key || raw?.yKey || "y",
    data: Array.isArray(raw?.data) ? raw.data : [],
    insight: raw?.insight || "",
    sql: raw?.sql || "",
    error: raw?.error || "",
    category: raw?.category || "chart",
  };
}

function formatCompactValue(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return String(value ?? "-");
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function truncateLabel(value, max = 16) {
  const text = String(value ?? "");
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function getChartHighlights(chart) {
  if (!Array.isArray(chart.data) || chart.data.length === 0) return [];

  const numericRows = chart.data
    .map((row) => ({
      label: row[chart.xKey],
      value: Number(row[chart.yKey]),
    }))
    .filter((row) => Number.isFinite(row.value));

  if (numericRows.length === 0) {
    return [{ label: "Points", value: `${chart.data.length}` }];
  }

  const topRow = [...numericRows].sort((left, right) => right.value - left.value)[0];
  const total = numericRows.reduce((sum, row) => sum + row.value, 0);

  return [
    { label: "Points", value: `${chart.data.length}` },
    { label: "Top value", value: formatCompactValue(topRow.value) },
    { label: "Lead segment", value: truncateLabel(topRow.label, 18) },
    { label: "Displayed total", value: formatCompactValue(total) },
  ];
}

function ChartCard({ chart, id }) {
  const [showSql, setShowSql] = useState(false);
  const fillId = `fill-${id}`;
  const highlights = getChartHighlights(chart);
  const scatter = chart.data
    .map((row) => ({ x: Number(row[chart.xKey]), y: Number(row[chart.yKey]) }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

  const commonAxes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
      <XAxis
        dataKey={chart.xKey}
        tick={{ fill: "var(--muted)", fontSize: 11 }}
        tickFormatter={(value) => truncateLabel(value)}
        minTickGap={12}
        axisLine={false}
        tickLine={false}
      />
      <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
      <Tooltip />
    </>
  );

  let body = (
    <div className="sub" style={{ height: 240, display: "grid", placeItems: "center", color: "var(--muted)", fontSize: "0.82rem" }}>
      No chart data available.
    </div>
  );

  if (chart.error) {
    body = (
      <div className="sub" style={{ padding: 14, color: "var(--warn)", fontSize: "0.82rem", lineHeight: 1.6 }}>
        {chart.error}
      </div>
    );
  } else if (chart.data.length > 0) {
    if (chart.chartType === "pie") {
      body = (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={chart.data} dataKey={chart.yKey} nameKey={chart.xKey} cx="50%" cy="50%" innerRadius={50} outerRadius={84} paddingAngle={3}>
                {chart.data.map((item, index) => <Cell key={`${item[chart.xKey]}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8, marginTop: 10 }}>
            {chart.data.slice(0, 6).map((item, index) => (
              <div key={`${item[chart.xKey]}-${index}`} className="sub" style={{ padding: "8px 10px", fontSize: "0.72rem", color: "var(--muted)", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: CHART_COLORS[index % CHART_COLORS.length], flexShrink: 0 }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {truncateLabel(item[chart.xKey], 18)}
                </span>
              </div>
            ))}
          </div>
        </>
      );
    } else if (chart.chartType === "scatter") {
      body = (
        <ResponsiveContainer width="100%" height={240}>
          <ScatterChart margin={{ top: 10, right: 12, bottom: 8, left: 2 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis type="number" dataKey="x" tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis type="number" dataKey="y" tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip />
            <Scatter data={scatter} fill={CHART_COLORS[0]} />
          </ScatterChart>
        </ResponsiveContainer>
      );
    } else if (chart.chartType === "line") {
      body = (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chart.data} margin={{ top: 10, right: 12, bottom: 8, left: 2 }}>
            {commonAxes}
            <Line type="monotone" dataKey={chart.yKey} stroke={CHART_COLORS[0]} strokeWidth={2.4} dot={false} activeDot={{ r: 4, fill: CHART_COLORS[0] }} />
          </LineChart>
        </ResponsiveContainer>
      );
    } else if (chart.chartType === "area") {
      body = (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={chart.data} margin={{ top: 10, right: 12, bottom: 8, left: 2 }}>
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS[0]} stopOpacity={0.28} />
                <stop offset="95%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
              </linearGradient>
            </defs>
            {commonAxes}
            <Area type="monotone" dataKey={chart.yKey} stroke={CHART_COLORS[0]} fill={`url(#${fillId})`} strokeWidth={2.3} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      );
    } else {
      body = (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chart.data} margin={{ top: 10, right: 12, bottom: 8, left: 2 }}>
            {commonAxes}
            <Bar dataKey={chart.yKey} radius={[10, 10, 0, 0]} maxBarSize={44}>
              {chart.data.map((item, index) => <Cell key={`${item[chart.xKey]}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );
    }
  }

  return (
    <article className="card" style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ display: "inline-block", marginBottom: 8, padding: "4px 10px", borderRadius: 999, background: "rgba(91,106,249,0.10)", color: "var(--accent)", fontSize: "0.7rem", textTransform: "capitalize" }}>
            {chart.category}
          </div>
          <h3 style={{ margin: 0, fontSize: "1rem", lineHeight: 1.35 }}>{chart.title}</h3>
        </div>
        <button type="button" className="btn sub" style={{ padding: "8px 10px", color: "var(--muted)", fontSize: "0.72rem" }} onClick={() => setShowSql((v) => !v)}>
          {showSql ? "Hide SQL" : "View SQL"}
        </button>
      </div>
      {body}
      {highlights.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8, marginTop: 12 }}>
          {highlights.map((item) => (
            <div key={`${chart.title}-${item.label}`} className="sub" style={{ padding: "8px 10px" }}>
              <div style={{ fontSize: "0.68rem", color: "var(--soft)", textTransform: "uppercase", marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text)", fontWeight: 600, lineHeight: 1.35 }}>{item.value}</div>
            </div>
          ))}
        </div>
      )}
      {!!chart.insight && <p style={{ margin: "12px 0 0", color: "var(--muted)", fontSize: "0.82rem", lineHeight: 1.65 }}>{chart.insight}</p>}
      {showSql && !!chart.sql && (
        <pre style={{ margin: "12px 0 0", padding: 12, borderRadius: 14, background: "#091020", color: "#9fd0ff", fontSize: "0.72rem", fontFamily: "'JetBrains Mono', monospace", whiteSpace: "pre-wrap", overflowX: "auto" }}>
          <code>{chart.sql}</code>
        </pre>
      )}
    </article>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const inputRef = useRef(null);
  const [isDark, setIsDark] = useState(true);
  const [datasets, setDatasets] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [requirements, setRequirements] = useState("");
  const [dashboard, setDashboard] = useState({ datasetId: "", charts: [], count: 0, generatedAt: "" });
  const [loadingSets, setLoadingSets] = useState(true);
  const [loadingDash, setLoadingDash] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => applyTheme(isDark), [isDark]);

  const selected = datasets.find((item) => item.dataset_id === selectedId) || null;
  const charts = dashboard.charts.map((item) => normalizeChart(item));
  const successCount = charts.filter((chart) => !chart.error && chart.data.length > 0).length;
  const dynamicBriefs = selected?.profile?.recommended_dashboard_requirements?.length
    ? selected.profile.recommended_dashboard_requirements
    : BRIEFS;

  const loadDatasets = async (preserve = true) => {
    setLoadingSets(true);
    try {
      const payload = await fetchJson(`${API_ENDPOINTS.DATASETS}/`, { headers: headers() });
      const items = Array.isArray(payload.datasets) ? payload.datasets : [];
      setDatasets(items);
      const savedDatasetId = localStorage.getItem(ACTIVE_DATASET_STORAGE_KEY);
      if (items.length === 0) {
        setSelectedId("");
      } else if (preserve && savedDatasetId && items.some((item) => item.dataset_id === savedDatasetId)) {
        setSelectedId(savedDatasetId);
      } else if (!preserve || !items.some((item) => item.dataset_id === selectedId)) {
        const amazonDataset = items.find((item) =>
          String(item.original_filename || item.filename || item.name || "")
            .toLowerCase()
            .includes("amazon_sales"),
        );
        setSelectedId((amazonDataset || items[0]).dataset_id);
      }
    } catch (error) {
      setMessage(error.message || "Failed to load datasets.");
    } finally {
      setLoadingSets(false);
    }
  };

  const generateDashboard = async (datasetId, nextRequirements = requirements) => {
    if (!datasetId) {
      setMessage("Upload or select a dataset first.");
      return;
    }
    setMessage("");
    setLoadingDash(true);
    try {
      const payload = await fetchJson(`${API_ENDPOINTS.DASHBOARD}/auto/${datasetId}`, {
        method: "POST",
        headers: headers(true),
        body: JSON.stringify({ requirements: nextRequirements.trim() || null }),
      });
      const nextCharts = Array.isArray(payload.charts) ? payload.charts : [];
      setDashboard({ datasetId, charts: nextCharts, count: Number(payload.chart_count || nextCharts.length || 0), generatedAt: new Date().toISOString() });
      if (nextCharts.length === 0) {
        setMessage("No dashboard charts were generated yet. Try a more specific brief or a richer dataset.");
      }
    } catch (error) {
      setDashboard({ datasetId, charts: [], count: 0, generatedAt: "" });
      setMessage(error.message || "Failed to generate dashboard.");
    } finally {
      setLoadingDash(false);
    }
  };

  useEffect(() => {
    loadDatasets(false);
  }, []);

  useEffect(() => {
    if (selectedId && !loadingSets) {
      localStorage.setItem(ACTIVE_DATASET_STORAGE_KEY, selectedId);
      generateDashboard(selectedId, requirements);
    }
  }, [selectedId, loadingSets]);

  const uploadFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`${API_ENDPOINTS.DATASETS}/upload`, { method: "POST", headers: headers(), body: formData });
      if (!response.ok) {
        let detail = `HTTP ${response.status}`;
        try {
          const payload = await response.json();
          if (payload?.detail) detail = payload.detail;
        } catch {}
        throw new Error(detail);
      }
      const payload = await response.json();
      await loadDatasets(false);
      setSelectedId(payload.dataset_id);
      if (payload?.dataset_id) {
        localStorage.setItem(ACTIVE_DATASET_STORAGE_KEY, payload.dataset_id);
      }
    } catch (error) {
      setMessage(error.message || "Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const datasetName = selected?.original_filename || selected?.filename || selected?.name || "No dataset selected";

  return (
    <>
      <Styles />
      <div className="shell">
        <div style={{ maxWidth: 1440, margin: "0 auto", padding: "24px clamp(16px,2.5vw,28px) 32px" }}>
          <header className="card" style={{ padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 14, display: "grid", placeItems: "center", background: "linear-gradient(135deg,var(--accent),#7c3aed)", color: "#fff" }}><Brain size={20} /></div>
              <div>
                <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.55rem", lineHeight: 1 }}>Narralytics Dashboard Studio</div>
                <div style={{ marginTop: 6, color: "var(--muted)", fontSize: "0.84rem" }}>Groq-driven dashboards generated from the dataset you upload.</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="btn sub" style={{ padding: "10px 14px", color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 8 }} onClick={() => navigate("/chat")}><MessageSquare size={16} />Chat</button>
              <button type="button" className="btn sub" style={{ padding: "10px 14px", color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 8 }} onClick={() => setIsDark((v) => !v)}>{isDark ? <Sun size={16} /> : <Moon size={16} />}{isDark ? "Light" : "Dark"}</button>
              <button type="button" className="btn" style={{ padding: "10px 14px", background: "var(--text)", color: "var(--bg)", display: "inline-flex", alignItems: "center", gap: 8 }} onClick={() => { logout(); navigate("/"); }}><LogOut size={16} />{user?.name ? user.name.split(" ")[0] : "Sign out"}</button>
            </div>
          </header>

          {message && (
            <div className="card" style={{ padding: 14, marginBottom: 20, color: "var(--warn)", display: "flex", gap: 10, alignItems: "flex-start", lineHeight: 1.6, fontSize: "0.82rem" }}>
              <AlertTriangle size={18} style={{ marginTop: 1 }} /> {message}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14, marginBottom: 20 }}>
            {[
              ["Datasets", loadingSets ? "..." : `${datasets.length}`, "available files"],
              ["Rows", selected ? `${Number(selected.row_count || 0).toLocaleString()}` : "0", datasetName],
              ["Charts", loadingDash ? "..." : `${dashboard.count}`, dashboard.generatedAt ? `updated ${relativeTime(dashboard.generatedAt)}` : "not generated yet"],
              ["Successful", loadingDash ? "..." : `${successCount}`, "charts with returned data"],
            ].map(([label, value, hint]) => (
              <div key={label} className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: "0.72rem", color: "var(--soft)", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
                <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.7rem", lineHeight: 1, marginBottom: 8 }}>{value}</div>
                <div style={{ color: "var(--muted)", fontSize: "0.78rem" }}>{hint}</div>
              </div>
            ))}
          </div>

          <div className="grid">
            <aside style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <section className="card" style={{ padding: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: "0.76rem", color: "var(--soft)", textTransform: "uppercase", marginBottom: 8 }}>Datasets</div>
                    <h2 style={{ margin: 0, fontSize: "1.02rem" }}>Upload and select data</h2>
                  </div>
                  <button type="button" className="btn sub" style={{ width: 38, height: 38, display: "grid", placeItems: "center", color: "var(--muted)" }} onClick={() => loadDatasets(true)}><RefreshCw size={15} /></button>
                </div>
                <button type="button" className="btn" style={{ width: "100%", padding: "13px 14px", background: "linear-gradient(135deg,var(--accent),#7c3aed)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12, opacity: uploading ? 0.72 : 1 }} onClick={() => inputRef.current?.click()} disabled={uploading}><Upload size={16} />{uploading ? "Uploading..." : "Upload CSV or Excel"}</button>
                <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }} onChange={(event) => uploadFile(event.target.files?.[0])} />
                <div style={{ display: "grid", gap: 10, maxHeight: 360, overflowY: "auto" }}>
                  {datasets.length === 0 && !loadingSets && <div className="sub" style={{ padding: 14, color: "var(--muted)", fontSize: "0.82rem", lineHeight: 1.6 }}>No dataset uploaded yet.</div>}
                  {datasets.map((dataset) => {
                    const active = dataset.dataset_id === selectedId;
                    const name = dataset.original_filename || dataset.filename || dataset.name || "Dataset";
                    return (
                      <button key={dataset.dataset_id} type="button" className="btn sub" style={{ padding: 14, textAlign: "left", borderColor: active ? "rgba(91,106,249,0.42)" : "var(--border)", background: active ? "rgba(91,106,249,0.08)" : "var(--panel2)" }} onClick={() => setSelectedId(dataset.dataset_id)}>
                        <div style={{ display: "flex", gap: 10 }}>
                          <div style={{ width: 38, height: 38, borderRadius: 12, display: "grid", placeItems: "center", background: active ? "rgba(91,106,249,0.14)" : "rgba(255,255,255,0.04)", color: active ? "var(--accent)" : "var(--muted)", flexShrink: 0 }}><FileSpreadsheet size={16} /></div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: "0.84rem", fontWeight: 600, lineHeight: 1.4 }}>{name}</div>
                            <div style={{ marginTop: 4, fontSize: "0.74rem", color: "var(--muted)" }}>{Number(dataset.row_count || 0).toLocaleString()} rows</div>
                            <div style={{ marginTop: 4, fontSize: "0.7rem", color: "var(--soft)" }}>updated {relativeTime(dataset.last_queried || dataset.uploaded_at)}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="card" style={{ padding: 18 }}>
                <div style={{ fontSize: "0.76rem", color: "var(--soft)", textTransform: "uppercase", marginBottom: 8 }}>Dashboard Brief</div>
                <h2 style={{ margin: "0 0 10px", fontSize: "1.02rem" }}>Guide the generated dashboard</h2>
                <p style={{ margin: "0 0 12px", color: "var(--muted)", fontSize: "0.82rem", lineHeight: 1.65 }}>Tell the system what to emphasize so each dataset gets a different dashboard shape.</p>
                <textarea className="input" rows={5} style={{ padding: 12, resize: "vertical", minHeight: 120 }} placeholder="Example: Build an executive dashboard focused on monthly trends, regional performance, and the top categories driving revenue." value={requirements} onChange={(event) => setRequirements(event.target.value)} />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                  {dynamicBriefs.map((brief) => <button key={brief} type="button" className="btn sub" style={{ padding: "8px 10px", color: "var(--muted)", fontSize: "0.74rem" }} onClick={() => setRequirements(brief)}>{brief}</button>)}
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                  <button type="button" className="btn" style={{ padding: "12px 14px", background: "var(--text)", color: "var(--bg)", display: "inline-flex", alignItems: "center", gap: 8, opacity: !selectedId || loadingDash ? 0.72 : 1 }} onClick={() => generateDashboard(selectedId, requirements)} disabled={!selectedId || loadingDash}><Sparkles size={16} />{loadingDash ? "Generating..." : "Generate"}</button>
                  <button type="button" className="btn sub" style={{ padding: "12px 14px", color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 8 }} onClick={() => generateDashboard(selectedId, requirements)} disabled={!selectedId || loadingDash}><RefreshCw size={16} />Refresh</button>
                </div>
                {!!selected?.profile?.recommended_questions?.length && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--soft)", textTransform: "uppercase", marginBottom: 8 }}>Suggested Business Questions</div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {selected.profile.recommended_questions.slice(0, 4).map((question) => (
                        <div key={question} className="sub" style={{ padding: "10px 12px", color: "var(--muted)", fontSize: "0.76rem", lineHeight: 1.5 }}>
                          {question}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </aside>

            <main style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
              <section className="card" style={{ padding: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: "0.76rem", color: "var(--soft)", textTransform: "uppercase", marginBottom: 8 }}>Current Dataset</div>
                    <h1 style={{ margin: 0, fontFamily: "'DM Serif Display', serif", fontSize: "clamp(1.7rem,4vw,2.5rem)", lineHeight: 1.05 }}>{datasetName}</h1>
                    <p style={{ margin: "10px 0 0", color: "var(--muted)", fontSize: "0.86rem", lineHeight: 1.7, maxWidth: 760 }}>
                      {selected?.profile?.summary || (selected ? `This dashboard is generated live from ${Number(selected.row_count || 0).toLocaleString()} rows and ${(selected.column_count || selected.columns?.length || 0).toLocaleString()} columns.` : "Upload a dataset to build a live dashboard.")}
                    </p>
                  </div>
                  <div className="sub" style={{ padding: 14, minWidth: 230 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)", fontSize: "0.74rem", marginBottom: 8 }}><Database size={14} />Schema Snapshot</div>
                    <div style={{ fontSize: "0.8rem", lineHeight: 1.75 }}>
                      <div><strong>{Number(selected?.row_count || 0).toLocaleString()}</strong> rows</div>
                      <div><strong>{(selected?.column_count || selected?.columns?.length || 0).toLocaleString()}</strong> columns</div>
                      <div><strong>{(selected?.numeric_columns?.length || 0).toLocaleString()}</strong> numeric fields</div>
                      <div><strong>{(selected?.categorical_columns?.length || 0).toLocaleString()}</strong> categorical fields</div>
                    </div>
                  </div>
                </div>
                {!!selected?.columns?.length && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                    {selected.columns.slice(0, 14).map((column) => <span key={column.code || column.name || column} className="sub" style={{ padding: "7px 10px", fontSize: "0.73rem", color: "var(--muted)" }}>{column.name || column}</span>)}
                  </div>
                )}
                {!!selected?.cleaning_report?.dropped_column_count && (
                  <div style={{ marginTop: 12, color: "var(--muted)", fontSize: "0.76rem", lineHeight: 1.6 }}>
                    Upload cleanup removed {selected.cleaning_report.dropped_column_count} noisy or empty columns before profiling the dataset.
                  </div>
                )}
              </section>

              <section className="card" style={{ padding: 18, minHeight: 320 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: "0.76rem", color: "var(--soft)", textTransform: "uppercase", marginBottom: 8 }}>Generated Dashboard</div>
                    <h2 style={{ margin: 0, fontSize: "1.04rem" }}>{requirements.trim() ? "Requirement-aware dashboard" : "Automatic dataset overview"}</h2>
                  </div>
                  <div style={{ color: "var(--muted)", fontSize: "0.78rem" }}>{dashboard.generatedAt ? `updated ${relativeTime(dashboard.generatedAt)}` : "not generated yet"}</div>
                </div>

                {loadingDash && (
                  <div className="charts">
                    {[0, 1, 2, 3].map((key) => <div key={key} className="sub" style={{ height: 310, opacity: 0.65 }} />)}
                  </div>
                )}

                {!loadingDash && charts.length === 0 && (
                  <div className="sub" style={{ minHeight: 240, display: "grid", placeItems: "center", textAlign: "center", padding: 20 }}>
                    <div>
                      <BarChart2 size={28} color="var(--accent)" style={{ marginBottom: 10 }} />
                      <div style={{ fontSize: "1rem", fontWeight: 600 }}>No dynamic charts yet</div>
                      <div style={{ marginTop: 8, color: "var(--muted)", fontSize: "0.83rem", lineHeight: 1.7, maxWidth: 540 }}>
                        Upload a dataset or regenerate with a clearer brief so the backend can create and execute live chart specs.
                      </div>
                    </div>
                  </div>
                )}

                {!loadingDash && charts.length > 0 && (
                  <div className="charts">
                    {charts.map((chart, index) => <ChartCard key={`${chart.title}-${index}`} chart={chart} id={`chart-${index}`} />)}
                  </div>
                )}
              </section>
            </main>
          </div>
        </div>
      </div>
    </>
  );
}
