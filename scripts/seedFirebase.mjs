/**
 * One-time script to seed Firebase Realtime Database with the fantasy football data.
 * Run with:  node scripts/seedFirebase.mjs
 */
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBIy7mb_wS05I_0ICLMSX1P5avFim7yXsA",
  authDomain: "chat-gtp-b0e1d.firebaseapp.com",
  databaseURL:
    "https://chat-gtp-b0e1d-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "chat-gtp-b0e1d",
  storageBucket: "chat-gtp-b0e1d.appspot.com",
  messagingSenderId: "617084173940",
  appId: "1:617084173940:web:e66612d6dae0337d4e9b21",
  measurementId: "G-TFJ234R5B9",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ── Data ────────────────────────────────────────────────────────────────

const myTeamPlayers = [
  { id: 1, name: "Alisson", position: "GKP", club: "Liverpool", clubShort: "LIV", price: 5.5, totalPoints: 98, gameweekPoints: 6, form: 5.2, upcomingFixture: "BOU (H)", fixtureDifficulty: 2, isCaptain: false, isViceCaptain: false, pointsHistory: [6, 2, 8, 1, 6, 3, 7] },
  { id: 2, name: "Alexander-Arnold", position: "DEF", club: "Liverpool", clubShort: "LIV", price: 7.2, totalPoints: 132, gameweekPoints: 12, form: 7.8, upcomingFixture: "BOU (H)", fixtureDifficulty: 2, isCaptain: false, isViceCaptain: false, pointsHistory: [12, 6, 2, 9, 8, 14, 6] },
  { id: 3, name: "Gabriel", position: "DEF", club: "Arsenal", clubShort: "ARS", price: 6.1, totalPoints: 110, gameweekPoints: 8, form: 5.9, upcomingFixture: "WHU (A)", fixtureDifficulty: 3, isCaptain: false, isViceCaptain: false, pointsHistory: [8, 1, 6, 2, 8, 6, 9] },
  { id: 4, name: "Saliba", position: "DEF", club: "Arsenal", clubShort: "ARS", price: 5.8, totalPoints: 105, gameweekPoints: 6, form: 5.4, upcomingFixture: "WHU (A)", fixtureDifficulty: 3, isCaptain: false, isViceCaptain: false, pointsHistory: [6, 2, 6, 1, 8, 6, 2] },
  { id: 5, name: "Salah", position: "MID", club: "Liverpool", clubShort: "LIV", price: 13.5, totalPoints: 198, gameweekPoints: 15, form: 9.6, upcomingFixture: "BOU (H)", fixtureDifficulty: 2, isCaptain: true, isViceCaptain: false, pointsHistory: [15, 8, 12, 3, 10, 14, 9] },
  { id: 6, name: "Palmer", position: "MID", club: "Chelsea", clubShort: "CHE", price: 11.0, totalPoints: 172, gameweekPoints: 10, form: 8.1, upcomingFixture: "AVL (H)", fixtureDifficulty: 3, isCaptain: false, isViceCaptain: true, pointsHistory: [10, 6, 13, 2, 8, 11, 7] },
  { id: 7, name: "Saka", position: "MID", club: "Arsenal", clubShort: "ARS", price: 10.2, totalPoints: 155, gameweekPoints: 7, form: 7.2, upcomingFixture: "WHU (A)", fixtureDifficulty: 3, isCaptain: false, isViceCaptain: false, pointsHistory: [7, 3, 9, 12, 5, 8, 6] },
  { id: 8, name: "Mbeumo", position: "MID", club: "Brentford", clubShort: "BRE", price: 7.8, totalPoints: 138, gameweekPoints: 9, form: 7.0, upcomingFixture: "NFO (H)", fixtureDifficulty: 2, isCaptain: false, isViceCaptain: false, pointsHistory: [9, 5, 2, 11, 7, 8, 3] },
  { id: 9, name: "Haaland", position: "FWD", club: "Man City", clubShort: "MCI", price: 14.3, totalPoints: 185, gameweekPoints: 13, form: 8.8, upcomingFixture: "EVE (A)", fixtureDifficulty: 2, isCaptain: false, isViceCaptain: false, pointsHistory: [13, 2, 10, 8, 15, 5, 11] },
  { id: 10, name: "Watkins", position: "FWD", club: "Aston Villa", clubShort: "AVL", price: 8.5, totalPoints: 120, gameweekPoints: 5, form: 5.8, upcomingFixture: "CHE (A)", fixtureDifficulty: 4, isCaptain: false, isViceCaptain: false, pointsHistory: [5, 8, 2, 6, 3, 9, 7] },
  { id: 11, name: "Isak", position: "FWD", club: "Newcastle", clubShort: "NEW", price: 9.0, totalPoints: 142, gameweekPoints: 8, form: 7.5, upcomingFixture: "BHA (H)", fixtureDifficulty: 2, isCaptain: false, isViceCaptain: false, pointsHistory: [8, 11, 3, 6, 9, 2, 10] },
];

const teamSummary = {
  totalPoints: 1555,
  teamValue: 108.9,
  moneyInBank: 1.1,
  overallRank: 42350,
  gameweekRank: 15820,
  currentGameweek: 24,
  gameweekPoints: 99,
  captainPoints: 30,
  averagePoints: 52,
  highestPoints: 112,
  transfers: { made: 1, cost: 0, available: 1 },
  chips: { wildcard: true, benchBoost: true, tripleCaptain: false, freeHit: true },
};

const gameweekHistory = [
  { gw: 18, points: 45, average: 48, rank: 85230 },
  { gw: 19, points: 72, average: 55, rank: 62100 },
  { gw: 20, points: 58, average: 52, rank: 54800 },
  { gw: 21, points: 89, average: 61, rank: 45200 },
  { gw: 22, points: 63, average: 54, rank: 43100 },
  { gw: 23, points: 77, average: 58, rank: 42800 },
  { gw: 24, points: 99, average: 52, rank: 42350 },
];

const projectedPoints = [
  { gw: 25, projected: 62, difficulty: "Easy" },
  { gw: 26, projected: 48, difficulty: "Hard" },
  { gw: 27, projected: 55, difficulty: "Medium" },
  { gw: 28, projected: 70, difficulty: "Easy" },
  { gw: 29, projected: 53, difficulty: "Medium" },
];

const availablePlayers = [
  { id: 101, name: "Son", position: "MID", club: "Tottenham", clubShort: "TOT", price: 9.8, totalPoints: 148, form: 7.9, upcomingFixtures: [{ gw: 25, opponent: "IPS (H)", difficulty: 2 }, { gw: 26, opponent: "MCI (A)", difficulty: 5 }, { gw: 27, opponent: "BOU (H)", difficulty: 2 }, { gw: 28, opponent: "FUL (A)", difficulty: 3 }, { gw: 29, opponent: "LEI (H)", difficulty: 2 }], expectedPoints: [8, 3, 7, 5, 8] },
  { id: 102, name: "Gordon", position: "MID", club: "Newcastle", clubShort: "NEW", price: 7.5, totalPoints: 125, form: 6.8, upcomingFixtures: [{ gw: 25, opponent: "BHA (H)", difficulty: 2 }, { gw: 26, opponent: "NFO (A)", difficulty: 3 }, { gw: 27, opponent: "LIV (H)", difficulty: 5 }, { gw: 28, opponent: "SOU (A)", difficulty: 2 }, { gw: 29, opponent: "AVL (H)", difficulty: 3 }], expectedPoints: [7, 5, 2, 8, 5] },
  { id: 103, name: "Cunha", position: "FWD", club: "Wolves", clubShort: "WOL", price: 7.0, totalPoints: 118, form: 7.2, upcomingFixtures: [{ gw: 25, opponent: "SOU (H)", difficulty: 1 }, { gw: 26, opponent: "ARS (A)", difficulty: 5 }, { gw: 27, opponent: "IPS (H)", difficulty: 2 }, { gw: 28, opponent: "EVE (A)", difficulty: 3 }, { gw: 29, opponent: "BRE (H)", difficulty: 3 }], expectedPoints: [9, 2, 8, 5, 5] },
  { id: 104, name: "Solanke", position: "FWD", club: "Tottenham", clubShort: "TOT", price: 7.6, totalPoints: 112, form: 6.1, upcomingFixtures: [{ gw: 25, opponent: "IPS (H)", difficulty: 2 }, { gw: 26, opponent: "MCI (A)", difficulty: 5 }, { gw: 27, opponent: "BOU (H)", difficulty: 2 }, { gw: 28, opponent: "FUL (A)", difficulty: 3 }, { gw: 29, opponent: "LEI (H)", difficulty: 2 }], expectedPoints: [7, 3, 6, 4, 7] },
  { id: 105, name: "Diaz", position: "MID", club: "Liverpool", clubShort: "LIV", price: 8.0, totalPoints: 130, form: 6.5, upcomingFixtures: [{ gw: 25, opponent: "BOU (H)", difficulty: 2 }, { gw: 26, opponent: "MUN (A)", difficulty: 4 }, { gw: 27, opponent: "NEW (A)", difficulty: 4 }, { gw: 28, opponent: "SOU (H)", difficulty: 1 }, { gw: 29, opponent: "MCI (A)", difficulty: 5 }], expectedPoints: [7, 4, 4, 9, 3] },
  { id: 106, name: "Nkunku", position: "FWD", club: "Chelsea", clubShort: "CHE", price: 6.8, totalPoints: 95, form: 6.0, upcomingFixtures: [{ gw: 25, opponent: "AVL (H)", difficulty: 3 }, { gw: 26, opponent: "SOU (A)", difficulty: 1 }, { gw: 27, opponent: "LEI (H)", difficulty: 2 }, { gw: 28, opponent: "MUN (A)", difficulty: 4 }, { gw: 29, opponent: "WOL (H)", difficulty: 2 }], expectedPoints: [5, 8, 7, 3, 6] },
  { id: 107, name: "Eze", position: "MID", club: "Crystal Palace", clubShort: "CRY", price: 6.9, totalPoints: 102, form: 5.8, upcomingFixtures: [{ gw: 25, opponent: "LEI (H)", difficulty: 2 }, { gw: 26, opponent: "BRE (A)", difficulty: 3 }, { gw: 27, opponent: "EVE (H)", difficulty: 2 }, { gw: 28, opponent: "ARS (A)", difficulty: 5 }, { gw: 29, opponent: "NFO (H)", difficulty: 3 }], expectedPoints: [7, 4, 6, 2, 5] },
];

const leagueData = {
  name: "Friends League",
  myPosition: 3,
  totalMembers: 12,
  standings: [
    { rank: 1, name: "TeamAlpha", manager: "James W.", points: 1620 },
    { rank: 2, name: "Goal Machine FC", manager: "Sarah K.", points: 1588 },
    { rank: 3, name: "My Football Fantasy", manager: "You", points: 1555 },
    { rank: 4, name: "Pep's Disciples", manager: "Mike T.", points: 1530 },
    { rank: 5, name: "Set Piece Kings", manager: "Emma R.", points: 1498 },
  ],
};

// ── Seed ────────────────────────────────────────────────────────────────

async function seed() {
  console.log("Seeding Firebase Realtime Database...");

  await set(ref(db, "ff2026"), {
    myTeamPlayers,
    teamSummary,
    gameweekHistory,
    projectedPoints,
    availablePlayers,
    leagueData,
  });

  console.log("Done! All data written to /ff2026");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
