# My Football Fantasy 2025/26

A Fantasy Premier League dashboard built with React + Vite, powered by the official FPL API.

**Live site:** https://maghov.github.io/FF2026/

## Features

### My Team
- Shows your starting XI pulled from the FPL API for manager ID `5398119`
- Player cards display position, club, price, total points, current form, and gameweek points
- Captain (C) and vice-captain (V) badges
- Next fixture with colour-coded difficulty rating (FDR 1-5)
- Team summary card: GW points, total points, team value, bank, overall rank, free transfers, and chip availability

### Points Performance
- Key metrics: GW points, total points, captain bonus, and points vs league average
- Gameweek trend bar chart comparing your points against the league average
- Upcoming gameweek projections based on season averages and fixture difficulty
- League standings from your first private classic league
- Rank progression tracker showing movement across recent gameweeks

### Trade Analyzer
- Select a player to transfer out (from your squad) and a player to transfer in (top 25 in-form available players)
- Analyze over 1-5 gameweeks
- Generates a recommendation (Strong Buy / Neutral / Avoid) with:
  - Projected points difference
  - Form comparison
  - Price impact
  - Fixture difficulty swing
  - Risk rating (Low / Medium / High)
  - Written analysis explanation
- Side-by-side fixture comparison table

### User Portal
- Create User form with country, mobile, name, email, company, manager, employment dates, and role
- Manage User form to update existing user details

## FPL API Integration

All data is fetched live from `https://fantasy.premierleague.com/api/`. Key endpoints used:

| Endpoint | Purpose |
|---|---|
| `/bootstrap-static/` | All players, teams, gameweeks, positions |
| `/entry/{id}/` | Manager info (points, rank, team value, leagues) |
| `/entry/{id}/history/` | Gameweek history, past seasons, chips used |
| `/entry/{id}/event/{gw}/picks/` | Squad picks, captain, multipliers |
| `/event/{gw}/live/` | Live gameweek points per player |
| `/fixtures/` | All fixtures with difficulty ratings |
| `/leagues-classic/{id}/standings/` | Classic league standings |

### CORS Handling
The FPL API does not allow cross-origin requests from browsers. The app handles this with:
- **Development:** Vite dev server proxy (`/fpl-api/` -> `fantasy.premierleague.com/api`)
- **Production:** Uses `api.allorigins.win` as a CORS proxy with automatic fallback

## Tech Stack

- **React 19** with hooks
- **Vite 7** for bundling and dev server
- **CSS** with custom properties (design tokens) and dark mode support
- **Firebase** (Realtime Database - used by the User Portal)
- **GitHub Pages** for hosting via `gh-pages` package

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server (FPL API proxied automatically)
npm run dev

# Lint
npm run lint

# Build for production
npm run build

# Deploy to GitHub Pages
npm run deploy
```

## Project Structure

```
src/
  components/
    MyTeam.jsx          # Squad display with player cards
    PointsPerformance.jsx # Charts, metrics, league standings
    TradeAnalyzer.jsx   # Transfer simulator with analysis
    ErrorMessage.jsx    # Error display with retry
    LoadingSpinner.jsx  # Loading indicator
    portal/
      UserPortal.jsx    # Admin portal wrapper
      CreateUserForm.jsx
      ManageUserForm.jsx
  services/
    fplApi.js           # FPL API client (CORS proxy, caching)
    api.js              # Data transformation layer
  hooks/
    useApi.js           # Data fetching hook with auto-refresh
  data/
    mockData.js         # Reference mock data
    portalMockData.js   # Portal dropdown options
  App.jsx               # Tab-based navigation
  main.jsx              # React entry point
  firebase.js           # Firebase config
  index.css             # Global styles and design tokens
```

## Configuration

To change the FPL manager, update `MANAGER_ID` in `src/services/fplApi.js`.
