import { expect, test } from "@playwright/test";
import { CLASSIC_IDS, playUiMove } from "../helpers/board";

/**
 * END-TO-END TESTS
 *
 * Drive the real browser UI, which talks to FastAPI -> Temporal -> Supabase.
 */
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Chess/);
});

test.describe("e2e: page layout", () => {
  test("renders a full 64-square board and the study dropdown", async ({
    page,
  }) => {
    await expect(page.locator(".board .sq")).toHaveCount(64);

    const options = page.locator("#classic option");
    // 5 classic games + the placeholder option.
    await expect(options).toHaveCount(CLASSIC_IDS.length + 1);
  });
});

test.describe("e2e: playing against the bot", () => {
  test("starts a game and plays a move", async ({ page }) => {
    await page.fill("#white", "E2E_Player");
    await page.click("#startBtn");

    await expect(page.locator("#turn")).toContainText("Your move (White)");
    await expect(page.locator("#resignBtn")).toBeEnabled();

    // Play 1. e4 by clicking e2 then e4; expect the move list to update.
    await playUiMove(page, "e2e4");
    await expect(page.locator("#moves")).toContainText("e4");
    // After the bot replies it is White's turn again.
    await expect(page.locator("#turn")).toContainText("Your move (White)");
  });

  test("resigning shows the game-over state", async ({ page }) => {
    await page.fill("#white", "E2E_Resign");
    await page.click("#startBtn");
    await expect(page.locator("#turn")).toContainText("Your move (White)");

    await page.click("#resignBtn");
    await expect(page.locator("#turn")).toContainText("resigned");
    await expect(page.locator("#resignBtn")).toBeDisabled();
  });
});

test.describe("e2e: studying classic games", () => {
  test("selecting a classic enables navigation and shows explanations", async ({
    page,
  }) => {
    await page.selectOption("#classic", "opera");

    await expect(page.locator("#lesson")).not.toBeEmpty();
    await expect(page.locator("#studyPos")).toContainText("move 0 / 33");
    for (const id of ["firstBtn", "prevBtn", "playBtn", "nextBtn", "lastBtn"]) {
      await expect(page.locator(`#${id}`)).toBeEnabled();
    }

    // Step forward one move: description should populate.
    await page.click("#nextBtn");
    await expect(page.locator("#studyPos")).toContainText("move 1 / 33");
    await expect(page.locator("#studyDesc")).toContainText("e2 to e4");
  });

  test("jumps to the final checkmate position", async ({ page }) => {
    await page.selectOption("#classic", "opera");
    await page.click("#lastBtn");

    await expect(page.locator("#studyPos")).toContainText("move 33 / 33");
    await expect(page.locator("#turn")).toContainText("Rd8#");
    await expect(page.locator("#moves")).toContainText("Rd8#");
  });

  test("shows a curated note on the famous queen sacrifice", async ({
    page,
  }) => {
    await page.selectOption("#classic", "opera");
    // Step to ply 31 (16. Qb8+).
    for (let i = 0; i < 31; i++) {
      await page.click("#nextBtn");
    }
    await expect(page.locator("#studyPos")).toContainText("move 31 / 33");
    await expect(page.locator("#studyNote")).toContainText("queen sacrifice");
  });

  test("starting a new game exits study mode", async ({ page }) => {
    await page.selectOption("#classic", "immortal");
    await expect(page.locator("#studyPos")).toContainText("move 0");

    await page.click("#startBtn");
    await expect(page.locator("#turn")).toContainText("Your move (White)");
    await expect(page.locator("#studyPos")).toBeEmpty();
    await expect(page.locator("#classic")).toHaveValue("");
  });
});
