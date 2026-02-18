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

// CORS proxies — tried in parallel, with the last working one remembered
const CORS_PROXIES = [
  (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url) => `https://thingproxy.freeboard.io/fetch/${url}`,
];

// Remember which proxy index last succeeded so subsequent calls try it first
let lastWorkingProxy = -1;
// Track whether the Netlify proxy is available (null = untested)
let netlifyProxyAvailable = null;

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

/** Try a single CORS proxy and return { index, data } on success */
async function tryCorsProxy(index, fullUrl) {
  const url = CORS_PROXIES[index](fullUrl);
  const res = await fetchWithTimeout(url, 6000);
  if (!res.ok) throw new Error(`FPL API error (${res.status})`);
  const data = await res.json();
  return { index, data };
}

async function fetchJson(path) {
  // In development, Vite proxy handles CORS — no proxy needed
  if (import.meta.env.DEV) {
    const res = await fetch(`/fpl-api/${path}`);
    if (!res.ok) throw new Error(`FPL API error (${res.status})`);
    return res.json();
  }

  // ── 1. Try pre-fetched static data first (instant, no network) ──
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

  // ── 2. Try Netlify serverless proxy (only if not already known to be unavailable) ──
  if (netlifyProxyAvailable !== false) {
    try {
      const res = await fetchWithTimeout(
        `/api/fpl-proxy?path=${encodeURIComponent(path)}`,
        netlifyProxyAvailable === null ? 3000 : 6000
      );
      if (res.ok) {
        const data = await res.json();
        netlifyProxyAvailable = true;
        return data;
      }
      // Got a response but not JSON / not ok — not a Netlify function
      netlifyProxyAvailable = false;
    } catch {
      netlifyProxyAvailable = false;
    }
  }

  // ── 3. CORS proxies — try last working one first, then race the rest ──
  const fullUrl = `${FPL_BASE}/${path}`;

  // If we know a proxy that worked before, try it first (fast path)
  if (lastWorkingProxy >= 0) {
    try {
      const { data } = await tryCorsProxy(lastWorkingProxy, fullUrl);
      return data;
    } catch {
      // It failed this time, fall through to racing all proxies
      lastWorkingProxy = -1;
    }
  }

  // Race all CORS proxies in parallel — first successful response wins
  const racePromises = CORS_PROXIES.map((_, i) =>
    tryCorsProxy(i, fullUrl)
  );

  try {
    // Promise.any resolves with the first fulfilled promise
    const { index, data } = await Promise.any(racePromises);
    lastWorkingProxy = index;
    return data;
  } catch {
    throw new Error(
      `Unable to reach the FPL API. All proxy methods failed. ` +
      `Try refreshing or running the app locally with "npm run dev".`
    );
  }
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
  return fetchJson(`event/${gw}/live/`);
}

export async function getLeagueStandings(leagueId) {
  return fetchJson(`leagues-classic/${leagueId}/standings/`);
}
