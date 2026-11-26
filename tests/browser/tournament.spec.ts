import { test, expect } from "@playwright/test";
test("public views and practice tournament through a bye to the final", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?practice=1");
  await expect(
    page.getByRole("heading", { name: "Every exchange. Every victory." }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-home.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: /Autumn Open/ }).click();
  await expect(
    page.getByRole("heading", { name: "Autumn Open", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-overview.png`,
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Standings" }).click();
  await expect(
    page.getByRole("columnheader", { name: "Ranking score" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create tournament" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Admin login", exact: true }).click();
  await page.getByRole("button", { name: "Enter practice desk" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Tournaments" })
    .click();
  await page
    .getByRole("button", { name: "Create tournament", exact: true })
    .click();
  await page.getByLabel("Tournament name").fill("First Build Cup");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(
    page.getByRole("button", { name: "Generate schedule", exact: true }),
  ).toBeDisabled();
  for (const name of ["Ada", "Bo", "Cy", "Dee"]) {
    await page.getByLabel("New fencer name").fill(name);
    await page.getByRole("button", { name: "Create profile and add" }).click();
    await expect(
      page.getByRole("button", { name: "Correct name for " + name }),
    ).toBeVisible();
  }
  await page.getByLabel("Number of pools").selectOption("2");
  for (const [name, pool] of [
    ["Ada", "0"],
    ["Bo", "0"],
    ["Cy", "1"],
    ["Dee", "1"],
  ])
    await page.getByLabel("Pool for " + name).selectOption(pool);
  await page.getByRole("button", { name: "Save pools" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Tournaments", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Review pools for First Build Cup" })
    .click();
  await expect(page.getByText("Ada, Bo")).toBeVisible();
  await expect(page.getByText(/scheduled pool bouts/)).toHaveCount(0);
  await page
    .getByRole("button", { name: "Generate schedule", exact: true })
    .click();
  await expect(page.getByText("2 scheduled pool bouts")).toBeVisible();
  await page
    .getByRole("button", { name: "Regenerate schedule", exact: true })
    .click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Tournaments", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open matches for First Build Cup" })
    .click();
  for (let i = 0; i < 2; i++) {
    await page.locator(".match-row").nth(i).click();
    await page
      .getByRole("button", { name: /Add 3 to/ })
      .first()
      .click();
    await expect(
      page.getByRole("button", { name: "Subtract double" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Add double" }).click();
    await page.getByRole("button", { name: "Add double" }).click();
    await page.getByRole("button", { name: "Subtract double" }).click();
    await expect(page.getByLabel("Doubles", { exact: true })).toHaveText("1");
    await page.getByRole("button", { name: "Undo last score action" }).click();
    await expect(page.getByLabel("Doubles", { exact: true })).toHaveText("2");
    await page.getByRole("button", { name: "Subtract double" }).click();
    await page
      .getByRole("button", { name: "Start timer", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Pause timer" }),
    ).toBeVisible();
    await page.mouse.click(1, 1);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Close dialog" }).click();
    await page.locator(".match-row").nth(i).click();
    await expect(
      page.getByRole("button", { name: "Pause timer" }),
    ).toBeVisible();
    await expect(page.getByLabel("Doubles", { exact: true })).toHaveText("1");
    await expect(page.locator(".score-side.a .big-score")).toHaveText("3");
    if (i === 0) {
      const scoreButtons = await page
        .locator(".score-controls button")
        .evaluateAll((buttons) =>
          buttons.map((b) => {
            const r = b.getBoundingClientRect();
            return r.left >= 0 && r.right <= innerWidth;
          }),
        );
      expect(scoreButtons.every(Boolean)).toBe(true);
    }
    if (i === 0)
      await page.screenshot({
        path: `test-results/${testInfo.project.name}-scoring.png`,
        fullPage: true,
      });
    await page
      .getByRole("button", { name: "Finish match", exact: true })
      .click();
    await page.getByRole("button", { name: "Confirm & submit result" }).click();
    await expect(page.locator(".result-banner")).toContainText("wins");
    await page.getByRole("button", { name: "Close dialog" }).click();
  }
  await page.getByRole("tab", { name: "Preparation" }).click();
  await expect(page.getByText(/Pool membership is locked/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Regenerate schedule/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Correct name for Dee" }).click();
  await page.getByLabel("Event name").fill("Dee Smith");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(
    page.getByRole("button", { name: "Correct name for Dee Smith" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Bracket", exact: true }).click();
  for (const name of ["Ada", "Bo", "Cy"])
    await page
      .getByRole("checkbox", { name: new RegExp("^" + name + " Pool") })
      .check();
  await expect(
    page.getByText("3 qualifiers · 4 slots · 1 byes.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm bracket" }).click();
  await expect(
    page.locator(".bracket-match").filter({ hasText: "Bye" }),
  ).toHaveCount(1);
  await page.locator(".bracket-match:not([disabled])").first().click();
  await page.getByRole("button", { name: "Finish match", exact: true }).click();
  await expect(
    page.getByText("Elimination needs a winner.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue scoring" }).click();
  await page
    .getByRole("button", { name: /Add 2 to/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Finish match", exact: true }).click();
  await page.getByRole("button", { name: "Confirm & submit result" }).click();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Generate next round" }).click();
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-bracket.png`,
    fullPage: true,
  });
  await page.locator(".bracket-column").last().getByRole("button").click();
  await page
    .getByRole("button", { name: /Add 1 to/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Finish match", exact: true }).click();
  await page.getByRole("button", { name: "Confirm & submit result" }).click();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("tab", { name: "Overview", exact: true }).click();
  await expect(page.locator(".champion")).toContainText(
    "First Build Cup champion",
  );
  await page.reload();
  await expect(page.locator(".champion")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Admin login", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("creation protects unfinished draft details from accidental dismissal", async ({
  page,
}) => {
  await page.goto("/?practice=1");
  await page.getByRole("button", { name: "Admin login", exact: true }).click();
  await page.getByRole("button", { name: "Enter practice desk" }).click();
  await page
    .getByRole("button", { name: "Create tournament", exact: true })
    .click();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Create tournament", exact: true })
    .click();
  await page.getByLabel("Tournament name").fill("Keep these details");
  await page.getByLabel("Format").selectOption("pools-only");
  await page.mouse.click(1, 1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Tournament name")).toHaveValue(
    "Keep these details",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(
    page.getByRole("heading", { name: "Discard this tournament?" }),
  ).toBeVisible();
  await page.mouse.click(1, 1);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Keep editing" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep editing" }).click();
  await expect(page.getByLabel("Format")).toHaveValue("pools-only");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("button", { name: "Discard tournament", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Create tournament", exact: true })
    .click();
  await expect(page.getByLabel("Tournament name")).toHaveValue("");
});

test("admin archives, restores and confirms permanent deletion", async ({
  page,
}) => {
  await page.goto("/?practice=1");
  await page.getByRole("button", { name: "Admin login", exact: true }).click();
  await page.getByRole("button", { name: "Enter practice desk" }).click();
  await page.getByRole("button", { name: /Autumn Open/ }).click();
  await page.getByRole("button", { name: "Manage tournament" }).click();
  await page
    .getByRole("button", { name: "Archive tournament", exact: true })
    .click();
  await expect(
    page.getByText("Archived · Results remain public.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Matches", exact: true }).click();
  await page.locator(".match-row").first().click();
  await expect(
    page.getByRole("button", { name: "Reopen to correct" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Tournaments" })
    .click();
  await expect(page.getByRole("button", { name: /Autumn Open/ })).toHaveCount(
    0,
  );
  await page.getByLabel("Tournament archive view").selectOption("archived");
  await page.getByRole("button", { name: /Autumn Open/ }).click();
  await page.getByRole("button", { name: "Manage tournament" }).click();
  await page
    .getByRole("button", { name: "Restore tournament", exact: true })
    .click();
  await expect(
    page.getByText("Archived · Results remain public.", { exact: false }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Manage tournament" }).click();
  await page
    .getByRole("button", { name: "Delete tournament…", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Delete permanently", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Type the tournament name to confirm")
    .fill("Wrong name");
  await expect(
    page.getByRole("button", { name: "Delete permanently", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Cancel deletion" }).click();
  await page
    .getByRole("button", { name: "Delete tournament…", exact: true })
    .click();
  await page
    .getByLabel("Type the tournament name to confirm")
    .fill("Autumn Open");
  await page
    .getByRole("button", { name: "Delete permanently", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Tournament archive view").selectOption("active");
  await expect(page.getByRole("button", { name: /Autumn Open/ })).toHaveCount(
    0,
  );
  await page.reload();
  await page.getByLabel("Tournament archive view").selectOption("archived");
  await expect(page.getByRole("button", { name: /Autumn Open/ })).toHaveCount(
    0,
  );
});

test("admin directory keeps event names while future entries use profile corrections", async ({
  page,
}, testInfo) => {
  await page.goto("/?practice=1");
  await expect(
    page.getByRole("button", { name: "Fencers", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Admin login", exact: true }).click();
  await page.getByRole("button", { name: "Enter practice desk" }).click();
  await expect(
    page.getByRole("heading", { name: "Tournaments", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fencers", exact: true }).click();
  await page
    .getByRole("button", { name: "Create fencer", exact: true })
    .click();
  await page.getByLabel("Profile name").fill("Robin");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toHaveText("Fencer profile created.");
  await page.getByLabel("Search fencers").fill("nobody");
  await expect(
    page.getByRole("heading", { name: "No fencers match your search." }),
  ).toBeVisible();
  await page.getByLabel("Search fencers").fill("robin");
  await expect(
    page.getByRole("button", { name: /Edit profile for Robin/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/" + testInfo.project.name + "-fencers.png",
    fullPage: true,
  });

  async function draft(name: string) {
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Tournaments", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Create tournament", exact: true })
      .click();
    await page.getByLabel("Tournament name").fill(name);
    await page.getByRole("button", { name: "Save draft" }).click();
    await page
      .getByLabel("Existing fencer profile")
      .selectOption({ label: name === "First Cup" ? "Robin" : "Robin Jones" });
    await page.getByRole("button", { name: "Add existing fencer" }).click();
  }
  await draft("First Cup");
  await expect(
    page.getByRole("button", { name: "Correct name for Robin", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fencers", exact: true }).click();
  await page.getByRole("button", { name: /Edit profile for Robin/ }).click();
  await page.getByLabel("Profile name").fill("Robin Jones");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Profile name saved." }),
  ).toHaveText("Profile name saved.");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Tournaments", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Continue preparation for First Cup" })
    .click();
  await expect(
    page.getByRole("button", { name: "Correct name for Robin", exact: true }),
  ).toBeVisible();
  await draft("Second Cup");
  await expect(
    page.getByRole("button", {
      name: "Correct name for Robin Jones",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Tournaments", exact: true })
    .click();
  await page.screenshot({
    path: "test-results/" + testInfo.project.name + "-admin-dashboard.png",
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Fencers", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Admin login", exact: true }).click();
  await page.getByRole("button", { name: "Enter practice desk" }).click();
  await page.getByRole("button", { name: "Fencers", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Edit profile for Robin Jones/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
