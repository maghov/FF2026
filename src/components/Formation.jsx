import { useState, useMemo, useEffect } from "react";
import { rankSquad, calculateXpts } from "../services/xpts";
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

/* ── Suggested formation logic (xPts-powered) ──────────────── */

const VALID_FORMATIONS = [
  [3, 4, 3], [3, 5, 2], [4, 3, 3], [4, 4, 2], [4, 5, 1], [5, 3, 2], [5, 4, 1],
];

function suggestFormation(allPlayers, teams) {
  const { ranked } = rankSquad(allPlayers, teams);
  const byPos = groupByPosition(ranked);

  for (const pos of Object.keys(byPos)) {
    byPos[pos].sort((a, b) => (b.xpts || 0) - (a.xpts || 0));
  }

  let bestFormation = null;
  let bestScore = -Infinity;
  let bestXI = null;
  let bestBench = null;

  for (const [d, m, f] of VALID_FORMATIONS) {
    if (byPos.GKP.length < 1 || byPos.DEF.length < d || byPos.MID.length < m || byPos.FWD.length < f) continue;

    const xi = [
      byPos.GKP[0],
      ...byPos.DEF.slice(0, d),
      ...byPos.MID.slice(0, m),
      ...byPos.FWD.slice(0, f),
    ];
    const xiIds = new Set(xi.map((p) => p.id));
    const bench = allPlayers.filter((p) => !xiIds.has(p.id));
    const totalScore = xi.reduce((s, p) => s + (p.xpts || 0), 0);

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestFormation = `${d}-${m}-${f}`;
      bestXI = xi;
      bestBench = bench;
    }
  }

  return { formation: bestFormation, xi: bestXI, bench: bestBench, score: bestScore };
}

/* ── FDR dots under player ─────────────────────────────────── */

function FdrDots({ fixtures }) {
  if (!fixtures || fixtures.length === 0) return null;
  return (
    <div className="formation-fdr-dots">
      {fixtures.slice(0, 3).map((f, i) => (
        <span
          key={i}
          className={`formation-fdr-dot fdr-dot-${f.difficulty}`}
          title={`GW${f.gw}: ${f.opponent} (FDR ${f.difficulty})`}
        />
      ))}
    </div>
  );
}

/* ── Swap validation ────────────────────────────────────────── */

function isValidFormation(xi) {
  const counts = { DEF: 0, MID: 0, FWD: 0, GKP: 0 };
  for (const p of xi) {
    if (counts[p.position] !== undefined) counts[p.position]++;
  }
  if (counts.GKP !== 1) return { valid: false, reason: "Must have exactly 1 goalkeeper in the XI" };
  const match = VALID_FORMATIONS.some(
    ([d, m, f]) => counts.DEF === d && counts.MID === m && counts.FWD === f
  );
  if (!match) return { valid: false, reason: `${counts.DEF}-${counts.MID}-${counts.FWD} is not a valid formation` };
  return { valid: true };
}

/* ── Pitch player ──────────────────────────────────────────── */

function PitchPlayer({ player, isSelected, isCompareSelected, isSwapSource, onSelect, compareMode, isSuggested, xpts }) {
  const handleClick = () => onSelect(player);
  const classes = [
    "pitch-player",
    isSelected ? "selected" : "",
    isCompareSelected ? "compare-selected" : "",
    isSwapSource ? "swap-source" : "",
    isSuggested ? "suggested-glow" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={classes} onClick={handleClick}>
      <div className={`pitch-shirt position-shirt-${player.position}`}>
        {player.isCaptain && <span className="pitch-armband">C</span>}
        {player.isViceCaptain && <span className="pitch-armband vc">V</span>}
        {compareMode && isCompareSelected && (
          <span className="pitch-compare-badge">VS</span>
        )}
        {xpts != null && (
          <span className="pitch-xpts-badge" title={`xPts: ${xpts}`}>{xpts}</span>
        )}
      </div>
      <div className="pitch-player-name">{player.name}</div>
      <div className="pitch-player-pts">{player.gameweekPoints} pts</div>
      <FdrDots fixtures={player.upcomingFixtures} />
    </div>
  );
}

/* ── Player detail panel ───────────────────────────────────── */

function PlayerDetail({ player, xptsData, onClose }) {
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
        {xptsData && (
          <div className="detail-stat">
            <span className="detail-stat-value highlight">{xptsData.xpts}</span>
            <span className="detail-stat-label">xPts</span>
          </div>
        )}
      </div>
      {xptsData?.topReasons?.length > 0 && (
        <div className="detail-xpts-reasons">
          {xptsData.topReasons.map((r, i) => (
            <span key={i} className="xpts-reason-chip">{r}</span>
          ))}
        </div>
      )}
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

/* ── Comparison panel ──────────────────────────────────────── */

function ComparePanel({ players, onClose }) {
  if (players.length < 2) return null;
  const [a, b] = players;

  const rows = [
    { label: "GW Pts", valA: a.gameweekPoints, valB: b.gameweekPoints },
    { label: "Total", valA: a.totalPoints, valB: b.totalPoints },
    { label: "Form", valA: a.form, valB: b.form },
    { label: "Price", valA: `£${a.price}m`, valB: `£${b.price}m`, isText: true },
  ];

  // Avg upcoming FDR
  const avgFdr = (p) => {
    const fix = p.upcomingFixtures || [];
    if (fix.length === 0) return 3;
    return (fix.slice(0, 3).reduce((s, f) => s + f.difficulty, 0) / Math.min(fix.length, 3)).toFixed(1);
  };
  rows.push({ label: "Avg FDR", valA: avgFdr(a), valB: avgFdr(b), lowerBetter: true });

  return (
    <div className="formation-compare">
      <div className="compare-header">
        <h4>Player Comparison</h4>
        <button className="detail-close" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div className="compare-names">
        <div className="compare-player-label">
          <span className={`position-badge position-${a.position}`}>{a.position}</span>
          <span>{a.name}</span>
        </div>
        <span className="compare-vs">VS</span>
        <div className="compare-player-label">
          <span className={`position-badge position-${b.position}`}>{b.position}</span>
          <span>{b.name}</span>
        </div>
      </div>

      <div className="compare-table">
        {rows.map((r) => {
          const numA = parseFloat(r.valA);
          const numB = parseFloat(r.valB);
          let winA = "", winB = "";
          if (!r.isText && !isNaN(numA) && !isNaN(numB)) {
            if (r.lowerBetter) {
              if (numA < numB) winA = "compare-win";
              else if (numB < numA) winB = "compare-win";
            } else {
              if (numA > numB) winA = "compare-win";
              else if (numB > numA) winB = "compare-win";
            }
          }
          return (
            <div key={r.label} className="compare-row">
              <span className={`compare-val ${winA}`}>{r.valA}</span>
              <span className="compare-label">{r.label}</span>
              <span className={`compare-val ${winB}`}>{r.valB}</span>
            </div>
          );
        })}
      </div>

      {/* Fixture comparison */}
      <div className="compare-fixtures">
        <div className="compare-fix-col">
          {(a.upcomingFixtures || []).slice(0, 5).map((f) => (
            <span key={f.gw} className={`detail-fixture-chip fdr-${f.difficulty}`}>{f.opponent}</span>
          ))}
        </div>
        <span className="compare-fix-label">Fixtures</span>
        <div className="compare-fix-col">
          {(b.upcomingFixtures || []).slice(0, 5).map((f) => (
            <span key={f.gw} className={`detail-fixture-chip fdr-${f.difficulty}`}>{f.opponent}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Suggested formation panel ─────────────────────────────── */

function SuggestedPanel({ suggestion, currentFormation, captainPick, onClose }) {
  if (!suggestion) return null;
  const isSame = suggestion.formation === currentFormation;

  return (
    <div className="formation-suggested-panel">
      <div className="compare-header">
        <h4>Suggested Formation</h4>
        <button className="detail-close" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      {isSame ? (
        <p className="suggested-verdict suggested-good">
          Your current {currentFormation} is already optimal based on xPts analysis.
        </p>
      ) : (
        <>
          <p className="suggested-verdict suggested-change">
            Consider switching from <strong>{currentFormation}</strong> to <strong>{suggestion.formation}</strong> to maximise expected points.
          </p>
          <div className="suggested-changes">
            <div className="suggested-changes-label">Move to bench:</div>
            {suggestion.bench
              .filter((p) => p.benchOrder === 0)
              .slice(0, 3)
              .map((p) => (
                <span key={p.id} className="suggested-chip bench-chip">
                  {p.name} <span className="suggested-chip-pos">{p.position}</span>
                  {p.xpts != null && <span className="suggested-chip-xpts">{p.xpts} xPts</span>}
                </span>
              ))}
            <div className="suggested-changes-label" style={{ marginTop: "0.5rem" }}>Bring into XI:</div>
            {suggestion.xi
              .filter((p) => p.benchOrder > 0)
              .slice(0, 3)
              .map((p) => (
                <span key={p.id} className="suggested-chip start-chip">
                  {p.name} <span className="suggested-chip-pos">{p.position}</span>
                  {p.xpts != null && <span className="suggested-chip-xpts">{p.xpts} xPts</span>}
                </span>
              ))}
          </div>
        </>
      )}
      {captainPick && (
        <div className="suggested-captain">
          <div className="suggested-changes-label" style={{ marginTop: "0.75rem" }}>Recommended captain:</div>
          <div className="captain-suggestion">
            <span className={`position-badge position-${captainPick.position}`}>{captainPick.position}</span>
            <strong>{captainPick.name}</strong>
            <span className="xpts-reason-badge">{captainPick.xpts} xPts</span>
            {captainPick.topReasons?.length > 0 && (
              <span className="captain-reasons">{captainPick.topReasons.join(" · ")}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main Formation component ──────────────────────────────── */

export default function Formation({ teamData, teamLoading, teamError, teamReload }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [comparePlayers, setComparePlayers] = useState([]);
  const [showSuggestion, setShowSuggestion] = useState(false);

  // Swap mode state — store swaps as [starterId, benchId] pairs
  const [swapMode, setSwapMode] = useState(false);
  const [swapSource, setSwapSource] = useState(null);
  const [swaps, setSwaps] = useState([]);
  const [swapError, setSwapError] = useState(null);

  // Auto-dismiss swap error
  useEffect(() => {
    if (!swapError) return;
    const t = setTimeout(() => setSwapError(null), 2500);
    return () => clearTimeout(t);
  }, [swapError]);

  const teams = useMemo(() => teamData?.teams || {}, [teamData]);

  const suggestion = useMemo(() => {
    if (!teamData) return null;
    const allPlayers = [...teamData.players, ...(teamData.bench || [])];
    return suggestFormation(allPlayers, teams);
  }, [teamData, teams]);

  // Compute xPts for all players (next fixture)
  const xptsMap = useMemo(() => {
    if (!teamData) return {};
    const allPlayers = [...teamData.players, ...(teamData.bench || [])];
    const map = {};
    for (const p of allPlayers) {
      const fix = p.upcomingFixtures?.[0] || { difficulty: 3, opponent: "TBD" };
      const result = calculateXpts(p, fix, teams);
      map[p.id] = result.xpts;
    }
    return map;
  }, [teamData, teams]);

  // Captain recommendation from suggestion
  const captainPick = useMemo(() => {
    if (!teamData) return null;
    const allPlayers = [...teamData.players, ...(teamData.bench || [])];
    const { captain } = rankSquad(allPlayers, teams);
    return captain;
  }, [teamData, teams]);

  // Derive effective players/bench by applying swaps to original data
  const { players, bench, hasSwaps } = useMemo(() => {
    if (!teamData) return { players: [], bench: [], hasSwaps: false };
    let xi = [...teamData.players];
    let bn = [...(teamData.bench || [])];
    for (const [idA, idB] of swaps) {
      const xiIdx = xi.findIndex((p) => p.id === idA);
      const bnIdx = bn.findIndex((p) => p.id === idB);
      if (xiIdx === -1 || bnIdx === -1) continue;
      [xi[xiIdx], bn[bnIdx]] = [bn[bnIdx], xi[xiIdx]];
    }
    return { players: xi, bench: bn, hasSwaps: swaps.length > 0 };
  }, [teamData, swaps]);

  if (teamLoading) return <LoadingSpinner message="Loading formation..." />;
  if (teamError) return <ErrorMessage message={teamError} onRetry={teamReload} />;

  const { summary } = teamData;

  const formation = detectFormation(players);
  const groups = groupByPosition(players);

  const suggestedXiIds = showSuggestion && suggestion ? new Set(suggestion.xi.map((p) => p.id)) : new Set();

  const starterIds = new Set(players.map((p) => p.id));

  function handlePlayerSelect(player) {
    if (swapMode) {
      handleSwapSelect(player);
      return;
    }
    if (compareMode) {
      setComparePlayers((prev) => {
        const exists = prev.find((p) => p.id === player.id);
        if (exists) return prev.filter((p) => p.id !== player.id);
        if (prev.length >= 2) return [prev[1], player];
        return [...prev, player];
      });
    } else {
      setSelectedPlayer((prev) => prev?.id === player.id ? null : player);
    }
  }

  function handleSwapSelect(player) {
    // No source yet — select this player
    if (!swapSource) {
      setSwapSource(player);
      return;
    }
    // Tapped same player — deselect
    if (swapSource.id === player.id) {
      setSwapSource(null);
      return;
    }

    const sourceIsStarter = starterIds.has(swapSource.id);
    const targetIsStarter = starterIds.has(player.id);

    // Both in same group — just switch source
    if (sourceIsStarter === targetIsStarter) {
      setSwapSource(player);
      return;
    }

    // One starter, one bench — attempt the swap
    const starter = sourceIsStarter ? swapSource : player;
    const benchPlayer = sourceIsStarter ? player : swapSource;

    // Build proposed XI to validate
    const newXI = players.map((p) => (p.id === starter.id ? benchPlayer : p));
    const result = isValidFormation(newXI);

    if (!result.valid) {
      setSwapError(result.reason);
      setSwapSource(null);
      return;
    }

    // Valid — record swap pair (starter id, bench id)
    setSwaps((prev) => [...prev, [starter.id, benchPlayer.id]]);
    setSwapSource(null);
  }

  function toggleSwap() {
    const next = !swapMode;
    setSwapMode(next);
    setSwapSource(null);
    setSwapError(null);
    if (next) {
      setCompareMode(false);
      setComparePlayers([]);
      setSelectedPlayer(null);
    }
  }

  function toggleCompare() {
    const next = !compareMode;
    setCompareMode(next);
    setComparePlayers([]);
    setSelectedPlayer(null);
    if (next) {
      setSwapMode(false);
      setSwapSource(null);
    }
  }

  function toggleSuggestion() {
    setShowSuggestion((prev) => !prev);
  }

  function resetSwaps() {
    setSwaps([]);
    setSwapSource(null);
    setSwapError(null);
  }

  const renderPlayer = (p) => (
    <PitchPlayer
      key={p.id}
      player={p}
      isSelected={selectedPlayer?.id === p.id}
      isCompareSelected={comparePlayers.some((cp) => cp.id === p.id)}
      isSwapSource={swapSource?.id === p.id}
      onSelect={handlePlayerSelect}
      compareMode={compareMode}
      isSuggested={showSuggestion && suggestedXiIds.has(p.id)}
      xpts={xptsMap[p.id]}
    />
  );

  return (
    <div className="formation-view">
      <div className="formation-header">
        <h3>Formation &mdash; {formation}</h3>
        <div className="formation-header-actions">
          <button
            className={`formation-action-btn ${swapMode ? "active" : ""}`}
            onClick={toggleSwap}
            title="Swap players between XI and bench"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
            </svg>
            <span>Swap</span>
          </button>
          {hasSwaps && (
            <button
              className="formation-action-btn formation-reset-btn"
              onClick={resetSwaps}
              title="Reset to original lineup"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
              </svg>
              <span>Reset</span>
            </button>
          )}
          <button
            className={`formation-action-btn ${compareMode ? "active" : ""}`}
            onClick={toggleCompare}
            title="Compare two players"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
            <span>Compare</span>
          </button>
          <button
            className={`formation-action-btn ${showSuggestion ? "active" : ""}`}
            onClick={toggleSuggestion}
            title="Suggest optimal formation"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
            <span>Suggest</span>
          </button>
          <span className="formation-gw">GW{summary.currentGameweek}</span>
        </div>
      </div>

      {compareMode && (
        <div className="formation-compare-hint">
          Tap any 2 players to compare them side-by-side
        </div>
      )}

      {swapMode && (
        <div className="formation-swap-hint">
          {swapSource
            ? <>Tap a {starterIds.has(swapSource.id) ? "bench" : "starting"} player to swap with <strong>{swapSource.name}</strong></>
            : "Tap a player, then tap another to swap them"
          }
        </div>
      )}

      {swapError && (
        <div className="swap-invalid-msg">{swapError}</div>
      )}

      <div className="pitch">
        <div className="pitch-surface">
          <div className="pitch-marking center-circle" />
          <div className="pitch-marking center-line" />
          <div className="pitch-marking penalty-box top" />
          <div className="pitch-marking penalty-box bottom" />

          <div className="pitch-row fwd-row">
            {groups.FWD.map(renderPlayer)}
          </div>
          <div className="pitch-row mid-row">
            {groups.MID.map(renderPlayer)}
          </div>
          <div className="pitch-row def-row">
            {groups.DEF.map(renderPlayer)}
          </div>
          <div className="pitch-row gk-row">
            {groups.GKP.map(renderPlayer)}
          </div>
        </div>

        {bench.length > 0 && (
          <div className="formation-bench">
            <div className="formation-bench-label">Bench</div>
            <div className="formation-bench-row">
              {bench.map((p, i) => (
                <div key={p.id} className="formation-bench-player">
                  <span className="bench-order">{i + 1}</span>
                  {renderPlayer(p)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {compareMode && comparePlayers.length === 2 && (
        <ComparePanel
          players={comparePlayers}
          onClose={() => setComparePlayers([])}
        />
      )}

      {!compareMode && !swapMode && selectedPlayer && (
        <PlayerDetail
          player={selectedPlayer}
          xptsData={calculateXpts(selectedPlayer, selectedPlayer.upcomingFixtures?.[0] || { difficulty: 3, opponent: "TBD" }, teams)}
          onClose={() => setSelectedPlayer(null)}
        />
      )}

      {showSuggestion && (
        <SuggestedPanel
          suggestion={suggestion}
          currentFormation={formation}
          captainPick={captainPick}
          onClose={() => setShowSuggestion(false)}
        />
      )}
    </div>
  );
}
