import { useState } from "react";
import MyTeam from "./components/MyTeam";
import PointsPerformance from "./components/PointsPerformance";
import TradeAnalyzer from "./components/TradeAnalyzer";
import Fixtures from "./components/Fixtures";
import Formation from "./components/Formation";
import UserPortal from "./components/portal/UserPortal";
import "./App.css";

const TABS = [
  { id: "team", label: "My Team", icon: "shield" },
  { id: "formation", label: "Formation", icon: "formation" },
  { id: "points", label: "Points", icon: "chart" },
  { id: "trade", label: "Trade Analyzer", icon: "swap" },
  { id: "fixtures", label: "Fixtures", icon: "calendar" },
];

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
  formation: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2"/><circle cx="12" cy="5" r="1.5" fill="currentColor"/><circle cx="7" cy="10" r="1.5" fill="currentColor"/><circle cx="17" cy="10" r="1.5" fill="currentColor"/><circle cx="8" cy="16" r="1.5" fill="currentColor"/><circle cx="16" cy="16" r="1.5" fill="currentColor"/><circle cx="12" cy="21" r="1.5" fill="currentColor"/>
    </svg>
  ),
};

export default function App() {
  const [activeTab, setActiveTab] = useState("team");
  const [currentView, setCurrentView] = useState("ff");

  if (currentView === "portal") {
    return <UserPortal onBack={() => setCurrentView("ff")} />;
  }

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
            {TABS.map((tab) => (
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
          <button
            className="btn btn-primary"
            onClick={() => setCurrentView("portal")}
          >
            User Portal
          </button>
        </div>
      </header>

      <main className="app-main">
        {activeTab === "team" && <MyTeam />}
        {activeTab === "formation" && <Formation />}
        {activeTab === "points" && <PointsPerformance />}
        {activeTab === "trade" && <TradeAnalyzer />}
        {activeTab === "fixtures" && <Fixtures />}
      </main>
    </div>
  );
}
