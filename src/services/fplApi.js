const FPL_BASE = "https://fantasy.premierleague.com/api";
let managerId = 5398119;

export function setManagerId(id) {
  managerId = Number(id);
}

export function getManagerId() {
  return managerId;
}

let bootstrapCache = null;
let fixturesCache = null;
const liveGwCache = {};

// Fallback CORS proxies (used only if the Netlify function is unavailable)
const CORS_PROXIES = [
  (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url) => `https://thingproxy.freeboard.io/fetch/${url}`,
];

async function fetchWithTimeout(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function fetchJson(path) {
  // In development, Vite proxy handles CORS — no proxy needed
  if (import.meta.env.DEV) {
    const res = await fetch(`/fpl-api/${path}`);
    if (!res.ok) throw new Error(`FPL API error (${res.status})`);
    return res.json();
  }

  // ── 1. Try our own Netlify serverless proxy (most reliable) ──
  try {
    const res = await fetchWithTimeout(`/api/fpl-proxy?path=${encodeURIComponent(path)}`);
    if (res.ok) return await res.json();
  } catch {
    // Netlify function unavailable, continue to fallbacks
  }

  // ── 2. Try pre-fetched static data (for bootstrap, fixtures & live GWs) ──
  const staticPaths = {
    "bootstrap-static/": "bootstrap.json",
    "fixtures/": "fixtures.json",
  };
  // Match live GW paths: event/{gw}/live/ → live/gw{gw}.json
  const liveMatch = path.match(/^event\/(\d+)\/live\/$/);
  const staticFile = staticPaths[path] || (liveMatch ? `live/gw${liveMatch[1]}.json` : null);
  if (staticFile) {
    try {
      const base = import.meta.env.BASE_URL || "/";
      const res = await fetchWithTimeout(`${base}data/${staticFile}`, 3000);
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

  // ── 3. Try third-party CORS proxies as last resort ──
  const fullUrl = `${FPL_BASE}/${path}`;
  let lastError;
  for (let i = 0; i < CORS_PROXIES.length; i++) {
    try {
      const url = CORS_PROXIES[i](fullUrl);
      const res = await fetchWithTimeout(url);
      if (!res.ok) throw new Error(`FPL API error (${res.status})`);
      return await res.json();
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(
    `Unable to reach the FPL API. All proxy methods failed. ` +
    `Last error: ${lastError?.message || "Unknown"}. ` +
    `Try refreshing or running the app locally with "npm run dev".`
  );
}

export async function getBootstrap() {
  if (!bootstrapCache) {
    bootstrapCache = fetchJson("bootstrap-static/").catch((err) => {
      bootstrapCache = null;
      throw err;
    });
  }
  return bootstrapCache;
}

export async function getManagerInfo() {
  return fetchJson(`entry/${managerId}/`);
}

export async function getManagerHistory() {
  return fetchJson(`entry/${managerId}/history/`);
}

export async function getManagerPicks(gw) {
  return fetchJson(`entry/${managerId}/event/${gw}/picks/`);
}

export async function getFixtures() {
  if (!fixturesCache) {
    fixturesCache = fetchJson("fixtures/").catch((err) => {
      fixturesCache = null;
      throw err;
    });
  }
  return fixturesCache;
}

export async function getLiveGameweek(gw) {
  if (!liveGwCache[gw]) {
    liveGwCache[gw] = fetchJson(`event/${gw}/live/`).catch((err) => {
      delete liveGwCache[gw];
      throw err;
    });
  }
  return liveGwCache[gw];
}

export async function getLeagueStandings(leagueId) {
  return fetchJson(`leagues-classic/${leagueId}/standings/`);
}
