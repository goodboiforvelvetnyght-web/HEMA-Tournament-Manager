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
  await page.getByLabel("Participants").fill("Ada\nBo\nCy\nDee");
  await page.getByRole("button", { name: "Arrange pools" }).click();
  await page.getByLabel("Number of pools").selectOption("2");
  await expect(
    page.getByText("4 fencers · 2 pools · 2 round-robin bouts"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create & generate matches" }).click();
  await page.getByRole("tab", { name: "Matches", exact: true }).click();
  for (let i = 0; i < 2; i++) {
    await page.locator(".match-row").nth(i).click();
    await page
      .getByRole("button", { name: /Add 3 to/ })
      .first()
      .click();
    await page.getByRole("button", { name: "Record double" }).click();
    await page
      .getByRole("button", { name: "Start timer", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Pause timer" }),
    ).toBeVisible();
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
