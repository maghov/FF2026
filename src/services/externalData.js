/**
 * Loads pre-fetched external data sources (Understat xG, betting odds).
 * These are optional enrichment layers — the app works without them,
 * but predictions improve significantly when they're available.
 */

let understatCache = null;
let oddsCache = null;

async function fetchStaticJson(filename) {
  try {
    const base = import.meta.env.BASE_URL || "/";
    const res = await fetch(`${base}data/${filename}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/* ── Understat xG data ─────────────────────────────────────── */

/**
 * Load Understat player xG data, returning a normalized-name → stats map.
 * Returns {} if data is unavailable.
 */
export async function getUnderstatData() {
  if (!understatCache) {
    understatCache = fetchStaticJson("understat.json").then((data) => {
      if (!data || !Array.isArray(data)) return {};
      const lookup = {};
      for (const p of data) {
        const key = normalizeName(p.name);
        lookup[key] = p;
      }
      return lookup;
    });
  }
  return understatCache;
}

/**
 * Try to match an FPL player to their Understat record.
 * Uses multiple name-matching strategies since the two sources
 * use different name formats.
 */
export function matchUnderstatPlayer(understatLookup, fplPlayer) {
  if (!understatLookup || !fplPlayer) return null;

  // Try web_name (e.g., "Salah")
  const webKey = normalizeName(fplPlayer.web_name || "");
  if (webKey && understatLookup[webKey]) return understatLookup[webKey];

  // Try second_name (e.g., "Salah")
  const secondKey = normalizeName(fplPlayer.second_name || "");
  if (secondKey && understatLookup[secondKey]) return understatLookup[secondKey];

  // Try full name (e.g., "Mohamed Salah")
  const fullKey = normalizeName(
    `${fplPlayer.first_name || ""} ${fplPlayer.second_name || ""}`
  );
  if (fullKey && understatLookup[fullKey]) return understatLookup[fullKey];

  // Partial suffix match for compound names (e.g., "Alexander-Arnold" → "arnold")
  if (webKey.length >= 4) {
    for (const [key, val] of Object.entries(understatLookup)) {
      if (key.endsWith(webKey) || webKey.endsWith(key)) return val;
    }
  }

  return null;
}

/* ── Betting odds data ─────────────────────────────────────── */

/**
 * Load betting odds data with team strength ratings.
 * Returns { matches: [], teamStrength: {} } if unavailable.
 */
export async function getOddsData() {
  if (!oddsCache) {
    oddsCache = fetchStaticJson("odds.json").then((data) => {
      return data || { matches: [], teamStrength: {} };
    });
  }
  return oddsCache;
}

// Maps football-data.co.uk team names → FPL short_name
const ODDS_TO_FPL_TEAM = {
  Arsenal: "ARS",
  "Aston Villa": "AVL",
  Bournemouth: "BOU",
  Brentford: "BRE",
  Brighton: "BHA",
  Chelsea: "CHE",
  "Crystal Palace": "CRY",
  Everton: "EVE",
  Fulham: "FUL",
  Ipswich: "IPS",
  Leicester: "LEI",
  Liverpool: "LIV",
  "Man City": "MCI",
  "Man United": "MUN",
  Newcastle: "NEW",
  "Nott'm Forest": "NFO",
  Southampton: "SOU",
  Tottenham: "TOT",
  "West Ham": "WHU",
  Wolves: "WOL",
};

// Reverse map: FPL short_name → odds name
const FPL_TO_ODDS_TEAM = Object.fromEntries(
  Object.entries(ODDS_TO_FPL_TEAM).map(([k, v]) => [v, k])
);

/**
 * Get bookmaker-derived team strength (0-1) for an FPL team.
 * Higher = stronger team. Returns null if unavailable.
 */
export function getTeamStrength(oddsData, fplShortName) {
  const oddsName = FPL_TO_ODDS_TEAM[fplShortName];
  if (!oddsName || !oddsData?.teamStrength?.[oddsName]) return null;
  return oddsData.teamStrength[oddsName].strength;
}

/* ── Helpers ───────────────────────────────────────────────── */

/** Normalize a name for cross-source matching (strip accents, lowercase). */
function normalizeName(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .trim();
}
