# Implementation Plan: Firebase Hosting + Auth + DB on maghov.no

## Overview

Migrate from GitHub Pages + Netlify Functions to Firebase Hosting with Cloud Functions, while keeping Firebase Authentication and Realtime Database as-is. Serve the app on the custom domain `maghov.no`.

---

## What Changes and What Doesn't

| File | Change |
|---|---|
| `vite.config.js` | Change `base` from `/FF2026/` to `/` |
| `package.json` | Update `homepage`, add firebase deploy script, remove `gh-pages` dep |
| `src/services/fplApi.js` | Replace Netlify/CORS proxy fallback chain with Cloud Function call |
| `firebase.json` | **New** — Hosting config with SPA rewrites + Cloud Function rewrite |
| `.firebaserc` | **New** — Links project to Firebase project ID `chat-gtp-b0e1d` |
| `functions/` | **New directory** — Cloud Function for FPL API proxy |
| `.github/workflows/deploy.yml` | Replace GitHub Pages deploy with Firebase deploy |
| `src/firebase.js` | No changes |
| `src/context/AuthContext.jsx` | No changes |
| `netlify.toml` | Delete |
| `netlify/functions/fpl-proxy.mjs` | Delete (replaced by Cloud Function) |

---

## Step 1 — Firebase Project Files

### firebase.json

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "/api/fpl-proxy",
        "function": "fplProxy"
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "/assets/**",
        "headers": [
          { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
        ]
      },
      {
        "source": "/data/**",
        "headers": [
          { "key": "Cache-Control", "value": "public, max-age=1800" }
        ]
      }
    ]
  },
  "functions": {
    "source": "functions"
  }
}
```

### .firebaserc

```json
{
  "projects": {
    "default": "chat-gtp-b0e1d"
  }
}
```

### functions/package.json

```json
{
  "name": "ff2026-functions",
  "type": "module",
  "engines": { "node": "20" },
  "dependencies": {
    "firebase-functions": "^6.0.0"
  }
}
```

### functions/index.js

Port of the existing Netlify proxy (`netlify/functions/fpl-proxy.mjs`):

```javascript
import { onRequest } from "firebase-functions/v2/https";

const FPL_BASE = "https://fantasy.premierleague.com/api";
const ALLOWED = /^(bootstrap-static|fixtures|entry|event|leagues-classic)\b/;

export const fplProxy = onRequest({ cors: true }, async (req, res) => {
  const path = req.query.path;

  if (!path) {
    return res.status(400).json({ error: "Missing ?path= parameter" });
  }

  if (!ALLOWED.test(path)) {
    return res.status(403).json({ error: "Path not allowed" });
  }

  try {
    const response = await fetch(`${FPL_BASE}/${path}`, {
      headers: { "User-Agent": "FF2026/1.0" },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `FPL API returned ${response.status}` });
    }

    const data = await response.json();
    res.set("Cache-Control", "public, max-age=120");
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: `Proxy fetch failed: ${err.message}` });
  }
});
```

---

## Step 2 — Vite Config

In `vite.config.js`, change:

```diff
- base: '/FF2026/',
+ base: '/',
```

The dev server proxy stays as-is (only used during `npm run dev`).

---

## Step 3 — FPL API Client

Simplify `src/services/fplApi.js`. The production fetch path becomes:

1. Try pre-fetched static data (`/data/bootstrap.json`, `/data/fixtures.json`) — instant, no network
2. Call `/api/fpl-proxy?path=...` — the Firebase Cloud Function on the same domain, no CORS issues

Remove:
- The `CORS_PROXIES` array and `tryCorsProxy` / racing logic
- The `netlifyProxyAvailable` tracking
- The `lastWorkingProxy` tracking

The simplified `fetchJson` in production:

```javascript
async function fetchJson(path) {
  // In development, Vite proxy handles CORS
  if (import.meta.env.DEV) {
    const res = await fetch(`/fpl-api/${path}`);
    if (!res.ok) throw new Error(`FPL API error (${res.status})`);
    return res.json();
  }

  // 1. Try pre-fetched static data first
  const staticPaths = {
    "bootstrap-static/": "bootstrap.json",
    "fixtures/": "fixtures.json",
  };
  if (staticPaths[path]) {
    try {
      const base = import.meta.env.BASE_URL || "/";
      const res = await fetchWithTimeout(`${base}data/${staticPaths[path]}`, 3000);
      if (res.ok) {
        const data = await res.json();
        if (data && (Array.isArray(data) ? data.length > 0 : Object.keys(data).length > 0)) {
          return data;
        }
      }
    } catch {
      // Static data not available, continue
    }
  }

  // 2. Firebase Cloud Function proxy (same domain, no CORS)
  const res = await fetchWithTimeout(`/api/fpl-proxy?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error(`FPL API error (${res.status})`);
  return res.json();
}
```

---

## Step 4 — package.json

```diff
- "homepage": "https://maghov.github.io/FF2026",
+ "homepage": "https://maghov.no",
```

```diff
  "scripts": {
    "dev": "vite",
    "prefetch": "node scripts/prefetch-fpl.mjs && node scripts/prefetch-understat.mjs && node scripts/prefetch-odds.mjs",
    "build": "node scripts/prefetch-fpl.mjs; node scripts/prefetch-understat.mjs; node scripts/prefetch-odds.mjs; vite build && cp dist/index.html dist/404.html",
    "lint": "eslint .",
    "preview": "vite preview",
-   "predeploy": "npm run build",
-   "deploy": "gh-pages -d dist",
+   "deploy": "firebase deploy",
    "seed": "node scripts/seedFirebase.mjs"
  },
```

```diff
  "dependencies": {
    "firebase": "^12.9.0",
-   "gh-pages": "^6.3.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
```

---

## Step 5 — GitHub Actions Workflow

Replace `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Firebase Hosting

on:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: firebase-deploy
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci
      - run: npm run build

      - name: Install function dependencies
        run: cd functions && npm ci

      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          channelId: live
```

### How to get `FIREBASE_SERVICE_ACCOUNT`

1. Go to Firebase Console → Project Settings → Service accounts
2. Click "Generate new private key" — downloads a JSON file
3. In your GitHub repo → Settings → Secrets → Actions → New repository secret
4. Name: `FIREBASE_SERVICE_ACCOUNT`, Value: paste the entire JSON content

---

## Step 6 — Delete Netlify Files

Remove:
- `netlify.toml`
- `netlify/functions/fpl-proxy.mjs`
- `netlify/` directory

---

## Step 7 — Manual Steps (Firebase Console + DNS)

These cannot be automated and must be done by hand.

### 7a. Upgrade to Blaze Plan

Cloud Functions require the Blaze (pay-as-you-go) plan. Free usage quotas still apply — this app will almost certainly stay within them.

1. Firebase Console → Project settings → Billing
2. Upgrade to Blaze plan (requires a payment method)

### 7b. Add maghov.no to Auth Authorized Domains

1. Firebase Console → Authentication → Settings → Authorized domains
2. Add `maghov.no`
3. Add `www.maghov.no`

Without this, Firebase Auth will reject sign-in attempts from the new domain.

### 7c. Connect Custom Domain in Firebase Hosting

1. Firebase Console → Hosting → Add custom domain
2. Enter `maghov.no`
3. Firebase provides a TXT record for verification — add it at your registrar
4. After verification, Firebase provides two A records — add them at your registrar
5. Repeat for `www.maghov.no` (or set up a redirect)

### 7d. DNS Records at Registrar (Domeneshop or similar)

```
Type    Name              Value                           TTL
TXT     maghov.no         <verification string from Firebase>  3600
A       maghov.no         <IP address 1 from Firebase>         3600
A       maghov.no         <IP address 2 from Firebase>         3600
CNAME   www.maghov.no     maghov.no                            3600
```

SSL is automatic — Firebase provisions a certificate once DNS propagates (can take up to 24-48 hours, usually much faster).

### 7e. First Deploy

```bash
npm install -g firebase-tools
firebase login
cd functions && npm install && cd ..
npm run build
firebase deploy
```

---

## Important Notes

- **Blaze plan billing**: Cloud Functions require Blaze. You will not be charged unless you exceed the free quotas (2M invocations/month, 400K GB-seconds/month). For an FPL dashboard this is effectively free, but set a budget alert in Google Cloud Console just in case.
- **Cold starts**: The Cloud Function may take 200-500ms extra on the first request after being idle. The static data fallback covers the two most common endpoints (bootstrap, fixtures), so most page loads won't hit the function at all.
- **No changes to Auth or DB**: Firebase Auth and Realtime Database are called client-side via the Firebase SDK. They work identically regardless of where the SPA is hosted. Only the `authDomain` authorized domains list needs updating.
- **Rollback**: Firebase Hosting keeps previous deploys. You can instantly roll back to any prior version in the Firebase Console → Hosting → Release history.

---

## Migration Checklist

- [ ] Create `firebase.json`
- [ ] Create `.firebaserc`
- [ ] Create `functions/package.json` and `functions/index.js`
- [ ] Update `vite.config.js` — change `base` to `/`
- [ ] Simplify `src/services/fplApi.js` — remove CORS proxy chain
- [ ] Update `package.json` — homepage, scripts, remove gh-pages
- [ ] Update `.github/workflows/deploy.yml` — Firebase deploy
- [ ] Delete `netlify.toml` and `netlify/functions/`
- [ ] Upgrade Firebase project to Blaze plan
- [ ] Add `maghov.no` to Firebase Auth authorized domains
- [ ] Connect `maghov.no` in Firebase Hosting console
- [ ] Add DNS records at registrar
- [ ] Add `FIREBASE_SERVICE_ACCOUNT` secret in GitHub repo
- [ ] Run first deploy: `npm run build && firebase deploy`
- [ ] Verify: site loads on https://maghov.no, auth works, FPL data loads
