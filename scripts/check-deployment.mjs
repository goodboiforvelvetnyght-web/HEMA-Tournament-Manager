import assert from "node:assert/strict";
const page = await fetch("https://jhematournamentapp.web.app");
assert.equal(page.status, 200);
assert.match(await page.text(), /En Garde/);
const response = await fetch(
  "https://asia-southeast1-jhematournamentapp.cloudfunctions.net/mutateTournament",
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data: {} }),
  },
);
assert.equal(response.status, 403);
const result = await response.json();
assert.equal(result.error.status, "PERMISSION_DENIED");
console.log(
  "Hosting serves En Garde and unauthenticated tournament changes are rejected.",
);
