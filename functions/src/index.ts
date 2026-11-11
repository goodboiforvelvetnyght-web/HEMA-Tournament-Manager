import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { setGlobalOptions } from "firebase-functions/v2";
import { createHash, scryptSync, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  applyCommand,
  createTournament,
  type Tournament,
} from "../../shared/domain.js";
initializeApp();
const db = getFirestore();
const passwordHash = defineSecret("ADMIN_PASSWORD_HASH");
setGlobalOptions({
  region: "asia-southeast1",
  maxInstances: 3,
  memory: "256MiB",
  serviceAccount: "hema-runtime@jhematournamentapp.iam.gserviceaccount.com",
});
const options = { cors: true, invoker: "public" as const };
export const adminLogin = onCall(
  { ...options, secrets: [passwordHash] },
  async (request) => {
    const password = request.data?.password;
    if (
      typeof password !== "string" ||
      password.length < 1 ||
      password.length > 128
    )
      throw new HttpsError("invalid-argument", "Enter your admin password.");
    const ip = createHash("sha256")
      .update(request.rawRequest.ip || "unknown")
      .digest("hex");
    const ref = db.collection("loginAttempts").doc(ip);
    const now = Date.now();
    await db.runTransaction(async (tx) => {
      const prior = (await tx.get(ref)).data();
      const fresh = !prior || now - prior.start >= 15 * 60 * 1000;
      if (!fresh && prior.count >= 10)
        throw new HttpsError(
          "resource-exhausted",
          "Too many attempts. Try again in 15 minutes.",
        );
      tx.set(ref, {
        start: fresh ? now : prior.start,
        count: fresh ? 1 : prior.count + 1,
      });
    });
    const [salt, expected] = passwordHash.value().split(":");
    if (!salt || !expected || !/^[a-f0-9]{128}$/.test(expected))
      throw new HttpsError(
        "failed-precondition",
        "Admin access has not been configured.",
      );
    const actual = scryptSync(password, salt, 64);
    if (!timingSafeEqual(actual, Buffer.from(expected, "hex")))
      throw new HttpsError("unauthenticated", "Incorrect admin password.");
    return {
      token: await getAuth().createCustomToken("shared-admin", { admin: true }),
    };
  },
);
const mutateSchema = z
  .object({
    tournamentId: z.string().regex(/^[a-zA-Z0-9-]{1,80}$/),
    expectedVersion: z.number().int().min(-1),
    requestId: z.string().uuid(),
    command: z.unknown(),
  })
  .strict();
export const mutateTournament = onCall(options, async (request) => {
  if (request.auth?.token.admin !== true)
    throw new HttpsError("permission-denied", "Admin access required.");
  try {
    const data = mutateSchema.parse(request.data);
    const ref = db.collection("tournaments").doc(data.tournamentId);
    const receipt = db.collection("mutationReceipts").doc(data.requestId);
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(data))
      .digest("hex");
    await db.runTransaction(async (tx) => {
      const previousReceipt = await tx.get(receipt);
      if (previousReceipt.exists) {
        if (previousReceipt.data()!.fingerprint !== fingerprint)
          throw new HttpsError(
            "invalid-argument",
            "Request identifier was already used.",
          );
        return;
      }
      const snapshot = await tx.get(ref);
      const now = Date.now();
      let tournament: Tournament;
      if (data.expectedVersion === -1) {
        if (snapshot.exists)
          throw new HttpsError(
            "already-exists",
            "This tournament already exists.",
          );
        tournament = createTournament(data.command, data.tournamentId, now);
      } else {
        if (!snapshot.exists)
          throw new HttpsError("not-found", "Tournament not found.");
        const old = snapshot.data() as Tournament;
        if (old.version !== data.expectedVersion)
          throw new HttpsError(
            "aborted",
            "Another judge updated this tournament. Your view has refreshed; please try again.",
          );
        tournament = applyCommand(old, data.command, now);
      }
      if (Buffer.byteLength(JSON.stringify(tournament)) > 900000)
        throw new HttpsError(
          "resource-exhausted",
          "Tournament storage limit reached. Export a backup and contact the administrator.",
        );
      tx.set(ref, tournament);
      tx.set(receipt, {
        tournamentId: data.tournamentId,
        fingerprint,
        at: now,
      });
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    if (error instanceof z.ZodError)
      throw new HttpsError(
        "invalid-argument",
        error.issues.map((i) => i.message).join(" "),
      );
    throw new HttpsError(
      "failed-precondition",
      error instanceof Error ? error.message : "Unable to update tournament.",
    );
  }
});
