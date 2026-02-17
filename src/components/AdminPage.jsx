import { useEffect, useState } from "react";
import { ref, get } from "firebase/database";
import { db } from "../firebase";
import "./AdminPage.css";

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUsers() {
      try {
        const snap = await get(ref(db, "users"));
        const data = snap.val();
        if (data) {
          const list = Object.entries(data).map(([uid, val]) => ({
            uid,
            name: val.name || "Unknown",
            email: val.email || "N/A",
            fplCode: val.fplCode || "N/A",
            createdAt: val.createdAt || null,
          }));
          list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
          setUsers(list);
        }
      } catch (err) {
        console.error("Failed to load users:", err);
      } finally {
        setLoading(false);
      }
    }
    loadUsers();
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

  return (
    <div className="admin-page">
      <h2 className="admin-title">Admin Dashboard</h2>

      {/* Stats cards */}
      <div className="admin-stats">
        <div className="stat-card">
          <div className="stat-value">{totalUsers}</div>
          <div className="stat-label">Total Users</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{withFpl}</div>
          <div className="stat-label">With FPL Code</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{recentWeek}</div>
          <div className="stat-label">New This Week</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {totalUsers > 0 ? Math.round((withFpl / totalUsers) * 100) : 0}%
          </div>
          <div className="stat-label">FPL Linked</div>
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
    </div>
  );
}
