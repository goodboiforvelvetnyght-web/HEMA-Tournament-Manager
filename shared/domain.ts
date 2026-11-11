import { z } from "zod";

export type Participant = { id: string; name: string; pool: number };
export type ScoreEvent = {
  kind: "point" | "double";
  side: "a" | "b";
  delta: number;
  at: number;
};
export type Match = {
  id: string;
  stage: "pools" | "bracket";
  pool: number;
  round: number;
  slot: number;
  a: string | null;
  b: string | null;
  scoreA: number;
  scoreB: number;
  doubles: number;
  status: "upcoming" | "live" | "finished" | "bye";
  result: "a" | "b" | "draw" | null;
  elapsedMs: number;
  startedAt: number | null;
  events: ScoreEvent[];
};
export type Tournament = {
  id: string;
  name: string;
  weapon: string;
  date: string;
  participants: Participant[];
  poolCount: number;
  matches: Match[];
  bracketSeeds: (string | null)[];
  bracketRound: number;
  version: number;
  createdAt: number;
  updatedAt: number;
};
const text = z.string().trim().min(1).max(60);
export const createSchema = z
  .object({
    name: text,
    weapon: text,
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    participants: z
      .array(z.object({ name: text, pool: z.number().int().min(0).max(11) }))
      .min(2)
      .max(24),
    poolCount: z.number().int().min(1).max(12),
  })
  .strict();
export const commandSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("score"),
      matchId: z.string(),
      side: z.enum(["a", "b"]),
      delta: z.number().int().min(-10).max(10),
    })
    .strict(),
  z
    .object({
      type: z.literal("double"),
      matchId: z.string(),
      delta: z.union([z.literal(-1), z.literal(1)]).default(1),
    })
    .strict(),
  z.object({ type: z.literal("undo"), matchId: z.string() }).strict(),
  z
    .object({
      type: z.literal("timer"),
      matchId: z.string(),
      action: z.enum(["start", "pause", "adjust"]),
      seconds: z.number().int().min(0).max(86400).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("submit"),
      matchId: z.string(),
      result: z.enum(["a", "b", "draw"]),
    })
    .strict(),
  z.object({ type: z.literal("reopen"), matchId: z.string() }).strict(),
  z
    .object({
      type: z.literal("reorder"),
      matchIds: z.array(z.string()).max(276),
    })
    .strict(),
  z
    .object({
      type: z.literal("bracket"),
      seeds: z.array(z.string().nullable()).min(2).max(32),
    })
    .strict(),
  z.object({ type: z.literal("nextRound") }).strict(),
]);
export type Command = z.infer<typeof commandSchema>;
function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
export function emptyMatch(
  id: string,
  a: string | null,
  b: string | null,
  round: number,
  slot: number,
  stage: Match["stage"],
  pool = 0,
): Match {
  return {
    id,
    a,
    b,
    round,
    slot,
    stage,
    pool,
    scoreA: 0,
    scoreB: 0,
    doubles: 0,
    status: "upcoming",
    result: null,
    elapsedMs: 0,
    startedAt: null,
    events: [],
  };
}
export function roundRobin(ids: string[]): (string | null)[][][] {
  const ring: (string | null)[] = [...ids];
  if (ring.length % 2) ring.push(null);
  const rounds: (string | null)[][][] = [];
  for (let r = 0; r < ring.length - 1; r++) {
    const pairs: (string | null)[][] = [];
    for (let i = 0; i < ring.length / 2; i++)
      if (ring[i] && ring[ring.length - 1 - i])
        pairs.push([ring[i], ring[ring.length - 1 - i]]);
    rounds.push(pairs);
    ring.splice(1, 0, ring.pop()!);
  }
  return rounds;
}
export function createTournament(
  input: unknown,
  id: string,
  now: number,
): Tournament {
  const data = createSchema.parse(input);
  const participants = data.participants.map((p, i) => ({
    ...p,
    id: `p${i + 1}`,
  }));
  for (let pool = 0; pool < data.poolCount; pool++)
    assert(
      participants.filter((p) => p.pool === pool).length >= 2,
      "Each pool needs at least two participants.",
    );
  assert(
    participants.every((p) => p.pool < data.poolCount),
    "Invalid pool assignment.",
  );
  const matches: Match[] = [];
  for (let pool = 0; pool < data.poolCount; pool++)
    roundRobin(
      participants.filter((p) => p.pool === pool).map((p) => p.id),
    ).forEach((pairs, round) =>
      pairs.forEach(([a, b], slot) =>
        matches.push(
          emptyMatch(
            `p${pool}r${round}m${slot}`,
            a,
            b,
            round + 1,
            slot,
            "pools",
            pool,
          ),
        ),
      ),
    );
  matches.sort(
    (a, b) => a.round - b.round || a.pool - b.pool || a.slot - b.slot,
  );
  return {
    id,
    name: data.name,
    weapon: data.weapon,
    date: data.date,
    poolCount: data.poolCount,
    participants,
    matches,
    bracketSeeds: [],
    bracketRound: 0,
    version: 0,
    createdAt: now,
    updatedAt: now,
  };
}
export function elapsed(match: Match, now: number) {
  return (
    match.elapsedMs +
    (match.startedAt === null ? 0 : Math.max(0, now - match.startedAt))
  );
}
export function winner(match: Match) {
  return match.result === "a" ? match.a : match.result === "b" ? match.b : null;
}
export function penalty(doubles: number) {
  return (doubles * (doubles - 1)) / 2;
}
export function standings(t: Tournament) {
  const rows = t.participants.map((p) => ({
    ...p,
    played: 0,
    wins: 0,
    draws: 0,
    for: 0,
    against: 0,
    doubles: 0,
    ranking: 0,
  }));
  const lookup = new Map(rows.map((r) => [r.id, r]));
  for (const m of t.matches.filter(
    (m) => m.stage === "pools" && m.status === "finished",
  )) {
    const a = lookup.get(m.a!)!,
      b = lookup.get(m.b!)!;
    a.played++;
    b.played++;
    a.for += m.scoreA;
    a.against += m.scoreB;
    b.for += m.scoreB;
    b.against += m.scoreA;
    a.doubles += m.doubles;
    b.doubles += m.doubles;
    if (m.result === "a") a.wins++;
    else if (m.result === "b") b.wins++;
    else {
      a.draws++;
      b.draws++;
    }
  }
  for (const r of rows)
    r.ranking = 3 * r.wins + r.for - r.against - penalty(r.doubles);
  return rows.sort(
    (a, b) => b.ranking - a.ranking || a.name.localeCompare(b.name),
  );
}
export function suggestedSeeds(ids: string[]): (string | null)[] {
  if (ids.length < 2) return [];
  const size = 2 ** Math.ceil(Math.log2(ids.length));
  const byes = size - ids.length;
  const seeds: (string | null)[] = [];
  let cursor = 0;
  for (let i = 0; i < size / 2; i++) {
    seeds.push(ids[cursor++]);
    seeds.push(i < byes ? null : ids[cursor++]);
  }
  return seeds;
}
function addRound(t: Tournament, entrants: (string | null)[], round: number) {
  for (let i = 0; i < entrants.length; i += 2) {
    const m = emptyMatch(
      `b${round}m${i / 2}`,
      entrants[i],
      entrants[i + 1],
      round,
      i / 2,
      "bracket",
    );
    assert(m.a || m.b, "An opening pairing cannot contain two byes.");
    if (!m.a || !m.b) {
      m.status = "bye";
      m.result = m.a ? "a" : "b";
    }
    t.matches.push(m);
  }
  t.bracketRound = round;
}
export function applyCommand(
  source: Tournament,
  raw: unknown,
  now: number,
): Tournament {
  const c = commandSchema.parse(raw);
  const t = structuredClone(source);
  if (c.type === "bracket") {
    assert(!t.bracketRound, "The bracket is already confirmed.");
    assert(
      t.matches
        .filter((m) => m.stage === "pools")
        .every((m) => m.status === "finished"),
      "Complete all pool matches before confirming the bracket.",
    );
    const ids = c.seeds.filter((id): id is string => id !== null);
    assert(
      ids.length >= 2 && new Set(ids).size === ids.length,
      "Select at least two distinct participants.",
    );
    assert(
      ids.every((id) => t.participants.some((p) => p.id === id)),
      "Unknown participant.",
    );
    assert(
      c.seeds.length === 2 ** Math.ceil(Math.log2(ids.length)),
      "Use the smallest bracket that fits the qualifiers.",
    );
    t.bracketSeeds = c.seeds;
    addRound(t, c.seeds, 1);
  } else if (c.type === "nextRound") {
    assert(t.bracketRound > 0, "Confirm the bracket first.");
    const current = t.matches
      .filter((m) => m.stage === "bracket" && m.round === t.bracketRound)
      .sort((a, b) => a.slot - b.slot);
    assert(current.length > 1, "The final round is already generated.");
    assert(
      current.every(
        (m) => (m.status === "finished" || m.status === "bye") && winner(m),
      ),
      "Finish the current round first.",
    );
    addRound(t, current.map(winner), t.bracketRound + 1);
  } else if (c.type === "reorder") {
    assert(
      c.matchIds.length === t.matches.length &&
        new Set(c.matchIds).size === t.matches.length &&
        c.matchIds.every((id) => t.matches.some((m) => m.id === id)),
      "The match queue changed. Refresh and try again.",
    );
    t.matches = c.matchIds.map((id) => t.matches.find((m) => m.id === id)!);
  } else {
    const m = t.matches.find((m) => m.id === c.matchId);
    assert(m, "Match not found.");
    assert(m.status !== "bye", "A bye does not require scoring.");
    if (c.type === "reopen") {
      assert(
        m.status === "finished",
        "Only submitted matches can be reopened.",
      );
      assert(
        m.stage === "pools" || m.round === t.bracketRound,
        "The next round has started. This result is locked.",
      );
      m.status = "live";
      m.result = null;
    } else {
      assert(
        m.status !== "finished",
        "Reopen this match before correcting it.",
      );
      if (c.type === "score") {
        const key = c.side === "a" ? "scoreA" : "scoreB";
        assert(
          c.delta !== 0 && m[key] + c.delta >= 0 && m[key] + c.delta <= 999,
          "Score must be between 0 and 999.",
        );
        m[key] += c.delta;
        m.events.push({ kind: "point", side: c.side, delta: c.delta, at: now });
        m.status = "live";
      } else if (c.type === "double") {
        assert(
          m.doubles + c.delta >= 0 && m.doubles + c.delta <= 99,
          "Doubles must be between 0 and 99.",
        );
        m.doubles += c.delta;
        m.events.push({ kind: "double", side: "a", delta: c.delta, at: now });
        m.status = "live";
      } else if (c.type === "undo") {
        const e = m.events.pop();
        assert(e, "No recent scoring action to undo.");
        if (e.kind === "double") m.doubles -= e.delta;
        else m[e.side === "a" ? "scoreA" : "scoreB"] -= e.delta;
      } else if (c.type === "timer") {
        if (c.action === "start") {
          assert(m.startedAt === null, "Timer is already running.");
          m.startedAt = now;
          m.status = "live";
        } else if (c.action === "pause") {
          m.elapsedMs = elapsed(m, now);
          m.startedAt = null;
        } else {
          assert(c.seconds !== undefined, "Enter elapsed seconds.");
          m.elapsedMs = c.seconds * 1000;
          m.startedAt = null;
        }
      } else if (c.type === "submit") {
        assert(
          (c.result === "a" && m.scoreA > m.scoreB) ||
            (c.result === "b" && m.scoreB > m.scoreA) ||
            (c.result === "draw" && m.scoreA === m.scoreB),
          "The result must agree with the scores.",
        );
        assert(
          m.stage === "pools" || c.result !== "draw",
          "Elimination requires a winner. Continue scoring or correct the scores.",
        );
        m.elapsedMs = elapsed(m, now);
        m.startedAt = null;
        m.status = "finished";
        m.result = c.result;
      }
      m.events = m.events.slice(-20);
    }
  }
  t.version++;
  t.updatedAt = now;
  return t;
}
