import { useState } from "react";
import CreateUserForm from "./CreateUserForm";
import ManageUserForm from "./ManageUserForm";
import "./UserPortal.css";

const PORTAL_PAGES = [
  { id: "create", label: "Create User" },
  { id: "manage", label: "Manage User" },
];

export default function UserPortal({ onBack }) {
  const [activePage, setActivePage] = useState("create");

  return (
    <div className="portal">
      <header className="portal-header">
        <div className="portal-header-content">
          <div className="portal-brand">
            <div className="portal-brand-icon">UP</div>
            <div>
              <h1>Manager User Portal</h1>
              <p className="portal-subtitle">User Administration</p>
            </div>
          </div>
          <nav className="portal-nav">
            {PORTAL_PAGES.map((page) => (
              <button
                key={page.id}
                className={`portal-nav-tab ${activePage === page.id ? "active" : ""}`}
                onClick={() => setActivePage(page.id)}
              >
                {page.label}
              </button>
            ))}
          </nav>
          <button className="portal-back-btn" onClick={onBack}>
            &larr; Back to Dashboard
          </button>
        </div>
      </header>

      <main className="portal-main">
        {activePage === "create" && <CreateUserForm />}
        {activePage === "manage" && <ManageUserForm />}
      </main>
    </div>
  );
}
