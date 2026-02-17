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

function PickCard({ pick }) {
  return (
    <div className="pick-card">
      <div className="pick-top">
        <span className={`pick-pos position-badge position-${pick.position}`}>
          {pick.position}
        </span>
        <span className="pick-price">£{pick.price}m</span>
      </div>
      <div className="pick-name">{pick.name}</div>
      <div className="pick-club">{pick.club}</div>
      <div className="pick-details">
        <div className="pick-stat">
          <span className="pick-stat-value">{pick.form}</span>
          <span className="pick-stat-label">Form</span>
        </div>
        <div className="pick-stat">
          <span className="pick-stat-value">{pick.totalPoints}</span>
          <span className="pick-stat-label">Pts</span>
        </div>
        <div className="pick-stat">
          <span className={`pick-stat-value fixture-badge fdr-${pick.difficulty}`}>
            {pick.opponent}
          </span>
          <span className="pick-stat-label">Fix</span>
        </div>
      </div>
    </div>
  );
}

function RecommendedPicks({ picks }) {
  if (!picks || picks.length === 0) return null;
  return (
    <div className="picks-section">
      <div className="picks-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
        <span>Recommended Picks</span>
      </div>
      <div className="picks-grid">
        {picks.map((p) => (
          <PickCard key={p.id} pick={p} />
        ))}
      </div>
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
        <>
          <div className="gw-matches">
            {gw.matches.map((m) => (
              <MatchRow key={m.id} match={m} />
            ))}
          </div>
          <RecommendedPicks picks={gw.picks} />
        </>
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
