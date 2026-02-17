const FPL_BASE = "https://fantasy.premierleague.com/api";
export const MANAGER_ID = 5398119;

let bootstrapCache = null;
let fixturesCache = null;

// CORS proxies to try in order (production only – FPL API blocks browser requests)
const CORS_PROXIES = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
];

function buildUrl(path, proxyIndex = 0) {
  const fullUrl = `${FPL_BASE}/${path}`;
  if (import.meta.env.DEV) {
    return `/fpl-api/${path}`;
  }
  const proxy = CORS_PROXIES[proxyIndex] || CORS_PROXIES[0];
  return proxy(fullUrl);
}

async function fetchJson(path) {
  // In development, Vite proxy handles CORS
  if (import.meta.env.DEV) {
    const res = await fetch(buildUrl(path));
    if (!res.ok) throw new Error(`FPL API error (${res.status})`);
    return res.json();
  }

  // In production, try each CORS proxy until one works
  let lastError;
  for (let i = 0; i < CORS_PROXIES.length; i++) {
    try {
      const url = buildUrl(path, i);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`FPL API error (${res.status})`);
      return await res.json();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
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
