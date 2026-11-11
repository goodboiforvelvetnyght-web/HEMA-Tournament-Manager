import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  signInWithCustomToken,
} from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  setDoc,
  getDoc,
} from "firebase/firestore";
import {
  getFunctions,
  connectFunctionsEmulator,
  httpsCallable,
} from "firebase/functions";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";
const config = { apiKey: "demo-key", projectId: "demo-hema" };
const app = initializeApp(config, "admin");
const viewer = initializeApp(config, "viewer");
const auth = getAuth(app);
connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
const db = getFirestore(viewer);
connectFirestoreEmulator(db, "127.0.0.1", 8080);
const funcs = getFunctions(app, "asia-southeast1");
connectFunctionsEmulator(funcs, "127.0.0.1", 5001);
const publicFuncs = getFunctions(viewer, "asia-southeast1");
connectFunctionsEmulator(publicFuncs, "127.0.0.1", 5001);
const login = httpsCallable(funcs, "adminLogin");
const mutate = httpsCallable(funcs, "mutateTournament");
let count = 0;
async function check(name, fn) {
  await fn();
  count++;
  console.log(`PASS ${name}`);
}
let server, browser;
try {
  await check("public callers cannot mutate", () =>
    assert.rejects(
      httpsCallable(publicFuncs, "mutateTournament")({}),
      /Admin access/,
    ),
  );
  await check("wrong password rejected", () =>
    assert.rejects(
      login({ password: "wrong-password" }),
      /Incorrect admin password/,
    ),
  );
  const token = (await login({ password: "emulator-admin-only" })).data.token;
  await signInWithCustomToken(auth, token);
  const id = randomUUID();
  const payload = {
    tournamentId: id,
    expectedVersion: -1,
    requestId: randomUUID(),
    command: {
      name: "Connected Test Cup",
      weapon: "Longsword",
      date: "2026-11-21",
      poolCount: 1,
      participants: [
        { name: "Ada", pool: 0 },
        { name: "Bo", pool: 0 },
      ],
    },
  };
  await check("authenticated admin creates tournament", async () => {
    await mutate(payload);
    assert.equal((await getDoc(doc(db, "tournaments", id))).data().version, 0);
  });
  await check("mutation retry is idempotent", async () => {
    await mutate(payload);
    assert.equal((await getDoc(doc(db, "tournaments", id))).data().version, 0);
  });
  await check("idempotency key cannot be reused for a different payload", () =>
    assert.rejects(
      mutate({ ...payload, command: { ...payload.command, name: "Changed" } }),
      /already used/,
    ),
  );
  await check("public direct writes denied", () =>
    assert.rejects(
      setDoc(doc(db, "tournaments", id), { name: "Hacked" }),
      /permissions/,
    ),
  );
  const adminDb = getFirestore(app);
  connectFirestoreEmulator(adminDb, "127.0.0.1", 8080);
  await check(
    "admin direct writes also denied; backend validation is required",
    () =>
      assert.rejects(
        setDoc(doc(adminDb, "tournaments", id), { name: "Hacked" }),
        /permissions/,
      ),
  );
  await check("private login metadata unreadable", () =>
    assert.rejects(getDoc(doc(db, "loginAttempts", "test")), /permissions/),
  );
  const match = (await getDoc(doc(db, "tournaments", id))).data().matches[0];
  const score = {
    tournamentId: id,
    expectedVersion: 0,
    requestId: randomUUID(),
    command: { type: "score", matchId: match.id, side: "a", delta: 3 },
  };
  await check(
    "score update persists and retry does not duplicate points",
    async () => {
      await mutate(score);
      await mutate(score);
      const data = (await getDoc(doc(db, "tournaments", id))).data();
      assert.equal(data.matches[0].scoreA, 3);
      assert.equal(data.version, 1);
    },
  );
  await check("stale judge writes rejected", () =>
    assert.rejects(
      mutate({ ...score, requestId: randomUUID() }),
      /Another judge/,
    ),
  );
  await check("client cannot submit a contradictory winner", () =>
    assert.rejects(
      mutate({
        ...score,
        expectedVersion: 1,
        requestId: randomUUID(),
        command: { type: "submit", matchId: match.id, result: "b" },
      }),
      /agree/,
    ),
  );
  await check(
    "browser public read and server-backed login/scoring",
    async () => {
      server = spawn(
        process.execPath,
        [
          "node_modules/vite/bin/vite.js",
          "--host",
          "127.0.0.1",
          "--port",
          "5174",
          "--strictPort",
        ],
        {
          env: { ...process.env, VITE_FIREBASE_EMULATORS: "true" },
          stdio: "ignore",
        },
      );
      let ready = false;
      for (let i = 0; i < 60; i++) {
        try {
          if ((await fetch("http://127.0.0.1:5174")).ok) {
            ready = true;
            break;
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 250));
      }
      assert(ready, "Vite started");
      browser = await chromium.launch({
        executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
        args: ["--no-sandbox"],
      });
      const page = await browser.newPage();
      await page.goto(`http://127.0.0.1:5174/#${id}`);
      await page
        .getByRole("heading", { name: "Connected Test Cup", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Admin login", exact: true })
        .click();
      await page.getByLabel("Admin password").fill("emulator-admin-only");
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.getByRole("button", { name: "Leave admin desk" }).waitFor();
      await page.getByRole("tab", { name: "Matches", exact: true }).click();
      await page.locator(".match-row").first().click();
      await page
        .getByRole("button", { name: "Add 2 to Ada", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Finish match", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Confirm & submit result" })
        .click();
      await page.locator(".result-banner").waitFor();
      assert.equal(
        (await getDoc(doc(db, "tournaments", id))).data().matches[0].scoreA,
        5,
      );
      await page.getByRole("button", { name: "Close dialog" }).click();
      await page.getByRole("button", { name: "Leave admin desk" }).click();
      await page
        .getByRole("button", { name: "Admin login", exact: true })
        .waitFor();
    },
  );
  await check("login attempts are throttled", async () => {
    let throttled = false;
    for (let i = 0; i < 11; i++) {
      try {
        await login({ password: "incorrect" });
      } catch (e) {
        if (e.code === "functions/resource-exhausted") {
          throttled = true;
          break;
        }
      }
    }
    assert(throttled);
  });
  console.log(`${count} Firebase integration checks passed.`);
} finally {
  await browser?.close();
  server?.kill();
  await deleteApp(app);
  await deleteApp(viewer);
}
