import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBhZ7XGKFde4UWy5H3i9NzVGYN-joVvoSY",
  authDomain: "pl-football-fantasy.firebaseapp.com",
  databaseURL:
    "https://pl-football-fantasy-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "pl-football-fantasy",
  storageBucket: "pl-football-fantasy.firebasestorage.app",
  messagingSenderId: "875638327100",
  appId: "1:875638327100:web:020b2630584c6d1e6dc039",
  measurementId: "G-FNBYMP2H7H",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
