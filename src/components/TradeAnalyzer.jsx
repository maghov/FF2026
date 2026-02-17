import { useState, useMemo } from "react";
import { useApi } from "../hooks/useApi";
import { fetchMyTeam, fetchAvailablePlayers, analyzeTransfer } from "../services/api";
import LoadingSpinner from "./LoadingSpinner";
import ErrorMessage from "./ErrorMessage";
import "./TradeAnalyzer.css";

function PlayerSelector({ label, players, selected, onChange, disabledId }) {
  return (
    <div className="selector">
      <label>{label}</label>
      <select
        value={selected || ""}
        onChange={(e) => onChange(Number(e.target.value) || null)}
      >
        <option value="">Select a player...</option>
        {players
          .filter((p) => p.id !== disabledId)
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.position}) - {p.clubShort} - £{p.price}m
            </option>
          ))}
      </select>
    </div>
  );
}

function FixtureComparison({ playerOut, playerIn, gameweeks }) {
  const outFixtures = playerOut.upcomingFixtures?.slice(0, gameweeks) || [];
  const inFixtures = playerIn.upcomingFixtures?.slice(0, gameweeks) || [];

  // Merge by GW so rows align even if one player has a blank GW
  const allGws = [...new Set([...outFixtures.map((f) => f.gw), ...inFixtures.map((f) => f.gw)])].sort(
    (a, b) => a - b
  );
  const outByGw = Object.fromEntries(outFixtures.map((f) => [f.gw, f]));
  const inByGw = Object.fromEntries(inFixtures.map((f) => [f.gw, f]));

  return (
    <div className="fixture-comparison">
      <h4>Fixture Comparison</h4>
      <div className="fixture-table">
        <div className="fixture-row header three-col">
          <span>{playerOut.name}</span>
          <span>GW</span>
          <span>{playerIn.name}</span>
        </div>
        {allGws.map((gw) => {
          const out = outByGw[gw];
          const inf = inByGw[gw];
          return (
            <div key={gw} className="fixture-row three-col">
              <span className={out ? `fixture-badge fdr-${out.difficulty}` : "fixture-blank"}>
                {out ? out.opponent : "-"}
              </span>
              <span className="fixture-gw">GW{gw}</span>
              <span className={inf ? `fixture-badge fdr-${inf.difficulty}` : "fixture-blank"}>
                {inf ? inf.opponent : "-"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TradeResult({ result, playerOut, playerIn }) {
  const recClass =
    result.recommendation === "Strong Buy"
      ? "strong-buy"
      : result.recommendation === "Avoid"
        ? "avoid"
        : "neutral";

  return (
    <div className="trade-result">
      <div className={`recommendation-badge ${recClass}`}>
        {result.recommendation}
      </div>

      <div className="result-metrics">
        <div className="result-metric">
          <span className="result-label">Projected Points Diff</span>
          <span
            className={`result-value ${result.pointsDiff > 0 ? "positive" : result.pointsDiff < 0 ? "negative" : ""}`}
          >
            {result.pointsDiff > 0 ? "+" : ""}
            {result.pointsDiff}
          </span>
        </div>
        <div className="result-metric">
          <span className="result-label">Form Comparison</span>
          <span
            className={`result-value ${Number(result.formDiff) > 0 ? "positive" : Number(result.formDiff) < 0 ? "negative" : ""}`}
          >
            {Number(result.formDiff) > 0 ? "+" : ""}
            {result.formDiff}
          </span>
        </div>
        <div className="result-metric">
          <span className="result-label">Price Impact</span>
          <span
            className={`result-value ${Number(result.priceDiff) < 0 ? "positive" : Number(result.priceDiff) > 0 ? "negative" : ""}`}
          >
            {Number(result.priceDiff) > 0 ? "+" : ""}
            £{result.priceDiff}m
          </span>
        </div>
        <div className="result-metric">
          <span className="result-label">Fixture Swing</span>
          <span
            className={`result-value ${Number(result.fixtureDiff) > 0 ? "positive" : Number(result.fixtureDiff) < 0 ? "negative" : ""}`}
          >
            {Number(result.fixtureDiff) > 0 ? "+" : ""}
            {result.fixtureDiff}
          </span>
        </div>
        <div className="result-metric">
          <span className="result-label">Risk Rating</span>
          <span className={`risk-badge risk-${result.riskLevel.toLowerCase()}`}>
            {result.riskLevel}
          </span>
        </div>
      </div>

      <div className="points-projection">
        <div className="projection-bar">
          <span className="proj-label">{playerOut.name}</span>
          <div className="proj-track">
            <div
              className="proj-fill out"
              style={{
                width: `${(result.outProjected / Math.max(result.outProjected, result.inProjected)) * 100}%`,
              }}
            >
              {result.outProjected} pts
            </div>
          </div>
        </div>
        <div className="projection-bar">
          <span className="proj-label">{playerIn.name}</span>
          <div className="proj-track">
            <div
              className="proj-fill in"
              style={{
                width: `${(result.inProjected / Math.max(result.outProjected, result.inProjected)) * 100}%`,
              }}
            >
              {result.inProjected} pts
            </div>
          </div>
        </div>
      </div>

      <div className="ai-explanation">
        <div className="explanation-header">Analysis</div>
        <p>{result.explanation}</p>
      </div>
    </div>
  );
}

export default function TradeAnalyzer() {
  const [playerOutId, setPlayerOutId] = useState(null);
  const [playerInId, setPlayerInId] = useState(null);
  const [gameweeks, setGameweeks] = useState(3);

  const { data: teamData, loading: tLoading, error: tError, reload: tReload } =
    useApi(fetchMyTeam);
  const {
    data: available,
    loading: aLoading,
    error: aError,
  } = useApi(fetchAvailablePlayers);

  const loading = tLoading || aLoading;
  const error = tError || aError;

  const playerOut = useMemo(
    () => teamData?.players.find((p) => p.id === playerOutId),
    [teamData, playerOutId]
  );

  const playerIn = useMemo(
    () => available?.find((p) => p.id === playerInId),
    [available, playerInId]
  );

  const result = useMemo(() => {
    if (!playerOut || !playerIn) return null;
    return analyzeTransfer(playerOut, playerIn, gameweeks);
  }, [playerOut, playerIn, gameweeks]);

  if (loading) return <LoadingSpinner message="Loading trade data..." />;
  if (error) return <ErrorMessage message={error} onRetry={tReload} />;

  return (
    <div className="trade-analyzer">
      <div className="trade-controls">
        <div className="controls-card">
          <h3>Transfer Setup</h3>
          <PlayerSelector
            label="Transfer Out"
            players={teamData.players}
            selected={playerOutId}
            onChange={setPlayerOutId}
          />
          <PlayerSelector
            label="Transfer In"
            players={available}
            selected={playerInId}
            onChange={setPlayerInId}
          />
          <div className="gameweeks-selector">
            <label>Gameweeks to Analyze</label>
            <div className="gw-buttons">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  className={`gw-btn ${gameweeks === n ? "active" : ""}`}
                  onClick={() => setGameweeks(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {playerOut && playerIn && (
          <div className="versus-card">
            <div className="versus-player">
              <span className={`position-badge position-${playerOut.position}`}>
                {playerOut.position}
              </span>
              <span className="versus-name">{playerOut.name}</span>
              <span className="versus-detail">
                {playerOut.club} &middot; £{playerOut.price}m &middot; Form: {playerOut.form}
              </span>
            </div>
            <div className="versus-icon">vs</div>
            <div className="versus-player">
              <span className={`position-badge position-${playerIn.position}`}>
                {playerIn.position}
              </span>
              <span className="versus-name">{playerIn.name}</span>
              <span className="versus-detail">
                {playerIn.club} &middot; £{playerIn.price}m &middot; Form: {playerIn.form}
              </span>
            </div>
          </div>
        )}
      </div>

      {result && (
        <div className="trade-results">
          <TradeResult
            result={result}
            playerOut={playerOut}
            playerIn={playerIn}
          />
          <FixtureComparison
            playerOut={playerOut}
            playerIn={playerIn}
            gameweeks={gameweeks}
          />
        </div>
      )}

      {!playerOutId && !playerInId && (
        <div className="trade-placeholder">
          <div className="placeholder-icon">&#8644;</div>
          <p>Select players above to analyze a potential transfer</p>
        </div>
      )}
    </div>
  );
}
