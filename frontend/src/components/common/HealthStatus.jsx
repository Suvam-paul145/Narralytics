import React from "react";
import { useHealthCheck } from "../../hooks/useHealthCheck";

const normalizeStatus = (status) => {
  const value = String(status || "").toLowerCase();
  if (value === "limited") return "degraded";
  return value || "unknown";
};

const getStatusStyle = (status) => {
  const normalized = normalizeStatus(status);
  if (normalized === "healthy") {
    return { color: "#22c55e", border: "rgba(34,197,94,0.28)", icon: "?" };
  }
  if (normalized === "degraded") {
    return { color: "#f59e0b", border: "rgba(245,158,11,0.28)", icon: "?" };
  }
  if (normalized === "unhealthy" || normalized === "error") {
    return { color: "#ef4444", border: "rgba(239,68,68,0.3)", icon: "?" };
  }
  return { color: "#9ca3af", border: "rgba(156,163,175,0.3)", icon: "?" };
};

const HealthStatus = ({ showDetails = false, className = "" }) => {
  const { healthStatus, isChecking } = useHealthCheck();
  const status = normalizeStatus(healthStatus.status);
  const statusStyle = getStatusStyle(status);

  if (!showDetails) {
    return (
      <div
        className={className}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "rgba(12,12,30,0.92)",
          border: `1px solid ${statusStyle.border}`,
          borderRadius: 999,
          padding: "6px 10px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          color: "#e5e7eb",
          pointerEvents: "auto",
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "0.78rem",
          lineHeight: 1,
        }}
      >
        <span style={{ color: statusStyle.color, fontSize: "0.8rem" }}>{statusStyle.icon}</span>
        <span style={{ color: "#cbd5e1", textTransform: "capitalize" }}>
          {isChecking ? "Checking..." : status}
        </span>
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        padding: 16,
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: "1.06rem", fontWeight: 600, color: "#1f2937" }}>System Status</h3>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: statusStyle.color,
            textTransform: "capitalize",
            fontWeight: 600,
          }}
        >
          <span>{statusStyle.icon}</span>
          <span>{status}</span>
        </div>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "0.86rem", color: "#4b5563" }}>API Server:</span>
          <span style={{ fontSize: "0.86rem", fontWeight: 600, color: getStatusStyle(healthStatus.services.api).color }}>
            {normalizeStatus(healthStatus.services.api)}
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "0.86rem", color: "#4b5563" }}>Database:</span>
          <span style={{ fontSize: "0.86rem", fontWeight: 600, color: getStatusStyle(healthStatus.services.database).color }}>
            {normalizeStatus(healthStatus.services.database)}
          </span>
        </div>

        {healthStatus.lastChecked && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderTop: "1px solid #e5e7eb",
              paddingTop: 8,
            }}
          >
            <span style={{ fontSize: "0.76rem", color: "#6b7280" }}>Last checked:</span>
            <span style={{ fontSize: "0.76rem", color: "#6b7280" }}>
              {new Date(healthStatus.lastChecked).toLocaleTimeString()}
            </span>
          </div>
        )}

        {healthStatus.error && (
          <div
            style={{
              marginTop: 6,
              padding: 8,
              borderRadius: 8,
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.22)",
              color: "#dc2626",
              fontSize: "0.76rem",
            }}
          >
            Error: {healthStatus.error}
          </div>
        )}

        {isChecking && (
          <div style={{ fontSize: "0.76rem", color: "#6b7280", fontStyle: "italic" }}>Checking system status...</div>
        )}
      </div>
    </div>
  );
};

export default HealthStatus;
