import { useState, useRef, useEffect, useCallback } from "react";
import { useApi } from "../hooks/useApi";
import { fetchTransferHistory } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { ref, get, set } from "firebase/database";
import { db } from "../firebase";
import "./TransferTracker.css";

const POSITIONS = ["All", "GK", "DEF", "MID", "FWD"];

export default function TransferTracker() {
  const { fplCode, user } = useAuth();
  const { data: transfers, loading, error, reload } = useApi(fetchTransferHistory, [fplCode]);
  const [expandedId, setExpandedId] = useState(null);
  const [posFilter, setPosFilter] = useState("All");
  const [newTransferIds, setNewTransferIds] = useState(new Set());
  const cardRefs = useRef({});

  // Firebase caching: save transfers when loaded, detect new ones
  useEffect(() => {
    if (!transfers || transfers.length === 0 || !user) return;

    const cacheRef = ref(db, `transferCache/${user.uid}`);

    async function syncCache() {
      try {
        const snap = await get(cacheRef);
        const cached = snap.val();

        if (cached?.transfers) {
          // Detect new transfers by comparing gameweek+playerIn combos
          const cachedKeys = new Set(
            cached.transfers.map((t) => `${t.gameweek}-${t.playerIn.id}`)
          );
          const newIds = new Set();
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
            netGain: t.netGain,
            gameweeksCompared: t.gameweeksCompared,
            playerIn: { id: t.playerIn.id, name: t.playerIn.name, position: t.playerIn.position, club: t.playerIn.club, pointsSinceTransfer: t.playerIn.pointsSinceTransfer },
            playerOut: { id: t.playerOut.id, name: t.playerOut.name, position: t.playerOut.position, club: t.playerOut.club, pointsSinceTransfer: t.playerOut.pointsSinceTransfer },
          })),
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error("Transfer cache sync error:", err);
      }
    }

    syncCache();
  }, [transfers, user]);

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

  if (!transfers || transfers.length === 0) {
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
    cumulativeData.push({ gw: t.gameweek, total: runningTotal, name: `${t.playerOut.name} → ${t.playerIn.name}` });
  }
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
              const barHeight = Math.max((Math.abs(d.total) / chartMax) * 50, 2);
              return (
                <div key={i} className="chart-bar-group">
                  <div className="chart-bar-area">
                    {isPositive ? (
                      <div className="chart-bar-top">
                        <span className="chart-bar-val">{d.total >= 0 ? "+" : ""}{d.total}</span>
                        <div className="chart-bar bar-positive" style={{ height: `${barHeight}%` }} />
                      </div>
                    ) : (
                      <div className="chart-bar-bottom">
                        <div className="chart-bar bar-negative" style={{ height: `${barHeight}%` }} />
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

      {/* Position filter */}
      <div className="transfer-filter-bar">
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

      {/* Transfer list */}
      <div className="transfer-list">
        {filtered.map((t) => {
          // Use original index for refs and expand state
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
                <span className="transfer-gw">GW{t.gameweek}</span>
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

              {/* Expanded breakdown */}
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
                  {/* Cumulative total row */}
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
    </div>
  );
}
