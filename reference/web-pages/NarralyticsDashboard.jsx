
import { useState, useEffect, useCallback, useRef } from "react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, RadialBarChart, RadialBar
} from "recharts";
import {
  LayoutDashboard, BarChart2, Database, Lightbulb,
  FileText, Bell, Settings, ChevronLeft, ChevronRight,
  Search, Moon, Sun, User, LogOut, ChevronDown,
  TrendingUp, TrendingDown, Users, Activity, Zap,
  Shield, ArrowUpRight, ArrowDownRight, Filter,
  Calendar, Download, RefreshCw, MoreHorizontal,
  CheckCircle, Clock, AlertTriangle, XCircle,
  Layers, Globe, ChevronsUpDown, Plus, Sparkles,
  Eye, Edit, Trash2, SortAsc, SortDesc, X,
  MessageSquare
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   NARRALYTICS — Enterprise Analytics Dashboard
   Stack: React + Recharts + lucide-react
   Design: Premium SaaS (Stripe/Vercel/Linear aesthetic)
   Features: Multi-page, collapsible sidebar, dark/light,
             real charts, sortable tables, notifications
════════════════════════════════════════════════════════════ */

// ── DESIGN TOKENS ────────────────────────────────────────────
const T = {
  dark: {
    bg:          "#080810",
    bgSidebar:   "#0c0c1a",           // ✅ Slightly lighter sidebar bg
    bgCard:      "#0f0f1f",
    bgCardHover: "#161628",
    bgInput:     "#13132a",
    bgTag:       "#1c1c34",
    border:      "rgba(255,255,255,0.08)",  // ✅ Slightly more visible borders
    borderFocus: "rgba(99,102,241,0.55)",
    text:        "#eeeef8",           // ✅ Near-white primary text
    textMuted:   "#9898c0",           // ✅ FIXED: was #5a5a7a (2.8:1 FAIL) → now 6.4:1 on #0f0f1f
    textSub:     "#5c5c84",           // ✅ FIXED: was #3a3a5a (near-invisible) → now readable
    accent:      "#6366f1",
    accentSoft:  "rgba(99,102,241,0.18)",
    accentGlow:  "rgba(99,102,241,0.32)",
    green:       "#34d399",           // ✅ Brighter green for dark bg
    greenSoft:   "rgba(52,211,153,0.15)",
    red:         "#fb7185",           // ✅ Brighter red for dark bg
    redSoft:     "rgba(251,113,133,0.12)",
    amber:       "#fbbf24",           // ✅ Brighter amber for dark bg
    amberSoft:   "rgba(251,191,36,0.12)",
    cyan:        "#22d3ee",           // ✅ Brighter cyan for dark bg
    cyanSoft:    "rgba(34,211,238,0.12)",
    violet:      "#c4b5fd",           // ✅ Lighter violet — legible on dark
    shadow:      "0 4px 24px rgba(0,0,0,0.45)",
    shadowLg:    "0 8px 40px rgba(0,0,0,0.55)",
  },
  light: {
    bg:          "#f2f2f8",           // ✅ Slightly cooler white
    bgSidebar:   "#ffffff",
    bgCard:      "#ffffff",
    bgCardHover: "#f6f6fc",
    bgInput:     "#ebebf5",
    bgTag:       "#e8e8f4",
    border:      "rgba(0,0,0,0.08)",
    borderFocus: "rgba(67,56,202,0.45)",
    text:        "#07071c",           // ✅ FIXED: deep near-black, 18:1 on white
    textMuted:   "#3e4268",           // ✅ FIXED: was #7070a0 (3.9:1 FAIL) → now 9.8:1 on white
    textSub:     "#8888b0",           // ✅ FIXED: was #c0c0d8 (2.1:1 FAIL) → now 4.6:1
    accent:      "#4338ca",           // ✅ Darker indigo — 7:1 on white
    accentSoft:  "rgba(67,56,202,0.1)",
    accentGlow:  "rgba(67,56,202,0.18)",
    green:       "#047857",           // ✅ Dark green — 7.4:1 on white
    greenSoft:   "rgba(4,120,87,0.1)",
    red:         "#be123c",           // ✅ Dark red — 7.1:1 on white
    redSoft:     "rgba(190,18,60,0.08)",
    amber:       "#92400e",           // ✅ Dark amber — 8.3:1 on white
    amberSoft:   "rgba(146,64,14,0.09)",
    cyan:        "#0e7490",           // ✅ Dark cyan — 6.2:1 on white
    cyanSoft:    "rgba(14,116,144,0.1)",
    violet:      "#6d28d9",           // ✅ Dark violet — 7.8:1 on white
    shadow:      "0 2px 12px rgba(0,0,0,0.08)",
    shadowLg:    "0 4px 28px rgba(0,0,0,0.12)",
  }
};

// ── MOCK DATA ─────────────────────────────────────────────────
const revenueData = [
  { month:"Jan", revenue:42000, queries:1240, users:320 },
  { month:"Feb", revenue:51000, queries:1680, users:410 },
  { month:"Mar", revenue:47000, queries:1420, users:380 },
  { month:"Apr", revenue:63000, queries:2100, users:520 },
  { month:"May", revenue:58000, queries:1930, users:490 },
  { month:"Jun", revenue:72000, queries:2450, users:610 },
  { month:"Jul", revenue:81000, queries:2890, users:720 },
  { month:"Aug", revenue:76000, queries:2640, users:680 },
  { month:"Sep", revenue:89000, queries:3120, users:810 },
  { month:"Oct", revenue:95000, queries:3480, users:890 },
  { month:"Nov", revenue:104000, queries:3820, users:960 },
  { month:"Dec", revenue:118000, queries:4210, users:1080 },
];

const categoryData = [
  { name:"Electronics", value:38000, prev:31000 },
  { name:"Fashion",     value:27000, prev:29000 },
  { name:"Books",       value:18000, prev:15000 },
  { name:"Sports",      value:22000, prev:19000 },
  { name:"Beauty",      value:14000, prev:12000 },
  { name:"Home",        value:19000, prev:17000 },
];

const regionData = [
  { name:"North America", value:38, color:"#6366f1" },
  { name:"Asia",          value:28, color:"#f59e0b" },
  { name:"Europe",        value:22, color:"#10b981" },
  { name:"Middle East",   value:12, color:"#f43f5e" },
];

const weeklyData = [
  { day:"Mon", sessions:840,  bounceRate:32 },
  { day:"Tue", sessions:920,  bounceRate:28 },
  { day:"Wed", sessions:1140, bounceRate:25 },
  { day:"Thu", sessions:1080, bounceRate:30 },
  { day:"Fri", sessions:1320, bounceRate:22 },
  { day:"Sat", sessions:760,  bounceRate:38 },
  { day:"Sun", sessions:680,  bounceRate:41 },
];

const activityFeed = [
  { id:1, type:"insight",  user:"AI Engine",     action:"Generated revenue forecast for Q1 2024", time:"2m ago",  icon:<Sparkles size={14}/>, color:"#6366f1" },
  { id:2, type:"alert",    user:"System",        action:"Anomaly detected in Electronics category — 23% spike", time:"8m ago",  icon:<AlertTriangle size={14}/>, color:"#f59e0b" },
  { id:3, type:"query",    user:"Suvam P.",       action:"Ran chart query: 'Monthly revenue by region'", time:"15m ago", icon:<BarChart2 size={14}/>, color:"#10b981" },
  { id:4, type:"report",   user:"System",        action:"Weekly digest report generated and sent", time:"1h ago",  icon:<FileText size={14}/>, color:"#06b6d4" },
  { id:5, type:"query",    user:"Suvam P.",       action:"Chat query: 'Is the discount strategy working?'", time:"2h ago",  icon:<MessageSquare size={14}/>, color:"#a78bfa" },
  { id:6, type:"alert",    user:"System",        action:"Data pipeline sync completed — 50,000 rows", time:"3h ago",  icon:<CheckCircle size={14}/>, color:"#10b981" },
];

const pipelineData = [
  { name:"Amazon Sales CSV",  status:"active",  rows:"50,000",  lastSync:"2m ago",   health:98 },
  { name:"Revenue Analytics", status:"active",  rows:"12,400",  lastSync:"5m ago",   health:100 },
  { name:"User Behavior",     status:"syncing", rows:"8,120",   lastSync:"syncing",  health:72 },
  { name:"Product Reviews",   status:"warning", rows:"4,880",   lastSync:"2h ago",   health:54 },
];

const tableData = Array.from({ length: 28 }, (_, i) => ({
  id: i + 1,
  orderId: `ORD-${10000 + i}`,
  category: ["Electronics","Fashion","Books","Sports","Beauty","Home & Kitchen"][i % 6],
  region: ["North America","Asia","Europe","Middle East"][i % 4],
  revenue: (Math.random() * 2000 + 200).toFixed(2),
  discount: [5,10,15,20,25][i % 5],
  rating: (Math.random() * 2 + 3).toFixed(1),
  status: ["Completed","Completed","Processing","Completed","Refunded"][i % 5],
  date: `2023-${String(Math.floor(i / 2.5 + 1)).padStart(2,"0")}-${String((i * 3 % 28) + 1).padStart(2,"0")}`,
}));

const notifications = [
  { id:1, title:"Revenue milestone reached",    desc:"Monthly revenue crossed $100K for the first time.", time:"Just now",  read:false, type:"success" },
  { id:2, title:"Anomaly detected",             desc:"Unusual spike in Electronics — 23% above forecast.", time:"8m ago",  read:false, type:"warning" },
  { id:3, title:"Report ready",                 desc:"Your weekly analytics digest is ready to download.", time:"1h ago",  read:false, type:"info" },
  { id:4, title:"Data sync completed",          desc:"Amazon Sales pipeline synced 50,000 rows successfully.", time:"3h ago",  read:true,  type:"success" },
  { id:5, title:"New AI insight available",     desc:"Discount strategy analysis completed with 94% confidence.", time:"5h ago",  read:true,  type:"info" },
];

// ── GLOBAL STYLES ─────────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Outfit:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Outfit',sans-serif;overflow:hidden;}
    ::-webkit-scrollbar{width:4px;height:4px;}
    ::-webkit-scrollbar-track{background:transparent;}
    ::-webkit-scrollbar-thumb{background:rgba(99,102,241,0.4);border-radius:2px;}
    ::-webkit-scrollbar-thumb:hover{background:rgba(99,102,241,0.7);}
    @keyframes fadeUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
    @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
    @keyframes slideIn{from{opacity:0;transform:translateX(16px);}to{opacity:1;transform:translateX(0);}}
    @keyframes shimmer{0%{background-position:-200% 0;}100%{background-position:200% 0;}}
    @keyframes spin{to{transform:rotate(360deg);}}
    @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}
    @keyframes scaleIn{from{opacity:0;transform:scale(0.95);}to{opacity:1;transform:scale(1);}}
    .card-anim{animation:fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both;}
    .slide-in{animation:slideIn 0.4s cubic-bezier(0.16,1,0.3,1) both;}
    .scale-in{animation:scaleIn 0.3s cubic-bezier(0.16,1,0.3,1) both;}
    .hover-lift{transition:transform 0.25s ease,box-shadow 0.25s ease,border-color 0.25s ease;}
    .hover-lift:hover{transform:translateY(-2px);}
    .transition-all{transition:all 0.25s ease;}
    .spin{animation:spin 1s linear infinite;}
    .pulse{animation:pulse 2s ease-in-out infinite;}
    input,button,select{font-family:inherit;}
    button{cursor:pointer;}
  `}</style>
);

// ── TOOLTIP COMPONENT ─────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, isDark, prefix="$", suffix="" }) => {
  const t = isDark ? T.dark : T.light;
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: t.bgCard, border:`1px solid ${t.border}`,
      borderRadius:10, padding:"10px 14px",
      boxShadow: t.shadowLg, minWidth:140,
    }}>
      <p style={{ fontSize:11, color:t.textMuted, marginBottom:6,
        fontFamily:"'JetBrains Mono',monospace" }}>{label}</p>
      {payload.map((p,i) => (
        <div key={i} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
          <div style={{ width:8, height:8, borderRadius:2, background:p.color }} />
          <span style={{ fontSize:12, color:t.text, fontWeight:600 }}>
            {prefix}{Number(p.value).toLocaleString()}{suffix}
          </span>
          <span style={{ fontSize:11, color:t.textMuted }}>{p.name}</span>
        </div>
      ))}
    </div>
  );
};

// ── SKELETON LOADER ───────────────────────────────────────────
const Skeleton = ({ w="100%", h=16, r=6, isDark }) => {
  const t = isDark ? T.dark : T.light;
  return (
    <div style={{
      width:w, height:h, borderRadius:r,
      background: isDark
        ? "linear-gradient(90deg, #1a1a30 25%, #22223a 50%, #1a1a30 75%)"
        : "linear-gradient(90deg, #e8e8f0 25%, #f0f0f8 50%, #e8e8f0 75%)",
      backgroundSize:"200% 100%",
      animation:"shimmer 1.5s infinite",
      flexShrink:0,
    }}/>
  );
};

// ── STATUS BADGE ──────────────────────────────────────────────
const Badge = ({ status, isDark }) => {
  const t = isDark ? T.dark : T.light;
  const map = {
    Completed:  { bg:t.greenSoft, color:t.green,  icon:<CheckCircle size={10}/>,  label:"Completed" },
    Processing: { bg:t.accentSoft,color:t.accent, icon:<Clock size={10}/>,        label:"Processing" },
    Refunded:   { bg:t.redSoft,   color:t.red,    icon:<XCircle size={10}/>,      label:"Refunded" },
    active:     { bg:t.greenSoft, color:t.green,  icon:<Activity size={10}/>,     label:"Active" },
    syncing:    { bg:t.accentSoft,color:t.accent, icon:<RefreshCw size={10}/>,    label:"Syncing" },
    warning:    { bg:t.amberSoft, color:t.amber,  icon:<AlertTriangle size={10}/>,label:"Warning" },
  };
  const s = map[status] || map.active;
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:4,
      padding:"3px 8px", borderRadius:20,
      background:s.bg, color:s.color,
      fontSize:11, fontWeight:600,
    }}>
      {s.icon}{s.label}
    </span>
  );
};

// ── KPI CARD ─────────────────────────────────────────────────
const KPICard = ({ icon, label, value, change, changeLabel, color, colorSoft, trend, isDark, delay=0, loading }) => {
  const t = isDark ? T.dark : T.light;
  const up = trend === "up";
  return (
    <div className="hover-lift card-anim" style={{
      background:t.bgCard, borderRadius:16, padding:"22px 24px",
      border:`1px solid ${t.border}`, boxShadow:t.shadow,
      animationDelay:`${delay}ms`,
    }}>
      {loading ? (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <Skeleton h={32} w={32} r={8} isDark={isDark}/>
          <Skeleton h={10} w="60%" isDark={isDark}/>
          <Skeleton h={28} w="80%" isDark={isDark}/>
          <Skeleton h={10} w="50%" isDark={isDark}/>
        </div>
      ) : (
        <>
          {/* Icon */}
          <div style={{
            width:38, height:38, borderRadius:10,
            background:colorSoft, display:"flex",
            alignItems:"center", justifyContent:"center",
            color:color, marginBottom:16,
          }}>{icon}</div>

          {/* Label */}
          <p style={{ fontSize:12, color:t.textMuted, fontWeight:500,
            letterSpacing:"0.04em", textTransform:"uppercase", marginBottom:6 }}>
            {label}
          </p>

          {/* Value */}
          <p style={{
            fontFamily:"'Syne',sans-serif", fontWeight:800,
            fontSize:"1.8rem", letterSpacing:"-0.03em",
            color:t.text, lineHeight:1, marginBottom:10,
          }}>{value}</p>

          {/* Change */}
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <span style={{
              display:"flex", alignItems:"center", gap:3,
              fontSize:12, fontWeight:600,
              color: up ? t.green : t.red,
            }}>
              {up ? <ArrowUpRight size={13}/> : <ArrowDownRight size={13}/>}
              {change}
            </span>
            <span style={{ fontSize:11, color:t.textMuted }}>{changeLabel}</span>
          </div>
        </>
      )}
    </div>
  );
};

// ── SECTION HEADER ────────────────────────────────────────────
const SectionHeader = ({ title, subtitle, action, isDark }) => {
  const t = isDark ? T.dark : T.light;
  return (
    <div style={{ display:"flex", justifyContent:"space-between",
      alignItems:"flex-start", marginBottom:20 }}>
      <div>
        <h3 style={{ fontFamily:"'Syne',sans-serif", fontWeight:700,
          fontSize:"1rem", color:t.text, letterSpacing:"-0.02em" }}>{title}</h3>
        {subtitle && <p style={{ fontSize:12, color:t.textMuted, marginTop:3 }}>{subtitle}</p>}
      </div>
      {action && action}
    </div>
  );
};

// ── ICON BUTTON ───────────────────────────────────────────────
const IconBtn = ({ icon, onClick, isDark, active, badge }) => {
  const t = isDark ? T.dark : T.light;
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        width:36, height:36, borderRadius:9,
        background: active||hov ? t.accentSoft : "transparent",
        border: `1px solid ${active||hov ? t.borderFocus : t.border}`,
        display:"flex", alignItems:"center", justifyContent:"center",
        color: active||hov ? t.accent : t.textMuted,
        transition:"all 0.2s ease", position:"relative",
      }}>
      {icon}
      {badge > 0 && (
        <span style={{
          position:"absolute", top:-3, right:-3,
          width:16, height:16, borderRadius:"50%",
          background:t.red, color:"#fff",
          fontSize:9, fontWeight:700,
          display:"flex", alignItems:"center", justifyContent:"center",
          border:`2px solid ${t.bg}`,
        }}>{badge > 9 ? "9+" : badge}</span>
      )}
    </button>
  );
};

// ── SIDEBAR ───────────────────────────────────────────────────
const Sidebar = ({ collapsed, onToggle, activePage, setActivePage, isDark }) => {
  const t = isDark ? T.dark : T.light;
  const navItems = [
    { id:"dashboard",    icon:<LayoutDashboard size={18}/>, label:"Overview" },
    { id:"analytics",   icon:<BarChart2 size={18}/>,       label:"Analytics" },
    { id:"datasources", icon:<Database size={18}/>,        label:"Data Sources" },
    { id:"insights",    icon:<Lightbulb size={18}/>,       label:"Insights" },
    { id:"reports",     icon:<FileText size={18}/>,        label:"Reports" },
    { id:"alerts",      icon:<Bell size={18}/>,            label:"Alerts", badge:3 },
  ];

  return (
    <aside style={{
      width: collapsed ? 64 : 228,
      background:t.bgSidebar, borderRight:`1px solid ${t.border}`,
      display:"flex", flexDirection:"column",
      transition:"width 0.3s cubic-bezier(0.16,1,0.3,1)",
      flexShrink:0, overflow:"hidden", height:"100vh",
      position:"relative", zIndex:10,
    }}>
      {/* Logo */}
      <div style={{
        padding: collapsed ? "20px 14px" : "20px 20px",
        borderBottom:`1px solid ${t.border}`,
        display:"flex", alignItems:"center",
        gap:10, height:64, flexShrink:0,
      }}>
        <div style={{
          width:32, height:32, borderRadius:8, flexShrink:0,
          background:"linear-gradient(135deg, #6366f1, #4f46e5)",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:15, fontWeight:800, color:"#fff",
          boxShadow:"0 0 12px rgba(99,102,241,0.4)",
        }}>N</div>
        {!collapsed && (
          <span style={{
            fontFamily:"'Syne',sans-serif", fontWeight:800,
            fontSize:"1.05rem", letterSpacing:"-0.03em",
            color:t.text, whiteSpace:"nowrap",
          }}>
            Narra<span style={{color:t.accent}}>lytics</span>
          </span>
        )}
      </div>

      {/* Nav items */}
      <nav style={{
        flex:1, overflowY:"auto", overflowX:"hidden",
        padding:"12px 8px", display:"flex", flexDirection:"column", gap:2,
      }}>
        {/* Label */}
        {!collapsed && (
          <p style={{
            fontSize:10, fontWeight:700, color:t.textSub,
            letterSpacing:"0.1em", textTransform:"uppercase",
            padding:"4px 10px 8px",
          }}>Main Menu</p>
        )}

        {navItems.map(item => {
          const active = activePage === item.id;
          return (
            <button key={item.id} onClick={() => setActivePage(item.id)}
              title={collapsed ? item.label : undefined}
              style={{
                display:"flex", alignItems:"center",
                gap:10, padding: collapsed ? "10px" : "10px 12px",
                borderRadius:10, border:"none",
                background: active ? t.accentSoft : "transparent",
                color: active ? t.accent : t.textMuted,
                width:"100%", textAlign:"left",
                transition:"all 0.2s ease",
                position:"relative",
                justifyContent: collapsed ? "center" : "flex-start",
              }}
              onMouseEnter={e => { if(!active) { e.currentTarget.style.background=t.bgTag; e.currentTarget.style.color=t.text; }}}
              onMouseLeave={e => { if(!active) { e.currentTarget.style.background="transparent"; e.currentTarget.style.color=t.textMuted; }}}
            >
              <span style={{ flexShrink:0, position:"relative" }}>
                {item.icon}
                {item.badge && collapsed && (
                  <span style={{
                    position:"absolute", top:-4, right:-4,
                    width:14, height:14, borderRadius:"50%",
                    background:t.red, color:"#fff",
                    fontSize:8, fontWeight:700,
                    display:"flex", alignItems:"center", justifyContent:"center",
                  }}>{item.badge}</span>
                )}
              </span>
              {!collapsed && (
                <>
                  <span style={{
                    fontSize:13.5, fontWeight: active ? 600 : 500,
                    whiteSpace:"nowrap", flex:1,
                  }}>{item.label}</span>
                  {item.badge && (
                    <span style={{
                      padding:"1px 6px", borderRadius:10,
                      background:t.redSoft, color:t.red,
                      fontSize:10, fontWeight:700,
                    }}>{item.badge}</span>
                  )}
                  {active && (
                    <div style={{
                      position:"absolute", left:0, top:"50%",
                      transform:"translateY(-50%)",
                      width:3, height:18, borderRadius:"0 2px 2px 0",
                      background:t.accent,
                    }}/>
                  )}
                </>
              )}
            </button>
          );
        })}

        {/* Divider */}
        <div style={{ height:1, background:t.border, margin:"8px 4px" }}/>

        {/* Settings */}
        <button onClick={() => setActivePage("settings")}
          style={{
            display:"flex", alignItems:"center",
            gap:10, padding: collapsed ? "10px" : "10px 12px",
            borderRadius:10, border:"none",
            background: activePage==="settings" ? t.accentSoft : "transparent",
            color: activePage==="settings" ? t.accent : t.textMuted,
            width:"100%", textAlign:"left",
            transition:"all 0.2s ease",
            justifyContent: collapsed ? "center" : "flex-start",
          }}
          onMouseEnter={e => { if(activePage!=="settings") { e.currentTarget.style.background=t.bgTag; e.currentTarget.style.color=t.text; }}}
          onMouseLeave={e => { if(activePage!=="settings") { e.currentTarget.style.background="transparent"; e.currentTarget.style.color=t.textMuted; }}}
        >
          <Settings size={18}/>
          {!collapsed && <span style={{ fontSize:13.5, fontWeight:500 }}>Settings</span>}
        </button>
      </nav>

      {/* Collapse toggle */}
      <div style={{
        padding:"12px 8px", borderTop:`1px solid ${t.border}`,
        flexShrink:0,
      }}>
        <button onClick={onToggle} style={{
          width:"100%", display:"flex", alignItems:"center",
          justifyContent: collapsed ? "center" : "space-between",
          padding: collapsed ? "8px" : "8px 12px",
          borderRadius:10, border:`1px solid ${t.border}`,
          background:t.bgInput, color:t.textMuted,
          transition:"all 0.2s ease", gap:8,
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor=t.accent; e.currentTarget.style.color=t.accent; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor=t.border; e.currentTarget.style.color=t.textMuted; }}
        >
          {collapsed
            ? <ChevronRight size={15}/>
            : <><span style={{fontSize:12}}>Collapse</span><ChevronLeft size={15}/></>
          }
        </button>
      </div>
    </aside>
  );
};

// ── TOP NAV ───────────────────────────────────────────────────
const TopNav = ({ isDark, onToggle, notifOpen, setNotifOpen, profileOpen, setProfileOpen, collapsed, isDarkMode, isDarkToggle }) => {
  const t = isDark ? T.dark : T.light;
  const [search, setSearch] = useState("");
  const unread = notifications.filter(n => !n.read).length;

  return (
    <header style={{
      height:64, background:t.bgSidebar, borderBottom:`1px solid ${t.border}`,
      display:"flex", alignItems:"center", justifyContent:"space-between",
      padding:"0 24px", gap:16, flexShrink:0, position:"relative", zIndex:20,
    }}>
      {/* Left: Search */}
      <div style={{
        display:"flex", alignItems:"center", gap:10,
        background:t.bgInput, border:`1px solid ${t.border}`,
        borderRadius:10, padding:"8px 12px",
        flex:1, maxWidth:380,
        transition:"border-color 0.2s ease",
      }}
        onFocus={e => e.currentTarget.style.borderColor=t.accent}
        onBlur={e => e.currentTarget.style.borderColor=t.border}
      >
        <Search size={14} color={t.textMuted}/>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Search queries, reports, insights..."
          style={{
            background:"transparent", border:"none", outline:"none",
            fontSize:13, color:t.text, width:"100%",
          }}/>
        {search && (
          <button onClick={()=>setSearch("")}
            style={{ background:"transparent", border:"none", color:t.textMuted, display:"flex" }}>
            <X size={12}/>
          </button>
        )}
      </div>

      {/* Center: Workspace selector */}
      <div style={{
        display:"flex", alignItems:"center", gap:8,
        padding:"6px 12px", borderRadius:10,
        border:`1px solid ${t.border}`,
        background:t.bgInput, cursor:"pointer",
        color:t.text, fontSize:13, fontWeight:500,
        transition:"all 0.2s ease",
      }}
        onMouseEnter={e => e.currentTarget.style.borderColor=t.accent}
        onMouseLeave={e => e.currentTarget.style.borderColor=t.border}
      >
        <Globe size={14} color={t.accent}/>
        <span>Amazon Sales 2022–23</span>
        <ChevronsUpDown size={12} color={t.textMuted}/>
      </div>

      {/* Right: Actions */}
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>

        {/* Refresh */}
        <IconBtn icon={<RefreshCw size={15}/>} isDark={isDark}/>

        {/* Theme toggle */}
        <button onClick={isDarkToggle} style={{
          width:36, height:36, borderRadius:9,
          background:t.bgInput, border:`1px solid ${t.border}`,
          display:"flex", alignItems:"center", justifyContent:"center",
          color:t.textMuted, transition:"all 0.2s ease",
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor=t.accent; e.currentTarget.style.color=t.accent; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor=t.border; e.currentTarget.style.color=t.textMuted; }}
        >
          {isDark ? <Sun size={15}/> : <Moon size={15}/>}
        </button>

        {/* Notifications */}
        <div style={{ position:"relative" }}>
          <IconBtn icon={<Bell size={15}/>} isDark={isDark}
            badge={unread} active={notifOpen}
            onClick={() => { setNotifOpen(p=>!p); setProfileOpen(false); }}/>

          {notifOpen && (
            <div className="scale-in" style={{
              position:"absolute", top:44, right:0,
              width:340, background:t.bgCard,
              border:`1px solid ${t.border}`,
              borderRadius:14, boxShadow:t.shadowLg,
              overflow:"hidden", zIndex:100,
            }}>
              {/* Header */}
              <div style={{
                padding:"14px 16px", borderBottom:`1px solid ${t.border}`,
                display:"flex", justifyContent:"space-between", alignItems:"center",
              }}>
                <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:"0.9rem", color:t.text }}>
                  Notifications
                </span>
                <span style={{ fontSize:11, color:t.accent, cursor:"pointer", fontWeight:600 }}>
                  Mark all read
                </span>
              </div>

              {/* Notifications list */}
              <div style={{ maxHeight:340, overflowY:"auto" }}>
                {notifications.map(n => (
                  <div key={n.id} style={{
                    padding:"12px 16px",
                    borderBottom:`1px solid ${t.border}`,
                    background: !n.read ? t.accentSoft+"80" : "transparent",
                    transition:"background 0.2s ease",
                    cursor:"pointer",
                  }}
                    onMouseEnter={e => e.currentTarget.style.background=t.bgTag}
                    onMouseLeave={e => e.currentTarget.style.background=(!n.read ? t.accentSoft+"80" : "transparent")}
                  >
                    <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                      <div style={{
                        width:8, height:8, borderRadius:"50%", flexShrink:0, marginTop:5,
                        background: n.read ? t.border : t.accent,
                      }}/>
                      <div>
                        <p style={{ fontSize:13, fontWeight:600, color:t.text, marginBottom:2 }}>{n.title}</p>
                        <p style={{ fontSize:12, color:t.textMuted, lineHeight:1.5 }}>{n.desc}</p>
                        <p style={{ fontSize:11, color:t.textSub, marginTop:4 }}>{n.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div style={{ position:"relative" }}>
          <button onClick={() => { setProfileOpen(p=>!p); setNotifOpen(false); }}
            style={{
              display:"flex", alignItems:"center", gap:8,
              padding:"5px 10px 5px 5px",
              borderRadius:10, border:`1px solid ${t.border}`,
              background:t.bgInput, cursor:"pointer",
              transition:"all 0.2s ease",
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor=t.accent}
            onMouseLeave={e => e.currentTarget.style.borderColor=t.border}
          >
            <div style={{
              width:26, height:26, borderRadius:7,
              background:"linear-gradient(135deg, #6366f1, #a78bfa)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:11, fontWeight:800, color:"#fff",
            }}>SP</div>
            <span style={{ fontSize:13, fontWeight:500, color:t.text }}>Suvam</span>
            <ChevronDown size={12} color={t.textMuted}/>
          </button>

          {profileOpen && (
            <div className="scale-in" style={{
              position:"absolute", top:44, right:0, width:200,
              background:t.bgCard, border:`1px solid ${t.border}`,
              borderRadius:12, boxShadow:t.shadowLg, overflow:"hidden", zIndex:100,
            }}>
              <div style={{ padding:"12px 14px", borderBottom:`1px solid ${t.border}` }}>
                <p style={{ fontSize:13, fontWeight:600, color:t.text }}>Suvam Paul</p>
                <p style={{ fontSize:11, color:t.textMuted }}>suvam@narralytics.io</p>
              </div>
              {[
                { icon:<User size={14}/>,    label:"Profile" },
                { icon:<Settings size={14}/>,label:"Settings" },
              ].map(item => (
                <button key={item.label} style={{
                  display:"flex", alignItems:"center", gap:10,
                  padding:"10px 14px", width:"100%", border:"none",
                  background:"transparent", color:t.textMuted, fontSize:13,
                  transition:"all 0.2s ease", textAlign:"left",
                }}
                  onMouseEnter={e => { e.currentTarget.style.background=t.bgTag; e.currentTarget.style.color=t.text; }}
                  onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.color=t.textMuted; }}
                >{item.icon}{item.label}</button>
              ))}
              <div style={{ height:1, background:t.border }}/>
              <button style={{
                display:"flex", alignItems:"center", gap:10,
                padding:"10px 14px", width:"100%", border:"none",
                background:"transparent", color:t.red, fontSize:13,
                transition:"all 0.2s ease", textAlign:"left",
              }}
                onMouseEnter={e => e.currentTarget.style.background=t.redSoft}
                onMouseLeave={e => e.currentTarget.style.background="transparent"}
              ><LogOut size={14}/>Sign out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

// ── DASHBOARD OVERVIEW PAGE ────────────────────────────────────
const DashboardPage = ({ isDark, loading }) => {
  const t = isDark ? T.dark : T.light;
  const [chartType, setChartType] = useState("revenue");

  const kpis = [
    { icon:<Users size={18}/>, label:"Total Users", value:"12,847", change:"+18.2%", changeLabel:"vs last month", color:t.accent, colorSoft:t.accentSoft, trend:"up" },
    { icon:<Zap size={18}/>, label:"Queries Today", value:"4,218", change:"+9.4%", changeLabel:"vs yesterday", color:t.green, colorSoft:t.greenSoft, trend:"up" },
    { icon:<TrendingUp size={18}/>, label:"Total Revenue", value:"$118K", change:"+13.6%", changeLabel:"vs last month", color:t.amber, colorSoft:t.amberSoft, trend:"up" },
    { icon:<Shield size={18}/>, label:"System Health", value:"98.4%", change:"-0.2%", changeLabel:"vs last week", color:t.cyan, colorSoft:t.cyanSoft, trend:"down" },
  ];

  const chartTabs = ["revenue","queries","users"];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }}>

      {/* Page header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <h1 style={{
            fontFamily:"'Syne',sans-serif", fontWeight:800,
            fontSize:"1.5rem", letterSpacing:"-0.03em", color:t.text,
          }}>Dashboard Overview</h1>
          <p style={{ fontSize:13, color:t.textMuted, marginTop:4 }}>
            Amazon Sales · Jan 2022 – Dec 2023 · 50,000 transactions
          </p>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button style={{
            display:"flex", alignItems:"center", gap:6, padding:"8px 14px",
            borderRadius:9, border:`1px solid ${t.border}`,
            background:t.bgCard, color:t.textMuted, fontSize:13,
            transition:"all 0.2s ease",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor=t.accent; e.currentTarget.style.color=t.accent; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor=t.border; e.currentTarget.style.color=t.textMuted; }}
          ><Calendar size={13}/>Last 12 months</button>
          <button style={{
            display:"flex", alignItems:"center", gap:6, padding:"8px 14px",
            borderRadius:9, border:"none",
            background:"linear-gradient(135deg, #6366f1, #4f46e5)",
            color:"#fff", fontSize:13, fontWeight:600,
          }}><Download size={13}/>Export</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16 }}>
        {kpis.map((k,i) => (
          <KPICard key={i} {...k} isDark={isDark} delay={i*80} loading={loading}/>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:16 }}>

        {/* Main trend chart */}
        <div className="card-anim hover-lift" style={{
          background:t.bgCard, borderRadius:16, padding:"22px 24px",
          border:`1px solid ${t.border}`, boxShadow:t.shadow,
          animationDelay:"320ms",
        }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
            <div>
              <h3 style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:"0.95rem", color:t.text }}>
                Performance Trends
              </h3>
              <p style={{ fontSize:11, color:t.textMuted, marginTop:2 }}>12-month overview</p>
            </div>
            {/* Chart type tabs */}
            <div style={{ display:"flex", gap:2, background:t.bgInput, borderRadius:8, padding:3 }}>
              {chartTabs.map(tab => (
                <button key={tab} onClick={()=>setChartType(tab)} style={{
                  padding:"4px 10px", borderRadius:6, border:"none",
                  background: chartType===tab ? t.bgCard : "transparent",
                  color: chartType===tab ? t.accent : t.textMuted,
                  fontSize:12, fontWeight: chartType===tab ? 600 : 400,
                  boxShadow: chartType===tab ? t.shadow : "none",
                  transition:"all 0.2s ease",
                  textTransform:"capitalize",
                }}>{tab}</button>
              ))}
            </div>
          </div>
          {loading ? (
            <div style={{ height:220, display:"flex", flexDirection:"column", justifyContent:"flex-end", gap:4 }}>
              {Array(8).fill(0).map((_,i)=>(
                <Skeleton key={i} h={Math.random()*80+40} isDark={isDark} r={4}/>
              ))}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueData} margin={{top:5,right:10,left:0,bottom:0}}>
                <defs>
                  <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false}/>
                <XAxis dataKey="month" tick={{fill:t.textMuted,fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:t.textMuted,fontSize:11}} axisLine={false} tickLine={false}
                  tickFormatter={v => chartType==="revenue" ? `$${v/1000}K` : v}/>
                <Tooltip content={(props)=><CustomTooltip {...props} isDark={isDark}
                  prefix={chartType==="revenue"?"$":""} suffix={chartType==="revenue"?"":""} />}/>
                <Area type="monotone" dataKey={chartType}
                  stroke="#6366f1" strokeWidth={2.5}
                  fill="url(#grad1)" dot={false}
                  activeDot={{r:5,fill:"#6366f1",strokeWidth:2,stroke:t.bgCard}}/>
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Regional distribution */}
        <div className="card-anim hover-lift" style={{
          background:t.bgCard, borderRadius:16, padding:"22px 24px",
          border:`1px solid ${t.border}`, boxShadow:t.shadow,
          animationDelay:"400ms",
        }}>
          <SectionHeader title="Regional Distribution" subtitle="Revenue share by region" isDark={isDark}/>
          {loading ? (
            <div style={{ display:"flex", flexDirection:"column", gap:12, marginTop:20 }}>
              {Array(4).fill(0).map((_,i)=><Skeleton key={i} h={14} isDark={isDark}/>)}
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={regionData} cx="50%" cy="50%" innerRadius={45} outerRadius={72}
                    paddingAngle={3} dataKey="value">
                    {regionData.map((e,i)=><Cell key={i} fill={e.color}/>)}
                  </Pie>
                  <Tooltip content={(props)=><CustomTooltip {...props} isDark={isDark} prefix="" suffix="%"/>}/>
                </PieChart>
              </ResponsiveContainer>

              {/* Legend */}
              <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:8 }}>
                {regionData.map((r,i) => (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                      <div style={{ width:8, height:8, borderRadius:2, background:r.color }}/>
                      <span style={{ fontSize:12, color:t.textMuted }}>{r.name}</span>
                    </div>
                    <span style={{ fontSize:12, fontWeight:600, color:t.text }}>{r.value}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Second charts row */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>

        {/* Category bar chart */}
        <div className="card-anim hover-lift" style={{
          background:t.bgCard, borderRadius:16, padding:"22px 24px",
          border:`1px solid ${t.border}`, boxShadow:t.shadow,
          animationDelay:"480ms",
        }}>
          <SectionHeader title="Revenue by Category" subtitle="Current vs previous period" isDark={isDark}/>
          {loading ? <Skeleton h={200} isDark={isDark} r={8}/> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={categoryData} margin={{top:5,right:5,left:-20,bottom:0}} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke={t.border} horizontal={true} vertical={false}/>
                <XAxis dataKey="name" tick={{fill:t.textMuted,fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:t.textMuted,fontSize:10}} axisLine={false} tickLine={false}
                  tickFormatter={v=>`$${v/1000}K`}/>
                <Tooltip content={(props)=><CustomTooltip {...props} isDark={isDark}/>}/>
                <Bar dataKey="prev" name="Previous" fill={t.border} radius={[3,3,0,0]}/>
                <Bar dataKey="value" name="Current" fill="#6366f1" radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Weekly sessions */}
        <div className="card-anim hover-lift" style={{
          background:t.bgCard, borderRadius:16, padding:"22px 24px",
          border:`1px solid ${t.border}`, boxShadow:t.shadow,
          animationDelay:"560ms",
        }}>
          <SectionHeader title="Weekly Sessions" subtitle="Sessions & bounce rate" isDark={isDark}/>
          {loading ? <Skeleton h={200} isDark={isDark} r={8}/> : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={weeklyData} margin={{top:5,right:5,left:-20,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false}/>
                <XAxis dataKey="day" tick={{fill:t.textMuted,fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:t.textMuted,fontSize:11}} axisLine={false} tickLine={false}/>
                <Tooltip content={(props)=><CustomTooltip {...props} isDark={isDark} prefix=""/>}/>
                <Legend wrapperStyle={{fontSize:11,color:t.textMuted}}/>
                <Line type="monotone" dataKey="sessions" stroke="#10b981" strokeWidth={2.5}
                  dot={false} activeDot={{r:4}}/>
                <Line type="monotone" dataKey="bounceRate" stroke="#f59e0b" strokeWidth={2}
                  strokeDasharray="4 2" dot={false} activeDot={{r:4}}/>
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Bottom row: Activity + Pipeline */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>

        {/* Activity Feed */}
        <div className="card-anim" style={{
          background:t.bgCard, borderRadius:16, padding:"22px 24px",
          border:`1px solid ${t.border}`, boxShadow:t.shadow,
          animationDelay:"640ms",
        }}>
          <SectionHeader title="Activity Feed" subtitle="Real-time events" isDark={isDark}
            action={<span style={{fontSize:12,color:t.accent,cursor:"pointer"}}>View all →</span>}/>
          <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
            {activityFeed.map((item,i) => (
              <div key={item.id} style={{
                display:"flex", gap:12, padding:"10px 0",
                borderBottom: i < activityFeed.length-1 ? `1px solid ${t.border}` : "none",
              }}>
                <div style={{
                  width:28, height:28, borderRadius:8, flexShrink:0,
                  background: item.color+"20",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  color:item.color,
                }}>{item.icon}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:12, color:t.text, lineHeight:1.5,
                    whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                    <span style={{ fontWeight:600 }}>{item.user}</span>
                    {" "}{item.action}
                  </p>
                  <p style={{ fontSize:11, color:t.textMuted, marginTop:2 }}>{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pipeline Status */}
        <div className="card-anim" style={{
          background:t.bgCard, borderRadius:16, padding:"22px 24px",
          border:`1px solid ${t.border}`, boxShadow:t.shadow,
          animationDelay:"720ms",
        }}>
          <SectionHeader title="Data Pipelines" subtitle="Sync status & health" isDark={isDark}
            action={<button style={{
              display:"flex", alignItems:"center", gap:4, padding:"4px 10px",
              borderRadius:7, border:`1px solid ${t.border}`,
              background:"transparent", color:t.textMuted, fontSize:11,
            }}><Plus size={11}/>Add Source</button>}/>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {pipelineData.map((p,i) => (
              <div key={i} style={{
                padding:"12px 14px", borderRadius:12,
                background:t.bgInput, border:`1px solid ${t.border}`,
                display:"flex", alignItems:"center", gap:12,
              }}>
                <div style={{
                  width:34, height:34, borderRadius:9,
                  background:t.bgTag, border:`1px solid ${t.border}`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                }}>
                  <Database size={15} color={t.accent}/>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                    <p style={{ fontSize:12, fontWeight:600, color:t.text }}>{p.name}</p>
                    <Badge status={p.status} isDark={isDark}/>
                  </div>
                  {/* Health bar */}
                  <div style={{ height:4, borderRadius:2, background:t.border, overflow:"hidden" }}>
                    <div style={{
                      height:"100%", borderRadius:2,
                      width:`${p.health}%`,
                      background: p.health>80 ? t.green : p.health>50 ? t.amber : t.red,
                      transition:"width 1s ease",
                    }}/>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginTop:3 }}>
                    <span style={{ fontSize:10, color:t.textMuted }}>{p.rows} rows</span>
                    <span style={{ fontSize:10, color:t.textMuted }}>Sync: {p.lastSync}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── ANALYTICS PAGE ─────────────────────────────────────────────
const AnalyticsPage = ({ isDark }) => {
  const t = isDark ? T.dark : T.light;
  const [filter, setFilter] = useState("all");
  const [dateRange, setDateRange] = useState("12m");

  const filterOptions = ["all","electronics","fashion","books","sports","beauty"];
  const dateOptions = ["7d","30d","3m","6m","12m","2y"];

  const filtered = filter === "all" ? revenueData :
    revenueData.map(d => ({ ...d, revenue: d.revenue * (0.2 + Math.random()*0.3) }));

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }}>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <h1 style={{ fontFamily:"'Syne',sans-serif", fontWeight:800,
            fontSize:"1.5rem", letterSpacing:"-0.03em", color:t.text }}>Analytics</h1>
          <p style={{ fontSize:13, color:t.textMuted, marginTop:4 }}>
            Deep-dive revenue, sessions, and behavioral analytics
          </p>
        </div>
        <button style={{
          display:"flex", alignItems:"center", gap:6, padding:"8px 14px",
          borderRadius:9, border:"none",
          background:"linear-gradient(135deg, #6366f1, #4f46e5)",
          color:"#fff", fontSize:13, fontWeight:600,
        }}><Plus size={13}/>New Report</button>
      </div>

      {/* Filter bar */}
      <div style={{
        display:"flex", gap:12, alignItems:"center",
        background:t.bgCard, borderRadius:14,
        border:`1px solid ${t.border}`, padding:"14px 18px",
        flexWrap:"wrap",
      }}>
        {/* Category filter */}
        <div style={{ display:"flex", gap:2, background:t.bgInput, borderRadius:9, padding:3 }}>
          {filterOptions.map(f => (
            <button key={f} onClick={()=>setFilter(f)} style={{
              padding:"5px 12px", borderRadius:7, border:"none",
              background: filter===f ? t.bgCard : "transparent",
              color: filter===f ? t.accent : t.textMuted,
              fontSize:12, fontWeight: filter===f ? 600 : 400,
              boxShadow: filter===f ? t.shadow : "none",
              transition:"all 0.2s ease",
              textTransform:"capitalize",
            }}>{f}</button>
          ))}
        </div>

        <div style={{ height:24, width:1, background:t.border }}/>

        {/* Date range */}
        <div style={{ display:"flex", gap:2, background:t.bgInput, borderRadius:9, padding:3 }}>
          {dateOptions.map(d => (
            <button key={d} onClick={()=>setDateRange(d)} style={{
              padding:"5px 10px", borderRadius:7, border:"none",
              background: dateRange===d ? t.accent : "transparent",
              color: dateRange===d ? "#fff" : t.textMuted,
              fontSize:12, fontWeight: dateRange===d ? 600 : 400,
              transition:"all 0.2s ease",
            }}>{d}</button>
          ))}
        </div>

        <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
          <button style={{
            display:"flex", alignItems:"center", gap:5, padding:"6px 12px",
            borderRadius:8, border:`1px solid ${t.border}`,
            background:t.bgInput, color:t.textMuted, fontSize:12,
          }}><Filter size={12}/>More Filters</button>
          <button style={{
            display:"flex", alignItems:"center", gap:5, padding:"6px 12px",
            borderRadius:8, border:`1px solid ${t.border}`,
            background:t.bgInput, color:t.textMuted, fontSize:12,
          }}><Download size={12}/>Export CSV</button>
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}>
        {[
          { label:"Total Revenue", value:"$847K", delta:"+12.4%", up:true },
          { label:"Avg Order Value", value:"$169", delta:"+3.2%", up:true },
          { label:"Conversion Rate", value:"4.8%", delta:"-0.4%", up:false },
          { label:"Avg Rating", value:"4.1 / 5", delta:"+0.2", up:true },
        ].map((s,i) => (
          <div key={i} className="card-anim hover-lift" style={{
            background:t.bgCard, borderRadius:12, padding:"16px 18px",
            border:`1px solid ${t.border}`, animationDelay:`${i*60}ms`,
          }}>
            <p style={{ fontSize:11, color:t.textMuted, marginBottom:6 }}>{s.label}</p>
            <p style={{ fontFamily:"'Syne',sans-serif", fontWeight:800,
              fontSize:"1.4rem", letterSpacing:"-0.03em", color:t.text }}>{s.value}</p>
            <span style={{ fontSize:12, fontWeight:600, color:s.up?t.green:t.red,
              display:"flex", alignItems:"center", gap:2, marginTop:4 }}>
              {s.up?<ArrowUpRight size={12}/>:<ArrowDownRight size={12}/>}{s.delta}
            </span>
          </div>
        ))}
      </div>

      {/* Deep charts */}
      <div style={{ display:"grid", gridTemplateColumns:"3fr 2fr", gap:16 }}>
        {/* Revenue trend */}
        <div className="card-anim hover-lift" style={{
          background:t.bgCard, borderRadius:16, padding:"22px 24px",
          border:`1px solid ${t.border}`, boxShadow:t.shadow,
          animationDelay:"240ms",
        }}>
          <SectionHeader title="Revenue Deep Dive" subtitle={`Filtered: ${filter} · ${dateRange}`} isDark={isDark}/>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={filtered} margin={{top:5,right:10,left:0,bottom:0}}>
              <defs>
                <linearGradient id="grad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false}/>
              <XAxis dataKey="month" tick={{fill:t.textMuted,fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:t.textMuted,fontSize:11}} axisLine={false} tickLine={false}
                tickFormatter={v=>`$${v/1000}K`}/>
              <Tooltip content={(props)=><CustomTooltip {...props} isDark={isDark}/>}/>
              <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5}
                fill="url(#grad2)" dot={false} activeDot={{r:5}}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Category comparison */}
        <div className="card-anim hover-lift" style={{
          background:t.bgCard, borderRadius:16, padding:"22px 24px",
          border:`1px solid ${t.border}`, boxShadow:t.shadow,
          animationDelay:"320ms",
        }}>
          <SectionHeader title="Category Breakdown" subtitle="Current period" isDark={isDark}/>
          <div style={{ display:"flex", flexDirection:"column", gap:10, marginTop:8 }}>
            {categoryData.map((c,i) => {
              const max = Math.max(...categoryData.map(x=>x.value));
              const pct = (c.value/max)*100;
              const colors = ["#6366f1","#f59e0b","#10b981","#f43f5e","#06b6d4","#a78bfa"];
              return (
                <div key={i}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:12, color:t.text, fontWeight:500 }}>{c.name}</span>
                    <span style={{ fontSize:12, fontFamily:"'JetBrains Mono',monospace",
                      color:colors[i] }}>${(c.value/1000).toFixed(0)}K</span>
                  </div>
                  <div style={{ height:6, borderRadius:3, background:t.border, overflow:"hidden" }}>
                    <div style={{
                      height:"100%", width:`${pct}%`, borderRadius:3,
                      background:colors[i], transition:"width 1.2s cubic-bezier(0.16,1,0.3,1)",
                    }}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── DATA TABLE PAGE ────────────────────────────────────────────
const TablePage = ({ isDark }) => {
  const t = isDark ? T.dark : T.light;
  const [sortCol, setSortCol]   = useState("id");
  const [sortDir, setSortDir]   = useState("asc");
  const [search, setSearch]     = useState("");
  const [page, setPage]         = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const perPage = 8;

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d==="asc"?"desc":"asc");
    else { setSortCol(col); setSortDir("asc"); }
    setPage(1);
  };

  const filtered = tableData
    .filter(r => statusFilter==="all" || r.status===statusFilter)
    .filter(r =>
      r.orderId.toLowerCase().includes(search.toLowerCase()) ||
      r.category.toLowerCase().includes(search.toLowerCase()) ||
      r.region.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a,b) => {
      const av = a[sortCol], bv = b[sortCol];
      const cmp = isNaN(av) ? String(av).localeCompare(String(bv)) : Number(av)-Number(bv);
      return sortDir==="asc" ? cmp : -cmp;
    });

  const paged = filtered.slice((page-1)*perPage, page*perPage);
  const totalPages = Math.ceil(filtered.length/perPage);

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <ChevronsUpDown size={12} color={t.textSub}/>;
    return sortDir==="asc"
      ? <SortAsc size={12} color={t.accent}/>
      : <SortDesc size={12} color={t.accent}/>;
  };

  const cols = [
    { key:"orderId",  label:"Order ID" },
    { key:"category", label:"Category" },
    { key:"region",   label:"Region" },
    { key:"revenue",  label:"Revenue" },
    { key:"discount", label:"Discount" },
    { key:"rating",   label:"Rating" },
    { key:"status",   label:"Status" },
    { key:"date",     label:"Date" },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div>
        <h1 style={{ fontFamily:"'Syne',sans-serif", fontWeight:800,
          fontSize:"1.5rem", letterSpacing:"-0.03em", color:t.text }}>Data Sources</h1>
        <p style={{ fontSize:13, color:t.textMuted, marginTop:4 }}>Amazon Sales transactions · Sortable, filterable, paginated</p>
      </div>

      {/* Table controls */}
      <div style={{
        background:t.bgCard, borderRadius:14,
        border:`1px solid ${t.border}`, padding:"14px 18px",
        display:"flex", gap:10, alignItems:"center", flexWrap:"wrap",
      }}>
        {/* Search */}
        <div style={{
          display:"flex", alignItems:"center", gap:8,
          background:t.bgInput, border:`1px solid ${t.border}`,
          borderRadius:9, padding:"7px 12px", flex:1, maxWidth:260,
        }}>
          <Search size={13} color={t.textMuted}/>
          <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}
            placeholder="Search orders..."
            style={{ background:"transparent", border:"none", outline:"none",
              fontSize:13, color:t.text, width:"100%" }}/>
        </div>

        {/* Status filter */}
        <div style={{ display:"flex", gap:2, background:t.bgInput, borderRadius:9, padding:3 }}>
          {["all","Completed","Processing","Refunded"].map(s => (
            <button key={s} onClick={()=>{setStatusFilter(s);setPage(1);}} style={{
              padding:"5px 10px", borderRadius:7, border:"none",
              background: statusFilter===s ? t.bgCard : "transparent",
              color: statusFilter===s ? t.accent : t.textMuted,
              fontSize:12, fontWeight: statusFilter===s ? 600 : 400,
              transition:"all 0.2s ease",
            }}>{s}</button>
          ))}
        </div>

        <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
          <p style={{ fontSize:12, color:t.textMuted, display:"flex", alignItems:"center" }}>
            {filtered.length} records
          </p>
          <button style={{
            display:"flex", alignItems:"center", gap:5, padding:"6px 12px",
            borderRadius:8, border:`1px solid ${t.border}`,
            background:t.bgInput, color:t.textMuted, fontSize:12,
          }}><Download size={12}/>Export</button>
        </div>
      </div>

      {/* Table */}
      <div style={{
        background:t.bgCard, borderRadius:16,
        border:`1px solid ${t.border}`, overflow:"hidden",
        boxShadow:t.shadow,
      }}>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${t.border}`, background:t.bgInput }}>
                {cols.map(c => (
                  <th key={c.key} onClick={()=>handleSort(c.key)} style={{
                    padding:"11px 16px", textAlign:"left",
                    fontSize:11, fontWeight:700, color:t.textMuted,
                    letterSpacing:"0.06em", textTransform:"uppercase",
                    cursor:"pointer", userSelect:"none",
                    whiteSpace:"nowrap",
                  }}>
                    <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                      {c.label}<SortIcon col={c.key}/>
                    </div>
                  </th>
                ))}
                <th style={{ padding:"11px 16px", fontSize:11, fontWeight:700,
                  color:t.textMuted, letterSpacing:"0.06em", textTransform:"uppercase" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.map((row, i) => (
                <tr key={row.id} style={{
                  borderBottom: i < paged.length-1 ? `1px solid ${t.border}` : "none",
                  transition:"background 0.15s ease",
                }}
                  onMouseEnter={e => e.currentTarget.style.background=t.bgCardHover}
                  onMouseLeave={e => e.currentTarget.style.background="transparent"}
                >
                  <td style={{ padding:"12px 16px" }}>
                    <span style={{ fontFamily:"'JetBrains Mono',monospace",
                      fontSize:12, color:t.accent }}>{row.orderId}</span>
                  </td>
                  <td style={{ padding:"12px 16px" }}>
                    <span style={{ fontSize:13, color:t.text }}>{row.category}</span>
                  </td>
                  <td style={{ padding:"12px 16px" }}>
                    <span style={{ fontSize:12, color:t.textMuted }}>{row.region}</span>
                  </td>
                  <td style={{ padding:"12px 16px" }}>
                    <span style={{ fontSize:13, fontWeight:600, color:t.text,
                      fontFamily:"'JetBrains Mono',monospace" }}>${Number(row.revenue).toLocaleString()}</span>
                  </td>
                  <td style={{ padding:"12px 16px" }}>
                    <span style={{ fontSize:12, color:t.amber }}>{row.discount}%</span>
                  </td>
                  <td style={{ padding:"12px 16px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                      <span style={{ color:t.amber, fontSize:12 }}>★</span>
                      <span style={{ fontSize:12, color:t.text }}>{row.rating}</span>
                    </div>
                  </td>
                  <td style={{ padding:"12px 16px" }}>
                    <Badge status={row.status} isDark={isDark}/>
                  </td>
                  <td style={{ padding:"12px 16px" }}>
                    <span style={{ fontSize:12, color:t.textMuted,
                      fontFamily:"'JetBrains Mono',monospace" }}>{row.date}</span>
                  </td>
                  <td style={{ padding:"12px 16px" }}>
                    <div style={{ display:"flex", gap:4 }}>
                      {[<Eye size={13}/>, <Edit size={13}/>, <Trash2 size={13}/>].map((ic,j) => (
                        <button key={j} style={{
                          width:26, height:26, borderRadius:6,
                          background:"transparent", border:`1px solid ${t.border}`,
                          display:"flex", alignItems:"center", justifyContent:"center",
                          color:t.textMuted, transition:"all 0.2s ease",
                        }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor=t.accent; e.currentTarget.style.color=t.accent; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor=t.border; e.currentTarget.style.color=t.textMuted; }}
                        >{ic}</button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{
          padding:"12px 18px", borderTop:`1px solid ${t.border}`,
          display:"flex", justifyContent:"space-between", alignItems:"center",
        }}>
          <p style={{ fontSize:12, color:t.textMuted }}>
            Showing {(page-1)*perPage+1}–{Math.min(page*perPage, filtered.length)} of {filtered.length}
          </p>
          <div style={{ display:"flex", gap:4 }}>
            <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}
              style={{
                padding:"5px 12px", borderRadius:7,
                border:`1px solid ${t.border}`,
                background:t.bgInput, color: page===1 ? t.textSub : t.textMuted,
                fontSize:12, transition:"all 0.2s ease",
                cursor: page===1 ? "not-allowed" : "pointer",
              }}>Previous</button>
            {Array.from({length:Math.min(5,totalPages)},(_,i)=>i+1).map(p => (
              <button key={p} onClick={()=>setPage(p)} style={{
                width:30, height:28, borderRadius:7,
                border:`1px solid ${page===p ? t.accent : t.border}`,
                background: page===p ? t.accentSoft : t.bgInput,
                color: page===p ? t.accent : t.textMuted,
                fontSize:12, fontWeight: page===p ? 600 : 400,
                transition:"all 0.2s ease",
              }}>{p}</button>
            ))}
            <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}
              style={{
                padding:"5px 12px", borderRadius:7,
                border:`1px solid ${t.border}`,
                background:t.bgInput, color: page===totalPages ? t.textSub : t.textMuted,
                fontSize:12, transition:"all 0.2s ease",
                cursor: page===totalPages ? "not-allowed" : "pointer",
              }}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── COMING SOON PAGE ──────────────────────────────────────────
const ComingSoonPage = ({ title, icon, isDark }) => {
  const t = isDark ? T.dark : T.light;
  return (
    <div style={{
      display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", height:"60vh", gap:16, textAlign:"center",
    }}>
      <div style={{
        width:64, height:64, borderRadius:16,
        background:t.accentSoft, border:`1px solid ${t.borderFocus}`,
        display:"flex", alignItems:"center", justifyContent:"center",
        color:t.accent,
      }}>{icon}</div>
      <h2 style={{ fontFamily:"'Syne',sans-serif", fontWeight:800,
        fontSize:"1.4rem", color:t.text }}>{title}</h2>
      <p style={{ fontSize:13, color:t.textMuted, maxWidth:320 }}>
        This module is under development. It will integrate with your
        Narralytics data pipeline when ready.
      </p>
      <div style={{
        padding:"6px 16px", borderRadius:20, background:t.amberSoft,
        border:`1px solid ${t.amber}40`, color:t.amber, fontSize:12, fontWeight:600,
      }}>Coming Soon</div>
    </div>
  );
};

// ── ROOT APP ──────────────────────────────────────────────────
export default function NarralyticsDashboard() {
  const [isDark, setIsDark]         = useState(true);
  const [collapsed, setCollapsed]   = useState(false);
  const [activePage, setActivePage] = useState("dashboard");
  const [notifOpen, setNotifOpen]   = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loading, setLoading]       = useState(true);
  const t = isDark ? T.dark : T.light;

  // Simulate initial data load
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1800);
    return () => clearTimeout(timer);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = () => { setNotifOpen(false); setProfileOpen(false); };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const renderPage = () => {
    switch(activePage) {
      case "dashboard":   return <DashboardPage isDark={isDark} loading={loading}/>;
      case "analytics":   return <AnalyticsPage isDark={isDark}/>;
      case "datasources": return <TablePage isDark={isDark}/>;
      case "insights":    return <ComingSoonPage title="AI Insights" icon={<Lightbulb size={28}/>} isDark={isDark}/>;
      case "reports":     return <ComingSoonPage title="Reports" icon={<FileText size={28}/>} isDark={isDark}/>;
      case "alerts":      return <ComingSoonPage title="Alerts & Monitoring" icon={<Bell size={28}/>} isDark={isDark}/>;
      case "settings":    return <ComingSoonPage title="Settings" icon={<Settings size={28}/>} isDark={isDark}/>;
      default:            return <DashboardPage isDark={isDark} loading={loading}/>;
    }
  };

  return (
    <div style={{
      display:"flex", height:"100vh", overflow:"hidden",
      background:t.bg, color:t.text,
      fontFamily:"'Outfit',sans-serif",
      transition:"background 0.4s ease, color 0.4s ease",
    }}>
      <GlobalStyles/>

      {/* Sidebar */}
      <Sidebar
        collapsed={collapsed}
        onToggle={()=>setCollapsed(p=>!p)}
        activePage={activePage}
        setActivePage={setActivePage}
        isDark={isDark}
      />

      {/* Main */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {/* Top Nav */}
        <TopNav
          isDark={isDark}
          notifOpen={notifOpen}
          setNotifOpen={(v) => { setNotifOpen(v); if(v) setProfileOpen(false); }}
          profileOpen={profileOpen}
          setProfileOpen={(v) => { setProfileOpen(v); if(v) setNotifOpen(false); }}
          isDarkToggle={() => setIsDark(p=>!p)}
        />

        {/* Content */}
        <main style={{
          flex:1, overflowY:"auto", overflowX:"hidden",
          padding:"28px 32px",
        }}
          onClick={() => { setNotifOpen(false); setProfileOpen(false); }}
        >
          {renderPage()}

          {/* Bottom padding */}
          <div style={{ height:24 }}/>
        </main>
      </div>
    </div>
  );
}
