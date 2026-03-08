import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, update } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCi8Ig3JuFSr-E0jM9BYIq-uNajWW5MTKg",
  authDomain: "math-competition-a9885.firebaseapp.com",
  databaseURL: "https://math-competition-a9885-default-rtdb.firebaseio.com",
  projectId: "math-competition-a9885",
  storageBucket: "math-competition-a9885.firebasestorage.app",
  messagingSenderId: "579384934096",
  appId: "1:579384934096:web:f4a09b8bd4eaa6950268d5",
  measurementId: "G-1L14TQ0G61",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, set, onValue, update };
