import { useAuth } from "../context/AuthContext";

export default function Room3DApp({ onSwitchApp }) {
  const { user, logout } = useAuth();

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="brand">
            <div className="brand-icon room3d-icon">3D</div>
            <div>
              <h1>Room 3D</h1>
              <p className="subtitle">Sketch to 3D Model</p>
            </div>
          </div>
          <div className="user-info">
            <span className="user-name">{user.displayName}</span>
            <button className="btn btn-secondary app-switcher" onClick={onSwitchApp}>
              Football Fantasy
            </button>
            <button className="btn btn-secondary" onClick={logout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="room3d-placeholder">
          <div className="room3d-placeholder-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12l10-7 10 7"/>
              <path d="M4 10v10h16V10"/>
              <rect x="9" y="14" width="6" height="6"/>
            </svg>
          </div>
          <h2>Coming Soon</h2>
          <p>Upload a photo of your hand-drawn room sketch, and we'll generate an interactive 3D model you can explore and export.</p>
        </div>
      </main>
    </div>
  );
}
