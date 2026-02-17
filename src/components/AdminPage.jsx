import { useEffect, useState } from "react";
import { ref, get } from "firebase/database";
import { db } from "../firebase";
import { getLiveGameweek, getBootstrap } from "../services/fplApi";
import "./AdminPage.css";

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snapshots, setSnapshots] = useState([]);
  const [outcomes, setOutcomes] = useState({});
  const [outcomesLoading, setOutcomesLoading] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        // Load users and xPts snapshots in parallel
        const [usersSnap, xptsSnap, bootstrap] = await Promise.all([
          get(ref(db, "users")),
          get(ref(db, "xptsSnapshots")),
          getBootstrap(),
        ]);

        // Process users
        const usersData = usersSnap.val();
        if (usersData) {
          const list = Object.entries(usersData).map(([uid, val]) => ({
            uid,
            name: val.name || "Unknown",
            email: val.email || "N/A",
            fplCode: val.fplCode || "N/A",
            createdAt: val.createdAt || null,
          }));
          list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
          setUsers(list);
        }

        // Process xPts snapshots
        const xptsData = xptsSnap.val();
        if (xptsData) {
          const allSnaps = [];
          for (const [, userSnaps] of Object.entries(xptsData)) {
            for (const [, s] of Object.entries(userSnaps)) {
              allSnaps.push(s);
            }
          }
          allSnaps.sort((a, b) => b.gameweek - a.gameweek);
          setSnapshots(allSnaps);

          // Determine current GW from bootstrap
          const currentEvent = bootstrap.events.find((e) => e.is_current);
          const currentGw = currentEvent?.id || 1;

          // Compute actual outcomes
          if (allSnaps.length > 0) {
            setOutcomesLoading(true);
            const results = await computeOutcomes(allSnaps, currentGw);
            setOutcomes(results);
            setOutcomesLoading(false);
          }
        }
      } catch (err) {
        console.error("Failed to load admin data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>Loading admin data...</p>
      </div>
    );
  }

  const totalUsers = users.length;
  const withFpl = users.filter((u) => u.fplCode && u.fplCode !== "N/A").length;
  const recentWeek = users.filter((u) => {
    if (!u.createdAt) return false;
    const diff = Date.now() - new Date(u.createdAt).getTime();
    return diff < 7 * 24 * 60 * 60 * 1000;
  }).length;

  // Registration timeline: group by date
  const regByDate = {};
  users.forEach((u) => {
    if (!u.createdAt) return;
    const date = u.createdAt.slice(0, 10);
    regByDate[date] = (regByDate[date] || 0) + 1;
  });
  const regDates = Object.keys(regByDate).sort();
  const maxReg = Math.max(...Object.values(regByDate), 1);

  // xPts prediction stats
  const resolved = snapshots.filter((s) => {
    const key = `${s.uid}-${s.gameweek}-${s.playerIn.id}`;
    return outcomes[key] && outcomes[key].verdict !== "pending";
  });
  const correctCount = resolved.filter((s) => {
    const key = `${s.uid}-${s.gameweek}-${s.playerIn.id}`;
    return outcomes[key]?.verdict === "correct";
  }).length;
  const pendingCount = snapshots.length - resolved.length;
  const accuracyRate = resolved.length > 0 ? Math.round((correctCount / resolved.length) * 100) : 0;

  return (
    <div className="admin-page">
      <h2 className="admin-title">Admin Dashboard</h2>

      {/* Stats cards */}
      <div className="admin-stats">
        <div className="stat-card">
          <div className="admin-stat-value">{totalUsers}</div>
          <div className="admin-stat-label">Total Users</div>
        </div>
        <div className="stat-card">
          <div className="admin-stat-value">{withFpl}</div>
          <div className="admin-stat-label">With FPL Code</div>
        </div>
        <div className="stat-card">
          <div className="admin-stat-value">{recentWeek}</div>
          <div className="admin-stat-label">New This Week</div>
        </div>
        <div className="stat-card">
          <div className="admin-stat-value">
            {totalUsers > 0 ? Math.round((withFpl / totalUsers) * 100) : 0}%
          </div>
          <div className="admin-stat-label">FPL Linked</div>
        </div>
      </div>

      {/* Registration chart */}
      {regDates.length > 0 && (
        <div className="admin-section">
          <h3>Registrations Over Time</h3>
          <div className="reg-chart">
            {regDates.map((date) => (
              <div key={date} className="reg-bar-group">
                <div className="reg-bar-wrapper">
                  <div
                    className="reg-bar"
                    style={{ height: `${(regByDate[date] / maxReg) * 100}%` }}
                  >
                    <span className="reg-bar-count">{regByDate[date]}</span>
                  </div>
                </div>
                <span className="reg-bar-label">
                  {new Date(date + "T00:00:00").toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User table */}
      <div className="admin-section">
        <h3>All Users ({totalUsers})</h3>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>FPL Code</th>
                <th>Registered</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.uid}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td className="mono">{u.fplCode}</td>
                  <td>
                    {u.createdAt
                      ? new Date(u.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "N/A"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* xPts Prediction Tracker */}
      <div className="admin-section">
        <h3>xPts Prediction Tracker ({snapshots.length} predictions)</h3>

        {snapshots.length === 0 ? (
          <p className="admin-xpts-empty">No xPts predictions recorded yet. Predictions are captured when users visit the Transfers tab.</p>
        ) : (
          <>
            <div className="admin-xpts-stats">
              <div className="stat-card">
                <div className="admin-stat-value">{snapshots.length}</div>
                <div className="admin-stat-label">Tracked</div>
              </div>
              <div className="stat-card">
                <div className="admin-stat-value">{accuracyRate}%</div>
                <div className="admin-stat-label">Accuracy</div>
              </div>
              <div className="stat-card">
                <div className="admin-stat-value">{correctCount}</div>
                <div className="admin-stat-label">Correct</div>
              </div>
              <div className="stat-card">
                <div className="admin-stat-value">{pendingCount}</div>
                <div className="admin-stat-label">Pending</div>
              </div>
            </div>

            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>GW</th>
                    <th>Player Out</th>
                    <th>Out xPts</th>
                    <th>Player In</th>
                    <th>In xPts</th>
                    <th>Actual Diff</th>
                    <th>Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map((s) => {
                    const key = `${s.uid}-${s.gameweek}-${s.playerIn.id}`;
                    const outcome = outcomes[key];
                    const actualDiff = outcome?.actualDiff;
                    const verdict = outcome?.verdict || "pending";
                    const outHigher = (s.playerOut.avgXpts || 0) > (s.playerIn.avgXpts || 0);
                    const inHigher = (s.playerIn.avgXpts || 0) > (s.playerOut.avgXpts || 0);

                    return (
                      <tr key={key}>
                        <td>{s.userName}</td>
                        <td>GW{s.gameweek}</td>
                        <td>
                          {s.playerOut.name}
                          <span className="admin-xpts-club"> {s.playerOut.club}</span>
                        </td>
                        <td className={outHigher ? "admin-xpts-higher" : ""}>
                          {s.playerOut.avgXpts ?? "—"}
                        </td>
                        <td>
                          {s.playerIn.name}
                          <span className="admin-xpts-club"> {s.playerIn.club}</span>
                        </td>
                        <td className={inHigher ? "admin-xpts-higher" : ""}>
                          {s.playerIn.avgXpts ?? "—"}
                        </td>
                        <td className={actualDiff > 0 ? "admin-xpts-correct" : actualDiff < 0 ? "admin-xpts-wrong" : ""}>
                          {outcomesLoading ? "..." : actualDiff != null ? (actualDiff > 0 ? `+${actualDiff}` : actualDiff) : "—"}
                        </td>
                        <td>
                          <span className={`admin-xpts-badge admin-xpts-badge-${verdict}`}>
                            {verdict}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Compute actual outcomes for snapshots ───────────────── */

async function computeOutcomes(snapshots, currentGw) {
  // Collect all unique GWs we need to fetch
  const gwsNeeded = new Set();
  for (const s of snapshots) {
    for (let gw = s.gameweek; gw <= currentGw; gw++) {
      gwsNeeded.add(gw);
    }
  }

  // Fetch live data for each GW (batched, with cache)
  const liveData = {};
  const gwList = [...gwsNeeded].sort((a, b) => a - b);
  const batchSize = 5;
  for (let i = 0; i < gwList.length; i += batchSize) {
    const batch = gwList.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map((gw) => getLiveGameweek(gw).catch(() => null))
    );
    batch.forEach((gw, idx) => {
      if (results[idx]) liveData[gw] = results[idx];
    });
  }

  // Compute actual points diff for each snapshot
  const outcomes = {};
  for (const s of snapshots) {
    const key = `${s.uid}-${s.gameweek}-${s.playerIn.id}`;
    let inPoints = 0;
    let outPoints = 0;
    let hasData = false;

    for (let gw = s.gameweek; gw <= currentGw; gw++) {
      const live = liveData[gw];
      if (!live) continue;
      const inEl = live.elements.find((e) => e.id === s.playerIn.id);
      const outEl = live.elements.find((e) => e.id === s.playerOut.id);
      inPoints += inEl?.stats?.total_points || 0;
      outPoints += outEl?.stats?.total_points || 0;
      hasData = true;
    }

    if (!hasData) {
      outcomes[key] = { actualDiff: null, verdict: "pending" };
      continue;
    }

    const actualDiff = inPoints - outPoints;
    const predictedInHigher = (s.playerIn.avgXpts || 0) >= (s.playerOut.avgXpts || 0);
    const actualInHigher = actualDiff >= 0;

    // "correct" if xPts predicted the right direction
    const verdict = predictedInHigher === actualInHigher ? "correct" : "wrong";
    outcomes[key] = { actualDiff, verdict };
  }

  return outcomes;
}
