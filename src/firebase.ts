import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
const emulator = import.meta.env.VITE_FIREBASE_EMULATORS === "true";
export const app = initializeApp({
  apiKey: emulator ? "demo-key" : "AIzaSyDGfM49KqtcOcRL2pbrUs1RYWqxuO2zW_g",
  authDomain: "jhematournamentapp.firebaseapp.com",
  projectId: emulator ? "demo-hema" : "jhematournamentapp",
  storageBucket: "jhematournamentapp.firebasestorage.app",
  messagingSenderId: "583621113851",
  appId: "1:583621113851:web:542075b29bb65ddae5bd5e",
});
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, "asia-southeast1");
if (emulator) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}
