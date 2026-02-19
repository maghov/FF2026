import { useState, useEffect } from "react";
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

/* ── Timing helpers ──────────────────────────────────── */

function getUKOffset() {
  const now = new Date();
  const year = now.getFullYear();
  const marchLast = new Date(year, 2, 31);
  const bstStart = new Date(year, 2, 31 - marchLast.getDay(), 1, 0);
  const octLast = new Date(year, 9, 31);
  const bstEnd = new Date(year, 9, 31 - octLast.getDay(), 1, 0);
  const isBST = now >= bstStart && now < bstEnd;
  const ukOffsetMs = isBST ? 1 * 60 * 60 * 1000 : 0;
  const localOffsetMs = now.getTimezoneOffset() * 60 * 1000;
  return ukOffsetMs + localOffsetMs;
}

function getNextPriceChange() {
  const now = new Date();
  const ukOffset = getUKOffset();
  const ukNow = new Date(now.getTime() + ukOffset);
  const next = new Date(ukNow);
  next.setHours(2, 30, 0, 0);
  if (ukNow.getHours() >= 3) next.setDate(next.getDate() + 1);
  return new Date(next.getTime() - ukOffset);
}

function getTimeParts(isoString) {
  if (!isoString) return null;
  const diff = new Date(isoString) - new Date();
  if (diff <= 0) return { label: "PASSED", d: 0, h: 0, m: 0, s: 0 };
  return {
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff % 86400000) / 3600000),
    m: Math.floor((diff % 3600000) / 60000),
    s: Math.floor((diff % 60000) / 1000),
  };
}

function formatDeadlineDate(isoString) {
  if (!isoString) return "TBD";
  return new Date(isoString).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTransfers(num) {
  const abs = Math.abs(num);
  if (abs >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (abs >= 1000) return (num / 1000).toFixed(1) + "k";
  return num.toString();
}

/* ── Countdown digits ────────────────────────────────── */

function CountdownUnit({ value, label }) {
  return (
    <div className="pc-cd-unit">
      <span className="pc-cd-digits">{String(value).padStart(2, "0")}</span>
      <span className="pc-cd-label">{label}</span>
    </div>
  );
}

function LiveCountdown({ iso, accent }) {
  const [parts, setParts] = useState(() => getTimeParts(iso));

  useEffect(() => {
    const id = setInterval(() => setParts(getTimeParts(iso)), 1000);
    return () => clearInterval(id);
  }, [iso]);

  if (!parts) return <span className="pc-cd-tbd">--:--</span>;
  if (parts.label === "PASSED") return <span className="pc-cd-passed">PASSED</span>;

  const isUrgent = parts.d === 0 && parts.h < 6;

  return (
    <div className={`pc-cd ${accent} ${isUrgent ? "pc-cd-urgent" : ""}`}>
      {parts.d > 0 && <><CountdownUnit value={parts.d} label="d" /><span className="pc-cd-sep">:</span></>}
      <CountdownUnit value={parts.h} label="h" />
      <span className="pc-cd-sep">:</span>
      <CountdownUnit value={parts.m} label="m" />
      <span className="pc-cd-sep">:</span>
      <CountdownUnit value={parts.s} label="s" />
    </div>
  );
}

/* ── Deadline strip ──────────────────────────────────── */

function DeadlineStrip({ deadline, nextGw, currentGw }) {
  const nextPrice = getNextPriceChange();

  return (
    <div className="pc-strip">
      <div className="pc-strip-cell">
        <span className="pc-strip-label">Next Price Change</span>
        <LiveCountdown iso={nextPrice.toISOString()} accent="pc-accent-amber" />
      </div>
      <div className="pc-strip-divider" />
      <div className="pc-strip-cell">
        <span className="pc-strip-label">
          GW{nextGw} Deadline
          <span className="pc-strip-date">{formatDeadlineDate(deadline)}</span>
        </span>
        <LiveCountdown iso={deadline} accent="pc-accent-red" />
      </div>
      <div className="pc-strip-divider" />
      <div className="pc-strip-cell pc-strip-cell-sm">
        <span className="pc-strip-label">Gameweek</span>
        <span className="pc-strip-gw">{currentGw}</span>
      </div>
    </div>
  );
}

/* ── Activity bar ────────────────────────────────────── */

function ActivityBar({ value, max, direction }) {
  const pct = max > 0 ? Math.min(Math.abs(value) / max * 100, 100) : 0;
  return (
    <div className="pc-bar-track">
      <div
        className={`pc-bar-fill ${direction === "in" ? "pc-bar-green" : "pc-bar-red"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ── Player row ──────────────────────────────────────── */

function PlayerRow({ player, rank, maxNet, direction, delay }) {
  return (
    <div className="pc-row" style={{ animationDelay: `${delay}ms` }}>
      <span className="pc-rank">{rank}</span>
      <div className="pc-player-col">
        <span className={`position-badge position-${player.position}`}>{player.position}</span>
        <div className="pc-player-text">
          <span className="pc-name">{player.name}</span>
          <span className="pc-meta">{player.clubShort} &middot; {player.selectedByPercent}%</span>
        </div>
      </div>
      <div className="pc-price-col">
        <span className="pc-price">&pound;{player.price}m</span>
        {player.costChangeEvent !== 0 && (
          <span className={`pc-delta ${player.costChangeEvent > 0 ? "pc-up" : "pc-down"}`}>
            {player.costChangeEvent > 0 ? "+" : ""}{player.costChangeEvent.toFixed(1)}
          </span>
        )}
      </div>
      <div className="pc-activity-col">
        <span className={`pc-net ${direction === "in" ? "pc-up" : "pc-down"}`}>
          {player.netTransfersEvent > 0 ? "+" : ""}{formatTransfers(player.netTransfersEvent)}
        </span>
        <ActivityBar value={player.netTransfersEvent} max={maxNet} direction={direction} />
      </div>
      <div className="pc-form-col">
        <span className="pc-form-val">{player.form}</span>
      </div>
      <span className={`pc-fix fixture-badge fdr-${player.nextDifficulty}`}>
        {player.nextFixture}
      </span>
      <span className={`pc-signal ${direction === "in" ? "pc-signal-rise" : "pc-signal-fall"} ${player.pricePressure === "rising" || player.pricePressure === "falling" ? "pc-signal-strong" : ""}`}>
        {direction === "in" ? "\u25B2" : "\u25BC"}
      </span>
    </div>
  );
}

/* ── Season row ──────────────────────────────────────── */

function SeasonRow({ player, rank, type, delay }) {
  const change = player.costChangeStart;
  return (
    <div className="pc-row" style={{ animationDelay: `${delay}ms` }}>
      <span className="pc-rank">{rank}</span>
      <div className="pc-player-col">
        <span className={`position-badge position-${player.position}`}>{player.position}</span>
        <div className="pc-player-text">
          <span className="pc-name">{player.name}</span>
          <span className="pc-meta">{player.clubShort} &middot; {player.totalPoints} pts</span>
        </div>
      </div>
      <div className="pc-price-col">
        <span className="pc-price">&pound;{player.price}m</span>
        <span className="pc-from">was &pound;{player.startPrice.toFixed(1)}</span>
      </div>
      <div className="pc-activity-col">
        <span className={`pc-season-delta ${change > 0 ? "pc-up" : "pc-down"}`}>
          {change > 0 ? "+" : ""}&pound;{change.toFixed(1)}m
        </span>
      </div>
      <div className="pc-form-col">
        <span className="pc-form-val">{player.form}</span>
      </div>
      <span className={`pc-fix fixture-badge fdr-${player.nextDifficulty}`}>
        {player.nextFixture}
      </span>
      <span className={`pc-signal ${type === "risers" ? "pc-signal-rise" : "pc-signal-fall"}`}>
        {type === "risers" ? "\u25B2" : "\u25BC"}
      </span>
    </div>
  );
}

/* ── Section ─────────────────────────────────────────── */

function Section({ title, count, accent, hint, children }) {
  return (
    <div className={`pc-section ${accent}`}>
      <div className="pc-section-head">
        <div className="pc-section-accent" />
        <h3>{title}</h3>
        {count != null && <span className="pc-count">{count}</span>}
      </div>
      {hint && <p className="pc-hint">{hint}</p>}
      <div className="pc-table-header">
        <span className="pc-th pc-th-rank">#</span>
        <span className="pc-th pc-th-player">Player</span>
        <span className="pc-th pc-th-price">Price</span>
        <span className="pc-th pc-th-activity">Activity</span>
        <span className="pc-th pc-th-form">Form</span>
        <span className="pc-th pc-th-fix">Next</span>
        <span className="pc-th pc-th-signal" />
      </div>
      {children}
    </div>
  );
}

/* ── Main component ──────────────────────────────────── */

export default function PriceChanges() {
  const [view, setView] = useState("predicted");
  const { data, loading, error, reload } = useApi(fetchPriceChanges, [], 30 * 60 * 1000);

  function handleRefresh() {
    clearBootstrapCache();
    reload();
  }

  if (loading) return <LoadingSpinner message="Loading price data..." />;
  if (error) return <ErrorMessage message={error} onRetry={handleRefresh} />;

  const { rising, falling, recentChanges, biggestRisers, biggestFallers, currentGw, nextGw, deadline, lastUpdated } = data;

  const maxRisingNet = rising.length > 0 ? Math.max(...rising.map((p) => Math.abs(p.netTransfersEvent))) : 1;
  const maxFallingNet = falling.length > 0 ? Math.max(...falling.map((p) => Math.abs(p.netTransfersEvent))) : 1;
  const maxRecentNet = recentChanges.length > 0 ? Math.max(...recentChanges.map((p) => Math.abs(p.netTransfersEvent))) : 1;

  return (
    <div className="price-changes">
      {/* Header */}
      <div className="pc-header">
        <div className="pc-header-left">
          <h2>
            <span className="pc-live-dot" />
            Price Tracker
          </h2>
          <span className="pc-updated">{lastUpdated}</span>
        </div>
        <button className="pc-refresh" onClick={handleRefresh}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Deadline strip */}
      <DeadlineStrip deadline={deadline} nextGw={nextGw} currentGw={currentGw} />

      {/* Stat pills */}
      <div className="pc-pills">
        <div className="pc-pill pc-pill-rise">
          <span className="pc-pill-num">{rising.length}</span>
          <span className="pc-pill-label">Rising</span>
        </div>
        <div className="pc-pill pc-pill-fall">
          <span className="pc-pill-num">{falling.length}</span>
          <span className="pc-pill-label">Falling</span>
        </div>
        <div className="pc-pill pc-pill-changed">
          <span className="pc-pill-num">{recentChanges.length}</span>
          <span className="pc-pill-label">Changed</span>
        </div>
      </div>

      {/* View switcher */}
      <div className="pc-views">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            className={`pc-view-btn ${view === v.id ? "active" : ""}`}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* ── Predicted ── */}
      {view === "predicted" && (
        <>
          <Section title="Buy Before Rise" count={rising.length} accent="pc-sec-green" hint="High transfer-in volume — price increase expected">
            {rising.length === 0 ? (
              <p className="pc-empty">No predicted rises right now</p>
            ) : (
              rising.map((p, i) => (
                <PlayerRow key={p.id} player={p} rank={i + 1} maxNet={maxRisingNet} direction="in" delay={i * 30} />
              ))
            )}
          </Section>
          <Section title="Sell Before Drop" count={falling.length} accent="pc-sec-red" hint="Losing ownership fast — price drop expected">
            {falling.length === 0 ? (
              <p className="pc-empty">No predicted drops right now</p>
            ) : (
              falling.map((p, i) => (
                <PlayerRow key={p.id} player={p} rank={i + 1} maxNet={maxFallingNet} direction="out" delay={i * 30} />
              ))
            )}
          </Section>
        </>
      )}

      {/* ── This GW ── */}
      {view === "recent" && (
        <Section title="Price Changes This GW" count={recentChanges.length} accent="pc-sec-neutral">
          {recentChanges.length === 0 ? (
            <p className="pc-empty">No price changes yet this gameweek</p>
          ) : (
            recentChanges.map((p, i) => (
              <PlayerRow
                key={p.id}
                player={p}
                rank={i + 1}
                maxNet={maxRecentNet}
                direction={p.costChangeEvent > 0 ? "in" : "out"}
                delay={i * 30}
              />
            ))
          )}
        </Section>
      )}

      {/* ── Season ── */}
      {view === "season" && (
        <>
          <Section title="Biggest Risers" accent="pc-sec-green">
            {biggestRisers.map((p, i) => (
              <SeasonRow key={p.id} player={p} rank={i + 1} type="risers" delay={i * 30} />
            ))}
          </Section>
          <Section title="Biggest Fallers" accent="pc-sec-red">
            {biggestFallers.map((p, i) => (
              <SeasonRow key={p.id} player={p} rank={i + 1} type="fallers" delay={i * 30} />
            ))}
          </Section>
        </>
      )}
    </div>
  );
}
