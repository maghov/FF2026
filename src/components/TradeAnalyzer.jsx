import { useState, useMemo, useEffect, useCallback } from "react";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import { fetchAvailablePlayers, analyzeTransfer } from "../services/api";
import { calculateMultiGwXpts, rankTransferTargets } from "../services/xpts";
import { getBootstrap, getLiveGameweek } from "../services/fplApi";
import { db } from "../firebase";
import { ref, get, set, push, remove } from "firebase/database";
import LoadingSpinner from "./LoadingSpinner";
import ErrorMessage from "./ErrorMessage";
import "./TradeAnalyzer.css";

const POSITIONS = ["All", "GKP", "DEF", "MID", "FWD"];
const SORT_OPTIONS = [
  { value: "xpts", label: "xPts" },
  { value: "form", label: "Form" },
  { value: "totalPoints", label: "Total Pts" },
  { value: "price-asc", label: "Price (low)" },
  { value: "price-desc", label: "Price (high)" },
  { value: "selectedByPercent", label: "Ownership %" },
  { value: "netTransfersEvent", label: "Transfer Activity" },
];

function PlayerSelector({ label, players, selected, onChange, disabledId, groups }) {
  return (
    <div className="selector">
      <label>{label}</label>
      <select
        value={selected || ""}
        onChange={(e) => onChange(Number(e.target.value) || null)}
      >
        <option value="">Select a player...</option>
        {groups ? (
          groups.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.players
                .filter((p) => p.id !== disabledId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.position}) - {p.clubShort} - £{p.price}m
                  </option>
                ))}
            </optgroup>
          ))
        ) : (
          players
            .filter((p) => p.id !== disabledId)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.position}) - {p.clubShort} - £{p.price}m
              </option>
            ))
        )}
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

function PlayerStatCard({ player, label, teams }) {
  const xptsResult = useMemo(() => {
    if (!player) return null;
    return calculateMultiGwXpts(player, player.upcomingFixtures, teams, 3);
  }, [player, teams]);

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
          {xptsResult ? (
            <span className="sc-value trade-xpts-value">{xptsResult.avgXpts}</span>
          ) : (
            <span className="sc-value">-</span>
          )}
          <span className="sc-label">xPts</span>
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
      {xptsResult?.topReasons?.length > 0 && (
        <div className="trade-xpts-reasons">
          {xptsResult.topReasons.map((r, i) => (
            <span key={i} className="trade-reason-chip">{r}</span>
          ))}
        </div>
      )}
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
          <span className="result-label">Projected xPts Diff</span>
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
              {result.outProjected} xPts
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
              {result.inProjected} xPts
            </div>
          </div>
        </div>
      </div>

      {(result.inReasons?.length > 0 || result.outReasons?.length > 0) && (
        <div className="trade-reasons-section">
          {result.inReasons?.length > 0 && (
            <div className="trade-reasons-group">
              <span className="trade-reasons-label">{playerIn.name}</span>
              <div className="trade-reasons-chips">
                {result.inReasons.map((r, i) => (
                  <span key={i} className="trade-reason-chip positive">{r}</span>
                ))}
              </div>
            </div>
          )}
          {result.outReasons?.length > 0 && (
            <div className="trade-reasons-group">
              <span className="trade-reasons-label">{playerOut.name}</span>
              <div className="trade-reasons-chips">
                {result.outReasons.map((r, i) => (
                  <span key={i} className="trade-reason-chip">{r}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="ai-explanation">
        <div className="explanation-header">Analysis</div>
        <p>{result.explanation}</p>
      </div>
    </div>
  );
}

/* ── History Tab ──────────────────────────────────────── */

function HistoryTab({ uid }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [currentGw, setCurrentGw] = useState(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const [snap, bootstrap] = await Promise.all([
        get(ref(db, `tradeAnalyses/${uid}`)),
        getBootstrap(),
      ]);
      const curGw = bootstrap.events.find((e) => e.is_current)?.id || 1;
      setCurrentGw(curGw);

      const raw = snap.val();
      if (!raw) { setEntries([]); return; }

      const list = Object.entries(raw).map(([key, val]) => ({ key, ...val }));
      list.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
      setEntries(list);

      // Resolve outcomes for completed analyses
      const needsOutcome = list.filter(
        (e) => !e.outcome && curGw > e.gameweek + e.gameweeksToTrack
      );
      if (needsOutcome.length > 0) {
        setResolving(true);
        await resolveOutcomes(needsOutcome, curGw, uid);
        // Reload after writing outcomes
        const refreshSnap = await get(ref(db, `tradeAnalyses/${uid}`));
        const refreshed = refreshSnap.val();
        if (refreshed) {
          const updated = Object.entries(refreshed)
            .map(([key, val]) => ({ key, ...val }))
            .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
          setEntries(updated);
        }
        setResolving(false);
      }
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  async function handleDelete(key) {
    await remove(ref(db, `tradeAnalyses/${uid}/${key}`));
    setEntries((prev) => prev.filter((e) => e.key !== key));
  }

  if (loading) return <LoadingSpinner message="Loading saved analyses..." />;

  if (entries.length === 0) {
    return (
      <div className="ta-history-empty">
        <div className="placeholder-icon">&#128202;</div>
        <p>No saved analyses yet</p>
        <p className="ta-history-hint">Analyze a transfer and click "Save Analysis" to track its accuracy over time.</p>
      </div>
    );
  }

  const completed = entries.filter((e) => e.outcome);
  const correctCount = completed.filter((e) => e.outcome?.verdict === "correct").length;

  return (
    <div className="ta-history">
      {resolving && <p className="ta-resolving">Calculating outcomes...</p>}

      {completed.length > 0 && (
        <div className="ta-history-stats">
          <div className="ta-hstat">
            <span className="ta-hstat-num">{entries.length}</span>
            <span className="ta-hstat-label">Saved</span>
          </div>
          <div className="ta-hstat">
            <span className="ta-hstat-num">{completed.length}</span>
            <span className="ta-hstat-label">Completed</span>
          </div>
          <div className="ta-hstat">
            <span className="ta-hstat-num ta-hstat-pos">{correctCount}</span>
            <span className="ta-hstat-label">Correct</span>
          </div>
          <div className="ta-hstat">
            <span className="ta-hstat-num ta-hstat-neg">{completed.length - correctCount}</span>
            <span className="ta-hstat-label">Wrong</span>
          </div>
          <div className="ta-hstat">
            <span className="ta-hstat-num">{completed.length > 0 ? Math.round((correctCount / completed.length) * 100) : 0}%</span>
            <span className="ta-hstat-label">Accuracy</span>
          </div>
        </div>
      )}

      <div className="ta-history-list">
        {entries.map((e) => (
          <HistoryCard key={e.key} entry={e} currentGw={currentGw} onDelete={() => handleDelete(e.key)} />
        ))}
      </div>
    </div>
  );
}

async function resolveOutcomes(entries, currentGw, uid) {
  // Collect all GWs we need to fetch
  const gwsNeeded = new Set();
  for (const e of entries) {
    const start = e.gameweek + 1;
    const end = e.gameweek + e.gameweeksToTrack;
    for (let gw = start; gw <= Math.min(end, currentGw); gw++) {
      gwsNeeded.add(gw);
    }
  }

  // Batch-fetch live data
  const liveData = {};
  const gwArr = [...gwsNeeded];
  const batchSize = 5;
  for (let i = 0; i < gwArr.length; i += batchSize) {
    const batch = gwArr.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map((gw) => getLiveGameweek(gw).catch(() => null))
    );
    batch.forEach((gw, idx) => {
      if (results[idx]) liveData[gw] = results[idx];
    });
  }

  // Calculate outcomes and write back
  for (const e of entries) {
    const start = e.gameweek + 1;
    const end = e.gameweek + e.gameweeksToTrack;
    let inPts = 0;
    let outPts = 0;
    const gwBreakdown = [];

    for (let gw = start; gw <= end; gw++) {
      const live = liveData[gw];
      if (!live) continue;
      const inEl = live.elements.find((el) => el.id === e.playerIn.id);
      const outEl = live.elements.find((el) => el.id === e.playerOut.id);
      const inGwPts = inEl?.stats?.total_points || 0;
      const outGwPts = outEl?.stats?.total_points || 0;
      inPts += inGwPts;
      outPts += outGwPts;
      gwBreakdown.push({ gw, inPts: inGwPts, outPts: outGwPts });
    }

    const rec = e.analysis.recommendation;
    let verdict;
    if (rec === "Strong Buy") {
      verdict = inPts >= outPts ? "correct" : "wrong";
    } else if (rec === "Avoid") {
      verdict = outPts >= inPts ? "correct" : "wrong";
    } else {
      verdict = inPts >= outPts ? "correct" : "wrong";
    }

    const outcome = { inActual: inPts, outActual: outPts, verdict, gwBreakdown };
    await set(ref(db, `tradeAnalyses/${uid}/${e.key}/outcome`), outcome);
  }
}

function HistoryCard({ entry, currentGw, onDelete }) {
  const e = entry;
  const endGw = e.gameweek + e.gameweeksToTrack;
  const isPending = !e.outcome && currentGw <= endGw;
  const gwsLeft = isPending ? endGw - currentGw + 1 : 0;

  const recClass =
    e.analysis.recommendation === "Strong Buy"
      ? "strong-buy"
      : e.analysis.recommendation === "Avoid"
        ? "avoid"
        : "neutral";

  const verdictClass = e.outcome?.verdict === "correct" ? "ta-verdict-correct" : "ta-verdict-wrong";
  const savedDate = new Date(e.savedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <div className={`ta-hcard ${e.outcome ? verdictClass : "ta-verdict-pending"}`}>
      <div className="ta-hcard-top">
        <div className="ta-hcard-meta">
          <span className="ta-hcard-date">{savedDate} &middot; GW{e.gameweek}</span>
          <span className="ta-hcard-tracking">{e.gameweeksToTrack} GW window</span>
        </div>
        <div className="ta-hcard-actions">
          <span className={`recommendation-badge ${recClass}`}>{e.analysis.recommendation}</span>
          <button className="ta-hcard-delete" onClick={onDelete} title="Delete">&times;</button>
        </div>
      </div>

      <div className="ta-hcard-players">
        <div className="ta-hcard-player ta-hcard-out">
          <span className="ta-hcard-dir">OUT</span>
          <span className={`position-badge position-${e.playerOut.position}`}>{e.playerOut.position}</span>
          <span className="ta-hcard-name">{e.playerOut.name}</span>
          <span className="ta-hcard-club">{e.playerOut.clubShort}</span>
        </div>
        <span className="ta-hcard-arrow">&#8594;</span>
        <div className="ta-hcard-player ta-hcard-in">
          <span className="ta-hcard-dir">IN</span>
          <span className={`position-badge position-${e.playerIn.position}`}>{e.playerIn.position}</span>
          <span className="ta-hcard-name">{e.playerIn.name}</span>
          <span className="ta-hcard-club">{e.playerIn.clubShort}</span>
        </div>
      </div>

      <div className="ta-hcard-comparison">
        <div className="ta-hcard-col">
          <span className="ta-hcard-col-label">Projected</span>
          <div className="ta-hcard-pts-row">
            <span className="ta-hcard-pts">{e.analysis.outProjected} xPts</span>
            <span className="ta-hcard-vs">vs</span>
            <span className="ta-hcard-pts">{e.analysis.inProjected} xPts</span>
          </div>
          <span className={`ta-hcard-diff ${e.analysis.pointsDiff > 0 ? "positive" : e.analysis.pointsDiff < 0 ? "negative" : ""}`}>
            {e.analysis.pointsDiff > 0 ? "+" : ""}{e.analysis.pointsDiff} diff
          </span>
        </div>
        {e.outcome ? (
          <div className="ta-hcard-col">
            <span className="ta-hcard-col-label">Actual</span>
            <div className="ta-hcard-pts-row">
              <span className="ta-hcard-pts">{e.outcome.outActual} pts</span>
              <span className="ta-hcard-vs">vs</span>
              <span className="ta-hcard-pts">{e.outcome.inActual} pts</span>
            </div>
            <span className={`ta-hcard-diff ${e.outcome.inActual - e.outcome.outActual > 0 ? "positive" : e.outcome.inActual - e.outcome.outActual < 0 ? "negative" : ""}`}>
              {e.outcome.inActual - e.outcome.outActual > 0 ? "+" : ""}{e.outcome.inActual - e.outcome.outActual} diff
            </span>
          </div>
        ) : (
          <div className="ta-hcard-col ta-hcard-pending">
            <span className="ta-hcard-col-label">Actual</span>
            <span className="ta-hcard-pending-text">
              {isPending ? `${gwsLeft} GW${gwsLeft > 1 ? "s" : ""} left` : "Resolving..."}
            </span>
          </div>
        )}
      </div>

      {e.outcome && (
        <div className={`ta-hcard-verdict ${verdictClass}`}>
          {e.outcome.verdict === "correct" ? "Prediction Correct" : "Prediction Wrong"}
        </div>
      )}

      {e.outcome?.gwBreakdown?.length > 0 && (
        <div className="ta-hcard-breakdown">
          {e.outcome.gwBreakdown.map((gw) => (
            <div key={gw.gw} className="ta-hcard-gw">
              <span className="ta-hcard-gw-label">GW{gw.gw}</span>
              <span className={gw.outPts > gw.inPts ? "negative" : gw.inPts > gw.outPts ? "positive" : ""}>{gw.outPts}</span>
              <span className="ta-hcard-gw-sep">vs</span>
              <span className={gw.inPts > gw.outPts ? "positive" : gw.outPts > gw.inPts ? "negative" : ""}>{gw.inPts}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TopPicks({ picks, onSelect }) {
  if (!picks || picks.length === 0) return null;
  return (
    <div className="trade-top-picks">
      <h4>Top Picks by xPts</h4>
      <div className="top-picks-grid">
        {picks.map((p) => (
          <button
            key={p.id}
            className="top-pick-card"
            onClick={() => onSelect(p.id)}
          >
            <div className="top-pick-header">
              <span className={`position-badge position-${p.position}`}>{p.position}</span>
              <span className="top-pick-xpts">{p.xpts} xPts</span>
            </div>
            <div className="top-pick-name">{p.name}</div>
            <div className="top-pick-meta">
              {p.clubShort} · £{p.price}m · {p.form} form
            </div>
            {p.topReasons?.length > 0 && (
              <div className="top-pick-reasons">
                {p.topReasons.slice(0, 2).map((r, i) => (
                  <span key={i} className="trade-reason-chip small">{r}</span>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function TradeAnalyzer({ teamData, teamLoading, teamError, teamReload }) {
  const { user } = useAuth();
  const [tab, setTab] = useState("analyze");
  const [playerOutId, setPlayerOutId] = useState(null);
  const [playerInId, setPlayerInId] = useState(null);
  const [gameweeks, setGameweeks] = useState(3);
  const [posFilter, setPosFilter] = useState("All");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy, setSortBy] = useState("xpts");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  const {
    data: availableData,
    loading: aLoading,
    error: aError,
  } = useApi(fetchAvailablePlayers);

  const loading = teamLoading || aLoading;
  const error = teamError || aError;

  const available = useMemo(() => availableData?.candidates || [], [availableData]);
  const teams = useMemo(() => availableData?.teams || teamData?.teams || {}, [availableData, teamData]);

  const allSquadPlayers = useMemo(
    () => [...(teamData?.players || []), ...(teamData?.bench || [])],
    [teamData]
  );

  const playerOut = useMemo(
    () => allSquadPlayers.find((p) => p.id === playerOutId),
    [allSquadPlayers, playerOutId]
  );

  const filteredAvailable = useMemo(() => {
    if (!available.length) return [];
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
      case "xpts": {
        const ranked = rankTransferTargets(sorted, teams, gameweeks);
        return ranked;
      }
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
  }, [available, posFilter, maxPrice, sortBy, teams, gameweeks]);

  const playerIn = useMemo(
    () => available.find((p) => p.id === playerInId),
    [available, playerInId]
  );

  const result = useMemo(() => {
    if (!playerOut || !playerIn) return null;
    return analyzeTransfer(playerOut, playerIn, gameweeks, teams);
  }, [playerOut, playerIn, gameweeks, teams]);

  // Top 3 picks for the position being filtered (or overall)
  const topPicks = useMemo(() => {
    if (!available.length) return [];
    let pool = available;
    if (posFilter !== "All") {
      pool = pool.filter((p) => p.position === posFilter);
    }
    return rankTransferTargets(pool, teams, gameweeks).slice(0, 3);
  }, [available, posFilter, teams, gameweeks]);

  function handlePlayerOutChange(id) {
    setPlayerOutId(id);
    if (id) {
      const p = allSquadPlayers.find((pl) => pl.id === id);
      if (p) setPosFilter(p.position);
    }
  }

  async function handleSaveAnalysis() {
    if (!user || !result || !playerOut || !playerIn) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const analysisRef = push(ref(db, `tradeAnalyses/${user.uid}`));
      await set(analysisRef, {
        savedAt: new Date().toISOString(),
        gameweek: teamData.summary.currentGameweek,
        gameweeksToTrack: gameweeks,
        playerOut: {
          id: playerOut.id,
          name: playerOut.name,
          position: playerOut.position,
          club: playerOut.club,
          clubShort: playerOut.clubShort,
          price: playerOut.price,
        },
        playerIn: {
          id: playerIn.id,
          name: playerIn.name,
          position: playerIn.position,
          club: playerIn.club,
          clubShort: playerIn.clubShort,
          price: playerIn.price,
        },
        analysis: {
          recommendation: result.recommendation,
          pointsDiff: result.pointsDiff,
          outProjected: result.outProjected,
          inProjected: result.inProjected,
          riskLevel: result.riskLevel,
          explanation: result.explanation,
        },
      });
      setSaveMessage("Saved! Track it in the History tab.");
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error("Save failed:", err);
      setSaveMessage("Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingSpinner message="Loading trade data..." />;
  if (error) return <ErrorMessage message={error} onRetry={teamReload} />;

  return (
    <div className="trade-analyzer">
      <div className="ta-tabs">
        <button className={`ta-tab ${tab === "analyze" ? "active" : ""}`} onClick={() => setTab("analyze")}>
          Analyze
        </button>
        <button className={`ta-tab ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>
          History
        </button>
      </div>

      {tab === "history" && user && <HistoryTab uid={user.uid} />}
      {tab === "history" && !user && (
        <div className="ta-history-empty">
          <p>Log in to save and track analyses.</p>
        </div>
      )}

      {tab === "analyze" && (<>
      <div className="trade-controls">
        <div className="controls-card">
          <h3>Transfer Setup</h3>
          <PlayerSelector
            label="Transfer Out"
            players={allSquadPlayers}
            selected={playerOutId}
            onChange={handlePlayerOutChange}
            groups={[
              { label: "Starting XI", players: teamData.players || [] },
              { label: "Bench", players: teamData.bench || [] },
            ]}
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
              <PlayerStatCard player={playerOut} label="OUT" teams={teams} />
              {playerOut && playerIn && <div className="versus-icon">vs</div>}
              <PlayerStatCard player={playerIn} label="IN" teams={teams} />
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
          <div>
            <TradeResult
              result={result}
              playerOut={playerOut}
              playerIn={playerIn}
            />
            {user && (
              <div className="ta-save-row">
                <button className="ta-save-btn" onClick={handleSaveAnalysis} disabled={saving}>
                  {saving ? "Saving..." : "Save Analysis"}
                </button>
                {saveMessage && <span className="ta-save-msg">{saveMessage}</span>}
              </div>
            )}
          </div>
          <FixtureComparison
            playerOut={playerOut}
            playerIn={playerIn}
            gameweeks={gameweeks}
          />
        </div>
      )}

      {!playerOutId && !playerInId && (
        <>
          <TopPicks picks={topPicks} onSelect={setPlayerInId} />
          <div className="trade-placeholder">
            <div className="placeholder-icon">&#8644;</div>
            <p>Select players above to analyze a potential transfer</p>
          </div>
        </>
      )}
      </>)}
    </div>
  );
}
