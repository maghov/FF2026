/* ── xPts Engine ────────────────────────────────────────────
   Multi-factor expected points prediction for FPL players.
   Pure functions — no React, no API calls.
   ──────────────────────────────────────────────────────────── */

/* Position-specific weight profiles */
const WEIGHTS = {
  ATK: { form: 0.18, ppg: 0.14, ict: 0.18, fdr: 0.14, homeAway: 0.10, teamStr: 0.12, availability: 0.09, bonus: 0.05 },
  DEF: { form: 0.20, ppg: 0.16, ict: 0.10, fdr: 0.16, homeAway: 0.10, teamStr: 0.14, availability: 0.09, bonus: 0.05 },
};

function getWeights(position) {
  return position === "GKP" || position === "DEF" ? WEIGHTS.DEF : WEIGHTS.ATK;
}

/* ── Normalise helpers (scale raw values to 0-10) ────────── */

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function normIct(ict) {
  // ICT typically ranges 0-500 over a season; per-game ~0-15
  return clamp(ict / 50, 0, 10);
}

function normFdr(difficulty) {
  // FDR 1 (easy) → 10, FDR 5 (hard) → 0
  return clamp((5 - difficulty) * 2.5, 0, 10);
}

function normAvailability(chance) {
  // null/undefined means fully available
  if (chance == null || chance === "") return 10;
  return clamp(chance / 10, 0, 10);
}

function normBonus(bonus, appearances) {
  if (!appearances || appearances <= 0) return 5;
  // bonus per appearance, typically 0-3 per game
  const rate = bonus / appearances;
  return clamp(rate * 3.3, 0, 10);
}

function normTeamStrength(team, position, isHome) {
  if (!team) return 5;
  const isDefensive = position === "GKP" || position === "DEF";
  let raw;
  if (isDefensive) {
    raw = isHome ? team.strength_defence_home : team.strength_defence_away;
  } else {
    raw = isHome ? team.strength_attack_home : team.strength_attack_away;
  }
  // Team strength values are typically 1000-1400 range
  if (!raw) return 5;
  return clamp((raw - 900) / 60, 0, 10);
}

function normHomeAway(isHome) {
  return isHome ? 7.5 : 4.5;
}

/* ── Label generators ────────────────────────────────────── */

function formLabel(v) {
  if (v >= 7) return "In great form";
  if (v >= 5) return "Decent form";
  if (v >= 3) return "Average form";
  return "Poor form";
}

function fdrLabel(difficulty, opponent) {
  const opp = opponent || "";
  if (difficulty <= 2) return `Easy fixture ${opp}`;
  if (difficulty <= 3) return `Medium fixture ${opp}`;
  return `Tough fixture ${opp}`;
}

function ictLabel(norm) {
  if (norm >= 7) return "High attacking threat";
  if (norm >= 4) return "Moderate involvement";
  return "Low attacking involvement";
}

function availLabel(chance) {
  if (chance == null || chance === "" || chance >= 100) return "Fully available";
  if (chance >= 75) return "Likely to play";
  if (chance >= 50) return "Fitness doubt";
  if (chance >= 25) return "Unlikely to play";
  return "Expected to miss";
}

/* ── Core: single-fixture xPts ───────────────────────────── */

export function calculateXpts(player, fixture, teams) {
  const w = getWeights(player.position);
  const isHome = fixture?.opponent?.includes("(H)") ?? false;
  const team = teams?.[player.teamId] || null;
  const appearances = player.appearances || (player.minutes ? Math.round(player.minutes / 70) : 0);

  const factors = [
    {
      name: "form",
      value: player.form || 0,
      norm: clamp(player.form || 0, 0, 10),
      weight: w.form,
      label: formLabel(player.form || 0),
    },
    {
      name: "ppg",
      value: player.pointsPerGame || 0,
      norm: clamp((player.pointsPerGame || 0) * 2, 0, 10),
      weight: w.ppg,
      label: `${(player.pointsPerGame || 0).toFixed(1)} pts/game average`,
    },
    {
      name: "ict",
      value: player.ictIndex || 0,
      norm: normIct(player.ictIndex || 0),
      weight: w.ict,
      label: ictLabel(normIct(player.ictIndex || 0)),
    },
    {
      name: "fdr",
      value: fixture?.difficulty || 3,
      norm: normFdr(fixture?.difficulty || 3),
      weight: w.fdr,
      label: fdrLabel(fixture?.difficulty || 3, fixture?.opponent),
    },
    {
      name: "homeAway",
      value: isHome ? 1 : 0,
      norm: normHomeAway(isHome),
      weight: w.homeAway,
      label: isHome ? "Home advantage" : "Away match",
    },
    {
      name: "teamStr",
      value: 0,
      norm: normTeamStrength(team, player.position, isHome),
      weight: w.teamStr,
      label: `Team ${player.position === "GKP" || player.position === "DEF" ? "defence" : "attack"} strength`,
    },
    {
      name: "availability",
      value: player.chanceOfPlaying ?? 100,
      norm: normAvailability(player.chanceOfPlaying),
      weight: w.availability,
      label: availLabel(player.chanceOfPlaying),
    },
    {
      name: "bonus",
      value: player.bonus || 0,
      norm: normBonus(player.bonus || 0, appearances),
      weight: w.bonus,
      label: `${((player.bonus || 0) / Math.max(appearances, 1)).toFixed(1)} bonus/game`,
    },
  ];

  // Calculate impact and total
  let total = 0;
  for (const f of factors) {
    f.impact = +(f.norm * f.weight).toFixed(2);
    total += f.impact;
  }

  // Scale to approximate FPL points range (avg ~4-5 pts/game)
  const xpts = +(total * 0.85).toFixed(1);

  // Top 3 reasons: sort by impact descending, pick top 3 with meaningful impact
  const topReasons = factors
    .filter((f) => f.impact > 0.5)
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 3)
    .map((f) => f.label);

  return { xpts, factors, topReasons };
}

/* ── Multi-gameweek xPts ─────────────────────────────────── */

export function calculateMultiGwXpts(player, fixtures, teams, gws = 3) {
  const target = (fixtures || []).slice(0, gws);
  if (target.length === 0) {
    const single = calculateXpts(player, { difficulty: 3, opponent: "TBD" }, teams);
    return {
      totalXpts: +(single.xpts * gws).toFixed(1),
      perGw: Array(gws).fill(single),
      avgXpts: single.xpts,
      topReasons: single.topReasons,
    };
  }

  const perGw = target.map((fix) => calculateXpts(player, fix, teams));
  const totalXpts = +perGw.reduce((s, r) => s + r.xpts, 0).toFixed(1);
  const avgXpts = +(totalXpts / perGw.length).toFixed(1);

  // Aggregate top reasons across all GWs
  const reasonCounts = {};
  for (const r of perGw) {
    for (const reason of r.topReasons) {
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    }
  }
  const topReasons = Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([reason]) => reason);

  return { totalXpts, perGw, avgXpts, topReasons };
}

/* ── Rank squad (for formation suggestions & captain) ───── */

export function rankSquad(allPlayers, teams) {
  const ranked = allPlayers.map((p) => {
    const { totalXpts, avgXpts, topReasons } = calculateMultiGwXpts(
      p,
      p.upcomingFixtures,
      teams,
      3,
    );
    return { ...p, xpts: avgXpts, totalXpts3: totalXpts, topReasons };
  });

  ranked.sort((a, b) => b.xpts - a.xpts);

  return {
    ranked,
    captain: ranked[0] || null,
    viceCaptain: ranked[1] || null,
  };
}

/* ── Rank transfer targets ───────────────────────────────── */

export function rankTransferTargets(candidates, teams, gws = 3) {
  return candidates
    .map((p) => {
      const { totalXpts, avgXpts, topReasons } = calculateMultiGwXpts(
        p,
        p.upcomingFixtures,
        teams,
        gws,
      );
      return { ...p, xpts: avgXpts, totalXpts, topReasons };
    })
    .sort((a, b) => b.xpts - a.xpts);
}
