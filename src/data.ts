import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import {
  onIdTokenChanged,
  signInWithCustomToken,
  signOut,
  browserSessionPersistence,
  setPersistence,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "./firebase";
import {
  applyCommand,
  createTournament,
  type Tournament,
} from "../shared/domain";
export const practice =
  new URLSearchParams(location.search).get("practice") === "1";
const key = "engarde-practice-v1";
function sample(): Tournament {
  const names = [
    "Alex Morgan",
    "Jordan Lee",
    "Sasha Reyes",
    "Rowan Blake",
    "Casey Tan",
    "Morgan Ellis",
    "Avery Chen",
    "Robin Hayes",
  ];
  let t = createTournament(
    {
      name: "Autumn Open",
      weapon: "Longsword",
      date: "2026-11-21",
      poolCount: 2,
      participants: names.map((name, i) => ({ name, pool: i % 2 })),
    },
    "autumn-open",
    Date.now(),
  );
  for (const [i, m] of t.matches.entries()) {
    if (i >= 7) break;
    t = applyCommand(
      t,
      { type: "score", matchId: m.id, side: "a", delta: 5 + (i % 3) },
      Date.now(),
    );
    t = applyCommand(
      t,
      { type: "score", matchId: m.id, side: "b", delta: 2 + (i % 2) },
      Date.now(),
    );
    if (i % 2)
      t = applyCommand(t, { type: "double", matchId: m.id }, Date.now());
    t = applyCommand(
      t,
      { type: "timer", matchId: m.id, action: "adjust", seconds: 148 + i * 6 },
      Date.now(),
    );
    t = applyCommand(
      t,
      { type: "submit", matchId: m.id, result: "a" },
      Date.now(),
    );
  }
  return t;
}
function initial(): Tournament[] {
  if (!practice) return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [sample()];
  } catch {
    return [sample()];
  }
}
export function useTournaments() {
  const [tournaments, setTournaments] = useState<Tournament[]>(initial);
  const [admin, setAdmin] = useState(false);
  const [loading, setLoading] = useState(!practice);
  const [error, setError] = useState("");
  useEffect(() => {
    if (practice) return;
    const stopAuth = onIdTokenChanged(auth, async (user) => {
      try {
        setAdmin(
          !!user && (await user.getIdTokenResult()).claims.admin === true,
        );
      } catch {
        setAdmin(false);
      }
    });
    const stopData = onSnapshot(
      query(collection(db, "tournaments"), orderBy("createdAt", "desc")),
      (snapshot) => {
        setTournaments(snapshot.docs.map((d) => d.data() as Tournament));
        setLoading(false);
        setError("");
      },
      () => {
        setLoading(false);
        setError(
          "Unable to load tournaments. Check your connection or try again once Firebase setup is complete.",
        );
      },
    );
    return () => {
      stopAuth();
      stopData();
    };
  }, []);
  useEffect(() => {
    if (practice) {
      try {
        localStorage.setItem(key, JSON.stringify(tournaments));
      } catch {
        setError(
          "Practice storage is full. Export your tournament before leaving.",
        );
      }
    }
  }, [tournaments]);
  async function login(password: string) {
    if (practice) {
      setAdmin(true);
      return;
    }
    await setPersistence(auth, browserSessionPersistence);
    const result = await httpsCallable<{ password: string }, { token: string }>(
      functions,
      "adminLogin",
    )({ password });
    await signInWithCustomToken(auth, result.data.token);
  }
  async function logout() {
    if (practice) setAdmin(false);
    else await signOut(auth);
  }
  async function mutate(t: Tournament | null, command: unknown) {
    if (!admin) throw new Error("Admin access required.");
    const id = t?.id || crypto.randomUUID();
    if (practice) {
      const next = t
        ? applyCommand(t, command, Date.now())
        : createTournament(command, id, Date.now());
      setTournaments((old) => [next, ...old.filter((item) => item.id !== id)]);
    } else
      await httpsCallable(
        functions,
        "mutateTournament",
      )({
        tournamentId: id,
        expectedVersion: t?.version ?? -1,
        requestId: crypto.randomUUID(),
        command,
      });
    return id;
  }
  return { tournaments, admin, loading, error, login, logout, mutate };
}
