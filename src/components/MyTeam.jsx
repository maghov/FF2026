import { useState } from "react";
import LoadingSpinner from "./LoadingSpinner";
import ErrorMessage from "./ErrorMessage";
import "./MyTeam.css";

const positionOrder = { GKP: 0, DEF: 1, MID: 2, FWD: 3 };

function PlayerCard({ player, isExpanded, onToggle }) {
  const formColor =
    player.form >= 7 ? "positive" : player.form <= 4 ? "negative" : "";
  const fixtures = player.upcomingFixtures || [];

  return (
    <div
      className={`player-card ${isExpanded ? "expanded" : ""}`}
      onClick={onToggle}
    >
      <div className="player-card-header">
        <span className={`position-badge position-${player.position}`}>
          {player.position}
        </span>
        <span className="player-club">{player.clubShort}</span>
        {player.isCaptain && <span className="badge captain">C</span>}
        {player.isViceCaptain && <span className="badge vice-captain">V</span>}
      </div>
      <div className="player-name">{player.name}</div>
      <div className="player-club-full">{player.club}</div>
      <div className="player-stats">
        <div className="stat">
          <span className="stat-label">Price</span>
          <span className="stat-value">&pound;{player.price}m</span>
        </div>
        <div className="stat">
          <span className="stat-label">Points</span>
          <span className="stat-value">{player.totalPoints}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Form</span>
          <span className={`stat-value ${formColor}`}>{player.form}</span>
        </div>
        <div className="stat">
          <span className="stat-label">GW Pts</span>
          <span className="stat-value highlight">{player.gameweekPoints}</span>
        </div>
      </div>
      <div className="player-fixture">
        <span className="fixture-label">Next:</span>
        <span className={`fixture-value fdr-${player.fixtureDifficulty}`}>
          {player.upcomingFixture}
        </span>
        <span className={`expand-arrow ${isExpanded ? "open" : ""}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </div>

      {isExpanded && (
        <div className="player-expanded" onClick={(e) => e.stopPropagation()}>
          {fixtures.length > 0 && (
            <div className="expanded-fixtures">
              <div className="expanded-section-title">Upcoming Fixtures</div>
              <div className="expanded-fixture-list">
                {fixtures.map((f) => (
                  <div key={f.gw} className="expanded-fixture-row">
                    <span className="ef-gw">GW{f.gw}</span>
                    <span className={`ef-opponent fdr-${f.difficulty}`}>
                      {f.opponent}
                    </span>
                    <span className="ef-diff-dots">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <span
                          key={n}
                          className={`ef-dot ${n <= f.difficulty ? "filled" : ""}`}
                        />
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="expanded-stats">
            <div className="expanded-section-title">Season Stats</div>
            <div className="expanded-stats-grid">
              <div className="es-item">
                <span className="es-value">{player.totalPoints}</span>
                <span className="es-label">Total Pts</span>
              </div>
              <div className="es-item">
                <span className="es-value">{player.gameweekPoints}</span>
                <span className="es-label">GW Pts</span>
              </div>
              <div className="es-item">
                <span className={`es-value ${formColor}`}>{player.form}</span>
                <span className="es-label">Form</span>
              </div>
              <div className="es-item">
                <span className="es-value">&pound;{player.price}m</span>
                <span className="es-label">Price</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TeamSummaryCard({ summary }) {
  return (
    <div className="team-summary">
      <h3>Team Summary &mdash; GW{summary.currentGameweek}</h3>
      <div className="summary-grid">
        <div className="summary-item featured">
          <span className="summary-value">{summary.gameweekPoints}</span>
          <span className="summary-label">GW Points</span>
        </div>
        <div className="summary-item">
          <span className="summary-value">{summary.totalPoints}</span>
          <span className="summary-label">Total Points</span>
        </div>
        <div className="summary-item">
          <span className="summary-value">&pound;{summary.teamValue}m</span>
          <span className="summary-label">Team Value</span>
        </div>
        <div className="summary-item">
          <span className="summary-value">&pound;{summary.moneyInBank}m</span>
          <span className="summary-label">In Bank</span>
        </div>
        <div className="summary-item">
          <span className="summary-value">
            {summary.overallRank.toLocaleString()}
          </span>
          <span className="summary-label">Overall Rank</span>
        </div>
        <div className="summary-item">
          <span className="summary-value">
            {summary.transfers.available}
          </span>
          <span className="summary-label">Free Transfers</span>
        </div>
      </div>
      <div className="chips-section">
        <span className="chips-label">Chips Available:</span>
        <div className="chips-list">
          {summary.chips.wildcard && <span className="chip available">Wildcard</span>}
          {summary.chips.benchBoost && <span className="chip available">Bench Boost</span>}
          {summary.chips.tripleCaptain && <span className="chip available">Triple Captain</span>}
          {summary.chips.freeHit && <span className="chip available">Free Hit</span>}
          {!summary.chips.tripleCaptain && <span className="chip used">Triple Captain</span>}
        </div>
      </div>
    </div>
  );
}

export default function MyTeam({ teamData, teamLoading, teamError, teamReload }) {
  const [expandedId, setExpandedId] = useState(null);

  if (teamLoading) return <LoadingSpinner message="Loading your team..." />;
  if (teamError) return <ErrorMessage message={teamError} onRetry={teamReload} />;

  const { players, summary } = teamData;
  const sorted = [...players].sort(
    (a, b) => positionOrder[a.position] - positionOrder[b.position]
  );

  return (
    <div className="my-team">
      <TeamSummaryCard summary={summary} />
      <div className="players-section">
        <h3>Your Squad</h3>
        <div className="players-grid">
          {sorted.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              isExpanded={expandedId === player.id}
              onToggle={() =>
                setExpandedId(expandedId === player.id ? null : player.id)
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
