#!/usr/bin/env node

/**
 * Pre-fetches Understat xG data at build time and saves as static JSON.
 * Provides advanced expected-goals metrics (xG, xA, npxG, xGChain, xGBuildup)
 * that go beyond what the FPL API offers.
 *
 * Run: node scripts/prefetch-understat.mjs
 */

import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "data");

// Understat uses the season start year (2025 for 2025/26)
const SEASON = "2025";
const URL = `https://understat.com/league/EPL/${SEASON}`;

/** Decode Understat's hex-encoded JSON strings (\x22 → ") */
function decodeHex(str) {
  return str.replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
}

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "FF2026-BuildScript/1.0",
          Accept: "text/html",
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (i === retries) throw err;
      const delay = 1000 * 2 ** i;
      console.log(`  Retry ${i + 1}/${retries} in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log("Pre-fetching Understat xG data...\n");

  try {
    const html = await fetchWithRetry(URL);

    // Understat embeds data in script tags as: var playersData = JSON.parse('...');
    const match = html.match(
      /var\s+playersData\s*=\s*JSON\.parse\('(.+?)'\)/
    );
    if (!match) throw new Error("Could not find playersData in page HTML");

    const decoded = decodeHex(match[1]);
    const players = JSON.parse(decoded);

    // Slim down to the fields we need for FPL enrichment
    const slimmed = players.map((p) => ({
      id: p.id,
      name: p.player_name,
      team: p.team_title,
      games: parseInt(p.games) || 0,
      time: parseInt(p.time) || 0,
      goals: parseInt(p.goals) || 0,
      assists: parseInt(p.assists) || 0,
      xG: parseFloat(p.xG) || 0,
      xA: parseFloat(p.xA) || 0,
      npg: parseInt(p.npg) || 0,
      npxG: parseFloat(p.npxG) || 0,
      xGChain: parseFloat(p.xGChain) || 0,
      xGBuildup: parseFloat(p.xGBuildup) || 0,
      shots: parseInt(p.shots) || 0,
      key_passes: parseInt(p.key_passes) || 0,
      position: p.position,
    }));

    writeFileSync(join(OUT_DIR, "understat.json"), JSON.stringify(slimmed));
    const sizeKb = (JSON.stringify(slimmed).length / 1024).toFixed(0);
    console.log(
      `  understat.json ... OK (${sizeKb} KB, ${slimmed.length} players)`
    );
  } catch (err) {
    console.log(`  understat.json ... FAILED (${err.message})`);
    console.log("  The app will work without Understat data.");
  }
}

main();
