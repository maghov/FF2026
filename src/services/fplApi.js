const FPL_BASE = "https://fantasy.premierleague.com/api";
export const MANAGER_ID = 5398119;

let bootstrapCache = null;
let fixturesCache = null;

function buildUrl(path) {
  if (import.meta.env.DEV) {
    return `/fpl-api/${path}`;
  }
  return `https://corsproxy.io/?url=${encodeURIComponent(`${FPL_BASE}/${path}`)}`;
}

async function fetchJson(path) {
  const url = buildUrl(path);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`FPL API error (${res.status})`);
  }
  return res.json();
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
