import {
  myTeamPlayers,
  teamSummary,
  gameweekHistory,
  projectedPoints,
  availablePlayers,
  leagueData,
} from "../data/mockData";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchMyTeam() {
  await delay(600);
  return { players: myTeamPlayers, summary: teamSummary };
}

export async function fetchGameweekHistory() {
  await delay(400);
  return gameweekHistory;
}

export async function fetchProjectedPoints() {
  await delay(400);
  return projectedPoints;
}

export async function fetchAvailablePlayers() {
  await delay(500);
  return availablePlayers;
}

export async function fetchLeagueData() {
  await delay(400);
  return leagueData;
}

export function analyzeTransfer(playerOut, playerIn, gameweeks) {
  const outFixtures = playerOut.pointsHistory || [];
  const inFixtures = playerIn.expectedPoints || [];

  const outProjected = outFixtures
    .slice(0, gameweeks)
    .reduce((s, v) => s + v, 0);
  const inProjected = inFixtures
    .slice(0, gameweeks)
    .reduce((s, v) => s + v, 0);
  const pointsDiff = inProjected - outProjected;

  const formDiff = playerIn.form - playerOut.form;
  const priceDiff = playerIn.price - playerOut.price;

  const avgInDifficulty =
    playerIn.upcomingFixtures
      .slice(0, gameweeks)
      .reduce((s, f) => s + f.difficulty, 0) / gameweeks;
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
    "Strong Buy": `${playerIn.name} is projected to outscore ${playerOut.name} by ${pointsDiff} points over the next ${gameweeks} gameweeks. With better form (${playerIn.form} vs ${playerOut.form}) and favorable upcoming fixtures, this looks like a smart move. The fixture swing favors the incoming player, making this a high-confidence transfer.`,
    Neutral: `This is a sideways move. ${playerIn.name} and ${playerOut.name} are projected to score similarly over the next ${gameweeks} gameweeks (${pointsDiff > 0 ? "+" : ""}${pointsDiff} point difference). Consider whether the transfer is worth using given the marginal gain. You might want to save the transfer for a better opportunity.`,
    Avoid: `${playerOut.name} is the better option here. Keeping the current player saves a transfer and is projected to yield ${Math.abs(pointsDiff)} more points over ${gameweeks} gameweeks. The form and fixture data don't support making this change right now.`,
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
