import { useState } from "react";
import { useAuth } from "../../context/AuthContext";

export default function LoginPage() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    fplCode: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (isRegister) {
        if (!formData.name.trim()) throw new Error("Name is required.");
        if (!formData.fplCode.trim()) throw new Error("FPL kode is required.");
        await register(formData.name.trim(), formData.email, formData.password, formData.fplCode);
      } else {
        await login(formData.email, formData.password);
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-icon">FF</div>
          <div>
            <h1>My Football Fantasy</h1>
            <p className="subtitle">Season 2025/26</p>
          </div>
        </div>

        <h2 className="auth-title">{isRegister ? "Create account" : "Sign in"}</h2>

        <form onSubmit={handleSubmit} className="auth-form">
          {isRegister && (
            <div className="form-group">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={formData.name}
                onChange={handleChange}
                placeholder="Your name"
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={isRegister ? "new-password" : "current-password"}
              required
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
            />
          </div>

          {isRegister && (
            <div className="form-group">
              <label htmlFor="fplCode">FPL kode</label>
              <input
                id="fplCode"
                name="fplCode"
                type="number"
                required
                value={formData.fplCode}
                onChange={handleChange}
                placeholder="e.g. 5398119"
              />
            </div>
          )}

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="btn btn-primary auth-submit" disabled={submitting}>
            {submitting ? "Please wait..." : isRegister ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="auth-toggle">
          {isRegister ? "Already have an account?" : "No account yet?"}{" "}
          <button
            type="button"
            className="auth-toggle-btn"
            onClick={() => { setIsRegister((v) => !v); setError(""); }}
          >
            {isRegister ? "Sign in" : "Create account"}
          </button>
        </p>
      </div>
    </div>
  );
}
