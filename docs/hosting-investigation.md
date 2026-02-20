# Hosting Investigation: Raspberry Pi + Firebase

## Current Architecture

FF2026 is a **React SPA** (Vite-built) for Fantasy Premier League analytics.

| Layer | Current Setup |
|-------|--------------|
| **Frontend hosting** | GitHub Pages (static `dist/` folder) |
| **CORS proxy** | Netlify Functions (`fpl-proxy.mjs`) |
| **Auth** | Firebase Authentication (already integrated) |
| **Database** | Firebase Realtime Database (already integrated) |
| **Build/CI** | GitHub Actions (build + deploy on push to `main`) |
| **Data prefetch** | Build-time scripts fetch FPL, Understat, odds data |

The app is entirely client-side. No persistent backend server is required.

---

## Option 1: Firebase Hosting (Recommended)

### What It Is

Firebase Hosting serves static content (HTML, CSS, JS, images) from a global CDN. It also supports Cloud Functions for server-side logic (replacing the Netlify proxy).

### Why It Fits This App Well

1. **Already using Firebase** -- Auth and Realtime Database are already integrated via `src/firebase.js`. Adding Firebase Hosting consolidates infrastructure into one platform.
2. **Static SPA** -- The app builds to a `dist/` folder of static assets. Firebase Hosting is purpose-built for this.
3. **Cloud Functions can replace Netlify Functions** -- The `fpl-proxy.mjs` CORS proxy can be reimplemented as a Firebase Cloud Function, eliminating the Netlify dependency.
4. **Free tier (Spark plan)** is generous for this use case:
   - 10 GB hosting storage
   - 360 MB/day transfer (~10 GB/month)
   - 125K Cloud Functions invocations/month
   - 5 GB Realtime Database storage
   - 50K Auth verifications/month
5. **Automatic SSL**, custom domain support, atomic deploys with rollback.

### Migration Steps

```
1. Install Firebase CLI:        npm install -g firebase-tools
2. Initialize project:          firebase init hosting
3. Set public directory:        dist
4. Configure as SPA:            Yes (rewrite all URLs to /index.html)
5. Port the CORS proxy:         Create a Cloud Function for fpl-proxy
6. Update vite.config.js:       Change `base` from '/FF2026/' to '/'
7. Deploy:                      firebase deploy
```

### Firebase Hosting Config (firebase.json)

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
        "source": "/data/**",
        "headers": [
          { "key": "Cache-Control", "value": "public, max-age=1800" }
        ]
      }
    ]
  }
}
```

### Cloud Function (replacing Netlify proxy)

```javascript
// functions/index.js
const { onRequest } = require("firebase-functions/v2/https");

const FPL_BASE = "https://fantasy.premierleague.com/api";
const allowed = /^(bootstrap-static|fixtures|entry|event|leagues-classic)\b/;

exports.fplProxy = onRequest({ cors: true }, async (req, res) => {
  const path = req.query.path;
  if (!path || !allowed.test(path)) {
    return res.status(400).json({ error: "Invalid path" });
  }

  const response = await fetch(`${FPL_BASE}/${path}`, {
    headers: { "User-Agent": "FF2026/1.0" },
  });

  const data = await response.json();
  res.set("Cache-Control", "public, max-age=120");
  res.json(data);
});
```

### Cost Assessment

| Usage Scenario | Spark (Free) | Blaze (Pay-as-you-go) |
|---|---|---|
| ~50 users/day | Well within free tier | N/A |
| ~500 users/day | May exceed transfer limits | ~$0.50-2/month |
| ~5000 users/day | Will exceed limits | ~$5-15/month |

### Pros
- Consolidates all services (hosting, auth, DB, functions) under one platform
- Global CDN with automatic SSL
- Generous free tier fits this app's scale
- Simple CLI deployment (`firebase deploy`)
- Preview channels for testing before going live
- GitHub Actions integration available

### Cons
- Cloud Functions add cold-start latency (~200-500ms on first request)
- Blaze plan required for Cloud Functions (pay-as-you-go, but still has free allocation)
- Vendor lock-in to Google/Firebase ecosystem

---

## Option 2: Raspberry Pi Self-Hosting

### What It Is

Running the app on a Raspberry Pi as a local or internet-facing web server.

### Viable Approaches

#### A. Pi as a Static File Server

Serve the pre-built `dist/` folder using Nginx or a lightweight Node.js server.

```
Pi Setup:
  - Raspberry Pi 4/5 (2GB+ RAM)
  - Raspberry Pi OS Lite (headless)
  - Nginx serving dist/ folder
  - Node.js for the CORS proxy
  - Let's Encrypt for SSL (via Certbot)
  - Dynamic DNS (e.g., DuckDNS) for a stable hostname
```

#### B. Pi as Full Dev/Build Server

Run `npm run build` on the Pi and serve the output.

```
Requirements:
  - Raspberry Pi 5 (4GB+ RAM recommended for Node.js builds)
  - Node.js 20+
  - ~500MB disk for node_modules
  - Build takes ~30-60 seconds on Pi 5
```

### Network Configuration Required

To make the Pi accessible from the internet:

1. **Port forwarding** on your router (ports 80/443 to the Pi's local IP)
2. **Dynamic DNS** service (most home IPs change periodically)
3. **SSL certificate** via Let's Encrypt / Certbot
4. **Firewall** configuration (UFW or iptables)

### Hardware Comparison

| Model | RAM | CPU | Suitable? | Notes |
|-------|-----|-----|-----------|-------|
| Pi 3B+ | 1 GB | 4x 1.4GHz | Marginal | Too slow for builds, OK for serving |
| Pi 4 | 2-8 GB | 4x 1.5GHz | Yes | Good for serving, slow builds |
| Pi 5 | 4-8 GB | 4x 2.4GHz | Best | Can handle builds + serving |
| Pi Zero 2W | 512 MB | 4x 1.0GHz | No | Too constrained |

### Resource Usage (Serving Only)

```
Nginx serving static files:
  - CPU: ~1-2% idle, ~5-10% under load
  - RAM: ~30-50 MB
  - Storage: ~50 MB (dist/ folder + deps)
  - Bandwidth: Depends on your ISP upload speed

Node.js CORS proxy:
  - CPU: ~1-5% per request
  - RAM: ~50-80 MB
  - Handles: ~50-100 concurrent requests comfortably on Pi 4/5
```

### Pros
- No recurring hosting costs (one-time hardware purchase)
- Full control over the server and data
- Educational/fun project
- Can run additional local services (home automation, etc.)
- No vendor lock-in

### Cons
- **Reliability**: Home internet has downtime, power outages, ISP issues
- **Performance**: Limited by home upload speeds (typically 10-50 Mbps)
- **Security burden**: You must maintain OS updates, firewall rules, SSL certs
- **No CDN**: All traffic goes through your home network -- slow for distant users
- **Dynamic IP**: Requires DDNS setup and may break periodically
- **Single point of failure**: Pi hardware failure = site down
- **Not suitable for production apps** with users outside your local network

---

## Option 3: Hybrid (Firebase Hosting + Raspberry Pi)

### Architecture

Use each platform for what it does best:

```
Internet Users
      |
      v
Firebase Hosting (CDN) ---- serves static React app
      |
      v
Firebase Auth + Realtime DB ---- user data (already in place)
      |
      v
Firebase Cloud Function ---- CORS proxy for FPL API


Your Home Network
      |
      v
Raspberry Pi ---- local dashboard display / kiosk mode
              ---- cron jobs for data prefetching
              ---- local development server
              ---- automated builds + deployment trigger
```

### Practical Hybrid Use Cases

| Use Case | Firebase | Raspberry Pi |
|----------|----------|-------------|
| **Serve app to the internet** | Yes (CDN) | No |
| **User authentication** | Yes (Firebase Auth) | No |
| **Store user data** | Yes (Realtime DB) | No |
| **CORS proxy for FPL API** | Yes (Cloud Function) | Alternative: local proxy |
| **Scheduled data prefetch** | Maybe (Cloud Scheduler) | Yes (cron + scripts) |
| **Local dashboard display** | No | Yes (kiosk mode in Chromium) |
| **Build & deploy pipeline** | GitHub Actions | Alternative: Pi runs builds |
| **Development server** | No | Yes (`npm run dev`) |

### Pi as a Build/Deploy Agent

The Pi could run a cron job or webhook listener that:
1. Pulls latest code from GitHub
2. Runs `npm run build` (including data prefetch scripts)
3. Deploys to Firebase Hosting via `firebase deploy`

This replaces GitHub Actions with a self-hosted builder:

```bash
#!/bin/bash
# /home/pi/deploy-ff2026.sh
cd /home/pi/FF2026
git pull origin main
npm ci
npm run build
firebase deploy --only hosting
```

### Pi as a Local Kiosk

Run the app on a monitor connected to the Pi for an always-on FPL dashboard:

```bash
# Auto-start Chromium in kiosk mode
chromium-browser --kiosk https://your-firebase-app.web.app
```

---

## Recommendation

### For Public-Facing Production Use: **Firebase Hosting**

The app already uses Firebase Auth and Realtime Database. Moving hosting to Firebase:
- Consolidates everything under one platform
- Provides CDN performance, SSL, and reliability
- Replaces the Netlify Function with a Cloud Function
- Stays within the free tier for typical FPL community usage
- Requires minimal code changes (mostly config)

### For the Raspberry Pi: **Use as a Companion, Not the Primary Host**

The Pi works well as:
- A local kiosk display for the dashboard
- A self-hosted build agent (replacing GitHub Actions)
- A cron runner for scheduled data prefetch jobs
- A development/testing server on your local network

It does **not** work well as:
- A public-facing web server (reliability, speed, security concerns)
- A replacement for CDN-backed hosting

### Migration Effort Estimate

| Task | Complexity |
|------|-----------|
| `firebase init hosting` + config | Low |
| Port `fpl-proxy.mjs` to Cloud Function | Low |
| Update `vite.config.js` base path | Trivial |
| Update GitHub Actions to deploy to Firebase | Low |
| Set up custom domain (optional) | Low |
| Set up Pi as kiosk/build agent (optional) | Medium |

---

## Next Steps

1. **Initialize Firebase Hosting** in the project
2. **Port the Netlify CORS proxy** to a Firebase Cloud Function
3. **Update the build/deploy pipeline** (GitHub Actions or Pi-based)
4. **Test the deployment** with Firebase preview channels
5. **(Optional)** Set up Raspberry Pi as a kiosk or build agent
