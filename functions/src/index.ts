import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { setGlobalOptions } from "firebase-functions/v2";
import { createHash, scryptSync, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  deleteSchema,
  applyCommand,
  createTournament,
  createDraft,
  profileEntrySchema,
  profileMutationSchema,
  type FencerProfile,
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
    const draft = db.collection("tournamentDrafts").doc(data.tournamentId);
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
      const [published, pending] = await tx.getAll(ref, draft);
      const snapshot = published.exists ? published : pending;
      let target = snapshot.exists ? snapshot.ref : draft;
      const now = Date.now();
      let tournament: Tournament;
      if (data.expectedVersion === -1) {
        if (snapshot.exists)
          throw new HttpsError(
            "already-exists",
            "This tournament already exists.",
          );
        if (
          data.command &&
          typeof data.command === "object" &&
          "participants" in data.command
        ) {
          tournament = createTournament(data.command, data.tournamentId, now);
          target = ref;
        } else {
          tournament = createDraft(data.command, data.tournamentId, now);
        }
      } else {
        if (!snapshot.exists)
          throw new HttpsError("not-found", "Tournament not found.");
        const old = snapshot.data() as Tournament;
        if (old.version !== data.expectedVersion)
          throw new HttpsError(
            "aborted",
            "Another judge updated this tournament. Your view has refreshed; please try again.",
          );
        if ((data.command as { type?: string })?.type === "delete") {
          const deletion = deleteSchema.parse(data.command);
          if (deletion.confirmation !== old.name)
            throw new HttpsError(
              "invalid-argument",
              "Type the tournament name to confirm deletion.",
            );
          tx.delete(target);
          tx.set(receipt, {
            tournamentId: data.tournamentId,
            fingerprint,
            at: now,
          });
          return;
        }
        let profile: FencerProfile | undefined;
        if ((data.command as { type?: string })?.type === "addEntry") {
          const entry = profileEntrySchema.parse(data.command);
          const profiles = db.collection("fencerProfiles");
          if ("id" in entry.profile) {
            profile = (await tx.get(profiles.doc(entry.profile.id))).data() as
              FencerProfile | undefined;
          } else {
            profile = { id: data.requestId, name: entry.profile.name };
            tx.create(profiles.doc(profile.id), profile);
          }
        }
        tournament = applyCommand(
          old,
          data.command,
          now,
          profile && { id: data.requestId, profile },
        );
        if (pending.exists && tournament.matches.length) {
          tx.delete(draft);
          target = ref;
        }
      }
      if (Buffer.byteLength(JSON.stringify(tournament)) > 900000)
        throw new HttpsError(
          "resource-exhausted",
          "Tournament storage limit reached. Export a backup and contact the administrator.",
        );
      tx.set(target, tournament);
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

// Profiles are edited independently so existing event names retain their snapshots.
export const mutateFencer = onCall(options, async (request) => {
  if (request.auth?.token.admin !== true)
    throw new HttpsError("permission-denied", "Admin access required.");
  try {
    const data = z
      .object({
        requestId: z.string().uuid(),
        command: profileMutationSchema,
      })
      .strict()
      .parse(request.data);
    const command = data.command;
    const id = command.type === "create" ? data.requestId : command.id;
    const ref = db.collection("fencerProfiles").doc(id);
    const receipt = db.collection("mutationReceipts").doc(data.requestId);
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({ operation: "fencer", ...data }))
      .digest("hex");
    await db.runTransaction(async (tx) => {
      const [prior, profile] = await tx.getAll(receipt, ref);
      if (prior.exists) {
        if (prior.data()!.fingerprint !== fingerprint)
          throw new HttpsError(
            "invalid-argument",
            "Request identifier was already used.",
          );
        return;
      }
      if (command.type === "create") {
        if (profile.exists)
          throw new HttpsError(
            "already-exists",
            "This profile already exists.",
          );
        tx.create(ref, { id, name: command.name });
      } else {
        if (!profile.exists)
          throw new HttpsError("not-found", "Fencer profile not found.");
        if (profile.data()!.name !== command.expectedName)
          throw new HttpsError(
            "aborted",
            "Another admin edited this profile. Review the latest name and try again.",
          );
        tx.update(ref, { name: command.name });
      }
      tx.set(receipt, { fingerprint, at: Date.now() });
    });
    return { id };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    if (error instanceof z.ZodError)
      throw new HttpsError(
        "invalid-argument",
        "Enter a name between 1 and 60 characters.",
      );
    throw new HttpsError(
      "internal",
      "Unable to save fencer profile. Please try again.",
    );
  }
});
