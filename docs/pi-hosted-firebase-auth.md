# Raspberry Pi Hosted App with Firebase Auth & Realtime Database

## Architecture: Pi Does the Hosting, Firebase Does the Identity

```
                        ┌─────────────────────────┐
                        │      Firebase Cloud      │
                        │  ┌───────────────────┐   │
                        │  │  Authentication    │   │
                        │  │  (email/password)  │   │
                        │  └───────────────────┘   │
                        │  ┌───────────────────┐   │
                        │  │  Realtime Database │   │
                        │  │  (user data, etc.) │   │
                        │  └───────────────────┘   │
                        └────────────┬────────────┘
                                     │ Firebase SDK calls
                                     │ (client-side JS)
                                     │
Internet ──── maghov.no ──── Router ──── Raspberry Pi
                               │         ┌──────────────────────┐
                          port forward    │  Nginx (reverse proxy)│
                          80 → Pi:80      │    ├─ Static SPA      │
                          443 → Pi:443    │    ├─ FPL API proxy   │
                                          │    └─ SSL (Let's Encrypt)
                                          └──────────────────────┘
```

**What lives where:**

| Concern | Where it runs | Why |
|---|---|---|
| React SPA (HTML/CSS/JS) | Raspberry Pi via Nginx | You control the server, no vendor dependency |
| Firebase Auth | Firebase cloud (client SDK) | Battle-tested auth with zero backend code |
| Realtime Database | Firebase cloud (client SDK) | Real-time sync, free tier is plenty for this app |
| FPL API proxy (CORS) | Raspberry Pi via Nginx or Node.js | Replaces Netlify Functions, no cold starts |
| SSL certificate | Pi via Let's Encrypt / Certbot | Free, auto-renewing HTTPS for maghov.no |
| DNS | Your domain registrar | Points maghov.no → your home IP |
| Build & deploy | GitHub Actions → Pi (via SSH) or manual | `npm run build` then copy `dist/` to Pi |

---

## Step 1: Domain Setup (maghov.no)

### DNS Configuration

At your domain registrar (Domeneshop, Norid-accredited registrar, etc.), create these DNS records:

```
Type    Name              Value                  TTL
A       maghov.no         <your-public-IP>       300
A       www.maghov.no     <your-public-IP>       300
```

### Dynamic IP Problem

Most Norwegian ISPs (Telenor, Telia, Altibox) assign dynamic public IPs. You need a way to keep the DNS record updated when your IP changes.

**Option A: Dynamic DNS service (simplest)**

Use a DDNS provider like [Duck DNS](https://www.duckdns.org/) (free) or [Cloudflare](https://www.cloudflare.com/) (free tier) and run an update script on the Pi:

```bash
# /home/pi/update-dns.sh (Cloudflare example)
#!/bin/bash
ZONE_ID="your-zone-id"
RECORD_ID="your-record-id"
API_TOKEN="your-cloudflare-api-token"

IP=$(curl -s https://api.ipify.org)

curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$RECORD_ID" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  --data "{\"type\":\"A\",\"name\":\"maghov.no\",\"content\":\"$IP\",\"ttl\":300}"
```

Run it every 5 minutes via cron:

```bash
crontab -e
# Add:
*/5 * * * * /home/pi/update-dns.sh >> /var/log/ddns.log 2>&1
```

**Option B: Cloudflare as DNS provider (recommended)**

Transfer DNS management for maghov.no to Cloudflare (free). This gives you:
- Built-in DDNS API (script above)
- DDoS protection and caching in front of your Pi
- Proxy mode hides your home IP from public DNS lookups
- Free SSL between user ↔ Cloudflare (combine with Let's Encrypt on Pi for full end-to-end)

To use Cloudflare, update your domain's nameservers at the registrar to point to Cloudflare's nameservers.

**Option C: Static IP from ISP**

Some Norwegian ISPs offer a static IP for a monthly fee (~50-100 NOK/month). This eliminates the DDNS complexity entirely. Check with your provider.

---

## Step 2: Raspberry Pi Setup

### Hardware Requirements

For this app (React SPA + Nginx + FPL proxy), the requirements are minimal:

| Component | Minimum | Recommended |
|---|---|---|
| Pi model | Pi 4 (2 GB) | Pi 4 (4 GB) or Pi 5 (4 GB) |
| Storage | 16 GB microSD | 32 GB+ microSD or USB SSD |
| Network | Wi-Fi | Ethernet (more reliable for a server) |
| Power | Official PSU | Official PSU + UPS HAT (optional) |

A Pi 5 is overkill for serving a static SPA. A Pi 4 with 2 GB RAM handles this comfortably.

### Base OS Setup

```bash
# Flash Raspberry Pi OS Lite (64-bit) using Raspberry Pi Imager
# Enable SSH during imaging, set hostname to e.g. "ff2026-server"

# After first boot, update everything
sudo apt update && sudo apt upgrade -y

# Install essentials
sudo apt install -y nginx certbot python3-certbot-nginx nodejs npm git ufw
```

### Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'   # ports 80 and 443
sudo ufw enable
```

### Router Port Forwarding

In your router admin panel, forward:

| External port | Internal IP | Internal port | Protocol |
|---|---|---|---|
| 80 | Pi's local IP (e.g. 192.168.1.50) | 80 | TCP |
| 443 | Pi's local IP | 443 | TCP |

Give the Pi a static local IP in your router's DHCP settings (or set it on the Pi itself).

---

## Step 3: Nginx Configuration

### Main Site Config

```nginx
# /etc/nginx/sites-available/maghov.no

server {
    listen 80;
    server_name maghov.no www.maghov.no;

    # Certbot will add the redirect to HTTPS here
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name maghov.no www.maghov.no;

    # SSL certs managed by Certbot (added automatically)
    # ssl_certificate /etc/letsencrypt/live/maghov.no/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/maghov.no/privkey.pem;

    root /var/www/ff2026;
    index index.html;

    # Gzip compression for faster delivery
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 256;

    # Cache static assets aggressively
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback — all routes serve index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # FPL API reverse proxy (replaces Netlify Functions)
    location /api/fpl/ {
        proxy_pass https://fantasy.premierleague.com/api/;
        proxy_set_header Host fantasy.premierleague.com;
        proxy_set_header Origin https://fantasy.premierleague.com;
        proxy_set_header Referer https://fantasy.premierleague.com/;
        proxy_set_header User-Agent "Mozilla/5.0";
        proxy_ssl_server_name on;

        # CORS headers for your frontend
        add_header Access-Control-Allow-Origin "https://maghov.no" always;
        add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type" always;

        # Handle preflight
        if ($request_method = OPTIONS) {
            return 204;
        }
    }
}
```

### Enable the Site

```bash
sudo ln -s /etc/nginx/sites-available/maghov.no /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t          # test config
sudo systemctl reload nginx
```

---

## Step 4: SSL with Let's Encrypt

```bash
# Get the certificate (Nginx plugin handles everything)
sudo certbot --nginx -d maghov.no -d www.maghov.no

# Certbot auto-renews via systemd timer. Verify:
sudo systemctl status certbot.timer

# Test renewal manually:
sudo certbot renew --dry-run
```

Certificates auto-renew every ~60 days. No maintenance needed.

---

## Step 5: Vite Config Changes

The app currently uses `/FF2026/` as the base path (for GitHub Pages subpath hosting). On maghov.no it should be `/`.

```js
// vite.config.js — changes needed

export default defineConfig({
  // Change from '/FF2026/' to '/' for root domain hosting
  base: '/',

  // Remove or update the dev proxy since Nginx handles it in production
  server: {
    proxy: {
      '/api/fpl': {
        target: 'https://fantasy.premierleague.com/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/fpl/, ''),
      },
    },
  },
})
```

### FPL API Client Update

Update the API client to use the Nginx proxy path instead of Netlify:

```js
// src/services/fplApi.js — change the base URL

// Before (Netlify proxy):
// const BASE = '/.netlify/functions/fpl-proxy'

// After (Nginx proxy on same domain):
const BASE = '/api/fpl'

// Example: fetch bootstrap data
// GET /api/fpl/bootstrap-static/ → proxied to fantasy.premierleague.com/api/bootstrap-static/
```

---

## Step 6: Firebase Config (Stays Almost the Same)

Firebase Auth and Realtime Database are called client-side from the browser. They work identically regardless of where the SPA is hosted. The only change needed:

### Add maghov.no as an Authorized Domain

In the [Firebase Console](https://console.firebase.google.com/):

1. Go to **Authentication → Settings → Authorized domains**
2. Add `maghov.no` and `www.maghov.no`

Without this, Firebase Auth will reject sign-in attempts from your domain.

### Firebase Config (no code changes needed)

```js
// src/firebase.js — this stays exactly the same
const firebaseConfig = {
  apiKey: "AIzaSyBIy7mb_wS05I_0ICLMSX1P5avFim7yXsA",
  authDomain: "chat-gtp-b0e1d.firebaseapp.com",
  databaseURL: "https://pl-football-fantasy-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "chat-gtp-b0e1d",
  // ...
}
```

The Firebase SDK connects directly to Firebase's servers from the user's browser. Your Pi never touches Firebase traffic — it just serves the JS that contains these calls.

---

## Step 7: Build & Deploy

### Option A: Manual Deploy (simplest)

Build locally and copy to Pi:

```bash
# On your dev machine
npm run build

# Copy dist/ to the Pi
scp -r dist/* pi@192.168.1.50:/var/www/ff2026/
```

### Option B: GitHub Actions → Pi (automated)

Add an SSH deploy step to your existing GitHub Actions workflow:

```yaml
# .github/workflows/deploy-pi.yml
name: Deploy to Raspberry Pi

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci
      - run: npm run build

      - name: Deploy to Pi via SSH
        uses: appleboy/scp-action@v0.1.7
        with:
          host: maghov.no
          username: pi
          key: ${{ secrets.PI_SSH_KEY }}
          source: "dist/*"
          target: "/var/www/ff2026"
          strip_components: 1
```

For this to work:
- Your Pi must be reachable from the internet on port 22 (SSH), or use a Cloudflare Tunnel
- Store your Pi's SSH private key in GitHub repository secrets as `PI_SSH_KEY`
- Alternatively, use a Tailscale or WireGuard tunnel to avoid exposing SSH publicly

### Option C: Git Pull on Pi (simple & secure)

Keep SSH closed. Instead, pull from the Pi itself on a schedule:

```bash
# /home/pi/deploy.sh
#!/bin/bash
cd /home/pi/FF2026
git pull origin main
npm ci --production
npm run build
rsync -a --delete dist/ /var/www/ff2026/
```

```bash
# Run every 10 minutes or trigger manually
crontab -e
*/10 * * * * /home/pi/deploy.sh >> /var/log/ff2026-deploy.log 2>&1
```

---

## Step 8: Data Prefetch Scripts on Pi

The app currently prefetches FPL, Understat, and odds data at build time. On the Pi, you can run these as scheduled jobs independent of the build:

```bash
# /home/pi/prefetch.sh
#!/bin/bash
cd /home/pi/FF2026
node scripts/prefetch-fpl.mjs
node scripts/prefetch-understat.mjs
node scripts/prefetch-odds.mjs

# Rebuild and deploy with fresh data
npm run build
rsync -a --delete dist/ /var/www/ff2026/
```

```bash
# Run every 2 hours during active gameweeks
crontab -e
0 */2 * * * /home/pi/prefetch.sh >> /var/log/ff2026-prefetch.log 2>&1
```

This is actually a **major advantage** over static hosting — you can keep data fresh automatically without triggering a full CI/CD pipeline.

---

## Security Hardening

### Pi Security Basics

```bash
# Change default password
passwd

# Disable password auth, use SSH keys only
sudo nano /etc/ssh/sshd_config
# Set: PasswordAuthentication no
sudo systemctl restart sshd

# Install fail2ban to block brute-force SSH attempts
sudo apt install -y fail2ban
sudo systemctl enable fail2ban

# Keep the system updated automatically
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

### Nginx Security Headers

Add to the `server` block in the Nginx config:

```nginx
# Security headers
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' https://apis.google.com; connect-src 'self' https://*.firebaseio.com https://*.googleapis.com wss://*.firebaseio.com https://fantasy.premierleague.com; frame-src https://*.firebaseapp.com; style-src 'self' 'unsafe-inline';" always;
```

The CSP header is important — it whitelists Firebase domains so Auth and Realtime DB work, while blocking everything else.

---

## What This Setup Costs

| Item | One-time | Monthly |
|---|---|---|
| Raspberry Pi 4 (2 GB) | ~400 NOK | — |
| microSD card (32 GB) | ~100 NOK | — |
| Power supply | ~100 NOK | — |
| Case + heatsink | ~100 NOK | — |
| maghov.no domain | — | ~15 NOK/month (~180 NOK/year) |
| Electricity (Pi running 24/7) | — | ~5-10 NOK/month |
| SSL certificate (Let's Encrypt) | — | Free |
| Firebase Spark plan | — | Free |
| Cloudflare DNS (if used) | — | Free |
| **Total** | **~700 NOK** | **~20-25 NOK/month** |

Compare to:
- Vercel Pro: ~$20/month (~220 NOK/month)
- Netlify Pro: ~$19/month (~210 NOK/month)
- Firebase Blaze: Variable, likely ~$0-5/month for this traffic

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| ISP blocks port 80/443 | Site unreachable | Use Cloudflare Tunnel (bypasses port blocking entirely) |
| Power outage | Site goes down | UPS HAT (~200 NOK) gives 2-4 hours battery |
| SD card corruption | Data loss, downtime | Use USB SSD instead; keep code in Git (always recoverable) |
| Dynamic IP changes | Brief DNS downtime | Cloudflare DDNS script updates within 5 min |
| ISP upload speed bottleneck | Slow page loads for users | Cloudflare proxy caches static assets at edge |
| Pi hardware failure | Site goes down | The SPA is in Git, Firebase data is in the cloud — recovery is just flashing a new Pi |
| Security breach via SSH | Attacker on your network | Disable password auth, use fail2ban, or close SSH entirely and use Cloudflare Tunnel |

### Cloudflare Tunnel (avoids most risks)

If your ISP blocks ports or you want to avoid exposing your home IP:

```bash
# Install cloudflared on Pi
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb

# Authenticate with your Cloudflare account
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create ff2026

# Configure tunnel
cat > ~/.cloudflared/config.yml << EOF
tunnel: <tunnel-id>
credentials-file: /home/pi/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: maghov.no
    service: http://localhost:80
  - hostname: www.maghov.no
    service: http://localhost:80
  - service: http_status:404
EOF

# Run as service
sudo cloudflared service install
sudo systemctl start cloudflared
```

With Cloudflare Tunnel:
- No port forwarding needed on your router
- Your home IP is never exposed
- Works even if your ISP blocks incoming connections
- SSL is handled by Cloudflare (you can still use Let's Encrypt on Pi for belt-and-suspenders)

---

## Comparison: This Setup vs Pure Firebase Hosting

| Factor | Pi + Firebase Auth/DB | Pure Firebase Hosting |
|---|---|---|
| Monthly cost | ~20-25 NOK | Free (Spark) |
| Page load speed | Depends on your ISP upload + Cloudflare | Google CDN, always fast |
| Uptime | Only as good as your power/internet | 99.95%+ SLA |
| FPL API proxy | Nginx on Pi (no cold starts) | Cloud Function (cold start latency) |
| Data freshness | Cron jobs refresh every 2h on Pi | Need external trigger or Cloud Scheduler |
| Control | Full root access, any software | Limited to what Firebase supports |
| Learning value | High (Linux, networking, Nginx, DNS) | Low (managed service) |
| Custom domain | maghov.no via DNS A record | maghov.no via Firebase DNS verification |
| Maintenance | You handle updates, security, backups | Google handles everything |

### Honest Take

This setup is **excellent for learning** and gives you full control. For a personal FPL dashboard used by you and a handful of friends, the reliability is fine — the site might go down for a few minutes during power cuts or ISP hiccups, but it's not a business-critical app.

The biggest practical advantage over Firebase Hosting is the **FPL API proxy** — running it on Nginx has zero cold starts and no invocation limits, and you can schedule data refreshes without needing Cloud Scheduler (paid) or Cloud Functions.

The biggest practical disadvantage is **maintenance** — you're now responsible for keeping the Pi patched, Nginx configured, SSL renewed, and the deployment pipeline working. Firebase Hosting gives you all of that for free with `firebase deploy`.

**If you already have the Pi and enjoy tinkering, this is a great setup.** If you just want the app online with minimal effort, Firebase Hosting is the pragmatic choice.

---

## Migration Checklist

- [ ] Get Raspberry Pi set up with Raspberry Pi OS Lite
- [ ] Install Nginx, Node.js, Certbot, ufw
- [ ] Configure firewall (allow SSH, HTTP, HTTPS)
- [ ] Set up port forwarding on router (or Cloudflare Tunnel)
- [ ] Point maghov.no DNS to your public IP (or Cloudflare nameservers)
- [ ] Configure Nginx with SPA fallback and FPL proxy
- [ ] Run Certbot to get SSL certificate
- [ ] Update Vite config: change `base` from `/FF2026/` to `/`
- [ ] Update FPL API client to use `/api/fpl/` path
- [ ] Add maghov.no to Firebase Auth authorized domains
- [ ] Build and deploy the app to `/var/www/ff2026/`
- [ ] Set up cron jobs for DDNS updates and data prefetch
- [ ] Test: site loads on https://maghov.no, auth works, FPL data loads
- [ ] (Optional) Set up GitHub Actions SSH deploy
- [ ] (Optional) Harden SSH, install fail2ban
