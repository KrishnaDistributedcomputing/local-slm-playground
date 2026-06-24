import type { Page } from "@playwright/test";

/** Shape of the game state returned by the chess API / workflow query. */
export interface GameState {
  white: string;
  black: string;
  fen: string;
  turn: "white" | "black";
  legal_moves: string[];
  last_move: string | null;
  check: boolean;
  status: string;
  result: string | null;
  winner: string | null;
  move_count: number;
  san_moves: string[];
  message: string;
  over: boolean;
}

/** A single ply of a classic study game. */
export interface ClassicPly {
  ply: number;
  san: string | null;
  uci: string | null;
  fen: string;
  side: "white" | "black";
  move_no: number;
  desc: string;
  note: string | null;
}

export const STANDARD_START_FEN_PREFIX =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w";

/** Expected classic game ids served by /api/classics. */
export const CLASSIC_IDS = [
  "opera",
  "immortal",
  "evergreen",
  "kasparov_topalov",
  "fischer_byrne",
] as const;

/**
 * Convert an algebraic square name (e.g. "e2") to the 0-based index of the
 * corresponding `.board .sq` element. The board renders rank 8 -> rank 1 top to
 * bottom and file a -> h left to right.
 */
export function squareIndex(name: string): number {
  const file = name.charCodeAt(0) - "a".charCodeAt(0); // 0..7
  const rank = parseInt(name[1], 10); // 1..8
  const row = 8 - rank; // 0 = rank 8
  return row * 8 + file;
}

/** Click a board square by its algebraic name (e.g. "e2"). */
export async function clickSquare(page: Page, name: string): Promise<void> {
  await page.locator(".board .sq").nth(squareIndex(name)).click();
}

/** Play a UCI move on the board UI by selecting the from-square then the to-square. */
export async function playUiMove(page: Page, uci: string): Promise<void> {
  await clickSquare(page, uci.slice(0, 2));
  await clickSquare(page, uci.slice(2, 4));
}
