import { describe, it, expect } from "vitest";
import {
  applyCommand,
  createTournament,
  penalty,
  roundRobin,
  standings,
  suggestedSeeds,
  elapsed,
  winner,
  type Tournament,
} from "../shared/domain";
const make = (n = 6, pools = 1) =>
  createTournament(
    {
      name: "Test Open",
      weapon: "Longsword",
      date: "2026-11-21",
      poolCount: pools,
      participants: Array.from({ length: n }, (_, i) => ({
        name: `Fencer ${i + 1}`,
        pool: i % pools,
      })),
    },
    "test",
    1000,
  );
function finish(t: Tournament) {
  for (const m of t.matches.filter((m) => m.stage === "pools"))
    t = applyCommand(
      t,
      { type: "submit", matchId: m.id, result: "draw" },
      2000,
    );
  return t;
}
describe("round-robin generation", () => {
  for (let n = 2; n <= 24; n++)
    it(`generates each pairing exactly once for ${n} fencers`, () => {
      const rounds = roundRobin(Array.from({ length: n }, (_, i) => String(i)));
      const pairs = rounds.flat();
      expect(pairs).toHaveLength((n * (n - 1)) / 2);
      expect(new Set(pairs.map((p) => [...p].sort().join(":"))).size).toBe(
        pairs.length,
      );
      for (const round of rounds) {
        const ids = round.flat();
        expect(new Set(ids).size).toBe(ids.length);
      }
    });
  it("separates pools and rejects singleton pools", () => {
    const t = make(8, 2);
    expect(t.matches).toHaveLength(12);
    for (const m of t.matches)
      expect(t.participants.find((p) => p.id === m.a)!.pool).toBe(
        t.participants.find((p) => p.id === m.b)!.pool,
      );
    expect(() => make(3, 2)).toThrow("at least two");
  });
});
describe("standings", () => {
  it("accumulates the double penalty across matches and counts against both fencers", () => {
    let t = make(3);
    for (const id of ["p2", "p3"]) {
      const m = t.matches.find(
        (m) => [m.a, m.b].includes("p1") && [m.a, m.b].includes(id),
      )!;
      const side = m.a === "p1" ? "a" : "b";
      t = applyCommand(
        t,
        { type: "score", matchId: m.id, side, delta: 5 },
        1000,
      );
      for (let i = 0; i < 2; i++)
        t = applyCommand(t, { type: "double", matchId: m.id }, 1000);
      t = applyCommand(
        t,
        { type: "submit", matchId: m.id, result: side },
        1000,
      );
    }
    const rows = standings(t);
    const p = rows.find((p) => p.id === "p1")!;
    expect(p).toMatchObject({
      wins: 2,
      for: 10,
      against: 0,
      doubles: 4,
      ranking: 10,
    });
    expect(rows.find((p) => p.id === "p2")!.doubles).toBe(2);
    expect(penalty(4)).toBe(6);
  });
  it("counts only submitted results; draws give no win bonus; corrections recalculate", () => {
    let t = make(2);
    const id = t.matches[0].id;
    t = applyCommand(t, { type: "double", matchId: id }, 1);
    expect(standings(t)[0].played).toBe(0);
    t = applyCommand(t, { type: "submit", matchId: id, result: "draw" }, 2);
    expect(standings(t)[0]).toMatchObject({
      played: 1,
      wins: 0,
      draws: 1,
      ranking: 0,
    });
    t = applyCommand(t, { type: "reopen", matchId: id }, 3);
    expect(standings(t)[0].played).toBe(0);
    t = applyCommand(t, { type: "score", matchId: id, side: "a", delta: 3 }, 4);
    t = applyCommand(t, { type: "submit", matchId: id, result: "a" }, 5);
    expect(standings(t)[0].ranking).toBe(6);
  });
});
describe("bracket", () => {
  for (const n of [2, 3, 5, 6, 7, 8, 12, 24])
    it(`advances ${n} qualifiers to one champion with correct byes`, () => {
      let t = finish(make(n));
      const seeds = suggestedSeeds(t.participants.map((p) => p.id));
      t = applyCommand(t, { type: "bracket", seeds }, 2000);
      expect(t.matches.filter((m) => m.status === "bye")).toHaveLength(
        seeds.length - n,
      );
      let rounds = 0;
      while (true) {
        const current = t.matches.filter(
          (m) => m.stage === "bracket" && m.round === t.bracketRound,
        );
        for (const m of current.filter((m) => m.status !== "bye")) {
          t = applyCommand(
            t,
            { type: "score", matchId: m.id, side: "a", delta: 1 },
            3000,
          );
          t = applyCommand(
            t,
            { type: "submit", matchId: m.id, result: "a" },
            4000,
          );
        }
        rounds++;
        if (current.length === 1) break;
        t = applyCommand(t, { type: "nextRound" }, 5000);
      }
      expect(rounds).toBe(Math.log2(seeds.length));
      expect(
        t.matches.filter(
          (m) => m.stage === "bracket" && m.status === "finished",
        ),
      ).toHaveLength(n - 1);
      expect(winner(t.matches.at(-1)!)).toBeTruthy();
      expect(() => applyCommand(t, { type: "nextRound" }, 6000)).toThrow(
        "final",
      );
    });
  it("rejects duplicate entrants, two-bye pairings, unfinished pools and premature advancement", () => {
    let t = make(3);
    expect(() =>
      applyCommand(t, { type: "bracket", seeds: ["p1", "p2"] }, 0),
    ).toThrow("Complete all");
    t = finish(t);
    expect(() =>
      applyCommand(t, { type: "bracket", seeds: ["p1", "p1"] }, 0),
    ).toThrow("distinct");
    expect(() =>
      applyCommand(
        finish(make(5)),
        {
          type: "bracket",
          seeds: [null, null, "p1", "p2", "p3", null, "p4", "p5"],
        },
        0,
      ),
    ).toThrow("two byes");
    t = applyCommand(
      t,
      { type: "bracket", seeds: ["p1", null, "p2", "p3"] },
      1,
    );
    expect(() => applyCommand(t, { type: "nextRound" }, 2)).toThrow(
      "Finish the current",
    );
  });
  it("rejects elimination draws and locks prior rounds once the next is generated", () => {
    let t = finish(make(4));
    t = applyCommand(
      t,
      { type: "bracket", seeds: ["p1", "p2", "p3", "p4"] },
      1,
    );
    const matches = t.matches.filter((m) => m.stage === "bracket");
    expect(() =>
      applyCommand(
        t,
        { type: "submit", matchId: matches[0].id, result: "draw" },
        2,
      ),
    ).toThrow("requires a winner");
    for (const m of matches) {
      t = applyCommand(
        t,
        { type: "score", matchId: m.id, side: "a", delta: 1 },
        2,
      );
      t = applyCommand(t, { type: "submit", matchId: m.id, result: "a" }, 3);
    }
    t = applyCommand(t, { type: "nextRound" }, 4);
    expect(() =>
      applyCommand(t, { type: "reopen", matchId: matches[0].id }, 5),
    ).toThrow("locked");
  });
});
describe("scoring and timer", () => {
  it("preserves source, validates scores, undoes points and doubles", () => {
    const source = make(2);
    const id = source.matches[0].id;
    let t = applyCommand(
      source,
      { type: "score", matchId: id, side: "a", delta: 3 },
      0,
    );
    expect(source.matches[0].scoreA).toBe(0);
    expect(() =>
      applyCommand(t, { type: "score", matchId: id, side: "b", delta: -1 }, 0),
    ).toThrow("between");
    t = applyCommand(t, { type: "double", matchId: id }, 1);
    t = applyCommand(t, { type: "undo", matchId: id }, 2);
    expect(t.matches[0].doubles).toBe(0);
    t = applyCommand(t, { type: "undo", matchId: id }, 3);
    expect(t.matches[0].scoreA).toBe(0);
  });
  it("counts up without automatically ending and resumes from pauses", () => {
    let t = make(2);
    const id = t.matches[0].id;
    t = applyCommand(t, { type: "timer", matchId: id, action: "start" }, 1000);
    expect(elapsed(t.matches[0], 301000)).toBe(300000);
    expect(t.matches[0].status).toBe("live");
    t = applyCommand(t, { type: "timer", matchId: id, action: "pause" }, 4000);
    expect(elapsed(t.matches[0], 8000)).toBe(3000);
    t = applyCommand(t, { type: "timer", matchId: id, action: "start" }, 9000);
    t = applyCommand(t, { type: "submit", matchId: id, result: "draw" }, 10000);
    expect(t.matches[0].elapsedMs).toBe(4000);
    expect(t.matches[0].startedAt).toBeNull();
  });
  it("rejects a result that conflicts with the scores and scoring on finished matches", () => {
    let t = make(2);
    const id = t.matches[0].id;
    t = applyCommand(t, { type: "score", matchId: id, side: "a", delta: 2 }, 0);
    expect(() =>
      applyCommand(t, { type: "submit", matchId: id, result: "b" }, 1),
    ).toThrow("agree");
    t = applyCommand(t, { type: "submit", matchId: id, result: "a" }, 1);
    expect(() =>
      applyCommand(t, { type: "score", matchId: id, side: "a", delta: 1 }, 2),
    ).toThrow("Reopen");
  });
});

describe("double corrections", () => {
  it("supports subtraction and undo, and recalculates both fencers after resubmission", () => {
    let t = make(2);
    const id = t.matches[0].id;
    for (let i = 0; i < 3; i++)
      t = applyCommand(t, { type: "double", matchId: id, delta: 1 }, i);
    t = applyCommand(t, { type: "submit", matchId: id, result: "draw" }, 4);
    expect(standings(t).map((r) => r.ranking)).toEqual([-3, -3]);
    t = applyCommand(t, { type: "reopen", matchId: id }, 5);
    t = applyCommand(t, { type: "double", matchId: id, delta: -1 }, 6);
    expect(t.matches[0].doubles).toBe(2);
    expect(t.matches[0].events.at(-1)?.delta).toBe(-1);
    t = applyCommand(t, { type: "undo", matchId: id }, 7);
    expect(t.matches[0].doubles).toBe(3);
    t = applyCommand(t, { type: "double", matchId: id, delta: -1 }, 8);
    t = applyCommand(t, { type: "submit", matchId: id, result: "draw" }, 9);
    expect(
      standings(t).map((r) => ({ doubles: r.doubles, ranking: r.ranking })),
    ).toEqual([
      { doubles: 2, ranking: -1 },
      { doubles: 2, ranking: -1 },
    ]);
  });
  it("rejects negative doubles, values over 99, and unsupported adjustments", () => {
    const t = make(2);
    const matchId = t.matches[0].id;
    expect(() =>
      applyCommand(t, { type: "double", matchId, delta: -1 }, 0),
    ).toThrow("between 0 and 99");
    for (const delta of [0, 2, -2, 0.5])
      expect(() =>
        applyCommand(t, { type: "double", matchId, delta }, 0),
      ).toThrow();
    t.matches[0].doubles = 99;
    expect(() =>
      applyCommand(t, { type: "double", matchId, delta: 1 }, 0),
    ).toThrow("between 0 and 99");
    expect(
      applyCommand(t, { type: "double", matchId, delta: -1 }, 0).matches[0]
        .doubles,
    ).toBe(98);
  });
});
