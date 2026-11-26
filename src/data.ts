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
  deleteSchema,
  applyCommand,
  createTournament,
  createDraft,
  profileEntrySchema,
  profileMutationSchema,
  type ProfileMutation,
  type FencerProfile,
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
const profilesKey = "engarde-practice-profiles-v1";
export function useTournaments() {
  const [profilesLoading, setProfilesLoading] = useState(!practice);
  const [draftsLoading, setDraftsLoading] = useState(!practice);
  const [profileError, setProfileError] = useState("");
  const [draftError, setDraftError] = useState("");
  const [drafts, setDrafts] = useState<Tournament[]>([]);
  const [profiles, setProfiles] = useState<FencerProfile[]>(() => {
    if (!practice) return [];
    try {
      return JSON.parse(localStorage.getItem(profilesKey) || "[]");
    } catch {
      return [];
    }
  });
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
    if (practice) return;
    if (!admin) {
      setDrafts([]);
      setProfiles([]);
      return;
    }
    setProfilesLoading(true);
    setDraftsLoading(true);
    const stopDrafts = onSnapshot(
      collection(db, "tournamentDrafts"),
      (snapshot) => {
        setDrafts(snapshot.docs.map((doc) => doc.data() as Tournament));
        setDraftsLoading(false);
        setDraftError("");
      },
      () => {
        setDraftsLoading(false);
        setDraftError("Unable to load tournament drafts.");
      },
    );
    const stopProfiles = onSnapshot(
      collection(db, "fencerProfiles"),
      (snapshot) => {
        setProfiles(snapshot.docs.map((doc) => doc.data() as FencerProfile));
        setProfilesLoading(false);
        setProfileError("");
      },
      () => {
        setProfilesLoading(false);
        setProfileError("Unable to load fencer profiles.");
      },
    );
    return () => {
      stopDrafts();
      stopProfiles();
    };
  }, [admin]);
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
      if (t && (command as { type?: string })?.type === "delete") {
        const deletion = deleteSchema.parse(command);
        if (deletion.confirmation !== t.name)
          throw new Error("Type the tournament name to confirm deletion.");
        setTournaments((old) => old.filter((item) => item.id !== id));
        return id;
      }
      let profile: FencerProfile | undefined;
      let created = false;
      if ((command as { type?: string })?.type === "addEntry") {
        const entry = profileEntrySchema.parse(command);
        if ("id" in entry.profile) {
          const existingId = entry.profile.id;
          profile = profiles.find((item) => item.id === existingId);
        } else {
          profile = { id: crypto.randomUUID(), name: entry.profile.name };
          created = true;
        }
      }
      const next = t
        ? applyCommand(
            t,
            command,
            Date.now(),
            profile && { id: crypto.randomUUID(), profile },
          )
        : createDraft(command, id, Date.now());
      if (created && profile) {
        const nextProfiles = [...profiles, profile];
        localStorage.setItem(profilesKey, JSON.stringify(nextProfiles));
        setProfiles(nextProfiles);
      }
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
  async function mutateProfile(command: ProfileMutation) {
    if (!admin) throw new Error("Admin access required.");
    const parsed = profileMutationSchema.parse(command);
    if (!practice) {
      const response = await httpsCallable<
        { requestId: string; command: ProfileMutation },
        { id: string }
      >(
        functions,
        "mutateFencer",
      )({ requestId: crypto.randomUUID(), command: parsed });
      return response.data.id;
    }
    const id = parsed.type === "create" ? crypto.randomUUID() : parsed.id;
    if (parsed.type === "rename") {
      const prior = profiles.find((profile) => profile.id === id);
      if (!prior) throw new Error("Fencer profile not found.");
      if (prior.name !== parsed.expectedName)
        throw new Error(
          "Another admin edited this profile. Review the latest name and try again.",
        );
    }
    const next =
      parsed.type === "create"
        ? [...profiles, { id, name: parsed.name }]
        : profiles.map((profile) =>
            profile.id === id ? { ...profile, name: parsed.name } : profile,
          );
    localStorage.setItem(profilesKey, JSON.stringify(next));
    setProfiles(next);
    return id;
  }
  const visible = admin
    ? [
        ...tournaments,
        ...drafts.filter(
          (draft) => !tournaments.some((t) => t.id === draft.id),
        ),
      ].sort((a, b) => b.createdAt - a.createdAt)
    : tournaments.filter((t) => !practice || t.matches.length > 0);
  return {
    tournaments: visible,
    profiles,
    admin,
    loading,
    error: error || draftError,
    profileError,
    profilesLoading,
    draftsLoading,
    login,
    logout,
    mutate,
    mutateProfile,
  };
}
