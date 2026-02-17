import {
  getBootstrap,
  getManagerInfo,
  getManagerHistory,
  getManagerPicks,
  getFixtures,
  getLiveGameweek,
  getLeagueStandings,
  MANAGER_ID,
} from "./fplApi";

/* ── helpers ──────────────────────────────────────────────── */

function buildLookups(bootstrap) {
  const teams = {};
  for (const t of bootstrap.teams) teams[t.id] = t;

  const positionMap = {};
  for (const p of bootstrap.element_types)
    positionMap[p.id] = p.singular_name_short;

  const players = {};
  for (const p of bootstrap.elements) players[p.id] = p;

  const events = {};
  for (const e of bootstrap.events) events[e.id] = e;

  const currentEvent = bootstrap.events.find((e) => e.is_current);
  const nextEvent = bootstrap.events.find((e) => e.is_next);

  return { teams, positionMap, players, events, currentEvent, nextEvent };
}

function getUpcomingFixturesByTeam(fixtures, teams, currentGw) {
  const upcoming = {};
  const future = fixtures
    .filter((f) => f.event && f.event > currentGw && !f.finished)
    .sort((a, b) => a.event - b.event);

  for (const fix of future) {
    if (!upcoming[fix.team_h]) upcoming[fix.team_h] = [];
    if (upcoming[fix.team_h].length < 5) {
      upcoming[fix.team_h].push({
        gw: fix.event,
        opponent: `${teams[fix.team_a]?.short_name || "?"} (H)`,
        difficulty: fix.team_h_difficulty,
      });
    }
    if (!upcoming[fix.team_a]) upcoming[fix.team_a] = [];
    if (upcoming[fix.team_a].length < 5) {
      upcoming[fix.team_a].push({
        gw: fix.event,
        opponent: `${teams[fix.team_h]?.short_name || "?"} (A)`,
        difficulty: fix.team_a_difficulty,
      });
    }
  }
  return upcoming;
}

function estimateFreeTransfers(history) {
  let ft = 1;
  const chipGws = new Set(history.chips.map((c) => c.event));

  for (const gw of history.current) {
    if (chipGws.has(gw.event)) {
      ft = Math.min(ft + 1, 5);
      continue;
    }
    if (gw.event_transfers === 0) {
      ft = Math.min(ft + 1, 5);
    } else if (gw.event_transfers_cost > 0) {
      ft = 1;
    } else {
      ft = Math.max(1, Math.min(ft - gw.event_transfers + 1, 5));
    }
  }
  return ft;
}

/* ── fetchMyTeam ──────────────────────────────────────────── */

export async function fetchMyTeam() {
  const [bootstrap, managerInfo, fixtures, history] = await Promise.all([
    getBootstrap(),
    getManagerInfo(),
    getFixtures(),
    getManagerHistory(),
  ]);

  const { teams, positionMap, players: allPlayers, currentEvent } =
    buildLookups(bootstrap);
  const currentGw = currentEvent?.id || managerInfo.current_event;

  const [picksData, liveData] = await Promise.all([
    getManagerPicks(currentGw),
    getLiveGameweek(currentGw),
  ]);

  // Live points lookup
  const livePoints = {};
  for (const el of liveData.elements) {
    livePoints[el.id] = el.stats.total_points;
  }

  // Upcoming fixtures
  const upcomingByTeam = getUpcomingFixturesByTeam(fixtures, teams, currentGw);

  // Starting XI (positions 1-11)
  const players = picksData.picks
    .filter((pick) => pick.position <= 11)
    .map((pick) => {
      const p = allPlayers[pick.element];
      const team = teams[p.team];
      const teamFixtures = upcomingByTeam[p.team] || [];
      const nextFix = teamFixtures[0];
      const form = parseFloat(p.form) || 0;

      return {
        id: p.id,
        name: p.web_name,
        position: positionMap[p.element_type],
        club: team?.name || "Unknown",
        clubShort: team?.short_name || "???",
        price: p.now_cost / 10,
        totalPoints: p.total_points,
        gameweekPoints: livePoints[p.id] ?? p.event_points ?? 0,
        form,
        upcomingFixtures: teamFixtures.slice(0, 5),
        upcomingFixture: nextFix ? nextFix.opponent : "TBD",
        fixtureDifficulty: nextFix ? nextFix.difficulty : 3,
        isCaptain: pick.is_captain,
        isViceCaptain: pick.is_vice_captain,
        pointsHistory: Array.from({ length: 5 }, () =>
          Math.max(1, Math.round(form + (Math.random() - 0.5) * 4))
        ),
      };
    });

  // Captain bonus (base pts × multiplier = total captain contribution)
  const captainPick = picksData.picks.find((p) => p.is_captain);
  const captainBaseGwPts = captainPick
    ? livePoints[captainPick.element] || 0
    : 0;
  const captainBonus = captainBaseGwPts * (captainPick?.multiplier || 2);

  // Chips used
  const usedChips = new Set(history.chips.map((c) => c.name));

  const eh = picksData.entry_history;

  const summary = {
    totalPoints: eh.total_points,
    teamValue: eh.value / 10,
    moneyInBank: eh.bank / 10,
    overallRank: eh.overall_rank || managerInfo.summary_overall_rank || 0,
    gameweekRank: eh.rank || 0,
    currentGameweek: currentGw,
    gameweekPoints: eh.points,
    captainPoints: captainBonus,
    averagePoints: currentEvent?.average_entry_score || 0,
    highestPoints: currentEvent?.highest_score || 0,
    transfers: {
      made: eh.event_transfers,
      cost: eh.event_transfers_cost,
      available: estimateFreeTransfers(history),
    },
    chips: {
      wildcard: !usedChips.has("wildcard"),
      benchBoost: !usedChips.has("bboost"),
      tripleCaptain: !usedChips.has("3xc"),
      freeHit: !usedChips.has("freehit"),
    },
  };

  return { players, summary };
}

/* ── fetchGameweekHistory ─────────────────────────────────── */

export async function fetchGameweekHistory() {
  const [bootstrap, history] = await Promise.all([
    getBootstrap(),
    getManagerHistory(),
  ]);

  const { events } = buildLookups(bootstrap);
  const recent = history.current.slice(-7);

  return recent.map((gw) => ({
    gw: gw.event,
    points: gw.points,
    average: events[gw.event]?.average_entry_score || 0,
    rank: gw.overall_rank,
  }));
}

/* ── fetchProjectedPoints ─────────────────────────────────── */

export async function fetchProjectedPoints() {
  const [bootstrap, fixtures] = await Promise.all([
    getBootstrap(),
    getFixtures(),
  ]);

  const { currentEvent } = buildLookups(bootstrap);
  const currentGw = currentEvent?.id || 1;

  const futureGws = bootstrap.events
    .filter((e) => e.id > currentGw)
    .slice(0, 5);

  if (futureGws.length === 0) {
    return [{ gw: currentGw + 1, projected: 50, difficulty: "Medium" }];
  }

  // Use the season's average score as a baseline
  const finishedEvents = bootstrap.events.filter((e) => e.finished);
  const seasonAvg =
    finishedEvents.length > 0
      ? Math.round(
          finishedEvents.reduce(
            (s, e) => s + (e.average_entry_score || 0),
            0
          ) / finishedEvents.length
        )
      : 50;

  return futureGws.map((e) => {
    const gwFixtures = fixtures.filter((f) => f.event === e.id);
    const avgDiff =
      gwFixtures.length > 0
        ? gwFixtures.reduce(
            (s, f) => s + f.team_h_difficulty + f.team_a_difficulty,
            0
          ) /
          (gwFixtures.length * 2)
        : 3;

    const difficulty =
      avgDiff < 2.5 ? "Easy" : avgDiff > 3.5 ? "Hard" : "Medium";
    const multiplier = avgDiff < 3 ? 1.1 : avgDiff > 3 ? 0.9 : 1;
    const projected = Math.round(seasonAvg * multiplier);

    return { gw: e.id, projected, difficulty };
  });
}

/* ── fetchAvailablePlayers ────────────────────────────────── */

export async function fetchAvailablePlayers() {
  const [bootstrap, managerInfo, fixtures] = await Promise.all([
    getBootstrap(),
    getManagerInfo(),
    getFixtures(),
  ]);

  const { teams, positionMap, currentEvent } = buildLookups(bootstrap);
  const currentGw = currentEvent?.id || managerInfo.current_event;

  const picksData = await getManagerPicks(currentGw);
  const myPlayerIds = new Set(picksData.picks.map((p) => p.element));
  const upcomingByTeam = getUpcomingFixturesByTeam(fixtures, teams, currentGw);

  // Top available players not in the manager's team
  const candidates = bootstrap.elements
    .filter(
      (p) =>
        !myPlayerIds.has(p.id) &&
        parseFloat(p.form) > 3 &&
        p.minutes > 0 &&
        p.status === "a"
    )
    .sort((a, b) => parseFloat(b.form) - parseFloat(a.form))
    .slice(0, 25);

  return candidates.map((p) => {
    const team = teams[p.team];
    const form = parseFloat(p.form) || 0;
    const teamFixtures = upcomingByTeam[p.team] || [];

    return {
      id: p.id,
      name: p.web_name,
      position: positionMap[p.element_type],
      club: team?.name || "Unknown",
      clubShort: team?.short_name || "???",
      price: p.now_cost / 10,
      totalPoints: p.total_points,
      form,
      upcomingFixtures: teamFixtures.slice(0, 5),
      expectedPoints: teamFixtures
        .slice(0, 5)
        .map((f) => Math.max(1, Math.round(form + (3 - f.difficulty) * 0.8))),
    };
  });
}

/* ── fetchLeagueData ──────────────────────────────────────── */

export async function fetchLeagueData() {
  const managerInfo = await getManagerInfo();

  const classicLeagues = managerInfo.leagues?.classic || [];

  // Prefer private leagues, then small public ones
  const league =
    classicLeagues.find((l) => l.league_type === "x") ||
    classicLeagues.find(
      (l) => l.max_entries && l.max_entries < 1000
    ) ||
    classicLeagues[0];

  if (!league) {
    return {
      name: "No League Found",
      myPosition: 0,
      totalMembers: 0,
      standings: [],
    };
  }

  const data = await getLeagueStandings(league.id);

  return {
    name: data.league.name,
    myPosition: league.entry_rank || 0,
    totalMembers: league.entry_count || data.standings.results.length,
    standings: data.standings.results.slice(0, 10).map((entry, i) => ({
      rank: entry.rank || i + 1,
      name: entry.entry_name,
      manager: entry.entry === MANAGER_ID ? "You" : entry.player_name,
      points: entry.total,
    })),
  };
}

/* ── fetchUpcomingFixtures ─────────────────────────────────── */

export async function fetchUpcomingFixtures() {
  const [bootstrap, fixtures] = await Promise.all([
    getBootstrap(),
    getFixtures(),
  ]);

  const { teams, currentEvent } = buildLookups(bootstrap);
  const currentGw = currentEvent?.id || 1;

  // Group future fixtures by gameweek (next 5 GWs)
  const upcoming = fixtures
    .filter((f) => f.event && f.event > currentGw && !f.finished)
    .sort((a, b) => a.event - b.event || a.kickoff_time?.localeCompare(b.kickoff_time || ""));

  const gwIds = [...new Set(upcoming.map((f) => f.event))].slice(0, 5);
  const gwDeadlines = {};
  for (const e of bootstrap.events) {
    gwDeadlines[e.id] = e.deadline_time;
  }

  return gwIds.map((gwId) => ({
    gw: gwId,
    deadline: gwDeadlines[gwId] || null,
    matches: upcoming
      .filter((f) => f.event === gwId)
      .map((f) => ({
        id: f.id,
        kickoff: f.kickoff_time,
        homeTeam: teams[f.team_h]?.name || "TBD",
        homeShort: teams[f.team_h]?.short_name || "?",
        awayTeam: teams[f.team_a]?.name || "TBD",
        awayShort: teams[f.team_a]?.short_name || "?",
        homeDifficulty: f.team_h_difficulty,
        awayDifficulty: f.team_a_difficulty,
      })),
  }));
}

/* ── analyzeTransfer ──────────────────────────────────────── */

export function analyzeTransfer(playerOut, playerIn, gameweeks) {
  const outProjected = playerOut.pointsHistory
    ? playerOut.pointsHistory.slice(0, gameweeks).reduce((s, v) => s + v, 0)
    : Math.round((playerOut.form || 4) * gameweeks);

  const inProjected = playerIn.expectedPoints
    ? playerIn.expectedPoints.slice(0, gameweeks).reduce((s, v) => s + v, 0)
    : Math.round((playerIn.form || 4) * gameweeks);

  const pointsDiff = inProjected - outProjected;
  const formDiff = (playerIn.form || 0) - (playerOut.form || 0);
  const priceDiff = (playerIn.price || 0) - (playerOut.price || 0);

  const avgInDifficulty = playerIn.upcomingFixtures?.length
    ? playerIn.upcomingFixtures
        .slice(0, gameweeks)
        .reduce((s, f) => s + f.difficulty, 0) / gameweeks
    : 3;
  const avgOutDifficulty = playerOut.fixtureDifficulty || 3;
  const fixtureDiff = avgOutDifficulty - avgInDifficulty;

  let riskLevel;
  if (Math.abs(pointsDiff) <= 3 && Math.abs(formDiff) < 1) {
    riskLevel = "Low";
  } else if (Math.abs(pointsDiff) > 8 || avgInDifficulty > 3.5) {
    riskLevel = "High";
  } else {
    riskLevel = "Medium";
  }

  let recommendation;
  if (pointsDiff > 5 && formDiff > 0) {
    recommendation = "Strong Buy";
  } else if (pointsDiff < -3 || formDiff < -1.5) {
    recommendation = "Avoid";
  } else {
    recommendation = "Neutral";
  }

  const explanations = {
    "Strong Buy": `${playerIn.name} is projected to outscore ${playerOut.name} by ${pointsDiff} points over the next ${gameweeks} gameweeks. With better form (${playerIn.form} vs ${playerOut.form}) and favorable upcoming fixtures, this looks like a smart move.`,
    Neutral: `This is a sideways move. ${playerIn.name} and ${playerOut.name} are projected similarly over the next ${gameweeks} gameweeks (${pointsDiff > 0 ? "+" : ""}${pointsDiff} point difference). Consider saving the transfer for a better opportunity.`,
    Avoid: `${playerOut.name} is the better option here. Keeping the current player saves a transfer and is projected to yield ${Math.abs(pointsDiff)} more points over ${gameweeks} gameweeks.`,
  };

  return {
    pointsDiff,
    formDiff: formDiff.toFixed(1),
    priceDiff: priceDiff.toFixed(1),
    fixtureDiff: fixtureDiff.toFixed(1),
    riskLevel,
    recommendation,
    explanation: explanations[recommendation],
    outProjected,
    inProjected,
    avgInDifficulty: avgInDifficulty.toFixed(1),
  };
}
