import { useState } from "react";
import { useApi } from "../hooks/useApi";
import { fetchMyTeam } from "../services/api";
import LoadingSpinner from "./LoadingSpinner";
import ErrorMessage from "./ErrorMessage";
import "./Formation.css";

function detectFormation(players) {
  const counts = { DEF: 0, MID: 0, FWD: 0 };
  for (const p of players) {
    if (counts[p.position] !== undefined) counts[p.position]++;
  }
  return `${counts.DEF}-${counts.MID}-${counts.FWD}`;
}

function groupByPosition(players) {
  const groups = { GKP: [], DEF: [], MID: [], FWD: [] };
  for (const p of players) {
    groups[p.position]?.push(p);
  }
  return groups;
}

function PitchPlayer({ player, isSelected, onSelect }) {
  return (
    <div
      className={`pitch-player ${isSelected ? "selected" : ""}`}
      onClick={() => onSelect(player)}
    >
      <div className={`pitch-shirt position-shirt-${player.position}`}>
        {player.isCaptain && <span className="pitch-armband">C</span>}
        {player.isViceCaptain && <span className="pitch-armband vc">V</span>}
      </div>
      <div className="pitch-player-name">{player.name}</div>
      <div className="pitch-player-pts">{player.gameweekPoints} pts</div>
    </div>
  );
}

function PlayerDetail({ player, onClose }) {
  if (!player) return null;
  const formColor =
    player.form >= 7 ? "positive" : player.form <= 4 ? "negative" : "";

  return (
    <div className="formation-detail">
      <div className="formation-detail-header">
        <div>
          <span className={`position-badge position-${player.position}`}>
            {player.position}
          </span>
          <span className="detail-player-name">{player.name}</span>
          {player.isCaptain && <span className="badge captain">C</span>}
          {player.isViceCaptain && <span className="badge vice-captain">V</span>}
        </div>
        <button className="detail-close" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div className="detail-club">{player.club}</div>
      <div className="detail-stats-grid">
        <div className="detail-stat">
          <span className="detail-stat-value highlight">{player.gameweekPoints}</span>
          <span className="detail-stat-label">GW Pts</span>
        </div>
        <div className="detail-stat">
          <span className="detail-stat-value">{player.totalPoints}</span>
          <span className="detail-stat-label">Total</span>
        </div>
        <div className="detail-stat">
          <span className={`detail-stat-value ${formColor}`}>{player.form}</span>
          <span className="detail-stat-label">Form</span>
        </div>
        <div className="detail-stat">
          <span className="detail-stat-value">&pound;{player.price}m</span>
          <span className="detail-stat-label">Price</span>
        </div>
      </div>
      {player.upcomingFixtures?.length > 0 && (
        <div className="detail-fixtures">
          <div className="detail-fixtures-label">Upcoming</div>
          <div className="detail-fixture-chips">
            {player.upcomingFixtures.slice(0, 5).map((f) => (
              <span key={f.gw} className={`detail-fixture-chip fdr-${f.difficulty}`}>
                {f.opponent}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Formation() {
  const { data, loading, error, reload } = useApi(fetchMyTeam);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  if (loading) return <LoadingSpinner message="Loading formation..." />;
  if (error) return <ErrorMessage message={error} onRetry={reload} />;

  const { players, summary } = data;
  const formation = detectFormation(players);
  const groups = groupByPosition(players);

  return (
    <div className="formation-view">
      <div className="formation-header">
        <h3>Formation &mdash; {formation}</h3>
        <span className="formation-gw">GW{summary.currentGameweek}</span>
      </div>

      <div className="pitch">
        <div className="pitch-surface">
          {/* Pitch markings */}
          <div className="pitch-marking center-circle" />
          <div className="pitch-marking center-line" />
          <div className="pitch-marking penalty-box top" />
          <div className="pitch-marking penalty-box bottom" />

          {/* Rows */}
          <div className="pitch-row fwd-row">
            {groups.FWD.map((p) => (
              <PitchPlayer
                key={p.id}
                player={p}
                isSelected={selectedPlayer?.id === p.id}
                onSelect={setSelectedPlayer}
              />
            ))}
          </div>
          <div className="pitch-row mid-row">
            {groups.MID.map((p) => (
              <PitchPlayer
                key={p.id}
                player={p}
                isSelected={selectedPlayer?.id === p.id}
                onSelect={setSelectedPlayer}
              />
            ))}
          </div>
          <div className="pitch-row def-row">
            {groups.DEF.map((p) => (
              <PitchPlayer
                key={p.id}
                player={p}
                isSelected={selectedPlayer?.id === p.id}
                onSelect={setSelectedPlayer}
              />
            ))}
          </div>
          <div className="pitch-row gk-row">
            {groups.GKP.map((p) => (
              <PitchPlayer
                key={p.id}
                player={p}
                isSelected={selectedPlayer?.id === p.id}
                onSelect={setSelectedPlayer}
              />
            ))}
          </div>
        </div>
      </div>

      <PlayerDetail
        player={selectedPlayer}
        onClose={() => setSelectedPlayer(null)}
      />
    </div>
  );
}
