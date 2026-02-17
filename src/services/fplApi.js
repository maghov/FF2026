const FPL_BASE = "https://fantasy.premierleague.com/api";
export const MANAGER_ID = 5398119;

let bootstrapCache = null;
let fixturesCache = null;

// CORS proxies to try in order (production only – FPL API blocks browser requests)
const CORS_PROXIES = [
  (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url) => `https://thingproxy.freeboard.io/fetch/${url}`,
];

function buildUrl(path, proxyIndex = 0) {
  const fullUrl = `${FPL_BASE}/${path}`;
  if (import.meta.env.DEV) {
    return `/fpl-api/${path}`;
  }
  const proxy = CORS_PROXIES[proxyIndex] || CORS_PROXIES[0];
  return proxy(fullUrl);
}

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
  // In development, Vite proxy handles CORS
  if (import.meta.env.DEV) {
    const res = await fetch(buildUrl(path));
    if (!res.ok) throw new Error(`FPL API error (${res.status})`);
    return res.json();
  }

  // In production, try pre-fetched static data first (for cacheable endpoints)
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
      // Static data not available, fall through to proxies
    }
  }

  // Try each CORS proxy until one works
  let lastError;
  for (let i = 0; i < CORS_PROXIES.length; i++) {
    try {
      const url = buildUrl(path, i);
      const res = await fetchWithTimeout(url);
      if (!res.ok) throw new Error(`FPL API error (${res.status})`);
      return await res.json();
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(
    `Unable to reach the FPL API. All ${CORS_PROXIES.length} proxy servers failed. ` +
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
  return fetchJson(`entry/${MANAGER_ID}/`);
}

export async function getManagerHistory() {
  return fetchJson(`entry/${MANAGER_ID}/history/`);
}

export async function getManagerPicks(gw) {
  return fetchJson(`entry/${MANAGER_ID}/event/${gw}/picks/`);
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
