import React, { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useDashboard } from "../hooks/useDashboard";
import { useChat } from "../hooks/useChat";
import NavBar from "../components/NavBar";
import ModeToggle from "../components/ModeToggle";
import HistorySidebar from "../components/HistorySidebar";
import ChartSelector from "../components/ChartSelector";
import DashboardCanvas from "../components/DashboardCanvas";
import ChatWindow from "../components/ChatWindow";
import ChatInput from "../components/ChatInput";
import SkeletonLoader from "../components/SkeletonLoader";

export default function Dashboard() {
  const [mode, setMode] = useState("chart");   // "chart" | "chat"
  const { user, logout } = useAuth();
  const chartState = useDashboard();
  const chatState  = useChat();

  const handleSubmit = (text) => {
    if (mode === "chart") chartState.submitQuery(text);
    else                  chatState.sendMessage(text);
  };

  const isLoading = mode === "chart" ? chartState.loading : chatState.loading;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: 'hidden' }}>
      <NavBar user={user} onLogout={logout} />
      
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <HistorySidebar />
        
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: 'linear-gradient(135deg, #020204 0%, #050510 100%)' }}>

          {/* Header Area */}
          <div style={{ 
            padding: "24px 32px", 
            borderBottom: "1px solid var(--border)",
            display: "flex", 
            alignItems: "center", 
            justifyContent: 'space-between',
            background: 'rgba(2, 2, 4, 0.5)',
            backdropFilter: 'blur(20px)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <ModeToggle mode={mode} onChange={setMode} />
              <div style={{ height: 24, width: 1, background: 'var(--border)' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                  {mode === "chart" ? "Interactive Dashboard" : "Strategic Analysis"}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  {mode === "chart"
                    ? "Generate data visualizations from simple questions"
                    : "Narrative insights from your senior business analyst"}
                </span>
              </div>
            </div>
          </div>

          {/* Main Content Viewport */}
          <div style={{ 
            flex: 1, 
            overflow: "hidden", 
            display: "flex", 
            flexDirection: "column",
            position: 'relative'
          }}>
            {mode === "chart" ? (
              <div style={{ 
                flex: 1, 
                overflowY: "auto", 
                padding: "32px",
                scrollbarWidth: 'thin',
                scrollbarColor: 'var(--border) transparent'
              }}>
                {chartState.pending && (
                  <ChartSelector
                    pending={chartState.pending}
                    onSelect={chartState.selectChart}
                    onDismiss={chartState.dismissPending}
                  />
                )}
                
                {chartState.loading && <SkeletonLoader />}
                
                {chartState.error && (
                  <div style={{ 
                    padding: '24px', 
                    background: 'rgba(239, 68, 68, 0.05)', 
                    border: "1px solid rgba(239, 68, 68, 0.2)", 
                    borderRadius: 20, 
                    marginBottom: 32,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}>
                    <p style={{ color: "#f87171", fontWeight: 700, fontSize: 14 }}>⚠️ Visualization Error</p>
                    <p style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.5 }}>
                      {chartState.error}
                    </p>
                  </div>
                )}
                
                <DashboardCanvas 
                  confirmed={chartState.confirmed} 
                  onAskAbout={(item) => chartState.askAboutChart(item, setMode, chatState.sendMessage)} 
                />
              </div>
            ) : (
              <ChatWindow messages={chatState.messages} loading={chatState.loading} />
            )}
            
            {/* Gradient Mask for bottom scroll */}
            <div style={{ 
              position: 'absolute', bottom: 0, left: 0, right: 0, height: 40,
              background: 'linear-gradient(to top, var(--bg-primary), transparent)',
              pointerEvents: 'none', zIndex: 1
            }} />
          </div>

          {/* Fixed Input at Bottom */}
          <div style={{ position: 'relative', zIndex: 2 }}>
            <ChatInput
              onSubmit={handleSubmit}
              loading={isLoading}
              mode={mode}
              placeholder={
                mode === "chart"
                  ? "Ask a data question to generate charts..."
                  : "Ask any business question — 'Why is Asia growing faster?'"
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
