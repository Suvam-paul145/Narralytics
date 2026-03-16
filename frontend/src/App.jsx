import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import Reports from "./pages/Reports";
import SystemStatus from "./pages/SystemStatus";
import { AuthProvider, useAuth } from "./context/AuthContext";
import HealthStatus from "./components/common/HealthStatus";

// Protected Route Wrapper
function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

// Wrapper for Landing to include navigation
function LandingPage() {
  const navigate = useNavigate();
  return <Landing onGetStarted={() => navigate("/login")} />;
}


function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        {/* Health status indicator - always visible in top right */}
        <div className="fixed top-4 right-4 z-50">
          <HealthStatus />
        </div>
        
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/system-status" element={<ProtectedRoute><SystemStatus /></ProtectedRoute>} />
          {/* Catch-all redirect to dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

