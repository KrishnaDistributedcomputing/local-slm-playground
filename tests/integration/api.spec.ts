import { expect, test } from "@playwright/test";
import { GameState, STANDARD_START_FEN_PREFIX } from "../helpers/board";

/**
 * INTEGRATION TESTS
 *
 * Drive the full stack through the HTTP API: FastAPI -> Temporal workflow
 * (ChessGameWorkflow) -> Supabase persistence. These create real workflows and,
 * on game end, write a row to the Supabase `chess_games` table.
 */
async function createGame(
  request: import("@playwright/test").APIRequestContext,
  white: string,
): Promise<{ id: string; state: GameState }> {
  const res = await request.post("/api/games", {
    data: { white, black: "Bot" },
  });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

test.describe("integration: game lifecycle", () => {
  test("creates a new game in the standard starting position", async ({
    request,
  }) => {
    const { id, state } = await createGame(request, "IT_Create");

    expect(id).toMatch(/^chess-it_create-[0-9a-f]{8}$/);
    expect(state.turn).toBe("white");
    expect(state.move_count).toBe(0);
    expect(state.over).toBe(false);
    expect(state.fen.startsWith(STANDARD_START_FEN_PREFIX)).toBe(true);
    expect(state.legal_moves).toHaveLength(20); // 20 legal first moves
    expect(state.legal_moves).toContain("e2e4");
  });

  test("a legal move is applied and the bot replies", async ({ request }) => {
    const { id } = await createGame(request, "IT_Move");

    const res = await request.post(`/api/games/${id}/move`, {
      data: { uci: "e2e4" },
    });
    expect(res.ok()).toBeTruthy();
    const { state }: { state: GameState } = await res.json();

    // White move + bot reply => 2 half-moves, turn back to White.
    expect(state.move_count).toBe(2);
    expect(state.turn).toBe("white");
    expect(state.san_moves[0]).toBe("e4");
    expect(state.san_moves).toHaveLength(2);
    expect(state.last_move).toMatch(/^[a-h][1-8][a-h][1-8]$/); // bot's reply
    expect(state.over).toBe(false);
  });

  test("an illegal move is rejected without changing the board", async ({
    request,
  }) => {
    const { id } = await createGame(request, "IT_Illegal");

    const res = await request.post(`/api/games/${id}/move`, {
      data: { uci: "e2e5" }, // illegal pawn jump
    });
    expect(res.ok()).toBeTruthy();
    const { state }: { state: GameState } = await res.json();

    expect(state.message).toBe("illegal move: e2e5");
    expect(state.move_count).toBe(0);
    expect(state.over).toBe(false);
  });

  test("querying a game returns its current state", async ({ request }) => {
    const { id } = await createGame(request, "IT_Query");
    await request.post(`/api/games/${id}/move`, { data: { uci: "d2d4" } });

    const res = await request.get(`/api/games/${id}`);
    expect(res.ok()).toBeTruthy();
    const state: GameState = await res.json();

    expect(state.san_moves[0]).toBe("d4");
    expect(state.move_count).toBe(2);
  });

  test("resigning ends the game and persists it to Supabase", async ({
    request,
  }) => {
    const white = `IT_Resign_${Date.now()}`;
    const { id } = await createGame(request, white);
    await request.post(`/api/games/${id}/move`, { data: { uci: "e2e4" } });

    const res = await request.post(`/api/games/${id}/resign`);
    expect(res.ok()).toBeTruthy();
    const { state, result } = await res.json();

    expect(state.over).toBe(true);
    expect(state.status).toBe("resigned");
    expect(state.result).toBe("0-1");
    expect(state.winner).toBe("black");
    expect(result).not.toBeNull();
    expect(typeof result.record_id).toBe("number");

    // The finished game is written to Supabase and visible via /api/history.
    await expect
      .poll(
        async () => {
          const h = await request.get("/api/history?limit=25");
          const { rows } = await h.json();
          return rows.some((r: { white: string }) => r.white === white);
        },
        { message: "resigned game should appear in Supabase history" },
      )
      .toBe(true);
  });
});

test.describe("integration: history endpoint", () => {
  test("returns a well-formed list of recent games", async ({ request }) => {
    const res = await request.get("/api/history?limit=5");
    expect(res.ok()).toBeTruthy();
    const { rows } = await res.json();

    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeLessThanOrEqual(5);
    for (const r of rows) {
      expect(r).toHaveProperty("white");
      expect(r).toHaveProperty("black");
      expect(r).toHaveProperty("result");
      expect(typeof r.moves).toBe("number");
    }
  });
});
