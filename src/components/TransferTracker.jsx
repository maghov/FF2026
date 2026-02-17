import { useState } from "react";
import { useApi } from "../hooks/useApi";
import { fetchTransferHistory } from "../services/api";
import { useAuth } from "../context/AuthContext";
import "./TransferTracker.css";

export default function TransferTracker() {
  const { fplCode } = useAuth();
  const { data: transfers, loading, error, reload } = useApi(fetchTransferHistory, [fplCode]);
  const [expandedId, setExpandedId] = useState(null);

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

  // Summary stats
  const totalTransfers = transfers.length;
  const totalNetGain = transfers.reduce((s, t) => s + t.netGain, 0);
  const bestTransfer = transfers.reduce((best, t) => (t.netGain > best.netGain ? t : best), transfers[0]);
  const worstTransfer = transfers.reduce((worst, t) => (t.netGain < worst.netGain ? t : worst), transfers[0]);
  const totalCost = transfers.reduce((s, t) => s + (t.transferCost || 0), 0);

  return (
    <div className="transfer-tracker">
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
        <div className="stat-card stat-positive">
          <div className="transfer-stat-value">+{bestTransfer.netGain}</div>
          <div className="transfer-stat-label">Best Transfer</div>
        </div>
        <div className="stat-card stat-negative">
          <div className="transfer-stat-value">{worstTransfer.netGain}</div>
          <div className="transfer-stat-label">Worst Transfer</div>
        </div>
      </div>

      {/* Transfer cost warning */}
      {totalCost > 0 && (
        <div className="transfer-cost-banner">
          Total transfer costs: <strong>-{totalCost} pts</strong> (hits taken)
        </div>
      )}

      {/* Transfer list */}
      <div className="transfer-list">
        {transfers.map((t, idx) => {
          const isExpanded = expandedId === idx;
          const isPositive = t.netGain >= 0;

          return (
            <div
              key={idx}
              className={`transfer-card ${isPositive ? "transfer-positive" : "transfer-negative"}`}
              onClick={() => setExpandedId(isExpanded ? null : idx)}
            >
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
