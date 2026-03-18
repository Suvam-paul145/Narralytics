import { useState, useEffect, useRef, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import ReactECharts from "echarts-for-react";
import { useAuth } from "../context/AuthContext";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ── Helpers ────────────────────────────────────────────────────────────────

function getAuthHeaders() {
  const token = localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function buildEChartsOption(spec, data) {
  if (!data || data.length === 0) return null;

  const { chart_type, x_key, y_key, color_by, title } = spec;
  const xData = [...new Set(data.map((row) => String(row[x_key] ?? "")))];
  const yData = data.map((row) => Number(row[y_key] ?? 0));
  const hasColorBy = Boolean(color_by && data.some((row) => row[color_by] !== undefined && row[color_by] !== null));

  const COLORS = ["#6366f1", "#a78bfa", "#f59e0b", "#34d399", "#f472b6", "#60a5fa", "#22d3ee", "#f97316"];

  const buildSeriesByColor = (seriesType, stacked = false) => {
    const colorValues = [...new Set(data.map((row) => String(row[color_by] ?? "Unknown")))];
    return colorValues.map((colorValue, idx) => {
      const valueMap = new Map();
      xData.forEach((x) => valueMap.set(x, 0));

      data.forEach((row) => {
        const xVal = String(row[x_key] ?? "");
        const cVal = String(row[color_by] ?? "Unknown");
        if (cVal === colorValue) {
          valueMap.set(xVal, Number(valueMap.get(xVal) || 0) + Number(row[y_key] ?? 0));
        }
      });

      const baseSeries = {
        type: seriesType,
        name: colorValue,
        data: xData.map((x) => Number(valueMap.get(x) || 0)),
        itemStyle: { color: COLORS[idx % COLORS.length] },
      };

      if (seriesType === "line") {
        return {
          ...baseSeries,
          smooth: true,
          lineStyle: { color: COLORS[idx % COLORS.length], width: 2 },
          areaStyle: chart_type === "area" ? { opacity: 0.2 } : undefined,
          stack: stacked ? "total" : undefined,
        };
      }

      return {
        ...baseSeries,
        stack: stacked ? "total" : undefined,
        emphasis: { itemStyle: { color: COLORS[idx % COLORS.length] } },
        itemStyle: {
          color: COLORS[idx % COLORS.length],
          borderRadius: [4, 4, 0, 0],
        },
      };
    });
  };

  const BASE = {
    backgroundColor: "transparent",
    title: {
      text: title,
      left: "center",
      textStyle: { color: "#e8e8f0", fontSize: 13, fontWeight: 500 },
    },
    tooltip: { 
      trigger: chart_type === "pie" ? "item" : "axis", 
      backgroundColor: "#1a1a3e", 
      borderColor: "#6366f1", 
      textStyle: { color: "#e8e8f0" },
      confine: true
    },
    grid: { left: "3%", right: "4%", bottom: data.length > 20 ? "15%" : "10%", containLabel: true },
    toolbox: {
      feature: {
        saveAsImage: { show: true, title: "Save", iconStyle: { borderColor: "#6366f1" } },
        dataZoom: { show: data.length > 50, title: { zoom: "Zoom", back: "Reset" } }
      },
      right: 10
    },
    dataZoom: data.length > 50 ? [
      { type: "inside", start: 0, end: 100 },
      { type: "slider", start: 0, end: 100, bottom: 0, textStyle: { color: "#aaa" }, borderColor: "rgba(255,255,255,0.05)" }
    ] : [],
  };

  if (chart_type === "bar") {
    return {
      ...BASE,
      legend: hasColorBy ? { top: 26, textStyle: { color: "#aaa" } } : undefined,
      xAxis: { type: "category", data: xData, axisLabel: { color: "#aaa", rotate: xData.length > 6 ? 30 : 0 }, axisLine: { lineStyle: { color: "#333" } } },
      yAxis: { type: "value", axisLabel: { color: "#aaa" }, splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } } },
      series: hasColorBy
        ? buildSeriesByColor("bar", true)
        : [{ type: "bar", name: y_key, data: yData, itemStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "#6366f1" }, { offset: 1, color: "#a78bfa" }] }, borderRadius: [4, 4, 0, 0] }, emphasis: { itemStyle: { color: "#818cf8" } } }],
    };
  }

  if (chart_type === "line" || chart_type === "area") {
    return {
      ...BASE,
      legend: hasColorBy ? { top: 26, textStyle: { color: "#aaa" } } : undefined,
      xAxis: { type: "category", data: xData, axisLabel: { color: "#aaa" }, axisLine: { lineStyle: { color: "#333" } } },
      yAxis: { type: "value", axisLabel: { color: "#aaa" }, splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } } },
      series: hasColorBy
        ? buildSeriesByColor("line", chart_type === "area")
        : [{ type: "line", name: y_key, data: yData, smooth: true, lineStyle: { color: "#6366f1", width: 2 }, itemStyle: { color: "#6366f1" }, areaStyle: chart_type === "area" ? { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(99,102,241,0.35)" }, { offset: 1, color: "rgba(99,102,241,0.01)" }] } } : undefined }],
    };
  }

  if (chart_type === "pie") {
    const pieData = data.map((row) => ({ name: String(row[x_key] ?? ""), value: Number(row[y_key] ?? 0) }));
    return {
      ...BASE,
      legend: { orient: "vertical", right: "2%", top: "center", textStyle: { color: "#aaa" }, type: "scroll" },
      series: [{ type: "pie", name: y_key, radius: ["40%", "70%"], center: ["40%", "55%"], data: pieData.map((d, i) => ({ ...d, itemStyle: { color: COLORS[i % COLORS.length] } })), emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: "rgba(99,102,241,0.5)" } }, label: { color: "#e8e8f0" } }],
    };
  }

  if (chart_type === "scatter") {
    const scatterData = data.map((row) => [Number(row[x_key] ?? 0), Number(row[y_key] ?? 0)]);
    return {
      ...BASE,
      xAxis: { type: "value", name: x_key, axisLabel: { color: "#aaa" }, splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } } },
      yAxis: { type: "value", name: y_key, axisLabel: { color: "#aaa" }, splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } } },
      series: [{ type: "scatter", name: y_key, data: scatterData, itemStyle: { color: "rgba(99,102,241,0.7)", borderColor: "#6366f1" }, symbolSize: 8 }],
    };
  }

  return null;
}

/**
 * Handle Stage 8: Exporting Report
 * Collects all charts from current messages and sends to backend for PDF generation
 */
async function exportReport(dataset_id, messages) {
  const charts = [];
  messages.forEach(msg => {
    if (msg.charts) {
      msg.charts.forEach(chart => {
        charts.push({
          title: chart.spec.title,
          insight: chart.spec.insight,
          chart_type: chart.spec.chart_type,
          // Send spec and data for server-side rendering
          spec: chart.spec,
          data: chart.data
        });
      });
    }
  });

  if (charts.length === 0) {
    alert("No charts generated yet. Generate some charts before exporting a report.");
    return;
  }

  try {
    const token = localStorage.getItem("authToken");
    const response = await fetch(`${API_BASE}/report/generate`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ dataset_id, charts, include_stats: true })
    });

    if (!response.ok) throw new Error("Failed to generate report");

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Narralytics_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Report Export Error:", err);
    alert(`Could not export report: ${err.message}`);
  }
}

// ── Animated background canvas ─────────────────────────────────────────────
const AnimatedNetwork = memo(function AnimatedNetwork() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const nodes = Array.from({ length: 45 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 2 + 1.2,
    }));
    let raf;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      nodes.forEach((n) => {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
      });
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) { ctx.beginPath(); ctx.strokeStyle = `rgba(99,102,241,${0.15 * (1 - dist / 120)})`; ctx.lineWidth = 0.7; ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); ctx.stroke(); }
        }
      }
      nodes.forEach((n) => { ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fillStyle = "rgba(99,102,241,0.55)"; ctx.fill(); });
      raf = requestAnimationFrame(draw);
    }
    draw();
    const ro = new ResizeObserver(() => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; });
    ro.observe(canvas);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);
  return <canvas ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }} />;
});

// ── Chart block rendered inside a message bubble ───────────────────────────
function ChartBlock({ spec, data }) {
  const option = buildEChartsOption(spec, data);
  if (!option) return (
    <div style={{ padding: "12px", background: "rgba(255,90,90,0.08)", border: "1px solid rgba(255,90,90,0.2)", borderRadius: "10px", fontSize: "0.82rem", color: "#f87171", marginTop: "10px" }}>
      ⚠ Chart data was empty or could not be rendered.
    </div>
  );
  return (
    <div style={{ marginTop: "12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(99,102,241,0.18)", borderRadius: "14px", overflow: "hidden", padding: "12px" }}>
      <ReactECharts option={option} style={{ height: 280, width: "100%" }} opts={{ renderer: "canvas" }} />
    </div>
  );
}

// ── Single message bubble ─────────────────────────────────────────────────
function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", flexDirection: isUser ? "row-reverse" : "row", gap: "10px", marginBottom: "16px", alignItems: "flex-start" }}>
      <div style={{ width: 30, height: 30, borderRadius: "50%", background: isUser ? "linear-gradient(135deg,#6366f1,#a78bfa)" : "linear-gradient(135deg,#34d399,#059669)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700, color: "#fff" }}>
        {isUser ? "U" : "AI"}
      </div>

      <div style={{ maxWidth: "82%", display: "flex", flexDirection: "column", gap: "6px" }}>
        {/* Text */}
        {msg.content && (
          <div style={{ background: isUser ? "linear-gradient(135deg,rgba(99,102,241,0.18),rgba(167,139,250,0.1))" : "rgba(255,255,255,0.05)", border: isUser ? "1px solid rgba(99,102,241,0.3)" : "1px solid rgba(255,255,255,0.08)", borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px", padding: "12px 16px", fontSize: "0.9rem", color: "#e8e8f0", lineHeight: 1.6 }}>
            {msg.content}
          </div>
        )}

        {/* Error / cannot_answer alert */}
        {msg.alert && (
          <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "10px", padding: "10px 14px", fontSize: "0.82rem", color: "#fbbf24", display: "flex", gap: "8px", alignItems: "flex-start" }}>
            <span>⚠</span><span>{msg.alert}</span>
          </div>
        )}

        {/* Charts */}
        {msg.charts && msg.charts.map((chart, i) => (
          <div key={i}>
            <ChartBlock spec={chart.spec} data={chart.data} />
            {chart.spec?.insight && (
              <div style={{ marginTop: "8px", padding: "8px 12px", background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.18)", borderRadius: "8px", fontSize: "0.8rem", color: "#6ee7b7", lineHeight: 1.5 }}>
                💡 {chart.spec.insight}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Dataset chip (shown after successful upload) ───────────────────────────
function DatasetChip({ dataset, onClear }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.25)", borderRadius: "100px", fontSize: "0.78rem", color: "#6ee7b7" }}>
      <span>📊</span>
      <span style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dataset.filename}</span>
      <span style={{ opacity: 0.6 }}>· {dataset.row_count?.toLocaleString()} rows</span>
      <button onClick={onClear} style={{ background: "none", border: "none", color: "#6ee7b7", cursor: "pointer", padding: "0 2px", lineHeight: 1, fontSize: "0.9rem", opacity: 0.6 }} title="Remove dataset">×</button>
    </div>
  );
}

// ── Upload progress pill ───────────────────────────────────────────────────
function UploadProgress({ filename, progress }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: "100px", fontSize: "0.78rem", color: "#a78bfa" }}>
      <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
      <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Uploading {filename}…</span>
      {progress > 0 && <span style={{ opacity: 0.7 }}>{progress}%</span>}
    </div>
  );
}

// ── Main Chat component ───────────────────────────────────────────────────
export default function Chat() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Dataset state
  const [dataset, setDataset] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadFilename, setUploadFilename] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");

  // Chat state
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [isExporting, setIsExporting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [greeting, setGreeting] = useState("Good morning");
  const textareaRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    const h = new Date().getHours();
    if (h >= 12 && h < 17) setGreeting("Good afternoon");
    else if (h >= 17) setGreeting("Good evening");
  }, []);

  // ── Handle File Upload ───────────────────────────────────────────────────
  const handleFileUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadFilename(file.name);
    setUploadProgress(10);
    setUploadError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(`${API_BASE}/datasets/upload`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Upload failed");
      }

      setUploadProgress(100);
      const data = await response.json();
      setDataset(data);
      
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: "assistant",
        content: `Successfully loaded "${file.name}" (${data.row_count.toLocaleString()} rows). What would you like to analyze?`
      }]);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  // ── Report Export ────────────────────────────────────────────────────────
  const handleExportReport = async () => {
    if (!dataset) return;
    const charts = [];
    messages.forEach(msg => {
      if (msg.charts) {
        msg.charts.forEach(chart => {
          charts.push({
            title: chart.spec.title,
            insight: chart.spec.insight,
            chart_type: chart.spec.chart_type,
            // Send spec and data for server-side rendering
            spec: chart.spec,
            data: chart.data
          });
        });
      }
    });

    if (charts.length === 0) {
      setMessages(prev => [...prev, { id: Date.now(), role: "assistant", alert: "No charts to export. Ask me to generate some charts first!" }]);
      return;
    }

    setIsExporting(true);
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(`${API_BASE}/report/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ dataset_id: dataset.dataset_id, charts, include_stats: true })
      });

      if (!response.ok) throw new Error("Failed to generate report");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Narralytics_Report_${dataset.filename.split('.')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setMessages(prev => [...prev, { id: Date.now(), role: "assistant", alert: `Export failed: ${err.message}` }]);
    } finally {
      setIsExporting(false);
    }
  };

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


  // ── Send Query ───────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (promptOverride) => {
    const text = (promptOverride || query).trim();
    if (!text || isLoading) return;

    if (!dataset) {
      setMessages((prev) => [...prev, {
        id: Date.now(), role: "assistant",
        alert: "Please upload a CSV or Excel file first. Use the 📎 button.",
      }]);
      return;
    }

    // --- Stage 7: Iterative Editing Detection ---
    const lowerText = text.toLowerCase();
    const isEditCommand = lowerText.includes("change to") || lowerText.includes("make it a") || lowerText.includes("switch to");
    const chartTypes = ["line", "bar", "pie", "scatter", "area"];
    const targetType = chartTypes.find(t => lowerText.includes(t));

    if (isEditCommand && targetType) {
      // Find the last assistant message with a chart
      const lastAiMsgIdx = [...messages].reverse().findIndex(m => m.role === "assistant" && m.charts?.length > 0);
      if (lastAiMsgIdx !== -1) {
        const realIdx = messages.length - 1 - lastAiMsgIdx;
        const newMessages = [...messages];
        const updatedMsg = { ...newMessages[realIdx] };
        updatedMsg.charts = updatedMsg.charts.map(c => ({
          ...c,
          spec: { ...c.spec, chart_type: targetType, title: `${targetType.charAt(0).toUpperCase() + targetType.slice(1)} Chart: ${c.spec.title.split(':').pop().trim()}` }
        }));
        setMessages([...newMessages, { id: Date.now(), role: "user", content: text }, updatedMsg]);
        setQuery("");
        return;
      }
    }

    const userMsg = { id: Date.now(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setQuery("");
    setIsLoading(true);

    const history = messages
      .filter((m) => m.role === "user" || (m.role === "assistant" && m.content))
      .slice(-10)
      .map((m) => ({ role: m.role === "assistant" ? "model" : "user", content: m.content || "" }));

    try {
      const token = localStorage.getItem("authToken");
      const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };

      const [chatRes, queryRes] = await Promise.allSettled([
        fetch(`${API_BASE}/chat`, {
          method: "POST", headers,
          body: JSON.stringify({ message: text, dataset_id: dataset.dataset_id, history, session_id: sessionId }),
        }).then((r) => r.json()),
        fetch(`${API_BASE}/query`, {
          method: "POST", headers,
          body: JSON.stringify({ prompt: text, dataset_id: dataset.dataset_id, output_count: 1, history, session_id: sessionId }),
        }).then((r) => r.json()),
      ]);

      const chatData = chatRes.status === "fulfilled" ? chatRes.value : null;
      const queryData = queryRes.status === "fulfilled" ? queryRes.value : null;

      const aiMsg = { id: Date.now() + 1, role: "assistant" };

      if (chatData?.cannot_answer) {
        aiMsg.alert = `Insufficient data: "${chatData.reason || "The dataset doesn't seem to contain the required information."}"`;
      } else if (chatData?.answer) {
        aiMsg.content = chatData.answer;
      }

      if (chatData?.charts?.length) {
        aiMsg.charts = chatData.charts.filter((o) => o.data?.length > 0);
      }

      if (queryData && !queryData.cannot_answer && queryData.options?.length) {
        const queryCharts = queryData.options.filter((o) => o.data?.length > 0);
        aiMsg.charts = [...(aiMsg.charts || []), ...queryCharts];
      }

      if (queryData?.cannot_answer && !aiMsg.content && !aiMsg.alert) {
        aiMsg.alert = queryData.reason || "Could not generate a chart for this query.";
      }

      if (!aiMsg.content && !aiMsg.charts && !aiMsg.alert) {
        aiMsg.content = "I processed your request but found no specific insights or charts to display.";
      }

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 2, role: "assistant", alert: `Error: ${err.message}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [query, dataset, messages, sessionId, isLoading]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const SUGGESTIONS = [
    { icon: "📊", label: "Monthly revenue by region" },
    { icon: "📈", label: "Top categories by sales" },
    { icon: "🏆", label: "Top 10 products by profit" },
    { icon: "🔍", label: "Show data distribution" },
  ];

  const hasMessages = messages.length > 0;
  const hasCharts = messages.some(m => m.charts?.length > 0);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --bg: #07071a; --bg2: #0d0d2b; --surface: rgba(255,255,255,0.04);
          --surface-hover: rgba(255,255,255,0.07); --border: rgba(255,255,255,0.08);
          --border-focus: rgba(99,102,241,0.6); --accent: #6366f1; --accent2: #a78bfa;
          --gold: #f59e0b; --teal: #34d399; --pink: #f472b6; --text: #e8e8f0;
          --muted: rgba(232,232,240,0.5); --font-body: 'DM Sans', sans-serif;
          --font-display: 'Instrument Serif', Georgia, serif;
          --font-mono: 'JetBrains Mono', monospace;
        }
        body { background: var(--bg); color: var(--text); font-family: var(--font-body); }
        .chat-layout { display:flex; height:100vh; width:100vw; overflow:hidden; background:var(--bg); position:relative; }
        .chat-sidebar { width:260px; min-width:260px; background:rgba(7,7,26,0.5); backdrop-filter:blur(24px); border-right:1px solid var(--border); display:flex; flex-direction:column; padding:16px 14px; z-index:10; transition:transform 0.3s ease, margin-left 0.3s ease; }
        .chat-sidebar.closed { transform:translateX(-100%); margin-left:-260px; }
        .chat-sidebar-btn { display:flex; align-items:center; gap:8px; padding:9px 12px; border-radius:9px; cursor:pointer; font-size:0.85rem; background:var(--surface); border:1px solid var(--border); color:var(--text); transition:all 0.2s; text-align:left; width:100%; margin-bottom: 8px; }
        .chat-sidebar-btn:hover { background:var(--surface-hover); border-color:rgba(99,102,241,0.35); }
        .chat-sidebar-btn.primary { background: var(--accent); border-color: var(--accent); box-shadow: 0 4px 12px rgba(99,102,241,0.2); }
        .chat-sidebar-btn.primary:hover { background: #4f52e8; }
        .chat-sidebar-btn.icon-only { padding:8px; width:auto; background:transparent; border-color:transparent; color:var(--muted); margin-bottom: 0; }
        .chat-sidebar-btn.icon-only:hover { color:var(--text); background:var(--surface); border-color:var(--border); }
        .chat-toggle-float { position:absolute; top:18px; left:18px; z-index:20; background:var(--surface); border:1px solid var(--border); color:var(--text); cursor:pointer; padding:8px; border-radius:10px; display:flex; align-items:center; justify-content:center; opacity:0; pointer-events:none; transition:all 0.3s; }
        .chat-toggle-float.visible { opacity:1; pointer-events:auto; }
        .chat-toggle-float:hover { background:var(--surface-hover); border-color:rgba(99,102,241,0.3); }
        .chat-main { flex:1; display:flex; flex-direction:column; position:relative; overflow:hidden; }
        .chat-messages { flex:1; overflow-y:auto; padding:24px 24px 8px; display:flex; flex-direction:column; position:relative; z-index:1; scroll-behavior:smooth; }
        .chat-messages::-webkit-scrollbar { width:4px; }
        .chat-messages::-webkit-scrollbar-thumb { background:rgba(99,102,241,0.3); border-radius:4px; }
        .chat-empty { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 24px; position:relative; z-index:1; }
        .chat-greeting { font-family:var(--font-display); font-size:clamp(2rem,4.5vw,3.2rem); font-weight:400; text-align:center; line-height:1.15; letter-spacing:-0.02em; color:var(--text); opacity:0; transform:translateY(20px); transition:opacity 0.7s ease, transform 0.7s ease; }
        .chat-greeting.show { opacity:1; transform:translateY(0); }
        .chat-subtitle { font-size:clamp(0.9rem,1.8vw,1rem); color:var(--muted); text-align:center; font-weight:300; opacity:0; transform:translateY(16px); transition:opacity 0.7s ease 0.12s, transform 0.7s ease 0.12s; margin-bottom:2.2rem; max-width:420px; line-height:1.6; }
        .chat-subtitle.show { opacity:1; transform:translateY(0); }
        .chat-bottom { position:relative; z-index:10; padding:0 16px 16px; display:flex; flex-direction:column; gap:8px; }
        .chat-upload-error { background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.25); border-radius:10px; padding:8px 14px; font-size:0.8rem; color:#f87171; display:flex; justify-content:space-between; align-items:center; }
        .chat-meta-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .chat-input-box { background:var(--surface); border:1.5px solid var(--border); border-radius:18px; display:flex; flex-direction:column; transition:border-color 0.25s, box-shadow 0.25s; }
        .chat-input-box.focused { border-color:var(--border-focus); box-shadow:0 0 0 3px rgba(99,102,241,0.1), 0 8px 40px rgba(0,0,0,0.35); }
        .chat-textarea { background:transparent; border:none; outline:none; color:var(--text); font-family:var(--font-body); font-size:0.96rem; line-height:1.6; padding:14px 18px 10px; resize:none; width:100%; min-height:52px; max-height:200px; caret-color:var(--accent2); }
        .chat-textarea::placeholder { color:rgba(232,232,240,0.28); }
        .chat-input-footer { display:flex; align-items:center; justify-content:space-between; padding:6px 10px 8px 14px; border-top:1px solid rgba(255,255,255,0.04); }
        .chat-input-left { display:flex; align-items:center; gap:8px; }
        .chat-badge { font-family:var(--font-mono); font-size:0.66rem; color:var(--muted); background:rgba(255,255,255,0.05); border:1px solid var(--border); padding:3px 8px; border-radius:6px; }
        .chat-badge.active { color:var(--teal); border-color:rgba(52,211,153,0.2); background:rgba(52,211,153,0.06); }
        .chat-upload-icon { display:flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:8px; background:rgba(255,255,255,0.05); border:1px solid var(--border); color:var(--muted); cursor:pointer; transition:all 0.2s; }
        .chat-upload-icon:hover { background:var(--surface-hover); border-color:rgba(99,102,241,0.35); color:var(--text); transform:translateY(-1px); }
        .chat-upload-icon.uploading { border-color:rgba(99,102,241,0.4); color:var(--accent2); animation:pulse-border 1.5s infinite; }
        @keyframes pulse-border { 0%,100%{box-shadow:0 0 0 0 rgba(99,102,241,0)} 50%{box-shadow:0 0 0 3px rgba(99,102,241,0.2)} }
        .chat-send-btn { width:36px; height:36px; background:var(--accent); border:none; border-radius:11px; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all 0.2s; box-shadow:0 0 14px rgba(99,102,241,0.3); }
        .chat-send-btn:hover { background:#4f52e8; transform:scale(1.06); box-shadow:0 0 22px rgba(99,102,241,0.5); }
        .chat-send-btn:disabled { opacity:0.35; cursor:not-allowed; transform:none; }
        .chat-send-btn svg { width:15px; height:15px; fill:#fff; }
        .chat-chips { display:flex; flex-wrap:wrap; gap:7px; justify-content:center; }
        .chat-chip { background:var(--surface); border:1px solid var(--border); border-radius:100px; padding:7px 14px; font-size:0.8rem; color:var(--muted); cursor:pointer; display:flex; align-items:center; gap:6px; transition:all 0.2s; white-space:nowrap; }
        .chat-chip:hover { background:var(--surface-hover); border-color:rgba(99,102,241,0.35); color:var(--text); transform:translateY(-2px); box-shadow:0 4px 16px rgba(99,102,241,0.12); }
        .chat-loading-dots { display:flex; gap:5px; padding:12px 16px; }
        .chat-loading-dots span { width:7px; height:7px; border-radius:50%; background:var(--accent2); animation:bounce-dot 1.2s infinite ease-in-out; }
        .chat-loading-dots span:nth-child(2) { animation-delay:0.2s; }
        .chat-loading-dots span:nth-child(3) { animation-delay:0.4s; }
        @keyframes bounce-dot { 0%,80%,100%{transform:translateY(0);opacity:0.4} 40%{transform:translateY(-8px);opacity:1} }
        @keyframes spin { to { transform:rotate(360deg); } }
        @media(max-width:768px) { .chat-sidebar { position:absolute; height:100%; box-shadow:4px 0 20px rgba(0,0,0,0.5); } .chat-sidebar.closed { margin-left:0; } .chat-toggle-float { display:flex; opacity:1; pointer-events:auto; } }
      `}</style>

      <div className="chat-layout">
        <AnimatedNetwork />

        {/* ── Sidebar ── */}
        <button className={`chat-toggle-float ${!isSidebarOpen ? "visible" : ""}`} onClick={() => setIsSidebarOpen(true)} title="Open sidebar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" /></svg>
        </button>

        <aside className={`chat-sidebar ${isSidebarOpen ? "" : "closed"}`}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <button className="chat-sidebar-btn" onClick={() => navigate("/dashboard")} style={{ justifyContent: "center", flex: 1, marginRight: 8, marginBottom: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
              Dashboard
            </button>
            <button className="chat-sidebar-btn icon-only" onClick={() => setIsSidebarOpen(false)} title="Collapse">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" /></svg>
            </button>
          </div>

          <button className="chat-sidebar-btn" onClick={() => { setMessages([]); setDataset(null); setQuery(""); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
            New Chat
          </button>

          {hasCharts && (
            <button className="chat-sidebar-btn primary" onClick={handleExportReport} disabled={isExporting}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              {isExporting ? "Generating PDF..." : "Export Report"}
            </button>
          )}

          <div style={{ fontSize: "0.7rem", color: "#666", padding: "0 4px", marginBottom: 8, marginTop: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Dataset</div>

          {dataset && (
            <div style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.15)", borderRadius: 10, padding: "10px 12px", fontSize: "0.8rem" }}>
              <div style={{ color: "#6ee7b7", fontWeight: 600, marginBottom: 4 }}>📊 Active</div>
              <div style={{ color: "#d1fae5", wordBreak: "break-all", fontWeight: 500 }}>{dataset.filename}</div>
              <div style={{ color: "#6ee7b7", opacity: 0.7, marginTop: 4 }}>{dataset.row_count?.toLocaleString()} rows · {dataset.columns?.length} cols</div>
            </div>
          )}

          {!dataset && (
            <div style={{ padding: "12px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: 10, fontSize: "0.8rem", color: "var(--muted)", textAlign: "center" }}>
              No dataset loaded.<br />Upload a CSV to begin.
            </div>
          )}

          <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", padding: "8px 4px" }}>
              {user?.name || "Guest"} · {messages.length} msg
            </div>
          </div>
        </aside>

        {/* ── Main ── */}
        <div className="chat-main">
          {/* Empty state greeting */}
          {!hasMessages && (
            <div className="chat-empty">
              <h1 className={`chat-greeting${mounted ? " show" : ""}`}>{greeting}, analyst.</h1>
              <p className={`chat-subtitle${mounted ? " show" : ""}`}>
                Upload your data to generate executive charts and strategic insights instantly.
              </p>
              <div className="chat-chips">
                {SUGGESTIONS.map((s) => (
                  <button key={s.label} className="chat-chip" onClick={() => { setQuery(s.label); handleSubmit(s.label); }}>
                    <span>{s.icon}</span> {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {hasMessages && (
            <div className="chat-messages">
              {messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)}
              {isLoading && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,#34d399,#059669)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700, color: "#fff" }}>AI</div>
                  <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "18px 18px 18px 4px" }}>
                    <div className="chat-loading-dots"><span /><span /><span /></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* ── Bottom input area ── */}
          <div className="chat-bottom">
            {/* Upload error banner */}
            {uploadError && (
              <div className="chat-upload-error">
                <span>⚠ {uploadError}</span>
                <button onClick={() => setUploadError("")} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", padding: 0, fontSize: "1rem" }}>×</button>
              </div>
            )}

            {/* Dataset chip / upload progress */}
            {(dataset || uploading) && (
              <div className="chat-meta-row" style={{ justifyContent: "space-between", width: "100%" }}>
                <div style={{ display: "flex", gap: "8px" }}>
                  {uploading && <UploadProgress filename={uploadFilename} progress={uploadProgress} />}
                  {dataset && !uploading && <DatasetChip dataset={dataset} onClear={() => { setDataset(null); setMessages([]); }} />}
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

            {/* Input box */}
            <div className={`chat-input-box${textareaRef.current === document.activeElement ? " focused" : ""}`}>
              <textarea
                ref={textareaRef}
                className="chat-textarea"
                placeholder={dataset ? `Query ${dataset.filename}…` : "Upload a dataset first…"}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
              />
              <div className="chat-input-footer">
                <div className="chat-input-left">
                  <span className={`chat-badge ${dataset ? "active" : ""}`}>
                    {dataset ? "● Online" : "○ Offline"}
                  </span>

                  <label className={`chat-upload-icon ${uploading ? "uploading" : ""}`} title="Upload DATA (CSV/Excel)">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      style={{ display: "none" }}
                      onChange={(e) => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); }}
                      disabled={uploading}
                    />
                    {uploading ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
                        <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                      </svg>
                    )}
                  </label>
                </div>

                <button
                  className="chat-send-btn"
                  onClick={() => handleSubmit()}
                  disabled={!query.trim() || isLoading}
                  title="Send"
                >
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
