import {
  getBootstrap,
  getManagerInfo,
  getManagerHistory,
  getManagerPicks,
  getFixtures,
  getLiveGameweek,
  getLeagueStandings,
  getManagerId,
} from "./fplApi";
import {
  getUnderstatData,
  getOddsData,
  matchUnderstatPlayer,
  getTeamStrength,
} from "./externalData";
import { calculateMultiGwXpts } from "./xpts";

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

/**
 * Extract advanced stats from an FPL bootstrap player element.
 * The FPL API provides xG, xA, ICT index, and per-90 metrics that
 * most apps ignore — these are strong predictors of future output.
 */
function extractAdvancedStats(p) {
  return {
    xG: parseFloat(p.expected_goals) || 0,
    xA: parseFloat(p.expected_assists) || 0,
    xGI: parseFloat(p.expected_goal_involvements) || 0,
    xGC: parseFloat(p.expected_goals_conceded) || 0,
    xG90: parseFloat(p.expected_goals_per_90) || 0,
    xA90: parseFloat(p.expected_assists_per_90) || 0,
    xGI90: parseFloat(p.expected_goal_involvements_per_90) || 0,
    ictIndex: parseFloat(p.ict_index) || 0,
    influence: parseFloat(p.influence) || 0,
    creativity: parseFloat(p.creativity) || 0,
    threat: parseFloat(p.threat) || 0,
    pointsPerGame: parseFloat(p.points_per_game) || 0,
    goalsScored: p.goals_scored || 0,
    assists: p.assists || 0,
    cleanSheets: p.clean_sheets || 0,
    minutes: p.minutes || 0,
    bonus: p.bonus || 0,
    bps: p.bps || 0,
    penaltiesOrder: p.penalties_order || null,
    cornersOrder: p.corners_and_indirect_freekicks_order || null,
    directFKOrder: p.direct_freekicks_order || null,
  };
}

/**
 * Extract price change and transfer activity data from an FPL element.
 * These fields are already present in the bootstrap API response but
 * previously unused. They power price change indicators and urgency signals.
 */
function extractPriceData(p) {
  const costChangeEvent = p.cost_change_event || 0;
  const costChangeStart = p.cost_change_start || 0;
  const transfersInEvent = p.transfers_in_event || 0;
  const transfersOutEvent = p.transfers_out_event || 0;

  const netTransfersEvent = transfersInEvent - transfersOutEvent;

  let pricePressure = "stable";
  if (netTransfersEvent > 50000) pricePressure = "rising";
  else if (netTransfersEvent > 20000) pricePressure = "likely-rising";
  else if (netTransfersEvent < -50000) pricePressure = "falling";
  else if (netTransfersEvent < -20000) pricePressure = "likely-falling";

  return {
    costChangeEvent: costChangeEvent / 10,
    costChangeStart: costChangeStart / 10,
    transfersInEvent,
    transfersOutEvent,
    netTransfersEvent,
    transfersIn: p.transfers_in || 0,
    transfersOut: p.transfers_out || 0,
    pricePressure,
    startPrice: (p.now_cost - costChangeStart) / 10,
  };
}

/**
 * Compute expected points for a player in a given fixture using a
 * multi-source blended model. This replaces the old form-only formula
 * with a weighted combination of:
 *
 *   - Form (FPL recent avg)        — captures hot/cold streaks
 *   - xGI per 90 (FPL)             — underlying attacking quality
 *   - ICT index per game            — overall match impact
 *   - Points per game               — actual historical output
 *   - Fixture difficulty adjustment  — opponent strength
 *   - Understat xG delta            — over/underperformance signal
 *   - Betting odds team strength    — bookmaker-derived opponent rating
 */
function computeExpectedPoints(fplPlayer, fixtureDifficulty, understatData, oddsData, opponentShortName) {
  const form = parseFloat(fplPlayer.form) || 0;
  const ppg = parseFloat(fplPlayer.points_per_game) || 0;
  const xGI90 = parseFloat(fplPlayer.expected_goal_involvements_per_90) || 0;
  const ict = parseFloat(fplPlayer.ict_index) || 0;
  const minutes = fplPlayer.minutes || 0;
  const games = minutes > 0 ? minutes / 90 : 1;

  // Normalize ICT to a per-game score (ICT is cumulative over the season)
  const ictPerGame = ict / Math.max(games, 1);
  // Scale ICT to roughly the same range as form (0-10)
  const ictScaled = Math.min(ictPerGame / 10, 10);

  // Base score: weighted blend of performance signals
  let base =
    form * 0.30 +          // Recent form (most responsive to streaks)
    ppg * 0.25 +           // Historical output (stable baseline)
    xGI90 * 8 * 0.20 +    // xGI per 90 scaled up (underlying quality)
    ictScaled * 0.15;      // ICT per game (overall match impact)

  // Understat enrichment: detect over/underperformance
  if (understatData) {
    const uPlayer = matchUnderstatPlayer(understatData, fplPlayer);
    if (uPlayer && uPlayer.games > 0) {
      // Goals vs xG — positive = overperforming (likely to regress down)
      const goalDelta = (uPlayer.goals - uPlayer.xG) / uPlayer.games;
      // npxG per 90 is a cleaner signal (removes penalties)
      const npxG90 = (uPlayer.npxG / uPlayer.games) * (90 / (uPlayer.time / uPlayer.games || 90));
      // Blend npxG90 as additional signal
      base += npxG90 * 5 * 0.10;
      // Slight regression adjustment: overperformers get a small penalty
      base -= goalDelta * 0.5;
    }
  }

  // Fixture difficulty adjustment
  let difficultyMultiplier = 1;

  // Try betting odds for a more nuanced difficulty measure
  if (oddsData && opponentShortName) {
    const oppStrength = getTeamStrength(oddsData, opponentShortName);
    if (oppStrength !== null) {
      // oppStrength: 0-1, higher = stronger opponent = harder fixture
      // Convert to multiplier: weak opponent (0.2) → 1.15, strong (0.6) → 0.85
      difficultyMultiplier = 1.15 - oppStrength * 0.5;
    } else {
      // Fall back to FPL FDR
      difficultyMultiplier = 1 + (3 - fixtureDifficulty) * 0.06;
    }
  } else {
    // Fall back to FPL FDR (original approach, slightly refined)
    difficultyMultiplier = 1 + (3 - fixtureDifficulty) * 0.06;
  }

  const projected = Math.max(1, Math.round(base * difficultyMultiplier));
  return projected;
}

/* ── fetchMyTeam ──────────────────────────────────────────── */

export async function fetchMyTeam() {
  // Start all independent fetches immediately (including external data)
  const bootstrapP = getBootstrap();
  const managerInfoP = getManagerInfo();
  const fixturesP = getFixtures();
  const historyP = getManagerHistory();
  const understatP = getUnderstatData();
  const oddsP = getOddsData();

  // Only need bootstrap to determine currentGw, don't wait for the rest
  const bootstrap = await bootstrapP;
  const { teams, positionMap, players: allPlayers, currentEvent } =
    buildLookups(bootstrap);
  const currentGw = currentEvent?.id || 1;

  // Start Phase 2 in parallel with the still-running Phase 1 calls
  const [managerInfo, fixtures, history, picksData, liveData, understatData, oddsData] =
    await Promise.all([
      managerInfoP,
      fixturesP,
      historyP,
      getManagerPicks(currentGw),
      getLiveGameweek(currentGw),
      understatP,
      oddsP,
    ]);

  // Live points lookup
  const livePoints = {};
  for (const el of liveData.elements) {
    livePoints[el.id] = el.stats.total_points;
  }

  // Upcoming fixtures
  const upcomingByTeam = getUpcomingFixturesByTeam(fixtures, teams, currentGw);

  // Map a pick to a player object
  function mapPick(pick) {
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
      teamId: p.team,
      price: p.now_cost / 10,
      totalPoints: p.total_points,
      gameweekPoints: livePoints[p.id] ?? p.event_points ?? 0,
      form,
      upcomingFixtures: teamFixtures.slice(0, 5),
      upcomingFixture: nextFix ? nextFix.opponent : "TBD",
      fixtureDifficulty: nextFix ? nextFix.difficulty : 3,
      isCaptain: pick.is_captain,
      isViceCaptain: pick.is_vice_captain,
      benchOrder: pick.position > 11 ? pick.position - 11 : 0,
      // xPts engine fields
      ictIndex: parseFloat(p.ict_index) || 0,
      pointsPerGame: parseFloat(p.points_per_game) || 0,
      chanceOfPlaying: p.chance_of_playing_next_round,
      bonus: p.bonus || 0,
      minutes: p.minutes || 0,
    };
  }

  // Starting XI (positions 1-11)
  const players = picksData.picks
    .filter((pick) => pick.position <= 11)
    .map((pick) => {
      const p = allPlayers[pick.element];
      const team = teams[p.team];
      const teamFixtures = upcomingByTeam[p.team] || [];
      const nextFix = teamFixtures[0];
      const form = parseFloat(p.form) || 0;
      const advanced = extractAdvancedStats(p);
      const priceData = extractPriceData(p);

      // Understat enrichment
      const uPlayer = matchUnderstatPlayer(understatData, p);
      const understat = uPlayer
        ? {
            xG: uPlayer.xG,
            xA: uPlayer.xA,
            npxG: uPlayer.npxG,
            xGChain: uPlayer.xGChain,
            xGBuildup: uPlayer.xGBuildup,
            shots: uPlayer.shots,
            keyPasses: uPlayer.key_passes,
          }
        : null;

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
        ...advanced,
        ...priceData,
        understat,
        upcomingFixtures: teamFixtures.slice(0, 5),
        upcomingFixture: nextFix ? nextFix.opponent : "TBD",
        fixtureDifficulty: nextFix ? nextFix.difficulty : 3,
        isCaptain: pick.is_captain,
        isViceCaptain: pick.is_vice_captain,
        pointsHistory: Array.from({ length: 5 }, () =>
          Math.max(1, Math.round(form + (Math.random() - 0.5) * 4))
        ),
        expectedPoints: teamFixtures
          .slice(0, 5)
          .map((f) => {
            const oppShort = f.opponent?.match(/^(\w+)/)?.[1] || null;
            return computeExpectedPoints(p, f.difficulty, understatData, oddsData, oppShort);
          }),
      };
    });

  // Bench (positions 12-15)
  const bench = picksData.picks
    .filter((pick) => pick.position > 11)
    .sort((a, b) => a.position - b.position)
    .map(mapPick);

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

  return { players, bench, summary, teams };
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
  const [bootstrap, managerInfo, fixtures, understatData, oddsData] =
    await Promise.all([
      getBootstrap(),
      getManagerInfo(),
      getFixtures(),
      getUnderstatData(),
      getOddsData(),
    ]);

  const { teams, positionMap, currentEvent } = buildLookups(bootstrap);
  const currentGw = currentEvent?.id || managerInfo.current_event;

  const picksData = await getManagerPicks(currentGw);
  const myPlayerIds = new Set(picksData.picks.map((p) => p.element));
  const upcomingByTeam = getUpcomingFixturesByTeam(fixtures, teams, currentGw);

  // All available players not in the manager's squad
  const candidates = bootstrap.elements
    .filter(
      (p) =>
        !myPlayerIds.has(p.id) &&
        p.minutes > 0 &&
        p.status === "a"
    )
    .sort((a, b) => parseFloat(b.form) - parseFloat(a.form))
    .slice(0, 150);

  const mapped = candidates.map((p) => {
    const team = teams[p.team];
    const form = parseFloat(p.form) || 0;
    const teamFixtures = upcomingByTeam[p.team] || [];
    const advanced = extractAdvancedStats(p);
    const priceData = extractPriceData(p);

    return {
      id: p.id,
      name: p.web_name,
      position: positionMap[p.element_type],
      club: team?.name || "Unknown",
      clubShort: team?.short_name || "???",
      teamId: p.team,
      price: p.now_cost / 10,
      totalPoints: p.total_points,
      form,
      ...advanced,
      ...priceData,
      selectedByPercent: parseFloat(p.selected_by_percent) || 0,
      upcomingFixtures: teamFixtures.slice(0, 5),
      expectedPoints: teamFixtures
        .slice(0, 5)
        .map((f) => {
          const oppShort = f.opponent?.match(/^(\w+)/)?.[1] || null;
          return computeExpectedPoints(p, f.difficulty, understatData, oddsData, oppShort);
        }),
      // xPts engine fields
      ictIndex: parseFloat(p.ict_index) || 0,
      pointsPerGame: parseFloat(p.points_per_game) || 0,
      chanceOfPlaying: p.chance_of_playing_next_round,
      bonus: p.bonus || 0,
      minutes: p.minutes || 0,
    };
  });

  return { candidates: mapped, teams };
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
      manager: entry.entry === getManagerId() ? "You" : entry.player_name,
      points: entry.total,
    })),
  };
}

/* ── fetchUpcomingFixtures ─────────────────────────────────── */

export async function fetchUpcomingFixtures() {
  const [bootstrap, fixtures, understatData, oddsData] = await Promise.all([
    getBootstrap(),
    getFixtures(),
    getUnderstatData(),
    getOddsData(),
  ]);

  const { teams, positionMap, currentEvent } = buildLookups(bootstrap);
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

  // Build fixture difficulty lookup per team per GW
  const teamGwDifficulty = {};
  for (const f of upcoming) {
    if (!teamGwDifficulty[f.team_h]) teamGwDifficulty[f.team_h] = {};
    teamGwDifficulty[f.team_h][f.event] = {
      difficulty: f.team_h_difficulty,
      opponent: `${teams[f.team_a]?.short_name || "?"} (H)`,
      opponentShort: teams[f.team_a]?.short_name || null,
    };
    if (!teamGwDifficulty[f.team_a]) teamGwDifficulty[f.team_a] = {};
    teamGwDifficulty[f.team_a][f.event] = {
      difficulty: f.team_a_difficulty,
      opponent: `${teams[f.team_h]?.short_name || "?"} (A)`,
      opponentShort: teams[f.team_h]?.short_name || null,
    };
  }

  // Score and rank players using the multi-source model
  const activePlayers = bootstrap.elements.filter(
    (p) => p.minutes > 0 && p.status === "a" && parseFloat(p.form) > 0
  );

  function getPicksForGw(gwId) {
    const scored = activePlayers
      .filter((p) => teamGwDifficulty[p.team]?.[gwId])
      .map((p) => {
        const fix = teamGwDifficulty[p.team][gwId];
        const form = parseFloat(p.form) || 0;
        // Use multi-source scoring model
        const score = computeExpectedPoints(
          p, fix.difficulty, understatData, oddsData, fix.opponentShort
        );
        return {
          id: p.id,
          name: p.web_name,
          position: positionMap[p.element_type],
          club: teams[p.team]?.short_name || "???",
          price: p.now_cost / 10,
          form,
          totalPoints: p.total_points,
          opponent: fix.opponent,
          difficulty: fix.difficulty,
          score,
        };
      })
      .sort((a, b) => b.score - a.score);

    // Pick top 2 per position to give varied suggestions
    const picks = [];
    const posCounts = {};
    for (const p of scored) {
      const count = posCounts[p.position] || 0;
      if (count < 2) {
        picks.push(p);
        posCounts[p.position] = count + 1;
      }
      if (picks.length >= 8) break;
    }
    return picks;
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
    picks: getPicksForGw(gwId),
  }));
}

/* ── fetchPriceChanges ─────────────────────────────────────── */

export async function fetchPriceChanges() {
  const [bootstrap, fixtures] = await Promise.all([
    getBootstrap(),
    getFixtures(),
  ]);

  const { teams, positionMap, currentEvent } = buildLookups(bootstrap);
  const currentGw = currentEvent?.id || 1;
  const upcomingByTeam = getUpcomingFixturesByTeam(fixtures, teams, currentGw);

  const players = bootstrap.elements
    .filter((p) => p.minutes > 0 && p.status === "a")
    .map((p) => {
      const team = teams[p.team];
      const priceData = extractPriceData(p);
      const teamFixtures = upcomingByTeam[p.team] || [];
      const nextFix = teamFixtures[0];

      return {
        id: p.id,
        name: p.web_name,
        position: positionMap[p.element_type],
        club: team?.name || "Unknown",
        clubShort: team?.short_name || "???",
        price: p.now_cost / 10,
        form: parseFloat(p.form) || 0,
        totalPoints: p.total_points,
        selectedByPercent: parseFloat(p.selected_by_percent) || 0,
        ...priceData,
        nextFixture: nextFix ? nextFix.opponent : "TBD",
        nextDifficulty: nextFix ? nextFix.difficulty : 3,
      };
    });

  // Split into rising, falling, and stable buckets
  const rising = players
    .filter((p) => p.pricePressure === "rising" || p.pricePressure === "likely-rising")
    .sort((a, b) => b.netTransfersEvent - a.netTransfersEvent);

  const falling = players
    .filter((p) => p.pricePressure === "falling" || p.pricePressure === "likely-falling")
    .sort((a, b) => a.netTransfersEvent - b.netTransfersEvent);

  // Recent price changes this GW (already happened)
  const recentChanges = players
    .filter((p) => p.costChangeEvent !== 0)
    .sort((a, b) => Math.abs(b.costChangeEvent) - Math.abs(a.costChangeEvent));

  // Biggest season movers
  const biggestRisers = [...players]
    .filter((p) => p.costChangeStart > 0)
    .sort((a, b) => b.costChangeStart - a.costChangeStart)
    .slice(0, 10);

  const biggestFallers = [...players]
    .filter((p) => p.costChangeStart < 0)
    .sort((a, b) => a.costChangeStart - b.costChangeStart)
    .slice(0, 10);

  return {
    rising,
    falling,
    recentChanges,
    biggestRisers,
    biggestFallers,
    lastUpdated: new Date().toLocaleTimeString(),
  };
}

/* ── fetchTransferHistory ─────────────────────────────────── */

export async function fetchTransferHistory() {
  const [bootstrap, history, fixtures] = await Promise.all([
    getBootstrap(),
    getManagerHistory(),
    getFixtures(),
  ]);

  const { teams, positionMap, players: allPlayers, currentEvent } = buildLookups(bootstrap);
  const playedGws = history.current.filter((gw) => gw.event_transfers > 0);

  if (playedGws.length === 0) return { transfers: [], teams };

  // Build upcoming fixtures for xPts enrichment
  const baseGw = currentEvent?.id || history.current[history.current.length - 1]?.event || 1;
  const upcomingByTeam = getUpcomingFixturesByTeam(fixtures, teams, baseGw);

  // Fetch picks for all played gameweeks (we need GW before and GW of transfer)
  const allGwIds = history.current.map((gw) => gw.event);
  const picksMap = {};
  // Fetch all picks in batches to avoid too many parallel requests
  const batchSize = 5;
  for (let i = 0; i < allGwIds.length; i += batchSize) {
    const batch = allGwIds.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map((gw) => getManagerPicks(gw).catch(() => null))
    );
    batch.forEach((gw, idx) => {
      if (results[idx]) picksMap[gw] = results[idx];
    });
  }

  // Detect transfers by comparing consecutive GW picks
  const transfers = [];
  for (const gwData of playedGws) {
    const gw = gwData.event;
    const prevGw = allGwIds[allGwIds.indexOf(gw) - 1];
    if (!prevGw || !picksMap[prevGw] || !picksMap[gw]) continue;

    const prevIds = new Set(picksMap[prevGw].picks.map((p) => p.element));
    const currIds = new Set(picksMap[gw].picks.map((p) => p.element));

    const playersIn = [...currIds].filter((id) => !prevIds.has(id));
    const playersOut = [...prevIds].filter((id) => !currIds.has(id));

    // Pair transfers (in/out)
    const count = Math.min(playersIn.length, playersOut.length);
    for (let i = 0; i < count; i++) {
      const pIn = allPlayers[playersIn[i]];
      const pOut = allPlayers[playersOut[i]];
      if (!pIn || !pOut) continue;

      transfers.push({
        gameweek: gw,
        transferCost: gwData.event_transfers_cost,
        playerIn: {
          id: pIn.id,
          name: pIn.web_name,
          position: positionMap[pIn.element_type],
          club: teams[pIn.team]?.short_name || "???",
          clubFull: teams[pIn.team]?.name || "Unknown",
          price: pIn.now_cost / 10,
          teamId: pIn.team,
          form: parseFloat(pIn.form) || 0,
          ictIndex: parseFloat(pIn.ict_index) || 0,
          pointsPerGame: parseFloat(pIn.points_per_game) || 0,
          chanceOfPlaying: pIn.chance_of_playing_next_round,
          bonus: pIn.bonus || 0,
          minutes: pIn.minutes || 0,
          upcomingFixtures: (upcomingByTeam[pIn.team] || []).slice(0, 5),
        },
        playerOut: {
          id: pOut.id,
          name: pOut.web_name,
          position: positionMap[pOut.element_type],
          club: teams[pOut.team]?.short_name || "???",
          clubFull: teams[pOut.team]?.name || "Unknown",
          price: pOut.now_cost / 10,
          teamId: pOut.team,
          form: parseFloat(pOut.form) || 0,
          ictIndex: parseFloat(pOut.ict_index) || 0,
          pointsPerGame: parseFloat(pOut.points_per_game) || 0,
          chanceOfPlaying: pOut.chance_of_playing_next_round,
          bonus: pOut.bonus || 0,
          minutes: pOut.minutes || 0,
          upcomingFixtures: (upcomingByTeam[pOut.team] || []).slice(0, 5),
        },
      });
    }
  }

  // Now calculate points for each transfer from the transfer GW onwards
  const currentGw = Math.max(...allGwIds);

  // Collect all unique GWs we need, then batch-fetch them
  const gwsNeeded = new Set();
  for (const t of transfers) {
    for (let gw = t.gameweek; gw <= currentGw; gw++) {
      gwsNeeded.add(gw);
    }
  }
  const liveCache = {};
  const gwBatch = [...gwsNeeded].sort((a, b) => a - b);
  for (let i = 0; i < gwBatch.length; i += batchSize) {
    const batch = gwBatch.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map((gw) => getLiveGameweek(gw).catch(() => null))
    );
    batch.forEach((gw, idx) => {
      liveCache[gw] = results[idx];
    });
  }

  for (const t of transfers) {
    let inPoints = 0;
    let outPoints = 0;
    const gwBreakdown = [];

    for (let gw = t.gameweek; gw <= currentGw; gw++) {
      const live = liveCache[gw];
      if (!live) continue;

      const inEl = live.elements.find((e) => e.id === t.playerIn.id);
      const outEl = live.elements.find((e) => e.id === t.playerOut.id);
      const inPts = inEl?.stats?.total_points || 0;
      const outPts = outEl?.stats?.total_points || 0;

      inPoints += inPts;
      outPoints += outPts;
      gwBreakdown.push({
        gw,
        inPts,
        outPts,
        diff: inPts - outPts,
      });
    }

    t.playerIn.pointsSinceTransfer = inPoints;
    t.playerOut.pointsSinceTransfer = outPoints;
    t.netGain = inPoints - outPoints;
    t.gwBreakdown = gwBreakdown;
    t.gameweeksCompared = gwBreakdown.length;
  }

  // Sort by most recent first
  transfers.sort((a, b) => b.gameweek - a.gameweek);

  return { transfers, teams };
}

/* ── analyzeTransfer ──────────────────────────────────────── */

export function analyzeTransfer(playerOut, playerIn, gameweeks, teams) {
  const outResult = calculateMultiGwXpts(playerOut, playerOut.upcomingFixtures, teams, gameweeks);
  const inResult = calculateMultiGwXpts(playerIn, playerIn.upcomingFixtures, teams, gameweeks);

  const outProjected = outResult.totalXpts;
  const inProjected = inResult.totalXpts;
  const pointsDiff = +(inProjected - outProjected).toFixed(1);
  const formDiff = (playerIn.form || 0) - (playerOut.form || 0);
  const priceDiff = (playerIn.price || 0) - (playerOut.price || 0);

  // xG-based comparison (if available)
  const inXGI = playerIn.xGI90 || playerIn.xGI || 0;
  const outXGI = playerOut.xGI90 || playerOut.xGI || 0;
  const xgiDiff = inXGI - outXGI;

  const avgInDifficulty = playerIn.upcomingFixtures?.length
    ? playerIn.upcomingFixtures
        .slice(0, gameweeks)
        .reduce((s, f) => s + f.difficulty, 0) / gameweeks
    : 3;
  const avgOutDifficulty = playerOut.upcomingFixtures?.length
    ? playerOut.upcomingFixtures
        .slice(0, gameweeks)
        .reduce((s, f) => s + f.difficulty, 0) / gameweeks
    : playerOut.fixtureDifficulty || 3;
  const fixtureDiff = avgOutDifficulty - avgInDifficulty;

  let riskLevel;
  if (Math.abs(pointsDiff) <= 2 && Math.abs(formDiff) < 1) {
    riskLevel = "Low";
  } else if (Math.abs(pointsDiff) > 5 || avgInDifficulty > 3.5) {
    riskLevel = "High";
  } else {
    riskLevel = "Medium";
  }

  let recommendation;
  if (pointsDiff > 3 && formDiff >= 0) {
    recommendation = "Strong Buy";
  } else if (pointsDiff > 3 && xgiDiff > 0.1) {
    // New: xG data supports the transfer even with moderate points diff
    recommendation = "Strong Buy";
  } else if (pointsDiff < -2 || formDiff < -1.5) {
    recommendation = "Avoid";
  } else {
    recommendation = "Neutral";
  }

  // Price pressure can tip a neutral recommendation
  if (recommendation === "Neutral") {
    const inRising = playerIn.pricePressure === "rising" || playerIn.pricePressure === "likely-rising";
    const outFalling = playerOut.pricePressure === "falling" || playerOut.pricePressure === "likely-falling";
    if (inRising && outFalling && pointsDiff >= 0) {
      recommendation = "Strong Buy";
    }
  }

  // Build richer explanation incorporating xG insights
  const xgNote =
    inXGI > 0 && outXGI > 0
      ? ` Underlying xGI comparison: ${playerIn.name} ${xgiDiff > 0 ? "+" : ""}${xgiDiff.toFixed(2)} per 90 vs ${playerOut.name}.`
      : "";

  const priceNote =
    (playerIn.pricePressure === "rising" || playerIn.pricePressure === "likely-rising")
      ? ` Price alert: ${playerIn.name} has ${(playerIn.netTransfersEvent || 0).toLocaleString()} net transfers in — price rise expected.`
      : (playerOut.pricePressure === "falling" || playerOut.pricePressure === "likely-falling")
        ? ` Price alert: ${playerOut.name} is losing ownership — price drop expected.`
        : "";

  // Build reasoning from xPts factors
  const inReasons = inResult.topReasons;
  const outReasons = outResult.topReasons;

  const explanations = {
    "Strong Buy": `${playerIn.name} (${inProjected} xPts) is projected to outscore ${playerOut.name} (${outProjected} xPts) over ${gameweeks} GW${gameweeks > 1 ? "s" : ""}. Key factors: ${inReasons.join(", ").toLowerCase()}.`,
    Neutral: `Sideways move. ${playerIn.name} (${inProjected} xPts) vs ${playerOut.name} (${outProjected} xPts) over ${gameweeks} GW${gameweeks > 1 ? "s" : ""}. Consider saving the transfer.`,
    Avoid: `${playerOut.name} (${outProjected} xPts) is the better option. Key: ${outReasons.join(", ").toLowerCase()}.`,
  };

  return {
    pointsDiff,
    formDiff: formDiff.toFixed(1),
    priceDiff: priceDiff.toFixed(1),
    fixtureDiff: fixtureDiff.toFixed(1),
    xgiDiff: xgiDiff.toFixed(2),
    riskLevel,
    recommendation,
    explanation: explanations[recommendation],
    outProjected,
    inProjected,
    outReasons,
    inReasons,
    avgInDifficulty: avgInDifficulty.toFixed(1),
  };
}
