import { useState } from "react";
import { useApi } from "../hooks/useApi";
import { fetchUpcomingFixtures } from "../services/api";
import LoadingSpinner from "./LoadingSpinner";
import ErrorMessage from "./ErrorMessage";
import "./Fixtures.css";

function formatDeadline(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatKickoff(iso) {
  if (!iso) return "TBD";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MatchRow({ match }) {
  return (
    <div className="match-row">
      <div className="match-team home">
        <span className="team-full">{match.homeTeam}</span>
        <span className="team-short">{match.homeShort}</span>
        <span className={`fdr-badge fdr-${match.homeDifficulty}`}>
          {match.homeDifficulty}
        </span>
      </div>
      <div className="match-vs">vs</div>
      <div className="match-team away">
        <span className={`fdr-badge fdr-${match.awayDifficulty}`}>
          {match.awayDifficulty}
        </span>
        <span className="team-full">{match.awayTeam}</span>
        <span className="team-short">{match.awayShort}</span>
      </div>
      <div className="match-kickoff">{formatKickoff(match.kickoff)}</div>
    </div>
  );
}

function GameweekCard({ gw, isActive, onToggle }) {
  return (
    <div className={`gw-card ${isActive ? "expanded" : ""}`}>
      <button className="gw-card-header" onClick={onToggle}>
        <div className="gw-title">
          <span className="gw-number">GW{gw.gw}</span>
          <span className="gw-match-count">
            {gw.matches.length} match{gw.matches.length !== 1 ? "es" : ""}
          </span>
        </div>
        <div className="gw-meta">
          {gw.deadline && (
            <span className="gw-deadline">
              Deadline: {formatDeadline(gw.deadline)}
            </span>
          )}
          <span className={`gw-chevron ${isActive ? "open" : ""}`}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </div>
      </button>
      {isActive && (
        <div className="gw-matches">
          {gw.matches.map((m) => (
            <MatchRow key={m.id} match={m} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Fixtures() {
  const { data, loading, error, reload } = useApi(fetchUpcomingFixtures);
  const [openGw, setOpenGw] = useState(null);

  if (loading) return <LoadingSpinner message="Loading fixtures..." />;
  if (error) return <ErrorMessage message={error} onRetry={reload} />;

  // Auto-open the first GW on load
  const activeGw = openGw ?? data[0]?.gw;

  return (
    <div className="fixtures">
      <div className="fixtures-header">
        <h3>Upcoming Fixtures</h3>
        <div className="fdr-legend">
          <span className="legend-label">FDR:</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} className={`fdr-badge fdr-${n}`}>
              {n}
            </span>
          ))}
        </div>
      </div>
      <div className="gw-list">
        {data.map((gw) => (
          <GameweekCard
            key={gw.gw}
            gw={gw}
            isActive={activeGw === gw.gw}
            onToggle={() =>
              setOpenGw(activeGw === gw.gw ? null : gw.gw)
            }
          />
        ))}
      </div>
    </div>
  );
}
