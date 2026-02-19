import { useState } from "react";
import { useApi } from "../hooks/useApi";
import { fetchPriceChanges } from "../services/api";
import { clearBootstrapCache } from "../services/fplApi";
import LoadingSpinner from "./LoadingSpinner";
import ErrorMessage from "./ErrorMessage";
import "./PriceChanges.css";

const VIEWS = [
  { id: "predicted", label: "Predicted" },
  { id: "recent", label: "This GW" },
  { id: "season", label: "Season" },
];

function PressureBadge({ pressure }) {
  const config = {
    rising: { label: "Rising", cls: "pc-badge-rising" },
    "likely-rising": { label: "Likely Rising", cls: "pc-badge-likely-rising" },
    falling: { label: "Falling", cls: "pc-badge-falling" },
    "likely-falling": { label: "Likely Falling", cls: "pc-badge-likely-falling" },
  };
  const c = config[pressure];
  if (!c) return null;
  return <span className={`pc-badge ${c.cls}`}>{c.label}</span>;
}

function formatTransfers(num) {
  const abs = Math.abs(num);
  if (abs >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (abs >= 1000) return (num / 1000).toFixed(1) + "k";
  return num.toString();
}

function PlayerRow({ player, showPressure }) {
  const isPositive = player.netTransfersEvent > 0 || player.costChangeEvent > 0 || player.costChangeStart > 0;

  return (
    <div className="pc-player-row">
      <div className="pc-player-info">
        <span className={`position-badge position-${player.position}`}>
          {player.position}
        </span>
        <div className="pc-player-details">
          <span className="pc-player-name">{player.name}</span>
          <span className="pc-player-meta">{player.clubShort} &middot; {player.form} form &middot; {player.selectedByPercent}%</span>
        </div>
      </div>
      <div className="pc-player-price">
        <span className="pc-price-value">&pound;{player.price}m</span>
        {player.costChangeEvent !== 0 && (
          <span className={`pc-price-change ${player.costChangeEvent > 0 ? "positive" : "negative"}`}>
            {player.costChangeEvent > 0 ? "+" : ""}&pound;{player.costChangeEvent.toFixed(1)}
          </span>
        )}
      </div>
      <div className="pc-player-transfers">
        <span className={`pc-transfers-value ${isPositive ? "positive" : "negative"}`}>
          {player.netTransfersEvent > 0 ? "+" : ""}{formatTransfers(player.netTransfersEvent)}
        </span>
        <span className="pc-transfers-label">net</span>
      </div>
      <div className="pc-player-fixture">
        <span className={`fixture-badge fdr-${player.nextDifficulty}`}>
          {player.nextFixture}
        </span>
      </div>
      {showPressure && (
        <div className="pc-player-status">
          <PressureBadge pressure={player.pricePressure} />
        </div>
      )}
    </div>
  );
}

function SeasonRow({ player, type }) {
  const change = type === "risers" ? player.costChangeStart : player.costChangeStart;

  return (
    <div className="pc-player-row">
      <div className="pc-player-info">
        <span className={`position-badge position-${player.position}`}>
          {player.position}
        </span>
        <div className="pc-player-details">
          <span className="pc-player-name">{player.name}</span>
          <span className="pc-player-meta">{player.clubShort} &middot; {player.totalPoints} pts &middot; {player.selectedByPercent}%</span>
        </div>
      </div>
      <div className="pc-player-price">
        <span className="pc-price-value">&pound;{player.price}m</span>
        <span className="pc-start-price">from &pound;{player.startPrice.toFixed(1)}m</span>
      </div>
      <div className="pc-player-transfers">
        <span className={`pc-season-change ${change > 0 ? "positive" : "negative"}`}>
          {change > 0 ? "+" : ""}&pound;{change.toFixed(1)}m
        </span>
      </div>
      <div className="pc-player-fixture">
        <span className={`fixture-badge fdr-${player.nextDifficulty}`}>
          {player.nextFixture}
        </span>
      </div>
    </div>
  );
}

export default function PriceChanges() {
  const [view, setView] = useState("predicted");
  const { data, loading, error, reload } = useApi(fetchPriceChanges, [], 30 * 60 * 1000);

  function handleRefresh() {
    clearBootstrapCache();
    reload();
  }

  if (loading) return <LoadingSpinner message="Loading price data..." />;
  if (error) return <ErrorMessage message={error} onRetry={handleRefresh} />;

  const { rising, falling, recentChanges, biggestRisers, biggestFallers, lastUpdated } = data;

  return (
    <div className="price-changes">
      <div className="pc-header">
        <div className="pc-header-left">
          <h2>Price Changes</h2>
          <span className="pc-updated">Updated {lastUpdated}</span>
        </div>
        <button className="btn btn-secondary pc-refresh-btn" onClick={handleRefresh}>
          Refresh
        </button>
      </div>

      <div className="pc-summary-row">
        <div className="pc-summary-card pc-summary-rising">
          <span className="pc-summary-count">{rising.length}</span>
          <span className="pc-summary-label">Predicted to Rise</span>
        </div>
        <div className="pc-summary-card pc-summary-falling">
          <span className="pc-summary-count">{falling.length}</span>
          <span className="pc-summary-label">Predicted to Fall</span>
        </div>
        <div className="pc-summary-card pc-summary-changed">
          <span className="pc-summary-count">{recentChanges.length}</span>
          <span className="pc-summary-label">Changed This GW</span>
        </div>
      </div>

      <div className="pc-view-tabs">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            className={`pc-view-tab ${view === v.id ? "active" : ""}`}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === "predicted" && (
        <div className="pc-sections">
          <div className="pc-section">
            <div className="pc-section-header pc-section-buy">
              <span className="pc-section-icon">{"\u25B2"}</span>
              <h3>Buy Before Price Rise</h3>
              <span className="pc-section-count">{rising.length}</span>
            </div>
            <p className="pc-section-hint">Players with high transfer-in activity — price rise expected</p>
            <div className="pc-player-list">
              {rising.length === 0 ? (
                <p className="pc-empty">No predicted price rises right now</p>
              ) : (
                rising.map((p) => <PlayerRow key={p.id} player={p} showPressure />)
              )}
            </div>
          </div>

          <div className="pc-section">
            <div className="pc-section-header pc-section-sell">
              <span className="pc-section-icon">{"\u25BC"}</span>
              <h3>Sell Before Price Drop</h3>
              <span className="pc-section-count">{falling.length}</span>
            </div>
            <p className="pc-section-hint">Players losing ownership fast — price drop expected</p>
            <div className="pc-player-list">
              {falling.length === 0 ? (
                <p className="pc-empty">No predicted price drops right now</p>
              ) : (
                falling.map((p) => <PlayerRow key={p.id} player={p} showPressure />)
              )}
            </div>
          </div>
        </div>
      )}

      {view === "recent" && (
        <div className="pc-sections">
          <div className="pc-section">
            <div className="pc-section-header">
              <h3>Price Changes This Gameweek</h3>
              <span className="pc-section-count">{recentChanges.length}</span>
            </div>
            <div className="pc-player-list">
              {recentChanges.length === 0 ? (
                <p className="pc-empty">No price changes this gameweek yet</p>
              ) : (
                recentChanges.map((p) => <PlayerRow key={p.id} player={p} showPressure={false} />)
              )}
            </div>
          </div>
        </div>
      )}

      {view === "season" && (
        <div className="pc-sections">
          <div className="pc-section">
            <div className="pc-section-header pc-section-buy">
              <span className="pc-section-icon">{"\u25B2"}</span>
              <h3>Biggest Risers</h3>
            </div>
            <div className="pc-player-list">
              {biggestRisers.map((p) => <SeasonRow key={p.id} player={p} type="risers" />)}
            </div>
          </div>

          <div className="pc-section">
            <div className="pc-section-header pc-section-sell">
              <span className="pc-section-icon">{"\u25BC"}</span>
              <h3>Biggest Fallers</h3>
            </div>
            <div className="pc-player-list">
              {biggestFallers.map((p) => <SeasonRow key={p.id} player={p} type="fallers" />)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
