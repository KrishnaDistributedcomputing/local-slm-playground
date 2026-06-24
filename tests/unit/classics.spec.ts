import { expect, test } from "@playwright/test";
import {
  CLASSIC_IDS,
  ClassicPly,
  STANDARD_START_FEN_PREFIX,
} from "../helpers/board";

/**
 * UNIT TESTS
 *
 * Exercise the pure, deterministic logic of the `classics` module through its
 * side-effect-free HTTP surface. These calls create no Temporal workflows and
 * write nothing to Supabase — they only validate computation (move parsing, FEN
 * generation, and the auto-generated/curated move descriptions).
 */
test.describe("unit: classic game catalogue", () => {
  test("lists exactly the expected classic games with metadata", async ({
    request,
  }) => {
    const res = await request.get("/api/classics");
    expect(res.ok()).toBeTruthy();
    const { games } = await res.json();

    expect(Array.isArray(games)).toBe(true);
    const ids = games.map((g: { id: string }) => g.id).sort();
    expect(ids).toEqual([...CLASSIC_IDS].sort());

    for (const g of games) {
      expect(g.name, "every game has a non-empty name").toBeTruthy();
      expect(g.lesson, "every game has a lesson summary").toBeTruthy();
    }
  });

  test("returns 404 for an unknown game id", async ({ request }) => {
    const res = await request.get("/api/classics/does-not-exist");
    expect(res.status()).toBe(404);
  });
});

test.describe("unit: position generation", () => {
  test("the Opera Game produces a correct, fully-described ply sequence", async ({
    request,
  }) => {
    const res = await request.get("/api/classics/opera");
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    const plies: ClassicPly[] = data.plies;

    // 33 half-moves + the initial position.
    expect(plies).toHaveLength(34);

    // Ply 0 is the standard starting position with no move.
    expect(plies[0].san).toBeNull();
    expect(plies[0].uci).toBeNull();
    expect(plies[0].fen.startsWith(STANDARD_START_FEN_PREFIX)).toBe(true);

    // First real move is 1. e4 with a generated description.
    expect(plies[1].san).toBe("e4");
    expect(plies[1].uci).toBe("e2e4");
    expect(plies[1].desc.toLowerCase()).toContain("pawn from e2 to e4");

    // The game ends in checkmate.
    const last = plies[plies.length - 1];
    expect(last.san).toBe("Rd8#");
    expect(last.desc.toLowerCase()).toContain("checkmate");

    // The famous queen sacrifice carries a curated note.
    const qb8 = plies.find((p) => p.san === "Qb8+");
    expect(qb8, "Qb8+ ply exists").toBeTruthy();
    expect(qb8!.note).toBeTruthy();
    expect(qb8!.note!.toLowerCase()).toContain("queen sacrifice");
  });

  test("every classic game has consistent, well-formed plies", async ({
    request,
  }) => {
    for (const id of CLASSIC_IDS) {
      const res = await request.get(`/api/classics/${id}`);
      expect(res.ok(), `GET /api/classics/${id}`).toBeTruthy();
      const data = await res.json();
      const plies: ClassicPly[] = data.plies;

      expect(plies.length, `${id} has moves`).toBeGreaterThan(1);
      expect(plies[0].san, `${id} starts from initial position`).toBeNull();

      for (let i = 1; i < plies.length; i++) {
        const p = plies[i];
        expect(p.san, `${id} ply ${i} has SAN`).toBeTruthy();
        expect(p.uci, `${id} ply ${i} has UCI`).toMatch(/^[a-h][1-8][a-h][1-8][qrbn]?$/);
        expect(p.fen, `${id} ply ${i} has FEN`).toBeTruthy();
        expect(p.desc, `${id} ply ${i} has a description`).toBeTruthy();
        expect(["white", "black"]).toContain(p.side);
      }

      // The final move of every curated game is recorded with SAN (some games
      // end in checkmate, others — e.g. Kasparov–Topalov — in resignation).
      const last = plies[plies.length - 1];
      expect(last.san, `${id} has a final move`).toBeTruthy();
    }
  });
});
