#!/usr/bin/env node

/**
 * Pre-fetches FPL API data at build time and saves as static JSON.
 * This avoids CORS issues in production — the app loads these files
 * from same-origin first, then falls back to CORS proxies for
 * manager-specific endpoints.
 *
 * Run: node scripts/prefetch-fpl.mjs
 */

import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "data");
const FPL_BASE = "https://fantasy.premierleague.com/api";

const ENDPOINTS = {
  "bootstrap.json": "bootstrap-static/",
  "fixtures.json": "fixtures/",
};

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "FF2026-BuildScript/1.0" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
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
  console.log("Pre-fetching FPL data...\n");

  let success = 0;
  let failed = 0;

  for (const [file, path] of Object.entries(ENDPOINTS)) {
    const url = `${FPL_BASE}/${path}`;
    process.stdout.write(`  ${file} ... `);
    try {
      const data = await fetchWithRetry(url);
      writeFileSync(join(OUT_DIR, file), JSON.stringify(data));
      const sizeKb = (JSON.stringify(data).length / 1024).toFixed(0);
      console.log(`OK (${sizeKb} KB)`);
      success++;
    } catch (err) {
      console.log(`FAILED (${err.message})`);
      failed++;
    }
  }

  // Pre-fetch live gameweek data for all finished GWs
  console.log("\nPre-fetching live gameweek data...\n");
  try {
    const bootstrapUrl = `${FPL_BASE}/bootstrap-static/`;
    const bootstrap = await fetchWithRetry(bootstrapUrl);
    const finishedGws = bootstrap.events
      .filter((e) => e.finished)
      .map((e) => e.id);

    mkdirSync(join(OUT_DIR, "live"), { recursive: true });

    for (const gw of finishedGws) {
      const file = `live/gw${gw}.json`;
      process.stdout.write(`  ${file} ... `);
      try {
        const data = await fetchWithRetry(`${FPL_BASE}/event/${gw}/live/`);
        writeFileSync(join(OUT_DIR, file), JSON.stringify(data));
        const sizeKb = (JSON.stringify(data).length / 1024).toFixed(0);
        console.log(`OK (${sizeKb} KB)`);
        success++;
      } catch (err) {
        console.log(`FAILED (${err.message})`);
        failed++;
      }
      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 300));
    }
  } catch (err) {
    console.log(`  Skipping live GW data: ${err.message}`);
  }

  console.log(`\nDone: ${success} fetched, ${failed} failed.`);
  if (failed > 0) {
    console.log("Warning: Some endpoints failed. The app will fall back to CORS proxies at runtime.");
  }
}

main();
