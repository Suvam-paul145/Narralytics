import React from "react";
import HealthStatus from "../components/common/HealthStatus";
import { useHealthCheck } from "../hooks/useHealthCheck";

const cardStyle = {
  background: "#ffffff",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  padding: 24,
};

const rowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const SystemStatus = () => {
  const { healthStatus, isChecking, checkHealth } = useHealthCheck(10000);

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", padding: "32px 16px" }}>
      <div style={{ maxWidth: 1024, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: "2rem", margin: 0, color: "#111827" }}>System Status</h1>
          <p style={{ marginTop: 8, color: "#4b5563" }}>
            Monitor the health and connectivity of all system components
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 16,
            alignItems: "start",
          }}
        >
          <div style={{ ...cardStyle, gridColumn: "1 / -1" }}>
            <HealthStatus showDetails={true} />
          </div>

          <div style={cardStyle}>
            <h3 style={{ margin: "0 0 16px", fontSize: "1.1rem", color: "#1f2937" }}>Manual Health Check</h3>
            <button
              onClick={checkHealth}
              disabled={isChecking}
              style={{
                width: "100%",
                height: 40,
                borderRadius: 8,
                border: "none",
                background: isChecking ? "#d1d5db" : "#2563eb",
                color: isChecking ? "#6b7280" : "#ffffff",
                fontWeight: 600,
                cursor: isChecking ? "not-allowed" : "pointer",
              }}
            >
              {isChecking ? "Checking..." : "Run Health Check"}
            </button>
          </div>

          <div style={cardStyle}>
            <h3 style={{ margin: "0 0 16px", fontSize: "1.1rem", color: "#1f2937" }}>System Information</h3>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={rowStyle}>
                <span style={{ fontSize: "0.9rem", color: "#4b5563" }}>Frontend Version:</span>
                <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>2.0.0</span>
              </div>
              <div style={rowStyle}>
                <span style={{ fontSize: "0.9rem", color: "#4b5563" }}>API Version:</span>
                <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>2.0.0</span>
              </div>
              <div style={rowStyle}>
                <span style={{ fontSize: "0.9rem", color: "#4b5563" }}>Health Check Interval:</span>
                <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>10 seconds</span>
              </div>
              {healthStatus.timestamp && (
                <div style={rowStyle}>
                  <span style={{ fontSize: "0.9rem", color: "#4b5563" }}>Server Time:</span>
                  <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                    {new Date(healthStatus.timestamp).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ ...cardStyle, marginTop: 16 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: "1.1rem", color: "#1f2937" }}>Connection Details</h3>
          <div style={{ background: "#f3f4f6", borderRadius: 8, padding: 12 }}>
            <pre style={{ margin: 0, fontSize: "0.8rem", color: "#374151", whiteSpace: "pre-wrap" }}>
              {JSON.stringify(healthStatus, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemStatus;
