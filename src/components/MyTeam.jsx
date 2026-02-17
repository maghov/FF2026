import { useApi } from "../hooks/useApi";
import { fetchMyTeam } from "../services/api";
import LoadingSpinner from "./LoadingSpinner";
import ErrorMessage from "./ErrorMessage";
import "./MyTeam.css";

const positionOrder = { GKP: 0, DEF: 1, MID: 2, FWD: 3 };

function PlayerCard({ player }) {
  const formColor =
    player.form >= 7 ? "positive" : player.form <= 4 ? "negative" : "";

  return (
    <div className="player-card">
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
        <span
          className={`fixture-value fdr-${player.fixtureDifficulty}`}
        >
          {player.upcomingFixture}
        </span>
      </div>
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

export default function MyTeam() {
  const { data, loading, error, reload } = useApi(fetchMyTeam, 60000);

  if (loading) return <LoadingSpinner message="Loading your team..." />;
  if (error) return <ErrorMessage message={error} onRetry={reload} />;

  const { players, summary } = data;
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
            <PlayerCard key={player.id} player={player} />
          ))}
        </div>
      </div>
    </div>
  );
}
