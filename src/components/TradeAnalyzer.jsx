import { useState, useMemo } from "react";
import { useApi } from "../hooks/useApi";
import { fetchAvailablePlayers, analyzeTransfer } from "../services/api";
import LoadingSpinner from "./LoadingSpinner";
import ErrorMessage from "./ErrorMessage";
import "./TradeAnalyzer.css";

const POSITIONS = ["All", "GKP", "DEF", "MID", "FWD"];
const SORT_OPTIONS = [
  { value: "form", label: "Form" },
  { value: "totalPoints", label: "Total Pts" },
  { value: "price-asc", label: "Price (low)" },
  { value: "price-desc", label: "Price (high)" },
  { value: "selectedByPercent", label: "Ownership %" },
  { value: "netTransfersEvent", label: "Transfer Activity" },
];

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

function PriceTag({ player }) {
  const pressure = player?.pricePressure;
  if (!pressure || pressure === "stable") return <span>&pound;{player.price}m</span>;
  const isRising = pressure.includes("rising");
  const symbol = isRising ? "\u25B2" : "\u25BC";
  const cls = isRising ? "positive" : "negative";
  return (
    <span>
      &pound;{player.price}m <span className={cls} style={{ fontSize: "0.65rem" }}>{symbol}</span>
    </span>
  );
}

function PlayerStatCard({ player, label }) {
  if (!player) return null;
  const nextFix = player.upcomingFixtures?.[0];
  return (
    <div className="player-stat-card">
      <div className="stat-card-header">
        <span className="stat-card-label">{label}</span>
        <span className={`position-badge position-${player.position}`}>
          {player.position}
        </span>
      </div>
      <div className="stat-card-name">{player.name}</div>
      <div className="stat-card-club">{player.club}</div>
      <div className="stat-card-stats">
        <div className="stat-card-item">
          <span className="sc-value">{player.totalPoints}</span>
          <span className="sc-label">Pts</span>
        </div>
        <div className="stat-card-item">
          <span className="sc-value">{player.form}</span>
          <span className="sc-label">Form</span>
        </div>
        <div className="stat-card-item">
          <span className="sc-value"><PriceTag player={player} /></span>
          <span className="sc-label">Price</span>
        </div>
        <div className="stat-card-item">
          {nextFix ? (
            <span className={`sc-value fixture-badge fdr-${nextFix.difficulty}`}>
              {nextFix.opponent}
            </span>
          ) : (
            <span className="sc-value">-</span>
          )}
          <span className="sc-label">Next</span>
        </div>
      </div>
    </div>
  );
}

function FixtureComparison({ playerOut, playerIn, gameweeks }) {
  const outFixtures = playerOut.upcomingFixtures?.slice(0, gameweeks) || [];
  const inFixtures = playerIn.upcomingFixtures?.slice(0, gameweeks) || [];

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

      {(playerIn.pricePressure === "rising" || playerIn.pricePressure === "likely-rising") && (
        <div className="urgency-alert urgency-rising">
          <span className="urgency-icon">{"\u25B2"}</span>
          <span className="urgency-text">
            {playerIn.name} has {(playerIn.netTransfersEvent || 0).toLocaleString()} net transfers in this GW
            {playerIn.pricePressure === "rising" ? " — price rise imminent, act now!" : " — trending toward a price rise."}
          </span>
        </div>
      )}
      {(playerOut.pricePressure === "falling" || playerOut.pricePressure === "likely-falling") && (
        <div className="urgency-alert urgency-falling">
          <span className="urgency-icon">{"\u25BC"}</span>
          <span className="urgency-text">
            {playerOut.name} is losing {Math.abs(playerOut.netTransfersEvent || 0).toLocaleString()} net transfers
            {playerOut.pricePressure === "falling" ? " — price drop imminent, sell before value loss!" : " — trending toward a price drop."}
          </span>
        </div>
      )}

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

export default function TradeAnalyzer({ teamData, teamLoading, teamError, teamReload }) {
  const [playerOutId, setPlayerOutId] = useState(null);
  const [playerInId, setPlayerInId] = useState(null);
  const [gameweeks, setGameweeks] = useState(3);
  const [posFilter, setPosFilter] = useState("All");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy, setSortBy] = useState("form");

  const {
    data: available,
    loading: aLoading,
    error: aError,
  } = useApi(fetchAvailablePlayers);

  const loading = teamLoading || aLoading;
  const error = teamError || aError;

  const playerOut = useMemo(
    () => teamData?.players.find((p) => p.id === playerOutId),
    [teamData, playerOutId]
  );

  const filteredAvailable = useMemo(() => {
    if (!available) return [];
    let list = available;

    if (posFilter !== "All") {
      list = list.filter((p) => p.position === posFilter);
    }

    if (maxPrice) {
      const cap = parseFloat(maxPrice);
      if (!isNaN(cap)) list = list.filter((p) => p.price <= cap);
    }

    const sorted = [...list];
    switch (sortBy) {
      case "form":
        sorted.sort((a, b) => b.form - a.form);
        break;
      case "totalPoints":
        sorted.sort((a, b) => b.totalPoints - a.totalPoints);
        break;
      case "price-asc":
        sorted.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        sorted.sort((a, b) => b.price - a.price);
        break;
      case "selectedByPercent":
        sorted.sort((a, b) => b.selectedByPercent - a.selectedByPercent);
        break;
      case "netTransfersEvent":
        sorted.sort((a, b) => (b.netTransfersEvent || 0) - (a.netTransfersEvent || 0));
        break;
    }

    return sorted;
  }, [available, posFilter, maxPrice, sortBy]);

  const playerIn = useMemo(
    () => available?.find((p) => p.id === playerInId),
    [available, playerInId]
  );

  const result = useMemo(() => {
    if (!playerOut || !playerIn) return null;
    return analyzeTransfer(playerOut, playerIn, gameweeks);
  }, [playerOut, playerIn, gameweeks]);

  function handlePlayerOutChange(id) {
    setPlayerOutId(id);
    if (id && teamData) {
      const p = teamData.players.find((pl) => pl.id === id);
      if (p) setPosFilter(p.position);
    }
  }

  if (loading) return <LoadingSpinner message="Loading trade data..." />;
  if (error) return <ErrorMessage message={error} onRetry={teamReload} />;

  return (
    <div className="trade-analyzer">
      <div className="trade-controls">
        <div className="controls-card">
          <h3>Transfer Setup</h3>
          <PlayerSelector
            label="Transfer Out"
            players={teamData.players}
            selected={playerOutId}
            onChange={handlePlayerOutChange}
          />

          <div className="filter-bar">
            <div className="filter-group">
              <label>Position</label>
              <div className="filter-buttons">
                {POSITIONS.map((pos) => (
                  <button
                    key={pos}
                    className={`filter-btn ${posFilter === pos ? "active" : ""}`}
                    onClick={() => setPosFilter(pos)}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>
            <div className="filter-row">
              <div className="filter-group filter-group-sm">
                <label>Max Price</label>
                <input
                  type="number"
                  className="filter-input"
                  placeholder="e.g. 8.0"
                  step="0.5"
                  min="3.5"
                  max="15"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                />
              </div>
              <div className="filter-group filter-group-sm">
                <label>Sort By</label>
                <select
                  className="filter-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <PlayerSelector
            label={`Transfer In (${filteredAvailable.length} players)`}
            players={filteredAvailable}
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

        <div className="stat-cards-column">
          {playerOut || playerIn ? (
            <>
              <PlayerStatCard player={playerOut} label="OUT" />
              {playerOut && playerIn && <div className="versus-icon">vs</div>}
              <PlayerStatCard player={playerIn} label="IN" />
            </>
          ) : (
            <div className="versus-card">
              <div className="placeholder-icon">&#8644;</div>
              <p className="versus-detail">
                Select players to compare stats
              </p>
            </div>
          )}
        </div>
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
