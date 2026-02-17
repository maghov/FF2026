import { useApi } from "../hooks/useApi";
import {
  fetchGameweekHistory,
  fetchProjectedPoints,
  fetchMyTeam,
  fetchLeagueData,
} from "../services/api";
import LoadingSpinner from "./LoadingSpinner";
import ErrorMessage from "./ErrorMessage";
import "./PointsPerformance.css";

function BarChart({ data, maxValue, labelKey, valueKey, compareKey }) {
  return (
    <div className="bar-chart">
      {data.map((item, i) => (
        <div key={i} className="bar-group">
          <div className="bar-container">
            {compareKey && (
              <div
                className="bar bar-compare"
                style={{ height: `${(item[compareKey] / maxValue) * 100}%` }}
                title={`Avg: ${item[compareKey]}`}
              />
            )}
            <div
              className="bar bar-primary"
              style={{ height: `${(item[valueKey] / maxValue) * 100}%` }}
              title={`${item[valueKey]} pts`}
            >
              <span className="bar-value">{item[valueKey]}</span>
            </div>
          </div>
          <span className="bar-label">{item[labelKey]}</span>
        </div>
      ))}
    </div>
  );
}

function MiniTable({ projections }) {
  return (
    <div className="projections-table">
      <div className="table-header">
        <span>GW</span>
        <span>Projected</span>
        <span>Difficulty</span>
      </div>
      {projections.map((p) => (
        <div key={p.gw} className="table-row">
          <span>GW{p.gw}</span>
          <span className="projected-value">{p.projected}</span>
          <span
            className={`difficulty difficulty-${p.difficulty.toLowerCase()}`}
          >
            {p.difficulty}
          </span>
        </div>
      ))}
    </div>
  );
}

function LeagueStandings({ league }) {
  return (
    <div className="league-standings">
      <div className="table-header league-header">
        <span>#</span>
        <span>Team</span>
        <span>Pts</span>
      </div>
      {league.standings.map((entry) => (
        <div
          key={entry.rank}
          className={`table-row league-row ${entry.manager === "You" ? "my-row" : ""}`}
        >
          <span className="rank">{entry.rank}</span>
          <span className="team-name">
            {entry.name}
            <small>{entry.manager}</small>
          </span>
          <span className="league-points">{entry.points}</span>
        </div>
      ))}
    </div>
  );
}

export default function PointsPerformance() {
  const {
    data: history,
    loading: histLoading,
    error: histError,
    reload: histReload,
  } = useApi(fetchGameweekHistory);

  const {
    data: projections,
    loading: projLoading,
    error: projError,
  } = useApi(fetchProjectedPoints);

  const {
    data: teamData,
    loading: teamLoading,
    error: teamError,
  } = useApi(fetchMyTeam);

  const {
    data: league,
    loading: leagueLoading,
    error: leagueError,
  } = useApi(fetchLeagueData);

  const loading = histLoading || projLoading || teamLoading || leagueLoading;
  const error = histError || projError || teamError || leagueError;

  if (loading) return <LoadingSpinner message="Loading performance data..." />;
  if (error) return <ErrorMessage message={error} onRetry={histReload} />;

  const { summary } = teamData;
  const maxGwPoints = Math.max(...history.map((h) => Math.max(h.points, h.average))) + 10;

  const totalMyPoints = history.reduce((s, h) => s + h.points, 0);
  const totalAvgPoints = history.reduce((s, h) => s + h.average, 0);
  const performanceDiff = totalMyPoints - totalAvgPoints;

  return (
    <div className="points-performance">
      {/* Key Metrics */}
      <div className="metrics-row">
        <div className="metric-card featured">
          <span className="metric-value">{summary.gameweekPoints}</span>
          <span className="metric-label">GW{summary.currentGameweek} Points</span>
        </div>
        <div className="metric-card">
          <span className="metric-value">{summary.totalPoints}</span>
          <span className="metric-label">Total Points</span>
        </div>
        <div className="metric-card">
          <span className="metric-value">{summary.captainPoints}</span>
          <span className="metric-label">Captain Bonus</span>
        </div>
        <div className="metric-card">
          <span className={`metric-value ${performanceDiff > 0 ? "positive" : "negative"}`}>
            {performanceDiff > 0 ? "+" : ""}
            {performanceDiff}
          </span>
          <span className="metric-label">vs League Avg</span>
        </div>
      </div>

      <div className="panels-grid">
        {/* Gameweek Trend */}
        <div className="panel">
          <h3>Gameweek Trend</h3>
          <div className="chart-legend">
            <span className="legend-item">
              <span className="legend-dot primary" /> You
            </span>
            <span className="legend-item">
              <span className="legend-dot compare" /> Average
            </span>
          </div>
          <BarChart
            data={history}
            maxValue={maxGwPoints}
            labelKey="gw"
            valueKey="points"
            compareKey="average"
          />
        </div>

        {/* Projections */}
        <div className="panel">
          <h3>Upcoming Projections</h3>
          <MiniTable projections={projections} />
        </div>

        {/* League */}
        <div className="panel">
          <h3>{league.name}</h3>
          <LeagueStandings league={league} />
        </div>

        {/* Rank Trend */}
        <div className="panel">
          <h3>Rank Progression</h3>
          <div className="rank-trend">
            {history.map((h, i) => {
              const prev = i > 0 ? history[i - 1].rank : h.rank;
              const change = prev - h.rank;
              return (
                <div key={h.gw} className="rank-item">
                  <span className="rank-gw">GW{h.gw}</span>
                  <span className="rank-number">
                    {h.rank.toLocaleString()}
                  </span>
                  <span
                    className={`rank-change ${change > 0 ? "positive" : change < 0 ? "negative" : ""}`}
                  >
                    {change > 0 ? `+${change.toLocaleString()}` : change < 0 ? change.toLocaleString() : "-"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
