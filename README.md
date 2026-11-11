# En Garde — HEMA Tournament Manager

A public tournament scoreboard with a shared-password admin desk. Built with React, TypeScript, Vite, and Firebase for `jhematournamentapp`.

## First release

- Create a tournament with 2–24 named participants, pool assignments, and automatic round-robin pairings. Shuffle or manually assign pools and reorder the match queue.
- Public overview, live match scores, pool/overall standings, and an SVG-connected elimination bracket.
- Admin scoring with point controls, corrections, doubles for both fencers, recent-action undo, count-up timer, time adjustment, and explicit result submission.
- Standings: `3 × wins + points scored − points conceded − D(D − 1)/2`, where D accumulates for each fencer across the round-robin stage. Only submitted pool results count. Draws have no win bonus.
- Manual qualifier selection from either overall or pool standings, editable opening pairings, automatic byes, and explicit generation of each next elimination round. Tied scores stay tied; the admin exercises discretion through qualifier selection and placement.
- Corrections recalculate pool standings. Confirmed bracket participants stay fixed. An elimination result can be corrected until the following round is generated.
- Firebase custom-token admin sessions, server-only mutations, optimistic version checks, idempotency receipts, and password-attempt throttling.
- Practice mode with sample data stored only on the current device. It never writes to Firebase.

## Development

Use Node 22 and Java 21 for Firebase emulators. Keep the existing checkout; a cloud task is already isolated and needs no extra Git worktree.

```bash
npm ci
npm --prefix functions ci
npm run build:backend
node scripts/prepare-emulators.mjs
npm run emulators
```

In a second terminal:

```bash
VITE_FIREBASE_EMULATORS=true npm run dev
```

The emulator password is `emulator-admin-only`. It is intentionally a local test credential, not the production password. `prepare-emulators.mjs` creates an ignored `functions/.secret.local` only if none exists. Never commit that file.

For frontend-only practice, run `npm run dev` and append `?practice=1` to the address shown by Vite. Use the bottom-right Admin login button to enter the practice desk. Reloading leaves the practice admin session; practice tournaments persist in local storage.

The normal frontend connects to production Firebase unless `VITE_FIREBASE_EMULATORS=true` is set. A normal local build does not create or seed any production data. Public Firebase web configuration is in `src/firebase.ts`; it is not deployment authorization.

In the Codex cloud workspace, use writable tool caches when needed:

```bash
export npm_config_cache=/workspace/.npm-cache
export XDG_CONFIG_HOME=/workspace/.firebase-config
export FIREBASE_EMULATORS_PATH=/workspace/.firebase-emulators
```

## Validation

```bash
npm test
npm run build
npm run build:backend
npm run test:e2e
node scripts/prepare-emulators.mjs
npm run test:firebase
```

Playwright defaults to `/usr/bin/chromium`; set `CHROMIUM_PATH` on another machine. CI installs Chromium and sets this automatically.

The domain suite checks all round-robin sizes from 2 to 24, cumulative penalties, draws, corrections, timers, bye counts, advancement, and locking. Desktop and mobile browser tests create and complete a tournament through the final. Firebase integration checks exercise public permissions, authenticated mutations, idempotency, conflicting judges, server validation, login throttling, and a connected browser scoring session against `demo-hema`, never production.

The Firestore emulator download requires `storage.googleapis.com`. Keep its checksum verification enabled.

## Data and limits

A tournament is a public Firestore document containing named participants, match totals, timer timestamps, and the most recent 20 scoring actions per match. Permanent participant IDs are scoped to a tournament; a future profile ID can link the same fencer across tournaments. Only shared-admin callable functions can change these documents. The server derives scores and standings from validated commands; browsers cannot directly write tournaments or admin claims.

This first version supports 24 participants per tournament and 12 pools, with at least two fencers in each pool. Match scores are limited to 999 and doubles to 99. Undo/history retain the most recent 20 point/double actions per match. Export downloads a JSON backup; there is no import/restore UI yet. Network access is required for official scoring, and a conflicting write prompts the judge to review and retry. Practice mode is the only offline workflow.

Participant profiles, uploads, automatic time/arena allocation, tournament deletion, separate judge identities, full audit archives, and multiple concurrent editable versions are outside this release. Storage is configured with deny-all rules until an upload feature is added. Public data should contain only the display names intended for the scoreboard.

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for the Google connection and GitHub Actions workflow. The first commit intentionally leaves deployment disabled until Google setup and all CI checks succeed.
