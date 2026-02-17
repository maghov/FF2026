# CLAUDE.md — FF2026 Project Guide

## Project Overview
Fantasy Premier League dashboard built with React 19 + Vite 7, hosted on GitHub Pages at `https://maghov.github.io/FF2026/`. Uses Firebase for auth and user data, and the FPL public API for game data.

## Commands
- `npm run dev` — Start dev server (localhost:5173/FF2026/)
- `npm run build` — Pre-fetch FPL data + Vite production build + SPA 404 fallback
- `npm run lint` — ESLint check
- `npm run preview` — Preview production build locally

## Architecture
- **Components** (`src/components/`): One `.jsx` + matching `.css` per component. PascalCase filenames.
- **Services** (`src/services/`): `fplApi.js` handles raw FPL API calls with CORS proxy fallbacks. `api.js` transforms raw data into UI-ready structures.
- **Hooks** (`src/hooks/`): `useApi.js` custom hook for data fetching with deps array and auto-refresh.
- **Context** (`src/context/`): `AuthContext.jsx` provides `user`, `fplCode`, `isAdmin`, `login`, `register`, `logout`, `updateFplCode`.
- **Tab navigation**: App.jsx renders tabs conditionally — no React Router.

## Key Conventions
- CSS uses design tokens from `src/index.css` (e.g., `--primary`, `--card-bg`, `--text-primary`, `--border`). Dark mode is automatic via `prefers-color-scheme`.
- Prefix component-specific CSS class names to avoid collisions (e.g., `admin-stat-value` not `stat-value`).
- Import order: React → relative modules → services → styles last.
- All data flows through `useApi(fetchFn, [deps])` — pass `fplCode` as a dependency so API re-fetches when it changes.
- Admin access is gated by `user.email === "maghovk@gmail.com"`.

## Firebase
- Project: `pl-football-fantasy`
- DB: `https://pl-football-fantasy-default-rtdb.europe-west1.firebasedatabase.app`
- Data paths: `users/{uid}` (profile), `transferCache/{uid}` (cached transfer data)

## Deployment
- Push to `main` triggers GitHub Actions (`.github/workflows/deploy.yml`) which builds and deploys to GitHub Pages.
- Commit directly to `main` — no branch/PR workflow.

## FPL API CORS Strategy (production)
1. Netlify serverless function (`/api/fpl-proxy`)
2. Pre-fetched static JSON (`public/data/`)
3. Third-party CORS proxy fallbacks

## Versioning
- The version label is displayed in `src/App.jsx` as `<div className="version-label">v0.01</div>`.
- Increment the version number each time a new version is pushed (e.g., v0.01 → v0.02).

## Don't
- Don't use generic CSS class names that could collide across components.
- Don't add React Router — navigation is tab-based in App.jsx.
- Don't commit `.env` or Firebase credentials (the API key in `firebase.js` is public by design).
