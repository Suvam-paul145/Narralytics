/**
 * Narralytics — Dashboard Page
 * Design: Obsidian Intelligence — premium analytics workspace
 * Fonts:  DM Serif Display · DM Sans · JetBrains Mono
 * Charts: Recharts (AreaChart, BarChart, PieChart, LineChart)
 * Icons:  lucide-react
 * Deps:   recharts, lucide-react
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";


import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  LayoutDashboard, BarChart2, Database, MessageSquare,
  FileText, Bell, Settings, Brain, Upload, ChevronLeft,
  ChevronRight, Search, Sun, Moon, User, LogOut,
  TrendingUp, TrendingDown, Users, Zap, Activity,
  Shield, ArrowUpRight, ArrowDownRight, ChevronDown,
  MoreHorizontal, RefreshCw, Download, Plus, X,
  Mic, Filter, Calendar, Lightbulb, AlertTriangle,
  CheckCircle, Clock, ChevronsUpDown, Globe,
  Sparkles, Eye, Layers
} from "lucide-react";

// ─── THEME TOKENS (same system as Landing.jsx) ────────────────
const THEMES = {
  dark: {
    "--bg":          "#05050f", "--bg-card":     "#0c0c1e",
    "--bg-card-2":   "#111128", "--bg-sidebar":  "#080818",
    "--bg-input":    "#111126", "--bg-tag":      "#18183a",
    "--bg-nav":      "rgba(8,8,24,0.95)",
    "--border":      "rgba(255,255,255,0.07)",
    "--border-glow": "rgba(91,106,249,0.45)",
    "--text":        "#eeeef8", "--text-muted":  "#9090c0",
    "--text-sub":    "#505070",
    "--accent":      "#5b6af9", "--accent-soft": "rgba(91,106,249,0.14)",
    "--accent-glow": "rgba(91,106,249,0.28)",
    "--amber":       "#f5a623", "--amber-soft":  "rgba(245,166,35,0.12)",
    "--green":       "#2dd4a0", "--green-soft":  "rgba(45,212,160,0.12)",
    "--red":         "#ff6b8a", "--red-soft":    "rgba(255,107,138,0.12)",
    "--cyan":        "#38bdf8",
    "--shadow":      "0 4px 28px rgba(0,0,0,0.5)",
    "--shadow-lg":   "0 12px 60px rgba(0,0,0,0.6)",
    "--gradient":    "linear-gradient(135deg,#5b6af9 0%,#8b5cf6 60%,#f5a623 100%)",
  },
  light: {
    "--bg":          "#f2f2f8", "--bg-card":     "#ffffff",
    "--bg-card-2":   "#f7f7fd", "--bg-sidebar":  "#ffffff",
    "--bg-input":    "#ebebf4", "--bg-tag":      "#e8e8f4",
    "--bg-nav":      "rgba(255,255,255,0.95)",
    "--border":      "rgba(0,0,0,0.08)",
    "--border-glow": "rgba(67,56,202,0.4)",
    "--text":        "#07071a", "--text-muted":  "#3e3e68",
    "--text-sub":    "#9090b8",
    "--accent":      "#4338ca", "--accent-soft": "rgba(67,56,202,0.09)",
    "--accent-glow": "rgba(67,56,202,0.18)",
    "--amber":       "#b45309", "--amber-soft":  "rgba(180,83,9,0.09)",
    "--green":       "#047857", "--green-soft":  "rgba(4,120,87,0.09)",
    "--red":         "#be123c", "--red-soft":    "rgba(190,18,60,0.08)",
    "--cyan":        "#0891b2",
    "--shadow":      "0 2px 16px rgba(0,0,0,0.07)",
    "--shadow-lg":   "0 8px 40px rgba(0,0,0,0.11)",
    "--gradient":    "linear-gradient(135deg,#4338ca 0%,#7c3aed 60%,#b45309 100%)",
  }
};

const DASH_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=JetBrains+Mono:wght@400;500&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'DM Sans',sans-serif;overflow:hidden}
  ::-webkit-scrollbar{width:4px;height:4px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:var(--accent);border-radius:2px}
  @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
  @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
  @keyframes scaleIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
  .card-in{animation:fadeUp .45s cubic-bezier(.16,1,.3,1) both}
  .scale-in{animation:scaleIn .3s cubic-bezier(.16,1,.3,1) both}
  .spin{animation:spin .8s linear infinite}
  .hover-row:hover{background:var(--bg-card-2)!important}
  .hover-row{transition:background .15s ease}
  .nav-item{transition:all .2s ease}
  .btn-icon{transition:all .2s ease;cursor:pointer}
  .btn-icon:hover{background:var(--bg-tag)!important;color:var(--accent)!important}
  input,button,select{font-family:inherit}
  button{cursor:pointer}
  .shimmer-bg{
    background:linear-gradient(90deg,var(--bg-card) 25%,var(--bg-card-2) 50%,var(--bg-card) 75%);
    background-size:200% 100%;
    animation:shimmer 1.4s infinite;
  }
  .gradient-text{
    background:var(--gradient);
    background-size:200% auto;
    -webkit-background-clip:text;
    -webkit-text-fill-color:transparent;
    background-clip:text;
  }
  @media(max-width:900px){
    .mobile-stack{grid-template-columns:1fr!important}
    .mobile-2col{grid-template-columns:1fr 1fr!important}
  }
  @media(max-width:540px){
    .mobile-2col{grid-template-columns:1fr!important}
    .hide-mobile{display:none!important}
  }
`;

function DashStyleInjector() {
  useEffect(() => {
    const id = "dash-styles";
    if (!document.getElementById(id)) {
      const t = document.createElement("style");
      t.id = id; t.textContent = DASH_CSS;
      document.head.appendChild(t);
    }
    return () => { const el = document.getElementById(id); if(el) el.remove(); };
  }, []);
  return null;
}

function applyDashTheme(isDark) {
  const tokens = isDark ? THEMES.dark : THEMES.light;
  Object.entries(tokens).forEach(([k,v]) => document.documentElement.style.setProperty(k,v));
}

// ─── MOCK DATA ────────────────────────────────────────────────
const revenueData = [
  {month:"Jan",revenue:42000,queries:1240,users:320},
  {month:"Feb",revenue:51000,queries:1680,users:410},
  {month:"Mar",revenue:47000,queries:1420,users:380},
  {month:"Apr",revenue:63000,queries:2100,users:520},
  {month:"May",revenue:58000,queries:1930,users:490},
  {month:"Jun",revenue:72000,queries:2450,users:610},
  {month:"Jul",revenue:81000,queries:2890,users:720},
  {month:"Aug",revenue:76000,queries:2640,users:680},
  {month:"Sep",revenue:89000,queries:3120,users:810},
  {month:"Oct",revenue:95000,queries:3480,users:890},
  {month:"Nov",revenue:104000,queries:3820,users:960},
  {month:"Dec",revenue:118000,queries:4210,users:1080},
];
const categoryData = [
  {name:"Electronics",value:38000,prev:31000},
  {name:"Fashion",    value:27000,prev:29000},
  {name:"Books",      value:18000,prev:15000},
  {name:"Sports",     value:22000,prev:19000},
  {name:"Beauty",     value:14000,prev:12000},
  {name:"Home",       value:19000,prev:17000},
];
const regionData = [
  {name:"North America",value:38,color:"#5b6af9"},
  {name:"Asia",         value:28,color:"#f5a623"},
  {name:"Europe",       value:22,color:"#2dd4a0"},
  {name:"Middle East",  value:12,color:"#ff6b8a"},
];
const weeklyData = [
  {day:"Mon",sessions:840, bounce:32},
  {day:"Tue",sessions:920, bounce:28},
  {day:"Wed",sessions:1140,bounce:25},
  {day:"Thu",sessions:1080,bounce:30},
  {day:"Fri",sessions:1320,bounce:22},
  {day:"Sat",sessions:760, bounce:38},
  {day:"Sun",sessions:680, bounce:41},
];
const activityFeed = [
  {id:1,icon:Sparkles,     color:"#5b6af9",user:"AI Engine",action:"Generated revenue forecast for Q1 2025",      time:"2m ago"},
  {id:2,icon:AlertTriangle,color:"#f5a623",user:"System",   action:"Anomaly: Electronics spike 23% above trend",  time:"8m ago"},
  {id:3,icon:BarChart2,    color:"#2dd4a0",user:"You",      action:"Queried: Monthly revenue by region",          time:"15m ago"},
  {id:4,icon:FileText,     color:"#38bdf8",user:"System",   action:"Weekly digest report generated",              time:"1h ago"},
  {id:5,icon:MessageSquare,color:"#a78bfa",user:"You",      action:"Chat: Is our discount strategy working?",     time:"2h ago"},
  {id:6,icon:CheckCircle,  color:"#2dd4a0",user:"System",   action:"Data pipeline sync — 50,000 rows complete",   time:"3h ago"},
];
const pipelineItems = [
  {name:"Sales Dataset 2023",  status:"active",  rows:"50,000", sync:"2m ago",  health:98},
  {name:"Marketing Analytics", status:"active",  rows:"12,400", sync:"5m ago",  health:100},
  {name:"User Behavior",       status:"syncing", rows:"8,120",  sync:"syncing", health:72},
  {name:"Product Reviews",     status:"warning", rows:"4,880",  sync:"2h ago",  health:54},
];
const recentQueries = [
  {id:1,prompt:"Show monthly revenue by product category", type:"chart",time:"10:32 AM",charts:2},
  {id:2,prompt:"Why is Electronics outperforming Fashion?",type:"chat", time:"10:18 AM",charts:0},
  {id:3,prompt:"Revenue trend for Q3 2023 by region",      type:"chart",time:"09:45 AM",charts:2},
  {id:4,prompt:"Average order value per region",           type:"chart",time:"09:20 AM",charts:1},
  {id:5,prompt:"Is our discount strategy working?",        type:"chat", time:"Yesterday",charts:0},
];

// ─── CHART TOOLTIP ────────────────────────────────────────────
function ChartTip({active,payload,label,prefix="$",suffix=""}) {
  if(!active||!payload?.length) return null;
  return (
    <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",
      borderRadius:10,padding:"10px 14px",boxShadow:"var(--shadow-lg)",minWidth:130}}>
      <p style={{fontSize:11,color:"var(--text-sub)",marginBottom:6,
        fontFamily:"'JetBrains Mono',monospace"}}>{label}</p>
      {payload.map((p,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
          <div style={{width:8,height:8,borderRadius:2,background:p.color,flexShrink:0}}/>
          <span style={{fontSize:12,fontWeight:600,color:"var(--text)"}}>
            {prefix}{typeof p.value==="number"?p.value.toLocaleString():p.value}{suffix}
          </span>
          <span style={{fontSize:11,color:"var(--text-muted)"}}>{p.name}</span>
        </div>
      ))}
    </div>
  );
}

// ─── SKELETON ─────────────────────────────────────────────────
function Skeleton({w="100%",h=14,r=6}) {
  return <div className="shimmer-bg" style={{width:w,height:h,borderRadius:r,flexShrink:0}}/>;
}

// ─── BADGE ────────────────────────────────────────────────────
function Badge({status}) {
  const map = {
    active:    {bg:"var(--green-soft)", color:"var(--green)",  Icon:Activity,       label:"Active"},
    syncing:   {bg:"var(--accent-soft)",color:"var(--accent)", Icon:RefreshCw,      label:"Syncing"},
    warning:   {bg:"var(--amber-soft)", color:"var(--amber)",  Icon:AlertTriangle,  label:"Warning"},
    chart:     {bg:"var(--accent-soft)",color:"var(--accent)", Icon:BarChart2,      label:"Chart"},
    chat:      {bg:"var(--green-soft)", color:"var(--green)",  Icon:MessageSquare,  label:"Chat"},
    Completed: {bg:"var(--green-soft)", color:"var(--green)",  Icon:CheckCircle,    label:"Completed"},
  };
  const s = map[status]||map.active;
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:4,
      padding:"3px 8px",borderRadius:20,background:s.bg,color:s.color,
      fontSize:11,fontWeight:600}}>
      <s.Icon size={10}/>{s.label}
    </span>
  );
}

// ─── KPI CARD ─────────────────────────────────────────────────
function KPICard({icon:Icon,label,value,change,up,color,colorSoft,loading,delay=0}) {
  return (
    <div className="card-in" style={{
      background:"var(--bg-card)",borderRadius:16,padding:"22px",
      border:"1px solid var(--border)",boxShadow:"var(--shadow)",
      animationDelay:`${delay}ms`,transition:"all .25s ease",
    }}
      onMouseEnter={e=>{
        e.currentTarget.style.borderColor=color+"50";
        e.currentTarget.style.transform="translateY(-3px)";
        e.currentTarget.style.boxShadow=`0 16px 48px ${color}14`;
      }}
      onMouseLeave={e=>{
        e.currentTarget.style.borderColor="var(--border)";
        e.currentTarget.style.transform="translateY(0)";
        e.currentTarget.style.boxShadow="var(--shadow)";
      }}
    >
      {loading?(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <Skeleton h={32} w={32} r={8}/><Skeleton h={10} w="55%"/>
          <Skeleton h={28} w="75%"/><Skeleton h={10} w="45%"/>
        </div>
      ):(
        <>
          <div style={{width:38,height:38,borderRadius:10,background:colorSoft,color,
            marginBottom:16,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <Icon size={18}/>
          </div>
          <p style={{fontSize:11,fontWeight:600,letterSpacing:"0.07em",
            textTransform:"uppercase",color:"var(--text-muted)",marginBottom:5}}>{label}</p>
          <p style={{fontFamily:"'DM Serif Display',serif",fontSize:"1.9rem",fontWeight:400,
            letterSpacing:"-0.02em",color:"var(--text)",lineHeight:1,marginBottom:10}}>{value}</p>
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <span style={{display:"flex",alignItems:"center",gap:2,fontSize:12,fontWeight:600,
              color:up?"var(--green)":"var(--red)"}}>
              {up?<ArrowUpRight size={13}/>:<ArrowDownRight size={13}/>}{change}
            </span>
            <span style={{fontSize:11,color:"var(--text-sub)"}}>vs last month</span>
          </div>
        </>
      )}
    </div>
  );
}

// ─── CARD HEADER ──────────────────────────────────────────────
function CardHeader({title,subtitle,action}) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
      <div>
        <h3 style={{fontSize:"0.92rem",fontWeight:600,color:"var(--text)",letterSpacing:"-0.01em"}}>{title}</h3>
        {subtitle&&<p style={{fontSize:"0.78rem",color:"var(--text-muted)",marginTop:2}}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ─── ICON BUTTON ──────────────────────────────────────────────
function IconBtn({icon:Icon,onClick,active,badge,title:ttl}) {
  return (
    <button onClick={onClick} title={ttl} className="btn-icon" style={{
      width:34,height:34,borderRadius:8,
      background:active?"var(--accent-soft)":"transparent",
      border:`1px solid ${active?"var(--border-glow)":"var(--border)"}`,
      color:active?"var(--accent)":"var(--text-muted)",
      display:"flex",alignItems:"center",justifyContent:"center",position:"relative",
    }}>
      <Icon size={14}/>
      {badge>0&&(
        <span style={{position:"absolute",top:-3,right:-3,width:15,height:15,
          borderRadius:"50%",background:"var(--red)",color:"#fff",
          fontSize:8,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",
          border:"2px solid var(--bg-sidebar)"}}>
          {badge>9?"9+":badge}
        </span>
      )}
    </button>
  );
}

// ─── SIDEBAR ─────────────────────────────────────────────────
function Sidebar({collapsed,onToggle,activePage,setActivePage}) {
  const navigate = useNavigate();
  const navItems = [
    {id:"overview",   icon:LayoutDashboard,label:"Overview"},
    {id:"chat",       icon:MessageSquare,  label:"AI Chat",  badge:2},
    {id:"reports",    icon:FileText,       label:"Reports"},
  ];

  const handleNavClick = (id) => {
    if (id === "chat") {
      navigate("/chat");
    } else if (id === "reports") {
      navigate("/reports");
    } else {
      setActivePage(id);
    }
  };


  return (
    <aside style={{
      width:collapsed?62:220,
      background:"var(--bg-sidebar)",borderRight:"1px solid var(--border)",
      display:"flex",flexDirection:"column",
      transition:"width .3s cubic-bezier(.16,1,.3,1)",
      flexShrink:0,overflow:"hidden",height:"100vh",position:"relative",zIndex:10,
    }}>
      {/* Logo */}
      <div onClick={() => navigate("/")} style={{height:62,padding:collapsed?"0 14px":"0 18px",
        borderBottom:"1px solid var(--border)",
        display:"flex",alignItems:"center",gap:9,flexShrink:0,cursor:"pointer"}}>
        <div style={{width:30,height:30,borderRadius:8,flexShrink:0,
          background:"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",
          boxShadow:"0 0 14px var(--accent-glow)"}}>
          <Brain size={15} color="#fff"/>
        </div>
        {!collapsed&&(
          <span style={{fontFamily:"'DM Serif Display',serif",fontSize:"1.05rem",
            color:"var(--text)",whiteSpace:"nowrap"}}>
            Narra<span style={{color:"var(--accent)"}}>lytics</span>
          </span>
        )}
      </div>

      {/* Nav */}
      <nav style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:"10px 6px",
        display:"flex",flexDirection:"column",gap:2}}>
        {!collapsed&&(
          <p style={{fontSize:9,fontWeight:700,color:"var(--text-sub)",
            letterSpacing:"0.14em",textTransform:"uppercase",padding:"4px 10px 6px"}}>Workspace</p>
        )}
        {navItems.map(item=>{
          const active=activePage===item.id;
          const Icon=item.icon;
          return (
            <button key={item.id} onClick={()=>handleNavClick(item.id)}

              title={collapsed?item.label:undefined}
              className="nav-item"
              style={{display:"flex",alignItems:"center",gap:9,
                padding:collapsed?"9px":"9px 10px",
                borderRadius:9,border:"none",
                background:active?"var(--accent-soft)":"transparent",
                color:active?"var(--accent)":"var(--text-muted)",
                width:"100%",textAlign:"left",
                justifyContent:collapsed?"center":"flex-start",
                position:"relative"}}
              onMouseEnter={e=>{if(!active){e.currentTarget.style.background="var(--bg-tag)";e.currentTarget.style.color="var(--text)";}}}
              onMouseLeave={e=>{if(!active){e.currentTarget.style.background="transparent";e.currentTarget.style.color="var(--text-muted)";}}}
            >
              <span style={{position:"relative",flexShrink:0}}>
                <Icon size={16}/>
                {item.badge&&collapsed&&(
                  <span style={{position:"absolute",top:-4,right:-5,width:13,height:13,
                    borderRadius:"50%",background:"var(--red)",color:"#fff",
                    fontSize:7,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {item.badge}
                  </span>
                )}
              </span>
              {!collapsed&&(
                <>
                  <span style={{fontSize:"0.84rem",fontWeight:active?600:400,flex:1,whiteSpace:"nowrap"}}>{item.label}</span>
                  {item.badge&&(
                    <span style={{padding:"1px 6px",borderRadius:10,
                      background:"var(--red-soft)",color:"var(--red)",
                      fontSize:10,fontWeight:700}}>{item.badge}</span>
                  )}
                  {active&&(
                    <div style={{position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
                      width:3,height:16,borderRadius:"0 2px 2px 0",background:"var(--accent)"}}/>
                  )}
                </>
              )}
            </button>
          );
        })}
        <div style={{height:1,background:"var(--border)",margin:"6px 4px"}}/>
        <button onClick={()=>setActivePage("settings")} className="nav-item"
          title={collapsed?"Settings":undefined}
          style={{display:"flex",alignItems:"center",gap:9,
            padding:collapsed?"9px":"9px 10px",borderRadius:9,border:"none",
            background:activePage==="settings"?"var(--accent-soft)":"transparent",
            color:activePage==="settings"?"var(--accent)":"var(--text-muted)",
            width:"100%",justifyContent:collapsed?"center":"flex-start"}}
          onMouseEnter={e=>{if(activePage!=="settings"){e.currentTarget.style.background="var(--bg-tag)";e.currentTarget.style.color="var(--text)";}}}
          onMouseLeave={e=>{if(activePage!=="settings"){e.currentTarget.style.background="transparent";e.currentTarget.style.color="var(--text-muted)";}}}
        >
          <Settings size={16}/>
          {!collapsed&&<span style={{fontSize:"0.84rem"}}>Settings</span>}
        </button>
      </nav>

      {/* Collapse toggle */}
      <div style={{padding:"10px 6px",borderTop:"1px solid var(--border)",flexShrink:0}}>
        <button onClick={onToggle} style={{
          width:"100%",display:"flex",alignItems:"center",
          justifyContent:collapsed?"center":"space-between",
          padding:collapsed?"7px":"7px 10px",
          borderRadius:8,border:"1px solid var(--border)",
          background:"var(--bg-input)",color:"var(--text-muted)",
          fontSize:12,gap:6,transition:"all .2s",
        }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--border-glow)";e.currentTarget.style.color="var(--accent)";}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--text-muted)";}}
        >
          {collapsed?<ChevronRight size={14}/>:<><span>Collapse</span><ChevronLeft size={14}/></>}
        </button>
      </div>
    </aside>
  );
}

// ─── TOP NAV ─────────────────────────────────────────────────
function TopNav({isDark,onToggle,notifOpen,setNotifOpen,profileOpen,setProfileOpen,activePage}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [search,setSearch]=useState("");

  const titles={overview:"Dashboard Overview",analytics:"Analytics",
    datasets:"Datasets",chat:"AI Chat Assistant",insights:"AI Insights",
    reports:"Reports",alerts:"Alerts",settings:"Settings"};
  const notifs=[
    {title:"Revenue milestone", desc:"Monthly revenue crossed $100K.",         time:"Just now",read:false},
    {title:"Anomaly detected",  desc:"Electronics spike — 23% above forecast.",time:"8m ago",  read:false},
    {title:"Report ready",      desc:"Weekly digest is ready to download.",     time:"1h ago",  read:false},
    {title:"Sync complete",     desc:"50,000 rows loaded successfully.",         time:"3h ago",  read:true},
  ];

  return (
    <header style={{height:62,background:"var(--bg-nav)",borderBottom:"1px solid var(--border)",
      display:"flex",alignItems:"center",justifyContent:"space-between",
      padding:"0 24px",gap:16,flexShrink:0,position:"relative",zIndex:20,
      backdropFilter:"blur(20px)"}}>
      {/* Left */}
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <h1 style={{fontSize:"0.95rem",fontWeight:600,color:"var(--text)",
          letterSpacing:"-0.01em",whiteSpace:"nowrap"}}>
          {titles[activePage]||"Dashboard"}
        </h1>
        <div style={{display:"flex",alignItems:"center",gap:7,
          padding:"5px 11px",borderRadius:8,
          border:"1px solid var(--border)",background:"var(--bg-input)",
          cursor:"pointer",fontSize:12,color:"var(--text-muted)",transition:"all .2s"}}
          onMouseEnter={e=>e.currentTarget.style.borderColor="var(--border-glow)"}
          onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border)"}>
          <Globe size={12} color="var(--accent)"/>
          <span style={{whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:5}}>
            Sales Dataset 2023 <ChevronsUpDown size={10}/>
          </span>
        </div>
      </div>

      {/* Search */}
      <div style={{flex:1,maxWidth:360,display:"flex",alignItems:"center",gap:8,
        background:"var(--bg-input)",border:"1px solid var(--border)",
        borderRadius:9,padding:"7px 12px",transition:"border-color .2s"}}
        onFocusCapture={e=>e.currentTarget.style.borderColor="var(--border-glow)"}
        onBlurCapture={e=>e.currentTarget.style.borderColor="var(--border)"}>
        <Search size={13} color="var(--text-muted)"/>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Search queries, reports..."
          style={{flex:1,background:"transparent",border:"none",outline:"none",
            fontSize:"0.82rem",color:"var(--text)"}}/>
        {search&&<button onClick={()=>setSearch("")}
          style={{background:"transparent",border:"none",color:"var(--text-muted)",display:"flex"}}>
          <X size={11}/>
        </button>}
      </div>

      {/* Right */}
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <IconBtn icon={RefreshCw} title="Refresh"/>
        <button onClick={onToggle} className="btn-icon" style={{
          width:34,height:34,borderRadius:8,
          background:"var(--bg-input)",border:"1px solid var(--border)",
          color:"var(--text-muted)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          {isDark?<Sun size={14}/>:<Moon size={14}/>}
        </button>

        {/* Notifications */}
        <div style={{position:"relative"}}>
          <IconBtn icon={Bell} badge={notifs.filter(n=>!n.read).length}
            active={notifOpen}
            onClick={()=>{setNotifOpen(p=>!p);setProfileOpen(false);}}
            title="Notifications"/>
          {notifOpen&&(
            <div className="scale-in" style={{
              position:"absolute",top:42,right:0,width:310,
              background:"var(--bg-card)",border:"1px solid var(--border)",
              borderRadius:14,boxShadow:"var(--shadow-lg)",overflow:"hidden",zIndex:200}}>
              <div style={{padding:"12px 16px",borderBottom:"1px solid var(--border)",
                display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:"0.88rem",fontWeight:600,color:"var(--text)"}}>Notifications</span>
                <span style={{fontSize:11,color:"var(--accent)",cursor:"pointer",fontWeight:600}}>Clear all</span>
              </div>
              <div style={{maxHeight:300,overflowY:"auto"}}>
                {notifs.map((n,i)=>(
                  <div key={i} style={{padding:"11px 16px",
                    borderBottom:i<notifs.length-1?"1px solid var(--border)":"none",
                    background:!n.read?"var(--accent-soft)":"transparent",
                    transition:"background .15s",cursor:"pointer"}}
                    onMouseEnter={e=>e.currentTarget.style.background="var(--bg-tag)"}
                    onMouseLeave={e=>e.currentTarget.style.background=!n.read?"var(--accent-soft)":"transparent"}>
                    <div style={{display:"flex",gap:9}}>
                      <div style={{width:7,height:7,borderRadius:"50%",flexShrink:0,marginTop:5,
                        background:n.read?"var(--border)":"var(--accent)"}}/>
                      <div>
                        <p style={{fontSize:"0.82rem",fontWeight:600,color:"var(--text)",marginBottom:2}}>{n.title}</p>
                        <p style={{fontSize:"0.78rem",color:"var(--text-muted)",lineHeight:1.5}}>{n.desc}</p>
                        <p style={{fontSize:"0.72rem",color:"var(--text-sub)",marginTop:3}}>{n.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div style={{position:"relative"}}>
          <button onClick={()=>{setProfileOpen(p=>!p);setNotifOpen(false);}}
            style={{display:"flex",alignItems:"center",gap:7,
              padding:"4px 9px 4px 4px",borderRadius:9,
              border:"1px solid var(--border)",background:"var(--bg-input)",
              cursor:"pointer",transition:"all .2s"}}
            onMouseEnter={e=>e.currentTarget.style.borderColor="var(--border-glow)"}
            onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border)"}>
            <div style={{width:24,height:24,borderRadius:7,
              background:"linear-gradient(135deg,#5b6af9,#a78bfa)",
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:10,fontWeight:700,color:"#fff"}}>{user?.name?.split(' ').map(n=>n[0]).join('') || 'G'}</div>
            <span style={{fontSize:"0.82rem",fontWeight:500,color:"var(--text)",whiteSpace:"nowrap"}}>{user?.name || 'Guest'}</span>

            <ChevronDown size={11} color="var(--text-muted)"/>
          </button>
          {profileOpen&&(
            <div className="scale-in" style={{
              position:"absolute",top:42,right:0,width:190,
              background:"var(--bg-card)",border:"1px solid var(--border)",
              borderRadius:12,boxShadow:"var(--shadow-lg)",overflow:"hidden",zIndex:200}}>
              <div style={{padding:"11px 14px",borderBottom:"1px solid var(--border)"}}>
                <p style={{fontSize:"0.85rem",fontWeight:600,color:"var(--text)"}}>{user?.name || 'Guest User'}</p>
                <p style={{fontSize:"0.78rem",color:"var(--text-muted)"}}>{user?.role || 'Guest'} account</p>
              </div>

              {[{icon:User,label:"Profile"},{icon:Settings,label:"Settings"}].map(item=>(
                <button key={item.label} style={{display:"flex",alignItems:"center",gap:9,
                  padding:"9px 14px",width:"100%",border:"none",
                  background:"transparent",color:"var(--text-muted)",fontSize:"0.82rem",
                  textAlign:"left",transition:"all .15s"}}
                  onMouseEnter={e=>{e.currentTarget.style.background="var(--bg-tag)";e.currentTarget.style.color="var(--text)";}}
                  onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color="var(--text-muted)";}}>
                  <item.icon size={13}/>{item.label}
                </button>
              ))}
              <div style={{height:1,background:"var(--border)"}}/>
              <button 
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
                style={{display:"flex",alignItems:"center",gap:9,
                padding:"9px 14px",width:"100%",border:"none",
                background:"transparent",color:"var(--red)",fontSize:"0.82rem",
                textAlign:"left",transition:"background .15s"}}
                onMouseEnter={e=>e.currentTarget.style.background="var(--red-soft)"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <LogOut size={13}/>Sign out
              </button>

            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// ─── UPLOAD ZONE ──────────────────────────────────────────────
function UploadZone({onUpload}) {
  const [dragging,setDragging]=useState(false);
  const inputRef=useRef(null);
  const handleDrop=useCallback(e=>{
    e.preventDefault();setDragging(false);
    const file=e.dataTransfer.files[0];
    if(file) onUpload?.(file);
  },[onUpload]);
  return (
    <div onDragOver={e=>{e.preventDefault();setDragging(true);}}
      onDragLeave={()=>setDragging(false)}
      onDrop={handleDrop}
      onClick={()=>inputRef.current?.click()}
      style={{border:`2px dashed ${dragging?"var(--accent)":"var(--border)"}`,
        borderRadius:14,padding:"28px 16px",
        background:dragging?"var(--accent-soft)":"var(--bg-card-2)",
        cursor:"pointer",textAlign:"center",transition:"all .25s ease",
        boxShadow:dragging?"0 0 28px var(--accent-glow)":"none"}}>
      <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" hidden
        onChange={e=>e.target.files[0]&&onUpload?.(e.target.files[0])}/>
      <div style={{width:40,height:40,borderRadius:10,
        background:"var(--accent-soft)",color:"var(--accent)",
        display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}>
        <Upload size={18}/>
      </div>
      <p style={{fontSize:"0.85rem",fontWeight:600,color:"var(--text)",marginBottom:4}}>
        {dragging?"Drop your file here":"Upload a dataset"}
      </p>
      <p style={{fontSize:"0.78rem",color:"var(--text-muted)",lineHeight:1.55}}>
        Drag & drop CSV or Excel
      </p>
      <div style={{display:"inline-flex",gap:5,marginTop:10,flexWrap:"wrap",justifyContent:"center"}}>
        {[".CSV",".XLSX",".XLS"].map(ext=>(
          <span key={ext} style={{padding:"2px 7px",borderRadius:5,
            background:"var(--bg-tag)",border:"1px solid var(--border)",
            fontSize:9,fontWeight:600,color:"var(--text-muted)",
            fontFamily:"'JetBrains Mono',monospace"}}>{ext}</span>
        ))}
      </div>
    </div>
  );
}

// ─── CHAT PREVIEW ─────────────────────────────────────────────
function ChatPreview() {
  const navigate = useNavigate();
  const [query,setQuery]=useState("");

  const starters=["Show me revenue by category","Why is Electronics growing fastest?","Compare Q3 vs Q4 sales"];
  return (
    <div style={{background:"var(--bg-card)",borderRadius:16,
      border:"1px solid var(--border)",boxShadow:"var(--shadow)",overflow:"hidden"}}>
      <div style={{padding:"14px 16px",borderBottom:"1px solid var(--border)",
        display:"flex",alignItems:"center",gap:9}}>
        <div style={{width:30,height:30,borderRadius:8,
          background:"var(--accent-soft)",color:"var(--accent)",
          display:"flex",alignItems:"center",justifyContent:"center"}}>
          <MessageSquare size={14}/>
        </div>
        <div>
          <p style={{fontSize:"0.85rem",fontWeight:600,color:"var(--text)"}}>AI Chat Assistant</p>
          <p style={{fontSize:"0.74rem",color:"var(--text-muted)"}}>Ask anything about your data</p>
        </div>
        <div style={{marginLeft:"auto"}}><IconBtn icon={Mic} title="Voice input"/></div>
      </div>
      <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:6}}>
        {starters.map((s,i)=>(
          <button key={i} onClick={()=>setQuery(s)} style={{
            padding:"7px 10px",borderRadius:8,
            background:"var(--bg-input)",border:"1px solid var(--border)",
            color:"var(--text-muted)",fontSize:"0.78rem",textAlign:"left",
            cursor:"pointer",transition:"all .2s"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--border-glow)";e.currentTarget.style.color="var(--accent)";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--text-muted)";}}>
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:"0.76rem"}}>"{s}"</span>
          </button>
        ))}
      </div>
      <div style={{padding:"0 12px 12px"}}>
        <div style={{display:"flex",gap:7,background:"var(--bg-input)",
          border:"1px solid var(--border)",borderRadius:9,padding:"7px 10px",transition:"border-color .2s"}}
          onFocusCapture={e=>e.currentTarget.style.borderColor="var(--border-glow)"}
          onBlurCapture={e=>e.currentTarget.style.borderColor="var(--border)"}>
          <input value={query} onChange={e=>setQuery(e.target.value)}
            placeholder="Ask a business question..."
            style={{flex:1,background:"transparent",border:"none",outline:"none",
              fontSize:"0.80rem",color:"var(--text)"}}/>
          <button onClick={() => navigate("/chat")} style={{
            background:"var(--accent)",border:"none",borderRadius:6,
            padding:"3px 9px",color:"#fff",fontSize:"0.78rem",fontWeight:600,cursor:"pointer"}}>
            Ask
          </button>

        </div>
      </div>
    </div>
  );
}

// ─── OVERVIEW PAGE ────────────────────────────────────────────
function OverviewPage({loading}) {
  const [chartTab,setChartTab]=useState("revenue");
  const { user } = useAuth();
  const [greeting, setGreeting] = useState("Good morning");

  useEffect(() => {
    const h = new Date().getHours();
    if (h >= 12 && h < 17) setGreeting("Good afternoon");
    else if (h >= 17) setGreeting("Good evening");
  }, []);

  const kpis=[
    {icon:Users,      label:"Total Users",   value:"12,847",change:"+18.2%",up:true, color:"#5b6af9",colorSoft:"var(--accent-soft)"},
    {icon:Zap,        label:"Queries Today", value:"4,218", change:"+9.4%", up:true, color:"#f5a623",colorSoft:"var(--amber-soft)"},
    {icon:TrendingUp, label:"Total Revenue", value:"$118K", change:"+13.6%",up:true, color:"#2dd4a0",colorSoft:"var(--green-soft)"},
    {icon:Shield,     label:"System Health", value:"98.4%", change:"-0.2%", up:false,color:"#38bdf8",colorSoft:"rgba(56,189,248,0.12)"},
  ];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{fontFamily:"'DM Serif Display',serif",fontWeight:400,
            fontSize:"1.5rem",letterSpacing:"-0.02em",color:"var(--text)"}}>
            {greeting}, {user?.name || "Guest"}
          </h2>
          <p style={{fontSize:"0.82rem",color:"var(--text-muted)",marginTop:3}}>
            Sales Dataset 2023 · 50,000 rows · Last synced 2 minutes ago
          </p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button style={{display:"flex",alignItems:"center",gap:6,padding:"7px 13px",
            borderRadius:8,border:"1px solid var(--border)",
            background:"var(--bg-card)",color:"var(--text-muted)",fontSize:"0.82rem",transition:"all .2s"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--border-glow)";e.currentTarget.style.color="var(--accent)";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--text-muted)";}}>
            <Calendar size={13}/>Last 12 months
          </button>
          <button style={{display:"flex",alignItems:"center",gap:6,padding:"7px 13px",
            borderRadius:8,border:"none",background:"var(--accent)",color:"#fff",fontSize:"0.82rem",fontWeight:600}}>
            <Download size={13}/>Export
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}} className="mobile-2col">
        {kpis.map((k,i)=><KPICard key={i} {...k} loading={loading} delay={i*70}/>)}
      </div>

      {/* Row 1: area + pie */}
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16}} className="mobile-stack">
        <div className="card-in" style={{background:"var(--bg-card)",borderRadius:16,padding:"22px",
          border:"1px solid var(--border)",boxShadow:"var(--shadow)",animationDelay:"280ms"}}>
          <CardHeader title="Performance Trends" subtitle="12-month overview"
            action={
              <div style={{display:"flex",gap:2,background:"var(--bg-input)",borderRadius:8,padding:3}}>
                {["revenue","queries","users"].map(tab=>(
                  <button key={tab} onClick={()=>setChartTab(tab)} style={{
                    padding:"4px 9px",borderRadius:6,border:"none",
                    background:chartTab===tab?"var(--bg-card)":"transparent",
                    color:chartTab===tab?"var(--accent)":"var(--text-muted)",
                    fontSize:11,fontWeight:chartTab===tab?600:400,
                    boxShadow:chartTab===tab?"var(--shadow)":"none",
                    transition:"all .2s",textTransform:"capitalize",cursor:"pointer"}}>
                    {tab}
                  </button>
                ))}
              </div>
            }
          />
          {loading?<Skeleton h={200} r={8}/>:(
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={revenueData} margin={{top:5,right:5,left:0,bottom:0}}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#5b6af9" stopOpacity={0.28}/>
                    <stop offset="95%" stopColor="#5b6af9" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                <XAxis dataKey="month" tick={{fill:"var(--text-muted)",fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:"var(--text-muted)",fontSize:10}} axisLine={false} tickLine={false}
                  tickFormatter={v=>chartTab==="revenue"?`$${v/1000}K`:v}/>
                <Tooltip content={<ChartTip prefix={chartTab==="revenue"?"$":""}/>}/>
                <Area type="monotone" dataKey={chartTab} stroke="#5b6af9" strokeWidth={2.5}
                  fill="url(#g1)" dot={false} activeDot={{r:4,fill:"#5b6af9"}}/>
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card-in" style={{background:"var(--bg-card)",borderRadius:16,padding:"22px",
          border:"1px solid var(--border)",boxShadow:"var(--shadow)",animationDelay:"360ms"}}>
          <CardHeader title="Regional Split" subtitle="Revenue share"/>
          {loading?<Skeleton h={160} r={8}/>:(
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={regionData} cx="50%" cy="50%"
                    innerRadius={40} outerRadius={64} paddingAngle={3} dataKey="value">
                    {regionData.map((e,i)=><Cell key={i} fill={e.color}/>)}
                  </Pie>
                  <Tooltip content={<ChartTip prefix="" suffix="%"/>}/>
                </PieChart>
              </ResponsiveContainer>
              <div style={{display:"flex",flexDirection:"column",gap:7,marginTop:6}}>
                {regionData.map((r,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <div style={{width:8,height:8,borderRadius:2,background:r.color}}/>
                      <span style={{fontSize:11,color:"var(--text-muted)"}}>{r.name}</span>
                    </div>
                    <span style={{fontSize:11,fontWeight:600,color:"var(--text)"}}>{r.value}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Row 2: bar + line */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}} className="mobile-stack">
        <div className="card-in" style={{background:"var(--bg-card)",borderRadius:16,padding:"22px",
          border:"1px solid var(--border)",boxShadow:"var(--shadow)",animationDelay:"440ms"}}>
          <CardHeader title="Revenue by Category" subtitle="Current vs previous"/>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={categoryData} margin={{top:5,right:5,left:-20,bottom:0}} barCategoryGap="28%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
              <XAxis dataKey="name" tick={{fill:"var(--text-muted)",fontSize:9}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:"var(--text-muted)",fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v/1000}K`}/>
              <Tooltip content={<ChartTip/>}/>
              <Bar dataKey="prev"  name="Previous" fill="var(--border)" radius={[3,3,0,0]}/>
              <Bar dataKey="value" name="Current"  fill="#5b6af9"       radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card-in" style={{background:"var(--bg-card)",borderRadius:16,padding:"22px",
          border:"1px solid var(--border)",boxShadow:"var(--shadow)",animationDelay:"520ms"}}>
          <CardHeader title="Weekly Sessions" subtitle="Sessions & bounce rate"/>
          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={weeklyData} margin={{top:5,right:5,left:-20,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
              <XAxis dataKey="day" tick={{fill:"var(--text-muted)",fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:"var(--text-muted)",fontSize:10}} axisLine={false} tickLine={false}/>
              <Tooltip content={<ChartTip prefix=""/>}/>
              <Legend wrapperStyle={{fontSize:10,color:"var(--text-muted)"}}/>
              <Line type="monotone" dataKey="sessions" stroke="#2dd4a0" strokeWidth={2.5} dot={false} activeDot={{r:4}}/>
              <Line type="monotone" dataKey="bounce"   stroke="#f5a623" strokeWidth={2}   dot={false} activeDot={{r:4}} strokeDasharray="4 2"/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 3: upload + chat + activity */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}} className="mobile-stack">
        <div className="card-in" style={{animationDelay:"600ms"}}>
          <div style={{background:"var(--bg-card)",borderRadius:16,padding:"18px 18px 0",
            border:"1px solid var(--border)"}}>
            <CardHeader title="New Dataset" subtitle="Analyze new data"/>
          </div>
          <div style={{background:"var(--bg-card)",borderRadius:"0 0 16px 16px",padding:"0 18px 18px",
            border:"1px solid var(--border)",borderTop:"none"}}>
            <UploadZone/>
          </div>
        </div>
        <div className="card-in" style={{animationDelay:"660ms"}}><ChatPreview/></div>
        <div className="card-in" style={{background:"var(--bg-card)",borderRadius:16,padding:"22px",
          border:"1px solid var(--border)",boxShadow:"var(--shadow)",animationDelay:"720ms"}}>
          <CardHeader title="Activity Feed" subtitle="Real-time events"
            action={<span style={{fontSize:11,color:"var(--accent)",cursor:"pointer"}}>View all →</span>}/>
          <div style={{display:"flex",flexDirection:"column",gap:0}}>
            {activityFeed.map((item,i)=>{
              const Icon=item.icon;
              return (
                <div key={item.id} style={{display:"flex",gap:10,padding:"9px 0",
                  borderBottom:i<activityFeed.length-1?"1px solid var(--border)":"none"}}>
                  <div style={{width:26,height:26,borderRadius:7,flexShrink:0,
                    background:item.color+"1a",color:item.color,
                    display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <Icon size={12}/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:"0.78rem",color:"var(--text)",lineHeight:1.45,
                      whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                      <span style={{fontWeight:600}}>{item.user}</span> {item.action}
                    </p>
                    <p style={{fontSize:"0.72rem",color:"var(--text-sub)",marginTop:1}}>{item.time}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pipeline */}
      <div className="card-in" style={{background:"var(--bg-card)",borderRadius:16,padding:"22px",
        border:"1px solid var(--border)",boxShadow:"var(--shadow)",animationDelay:"800ms"}}>
        <CardHeader title="Data Pipelines" subtitle="Sync status and health"
          action={<button style={{display:"flex",alignItems:"center",gap:5,padding:"5px 10px",
            borderRadius:7,border:"1px solid var(--border)",background:"transparent",
            color:"var(--text-muted)",fontSize:11,cursor:"pointer"}}>
            <Plus size={11}/>Add Source
          </button>}/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}} className="mobile-2col">
          {pipelineItems.map((p,i)=>(
            <div key={i} style={{padding:"13px",borderRadius:11,
              background:"var(--bg-input)",border:"1px solid var(--border)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:9}}>
                <div style={{width:28,height:28,borderRadius:7,
                  background:"var(--bg-tag)",border:"1px solid var(--border)",
                  display:"flex",alignItems:"center",justifyContent:"center",color:"var(--accent)"}}>
                  <Database size={12}/>
                </div>
                <Badge status={p.status}/>
              </div>
              <p style={{fontSize:"0.80rem",fontWeight:600,color:"var(--text)",marginBottom:3}}>{p.name}</p>
              <div style={{height:4,borderRadius:2,background:"var(--border)",marginBottom:4,overflow:"hidden"}}>
                <div style={{height:"100%",borderRadius:2,transition:"width 1s ease",
                  width:`${p.health}%`,
                  background:p.health>80?"var(--green)":p.health>50?"var(--amber)":"var(--red)"}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{fontSize:10,color:"var(--text-muted)"}}>{p.rows} rows</span>
                <span style={{fontSize:10,color:"var(--text-sub)"}}>{p.sync}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent queries table */}
      <div className="card-in" style={{background:"var(--bg-card)",borderRadius:16,
        border:"1px solid var(--border)",boxShadow:"var(--shadow)",
        animationDelay:"860ms",overflow:"hidden"}}>
        <div style={{padding:"18px 22px 10px"}}>
          <CardHeader title="Recent Queries" subtitle="Your latest chart and chat interactions"/>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{borderBottom:"1px solid var(--border)",background:"var(--bg-input)"}}>
                {["Query","Type","Charts","Time","Action"].map(h=>(
                  <th key={h} style={{padding:"9px 22px",textAlign:"left",fontSize:10,
                    fontWeight:700,color:"var(--text-muted)",letterSpacing:"0.08em",
                    textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentQueries.map((q,i)=>(
                <tr key={q.id} className="hover-row"
                  style={{borderBottom:i<recentQueries.length-1?"1px solid var(--border)":"none"}}>
                  <td style={{padding:"11px 22px"}}>
                    <span style={{fontSize:"0.80rem",color:"var(--text)",
                      fontFamily:"'JetBrains Mono',monospace"}}>"{q.prompt}"</span>
                  </td>
                  <td style={{padding:"11px 22px"}}><Badge status={q.type}/></td>
                  <td style={{padding:"11px 22px"}}>
                    <span style={{fontSize:"0.80rem",color:"var(--text-muted)"}}>{q.charts>0?q.charts:"—"}</span>
                  </td>
                  <td style={{padding:"11px 22px"}}>
                    <span style={{fontSize:"0.76rem",color:"var(--text-sub)",
                      fontFamily:"'JetBrains Mono',monospace"}}>{q.time}</span>
                  </td>
                  <td style={{padding:"11px 22px"}}>
                    <button style={{display:"flex",alignItems:"center",gap:4,padding:"4px 9px",
                      borderRadius:6,border:"1px solid var(--border)",
                      background:"transparent",color:"var(--text-muted)",fontSize:11,cursor:"pointer",
                      transition:"all .2s"}}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--border-glow)";e.currentTarget.style.color="var(--accent)";}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--text-muted)";}}>
                      <Eye size={11}/>View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── COMING SOON ──────────────────────────────────────────────
function ComingSoon({title,icon:Icon}) {
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",
      justifyContent:"center",height:"60vh",gap:14,textAlign:"center"}}>
      <div style={{width:60,height:60,borderRadius:16,
        background:"var(--accent-soft)",border:"1px solid var(--border-glow)",
        display:"flex",alignItems:"center",justifyContent:"center",color:"var(--accent)"}}>
        <Icon size={26}/>
      </div>
      <h2 style={{fontFamily:"'DM Serif Display',serif",fontWeight:400,
        fontSize:"1.4rem",color:"var(--text)"}}>{title}</h2>
      <p style={{fontSize:"0.85rem",color:"var(--text-muted)",maxWidth:300,lineHeight:1.65}}>
        This module is under active development and will be available in the next release.
      </p>
      <div style={{padding:"5px 14px",borderRadius:20,
        background:"var(--amber-soft)",border:"1px solid var(--amber-soft)",
        color:"var(--amber)",fontSize:11,fontWeight:600}}>Coming Soon</div>
    </div>
  );
}

// ─── ROOT COMPONENT ───────────────────────────────────────────
export default function Dashboard({onNavigateToLanding}) {
  const [isDark,setIsDark]             = useState(true);
  const [collapsed,setCollapsed]       = useState(false);
  const [activePage,setActivePage]     = useState("overview");
  const [notifOpen,setNotifOpen]       = useState(false);
  const [profileOpen,setProfileOpen]   = useState(false);
  const [loading,setLoading]           = useState(true);

  useEffect(()=>{ applyDashTheme(isDark); },[isDark]);
  useEffect(()=>{ const t=setTimeout(()=>setLoading(false),1800); return ()=>clearTimeout(t); },[]);
  useEffect(()=>{
    const h=()=>{ setNotifOpen(false); setProfileOpen(false); };
    document.addEventListener("click",h);
    return ()=>document.removeEventListener("click",h);
  },[]);

  const pageMap = {
    overview:  <OverviewPage loading={loading}/>,
    analytics: <ComingSoon title="Analytics Deep-Dive" icon={BarChart2}/>,
    datasets:  <ComingSoon title="Dataset Manager"     icon={Database}/>,
    chat:      <ComingSoon title="AI Chat Assistant"   icon={MessageSquare}/>,
    insights:  <ComingSoon title="AI Insights"         icon={Lightbulb}/>,
    reports:   <ComingSoon title="PDF Reports"         icon={FileText}/>,
    alerts:    <ComingSoon title="Alerts & Monitoring" icon={Bell}/>,
    settings:  <ComingSoon title="Settings"            icon={Settings}/>,
  };

  return (
    <>
      <DashStyleInjector/>
      <div style={{display:"flex",height:"100vh",overflow:"hidden",
        background:"var(--bg)",color:"var(--text)",
        fontFamily:"'DM Sans',sans-serif",
        transition:"background .4s ease,color .4s ease"}}>
        <Sidebar collapsed={collapsed} onToggle={()=>setCollapsed(p=>!p)}
          activePage={activePage} setActivePage={setActivePage}/>
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div onClick={e=>e.stopPropagation()}>
            <TopNav isDark={isDark} onToggle={()=>setIsDark(p=>!p)}
              notifOpen={notifOpen} setNotifOpen={v=>{setNotifOpen(v);if(v)setProfileOpen(false);}}
              profileOpen={profileOpen} setProfileOpen={v=>{setProfileOpen(v);if(v)setNotifOpen(false);}}
              activePage={activePage}/>
          </div>
          <main onClick={()=>{setNotifOpen(false);setProfileOpen(false);}}
            style={{flex:1,overflowY:"auto",overflowX:"hidden",
              padding:"22px clamp(14px,2.5vw,28px)"}}>
            {pageMap[activePage]||pageMap.overview}
            <div style={{height:20}}/>
          </main>
        </div>
      </div>
    </>
  );
}
