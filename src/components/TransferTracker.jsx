import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useApi } from "../hooks/useApi";
import { fetchTransferHistory } from "../services/api";
import { calculateMultiGwXpts } from "../services/xpts";
import { useAuth } from "../context/AuthContext";
import { ref, get, set } from "firebase/database";
import { db } from "../firebase";
import "./TransferTracker.css";

const POSITIONS = ["All", "GK", "DEF", "MID", "FWD"];

const CHIP_LABELS = {
  freehit: "FH",
  wildcard: "WC",
  bboost: "BB",
  "3xc": "TC",
};

const CHIP_NAMES = {
  freehit: "Free Hit",
  wildcard: "Wildcard",
  bboost: "Bench Boost",
  "3xc": "Triple Captain",
};

export default function TransferTracker() {
  const { fplCode, user } = useAuth();
  const { data: result, loading, error, reload } = useApi(fetchTransferHistory, [fplCode]);
  const transfers = useMemo(() => result?.transfers || [], [result]);
  const teams = useMemo(() => result?.teams || {}, [result]);
  const chips = useMemo(() => result?.chips || [], [result]);
  const [expandedId, setExpandedId] = useState(null);
  const [posFilter, setPosFilter] = useState("All");
  const [viewMode, setViewMode] = useState("weekly"); // "individual" | "weekly"
  const [newTransferIds, setNewTransferIds] = useState(new Set());
  const cardRefs = useRef({});

  // Firebase caching: save transfers when loaded, detect new ones, write xPts snapshots
  useEffect(() => {
    if (!transfers.length || !user) return;

    const cacheRef = ref(db, `transferCache/${user.uid}`);

    async function syncCache() {
      try {
        const snap = await get(cacheRef);
        const cached = snap.val();

        const newIds = new Set();
        if (cached?.transfers) {
          // Detect new transfers by comparing gameweek+playerIn combos
          const cachedKeys = new Set(
            cached.transfers.map((t) => `${t.gameweek}-${t.playerIn.id}`)
          );
          transfers.forEach((t, idx) => {
            if (!cachedKeys.has(`${t.gameweek}-${t.playerIn.id}`)) {
              newIds.add(idx);
            }
          });
          if (newIds.size > 0) setNewTransferIds(newIds);
        }

        // Save current transfers to Firebase
        await set(cacheRef, {
          transfers: transfers.map((t) => ({
            gameweek: t.gameweek,
            transferCost: t.transferCost,
            chip: t.chip || null,
            netGain: t.netGain,
            gameweeksCompared: t.gameweeksCompared,
            playerIn: { id: t.playerIn.id, name: t.playerIn.name, position: t.playerIn.position, club: t.playerIn.club, pointsSinceTransfer: t.playerIn.pointsSinceTransfer },
            playerOut: { id: t.playerOut.id, name: t.playerOut.name, position: t.playerOut.position, club: t.playerOut.club, pointsSinceTransfer: t.playerOut.pointsSinceTransfer },
          })),
          updatedAt: new Date().toISOString(),
        });

        // Write xPts snapshots for new transfers
        for (const idx of newIds) {
          const t = transfers[idx];
          const snapshotKey = `${t.gameweek}-${t.playerIn.id}`;
          const snapRef = ref(db, `xptsSnapshots/${user.uid}/${snapshotKey}`);

          // Skip if snapshot already exists
          const existing = await get(snapRef);
          if (existing.exists()) continue;

          let inXpts = { avgXpts: null, topReasons: [] };
          let outXpts = { avgXpts: null, topReasons: [] };

          try {
            const inResult = calculateMultiGwXpts(t.playerIn, t.playerIn.upcomingFixtures, teams, 3);
            inXpts = { avgXpts: inResult.avgXpts, topReasons: inResult.topReasons };
          } catch (e) {
            console.warn("xPts calc failed for playerIn", t.playerIn.name, e);
          }

          try {
            const outResult = calculateMultiGwXpts(t.playerOut, t.playerOut.upcomingFixtures, teams, 3);
            outXpts = { avgXpts: outResult.avgXpts, topReasons: outResult.topReasons };
          } catch (e) {
            console.warn("xPts calc failed for playerOut", t.playerOut.name, e);
          }

          await set(snapRef, {
            uid: user.uid,
            userName: user.displayName || "Unknown",
            capturedAt: new Date().toISOString(),
            gameweek: t.gameweek,
            transferCost: t.transferCost || 0,
            playerOut: {
              id: t.playerOut.id,
              name: t.playerOut.name,
              position: t.playerOut.position,
              club: t.playerOut.club,
              avgXpts: outXpts.avgXpts,
              topReasons: outXpts.topReasons,
            },
            playerIn: {
              id: t.playerIn.id,
              name: t.playerIn.name,
              position: t.playerIn.position,
              club: t.playerIn.club,
              avgXpts: inXpts.avgXpts,
              topReasons: inXpts.topReasons,
            },
          });
        }
      } catch (err) {
        console.error("Transfer cache sync error:", err);
      }
    }

    syncCache();
  }, [transfers, teams, user]);

  // Scroll to a transfer card
  const scrollToCard = useCallback((idx) => {
    const el = cardRefs.current[idx];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setExpandedId(idx);
      el.classList.add("transfer-highlight");
      setTimeout(() => el.classList.remove("transfer-highlight"), 2000);
    }
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>Analysing your transfers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p>Failed to load transfers: {error}</p>
        <button className="btn btn-primary" onClick={reload}>Retry</button>
      </div>
    );
  }

  if (transfers.length === 0) {
    return (
      <div className="transfers-empty">
        <div className="empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
        </div>
        <h3>No Transfers Yet</h3>
        <p>Your transfer history will appear here once you make transfers.</p>
      </div>
    );
  }

  // Filter by position
  const filtered = posFilter === "All"
    ? transfers
    : transfers.filter((t) => t.playerIn.position === posFilter || t.playerOut.position === posFilter);

  // Summary stats (always computed from all transfers, not filtered)
  const totalTransfers = transfers.length;
  const totalNetGain = transfers.reduce((s, t) => s + t.netGain, 0);
  const goodTransfers = transfers.filter((t) => t.netGain > 0).length;
  const successRate = totalTransfers > 0 ? Math.round((goodTransfers / totalTransfers) * 100) : 0;
  const bestIdx = transfers.reduce((bi, t, i) => (t.netGain > transfers[bi].netGain ? i : bi), 0);
  const worstIdx = transfers.reduce((wi, t, i) => (t.netGain < transfers[wi].netGain ? i : wi), 0);
  const bestTransfer = transfers[bestIdx];
  const worstTransfer = transfers[worstIdx];
  const totalCost = transfers.reduce((s, t) => s + (t.transferCost || 0), 0);

  // Cumulative chart data — sorted chronologically
  const chronological = [...transfers].sort((a, b) => a.gameweek - b.gameweek);
  const cumulativeData = [];
  let runningTotal = 0;
  for (const t of chronological) {
    runningTotal += t.netGain;
    cumulativeData.push({
      gw: t.gameweek,
      total: runningTotal,
      name: `${t.playerOut.name} → ${t.playerIn.name}`,
      chip: t.chip,
    });
  }
  // Add BB/TC chip markers at GWs that had no transfers (so they appear on the chart)
  const chartGws = new Set(cumulativeData.map(d => d.gw));
  for (const c of chips) {
    if ((c.name === 'bboost' || c.name === '3xc') && !chartGws.has(c.event)) {
      // Find the running total at this point
      const lastBefore = cumulativeData.filter(d => d.gw < c.event).pop();
      cumulativeData.push({
        gw: c.event,
        total: lastBefore?.total || 0,
        name: CHIP_NAMES[c.name],
        chip: c.name,
        chipOnly: true, // No transfer, just a marker
      });
    }
  }
  cumulativeData.sort((a, b) => a.gw - b.gw);
  const chartMax = Math.max(...cumulativeData.map((d) => Math.abs(d.total)), 1);

  return (
    <div className="transfer-tracker">
      {/* New transfer notification */}
      {newTransferIds.size > 0 && (
        <div className="new-transfer-banner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {newTransferIds.size} new transfer{newTransferIds.size > 1 ? "s" : ""} detected since last visit!
          <button className="new-transfer-dismiss" onClick={() => setNewTransferIds(new Set())}>Dismiss</button>
        </div>
      )}

      {/* Summary cards */}
      <div className="transfer-stats">
        <div className="stat-card">
          <div className="transfer-stat-value">{totalTransfers}</div>
          <div className="transfer-stat-label">Transfers Made</div>
        </div>
        <div className={`stat-card ${totalNetGain >= 0 ? "stat-positive" : "stat-negative"}`}>
          <div className="transfer-stat-value">
            {totalNetGain >= 0 ? "+" : ""}{totalNetGain}
          </div>
          <div className="transfer-stat-label">Net Points Gain</div>
        </div>
        <div className={`stat-card ${successRate >= 50 ? "stat-positive" : "stat-negative"}`}>
          <div className="transfer-stat-value">{successRate}%</div>
          <div className="transfer-stat-label">Success Rate</div>
        </div>
        <div className="stat-card clickable-stat stat-positive" onClick={() => scrollToCard(bestIdx)}>
          <div className="transfer-stat-value">+{bestTransfer.netGain}</div>
          <div className="transfer-stat-label">Best Transfer ↓</div>
        </div>
        <div className="stat-card clickable-stat stat-negative" onClick={() => scrollToCard(worstIdx)}>
          <div className="transfer-stat-value">{worstTransfer.netGain}</div>
          <div className="transfer-stat-label">Worst Transfer ↓</div>
        </div>
      </div>

      {/* Transfer cost warning */}
      {totalCost > 0 && (
        <div className="transfer-cost-banner">
          Total transfer costs: <strong>-{totalCost} pts</strong> (hits taken)
        </div>
      )}

      {/* Cumulative chart */}
      {cumulativeData.length > 1 && (
        <div className="cumulative-section">
          <h3 className="section-title">Cumulative Net Gain</h3>
          <div className="cumulative-chart">
            <div className="chart-zero-line" />
            {cumulativeData.map((d, i) => {
              const isPositive = d.total >= 0;
              const barHeight = d.chipOnly ? 0 : Math.max((Math.abs(d.total) / chartMax) * 50, 2);
              const chipLabel = d.chip ? CHIP_LABELS[d.chip] : null;
              return (
                <div key={i} className={`chart-bar-group ${d.chip ? "chart-bar-chip" : ""}`}>
                  {chipLabel && <span className={`chart-chip-tag chip-${d.chip}`}>{chipLabel}</span>}
                  <div className="chart-bar-area">
                    {d.chipOnly ? (
                      <div className="chart-bar-top">
                        <span className="chart-bar-val chart-chip-marker">
                          {CHIP_LABELS[d.chip]}
                        </span>
                      </div>
                    ) : isPositive ? (
                      <div className="chart-bar-top">
                        <span className="chart-bar-val">{d.total >= 0 ? "+" : ""}{d.total}</span>
                        <div className={`chart-bar bar-positive ${d.chip ? `bar-chip-${d.chip}` : ""}`} style={{ height: `${barHeight}%` }} />
                      </div>
                    ) : (
                      <div className="chart-bar-bottom">
                        <div className={`chart-bar bar-negative ${d.chip ? `bar-chip-${d.chip}` : ""}`} style={{ height: `${barHeight}%` }} />
                        <span className="chart-bar-val">{d.total}</span>
                      </div>
                    )}
                  </div>
                  <span className="chart-bar-label">GW{d.gw}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* View toggle + Position filter */}
      <div className="transfer-filter-bar">
        <div className="view-toggle">
          <button
            className={`view-toggle-btn ${viewMode === "weekly" ? "view-active" : ""}`}
            onClick={() => setViewMode("weekly")}
          >
            Weekly
          </button>
          <button
            className={`view-toggle-btn ${viewMode === "individual" ? "view-active" : ""}`}
            onClick={() => setViewMode("individual")}
          >
            Individual
          </button>
        </div>
        <span className="filter-label">Filter:</span>
        {POSITIONS.map((pos) => (
          <button
            key={pos}
            className={`filter-btn ${posFilter === pos ? "filter-active" : ""}`}
            onClick={() => setPosFilter(pos)}
          >
            {pos}
          </button>
        ))}
        <span className="filter-count">{filtered.length} transfer{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Transfer list — Individual view */}
      {viewMode === "individual" && (
        <div className="transfer-list">
          {filtered.map((t) => {
            const origIdx = transfers.indexOf(t);
            const isExpanded = expandedId === origIdx;
            const isPositive = t.netGain >= 0;
            const isNew = newTransferIds.has(origIdx);

            return (
              <div
                key={origIdx}
                ref={(el) => (cardRefs.current[origIdx] = el)}
                className={`transfer-card ${isPositive ? "transfer-positive" : "transfer-negative"} ${isNew ? "transfer-new" : ""}`}
                onClick={() => setExpandedId(isExpanded ? null : origIdx)}
              >
                {isNew && <div className="new-badge">NEW</div>}

                <div className="transfer-header">
                  <div className="transfer-gw-row">
                    <span className="transfer-gw">GW{t.gameweek}</span>
                    {t.chip && (
                      <span className={`transfer-chip-badge chip-${t.chip}`}>
                        {CHIP_LABELS[t.chip]} — {CHIP_NAMES[t.chip]}
                      </span>
                    )}
                  </div>
                  <div className={`transfer-net ${isPositive ? "net-positive" : "net-negative"}`}>
                    {isPositive ? "+" : ""}{t.netGain} pts
                  </div>
                </div>

                <div className="transfer-players">
                  <div className="transfer-player out">
                    <div className="transfer-direction">OUT</div>
                    <div className="transfer-player-info">
                      <span className="transfer-player-name">{t.playerOut.name}</span>
                      <span className="transfer-player-meta">
                        {t.playerOut.club} · {t.playerOut.position}
                      </span>
                    </div>
                    <div className="transfer-player-points">{t.playerOut.pointsSinceTransfer} pts</div>
                  </div>

                  <div className="transfer-arrow">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12l7 7 7-7" />
                    </svg>
                  </div>

                  <div className="transfer-player in">
                    <div className="transfer-direction">IN</div>
                    <div className="transfer-player-info">
                      <span className="transfer-player-name">{t.playerIn.name}</span>
                      <span className="transfer-player-meta">
                        {t.playerIn.club} · {t.playerIn.position}
                      </span>
                    </div>
                    <div className="transfer-player-points">{t.playerIn.pointsSinceTransfer} pts</div>
                  </div>
                </div>

                {t.transferCost > 0 && (
                  <div className="transfer-hit">-{t.transferCost} pt hit</div>
                )}

                <div className="transfer-meta">
                  {t.gameweeksCompared} GW{t.gameweeksCompared !== 1 ? "s" : ""} compared
                  <span className="expand-hint">{isExpanded ? "▲" : "▼"}</span>
                </div>

                {isExpanded && (
                  <div className="transfer-breakdown">
                    <div className="breakdown-header">
                      <span>GW</span>
                      <span>{t.playerOut.name}</span>
                      <span>{t.playerIn.name}</span>
                      <span>Diff</span>
                    </div>
                    {t.gwBreakdown.map((gw) => (
                      <div key={gw.gw} className="breakdown-row">
                        <span className="breakdown-gw">{gw.gw}</span>
                        <span className="breakdown-pts">{gw.outPts}</span>
                        <span className="breakdown-pts">{gw.inPts}</span>
                        <span className={`breakdown-diff ${gw.diff >= 0 ? "diff-positive" : "diff-negative"}`}>
                          {gw.diff >= 0 ? "+" : ""}{gw.diff}
                        </span>
                      </div>
                    ))}
                    <div className="breakdown-row breakdown-total">
                      <span className="breakdown-gw">Total</span>
                      <span className="breakdown-pts">{t.playerOut.pointsSinceTransfer}</span>
                      <span className="breakdown-pts">{t.playerIn.pointsSinceTransfer}</span>
                      <span className={`breakdown-diff ${t.netGain >= 0 ? "diff-positive" : "diff-negative"}`}>
                        {t.netGain >= 0 ? "+" : ""}{t.netGain}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Transfer list — Weekly grouped view */}
      {viewMode === "weekly" && (
        <WeeklyView transfers={filtered} expandedId={expandedId} setExpandedId={setExpandedId} />
      )}
    </div>
  );
}

/* ── Weekly Grouped View ─────────────────────────────────── */

function WeeklyView({ transfers, expandedId, setExpandedId }) {
  // Group transfers by gameweek (most recent first)
  const grouped = useMemo(() => {
    const byGw = {};
    for (const t of transfers) {
      if (!byGw[t.gameweek]) {
        byGw[t.gameweek] = {
          gameweek: t.gameweek,
          chip: t.chip,
          transfers: [],
          totalNetGain: 0,
          transferCost: t.transferCost || 0,
        };
      }
      byGw[t.gameweek].transfers.push(t);
      byGw[t.gameweek].totalNetGain += t.netGain;
    }
    return Object.values(byGw).sort((a, b) => b.gameweek - a.gameweek);
  }, [transfers]);

  return (
    <div className="transfer-list">
      {grouped.map((week) => {
        const gwKey = `gw-${week.gameweek}`;
        const isExpanded = expandedId === gwKey;
        const isPositive = week.totalNetGain >= 0;
        const count = week.transfers.length;

        return (
          <div
            key={gwKey}
            className={`transfer-card weekly-card ${isPositive ? "transfer-positive" : "transfer-negative"}`}
            onClick={() => setExpandedId(isExpanded ? null : gwKey)}
          >
            {/* Header */}
            <div className="transfer-header">
              <div className="transfer-gw-row">
                <span className="transfer-gw">GW{week.gameweek}</span>
                {week.chip && (
                  <span className={`transfer-chip-badge chip-${week.chip}`}>
                    {CHIP_LABELS[week.chip]} — {CHIP_NAMES[week.chip]}
                  </span>
                )}
                <span className="weekly-count">{count} transfer{count !== 1 ? "s" : ""}</span>
              </div>
              <div className={`transfer-net ${isPositive ? "net-positive" : "net-negative"}`}>
                {isPositive ? "+" : ""}{week.totalNetGain} pts
              </div>
            </div>

            {/* Compact transfer rows */}
            <div className="weekly-transfers">
              {week.transfers.map((t, i) => {
                const tPositive = t.netGain >= 0;
                return (
                  <div key={i} className="weekly-transfer-row">
                    <div className="weekly-player out">
                      <span className="weekly-player-name">{t.playerOut.name}</span>
                      <span className="weekly-player-meta">{t.playerOut.club}</span>
                    </div>
                    <div className="weekly-arrow">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </div>
                    <div className="weekly-player in">
                      <span className="weekly-player-name">{t.playerIn.name}</span>
                      <span className="weekly-player-meta">{t.playerIn.club}</span>
                    </div>
                    <div className={`weekly-diff ${tPositive ? "diff-positive" : "diff-negative"}`}>
                      {tPositive ? "+" : ""}{t.netGain}
                    </div>
                  </div>
                );
              })}
            </div>

            {week.transferCost > 0 && (
              <div className="transfer-hit">-{week.transferCost} pt hit</div>
            )}

            <div className="transfer-meta">
              <span className="expand-hint">{isExpanded ? "▲ Hide details" : "▼ Show details"}</span>
            </div>

            {/* Expanded: individual breakdowns */}
            {isExpanded && (
              <div className="weekly-expanded">
                {week.transfers.map((t, i) => (
                  <div key={i} className="weekly-detail-card">
                    <div className="weekly-detail-header">
                      <span className="weekly-detail-names">
                        {t.playerOut.name} → {t.playerIn.name}
                      </span>
                      <span className={`weekly-detail-net ${t.netGain >= 0 ? "diff-positive" : "diff-negative"}`}>
                        {t.netGain >= 0 ? "+" : ""}{t.netGain} pts
                      </span>
                    </div>
                    <div className="weekly-detail-meta">
                      {t.playerOut.position} · {t.gameweeksCompared} GW{t.gameweeksCompared !== 1 ? "s" : ""} compared
                    </div>
                    {t.gwBreakdown && (
                      <div className="transfer-breakdown">
                        <div className="breakdown-header">
                          <span>GW</span>
                          <span>{t.playerOut.name}</span>
                          <span>{t.playerIn.name}</span>
                          <span>Diff</span>
                        </div>
                        {t.gwBreakdown.map((gw) => (
                          <div key={gw.gw} className="breakdown-row">
                            <span className="breakdown-gw">{gw.gw}</span>
                            <span className="breakdown-pts">{gw.outPts}</span>
                            <span className="breakdown-pts">{gw.inPts}</span>
                            <span className={`breakdown-diff ${gw.diff >= 0 ? "diff-positive" : "diff-negative"}`}>
                              {gw.diff >= 0 ? "+" : ""}{gw.diff}
                            </span>
                          </div>
                        ))}
                        <div className="breakdown-row breakdown-total">
                          <span className="breakdown-gw">Total</span>
                          <span className="breakdown-pts">{t.playerOut.pointsSinceTransfer}</span>
                          <span className="breakdown-pts">{t.playerIn.pointsSinceTransfer}</span>
                          <span className={`breakdown-diff ${t.netGain >= 0 ? "diff-positive" : "diff-negative"}`}>
                            {t.netGain >= 0 ? "+" : ""}{t.netGain}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
