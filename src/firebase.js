import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

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
export const db = getDatabase(app);
