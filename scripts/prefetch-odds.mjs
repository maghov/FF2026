#!/usr/bin/env node

/**
 * Pre-fetches Premier League betting odds from football-data.co.uk
 * and converts them to team strength ratings and match probabilities.
 *
 * Betting odds are a strong predictor of match outcomes — bookmakers
 * price matches using sophisticated models, and their implied
 * probabilities outperform FPL's crude 1-5 fixture difficulty ratings.
 *
 * Run: node scripts/prefetch-odds.mjs
 */

import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "data");

// football-data.co.uk CSV for current EPL season (2025-26)
const SEASON_CODE = "2526";
const URL = `https://www.football-data.co.uk/mmz4281/${SEASON_CODE}/E0.csv`;

function parseCSV(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    // Handle quoted fields in CSV
    const values = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const obj = {};
    headers.forEach((h, i) => (obj[h.trim()] = values[i] || ""));
    return obj;
  });
}

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "FF2026-BuildScript/1.0" },
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
  console.log("Pre-fetching betting odds data...\n");

  try {
    const csv = await fetchWithRetry(URL);
    const rows = parseCSV(csv);

    // Extract match results and betting-implied probabilities
    const matches = rows
      .filter((r) => r.HomeTeam && r.AwayTeam)
      .map((r) => {
        const b365h = parseFloat(r.B365H) || 0;
        const b365d = parseFloat(r.B365D) || 0;
        const b365a = parseFloat(r.B365A) || 0;

        // Convert decimal odds to implied probabilities (remove overround)
        const rawH = b365h > 0 ? 1 / b365h : 0;
        const rawD = b365d > 0 ? 1 / b365d : 0;
        const rawA = b365a > 0 ? 1 / b365a : 0;
        const total = rawH + rawD + rawA || 1;

        return {
          date: r.Date,
          home: r.HomeTeam,
          away: r.AwayTeam,
          fthg: parseInt(r.FTHG) || 0,
          ftag: parseInt(r.FTAG) || 0,
          result: r.FTR, // H=Home win, D=Draw, A=Away win
          homeWinProb: +(rawH / total).toFixed(3),
          drawProb: +(rawD / total).toFixed(3),
          awayWinProb: +(rawA / total).toFixed(3),
          homeShots: parseInt(r.HS) || 0,
          awayShots: parseInt(r.AS) || 0,
          homeShotsTarget: parseInt(r.HST) || 0,
          awayShotsTarget: parseInt(r.AST) || 0,
        };
      });

    // Compute team strength from average bookmaker-implied win probability
    const teamStrength = {};
    for (const m of matches) {
      if (!teamStrength[m.home]) {
        teamStrength[m.home] = { homeWinProbs: [], awayWinProbs: [], games: 0 };
      }
      if (!teamStrength[m.away]) {
        teamStrength[m.away] = { homeWinProbs: [], awayWinProbs: [], games: 0 };
      }

      teamStrength[m.home].homeWinProbs.push(m.homeWinProb);
      teamStrength[m.home].games++;
      teamStrength[m.away].awayWinProbs.push(m.awayWinProb);
      teamStrength[m.away].games++;
    }

    // Finalize team strength as a single 0-1 rating
    const teamRatings = {};
    for (const [team, data] of Object.entries(teamStrength)) {
      const allProbs = [...data.homeWinProbs, ...data.awayWinProbs];
      const avgWinProb =
        allProbs.length > 0
          ? allProbs.reduce((s, v) => s + v, 0) / allProbs.length
          : 0.33;
      teamRatings[team] = {
        strength: +avgWinProb.toFixed(3),
        games: data.games,
      };
    }

    const output = { matches, teamStrength: teamRatings };
    writeFileSync(join(OUT_DIR, "odds.json"), JSON.stringify(output));
    const sizeKb = (JSON.stringify(output).length / 1024).toFixed(0);
    console.log(
      `  odds.json ... OK (${sizeKb} KB, ${matches.length} matches, ${Object.keys(teamRatings).length} teams)`
    );
  } catch (err) {
    console.log(`  odds.json ... FAILED (${err.message})`);
    console.log("  The app will work without betting odds data.");
  }
}

main();
