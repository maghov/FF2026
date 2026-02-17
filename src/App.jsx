import { useState } from "react";
import MyTeam from "./components/MyTeam";
import PointsPerformance from "./components/PointsPerformance";
import TradeAnalyzer from "./components/TradeAnalyzer";
import Fixtures from "./components/Fixtures";
import AdminPage from "./components/AdminPage";
import LoginPage from "./components/auth/LoginPage";
import { AuthProvider, useAuth } from "./context/AuthContext";
import "./App.css";

const TABS = [
  { id: "team", label: "My Team", icon: "shield" },
  { id: "points", label: "Points", icon: "chart" },
  { id: "trade", label: "Trade Analyzer", icon: "swap" },
  { id: "fixtures", label: "Fixtures", icon: "calendar" },
];

const ADMIN_TAB = { id: "admin", label: "Admin", icon: "admin" };

const iconMap = {
  shield: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  chart: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  swap: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
    </svg>
  ),
  calendar: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  admin: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15c-3.87 0-7 1.57-7 3.5V21h14v-2.5c0-1.93-3.13-3.5-7-3.5z"/><circle cx="12" cy="8" r="4"/><path d="M19 8l1.5 1.5L22 8"/>
    </svg>
  ),
};

function Dashboard() {
  const { user, isAdmin, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("team");

  const tabs = isAdmin ? [...TABS, ADMIN_TAB] : TABS;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="brand">
            <div className="brand-icon">FF</div>
            <div>
              <h1>My Football Fantasy</h1>
              <p className="subtitle">Season 2025/26</p>
            </div>
          </div>
          <nav className="nav-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`nav-tab ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {iconMap[tab.icon]}
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
          <div className="user-info">
            <span className="user-name">{user.displayName}</span>
            <button className="btn btn-secondary" onClick={logout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        {activeTab === "team" && <MyTeam />}
        {activeTab === "points" && <PointsPerformance />}
        {activeTab === "trade" && <TradeAnalyzer />}
        {activeTab === "fixtures" && <Fixtures />}
        {activeTab === "admin" && isAdmin && <AdminPage />}
      </main>
    </div>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  return user ? <Dashboard /> : <LoginPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
