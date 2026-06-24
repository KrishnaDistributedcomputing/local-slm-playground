"""Chess game implemented as a Temporal workflow.

The human plays White; a simple bot (random legal move) plays Black. The workflow
owns the board state. Moves arrive as `move` signals (UCI, e.g. "e2e4"), state is
read via the `state` query, and the finished game is persisted to Supabase.

Chess rules/validation are handled by the deterministic `python-chess` library,
which is safe to run inside the workflow sandbox.
"""
from __future__ import annotations

import datetime
from typing import Any

from temporalio import workflow

with workflow.unsafe.imports_passed_through():
    import chess
    from ...activities.chess_store import record_chess_game


def _outcome_fields(board: "chess.Board") -> tuple[str, str | None, str | None]:
    """Return (status, result, winner) for a finished board."""
    outcome = board.outcome(claim_draw=True)
    if outcome is None:
        return "in_progress", None, None
    result = outcome.result()  # "1-0", "0-1", "1/2-1/2"
    if outcome.winner is None:
        status = "stalemate" if board.is_stalemate() else "draw"
        return status, result, None
    winner = "white" if outcome.winner == chess.WHITE else "black"
    return "checkmate", result, winner


@workflow.defn
class ChessGameWorkflow:
    def __init__(self) -> None:
        self._board = chess.Board()
        self._white = "Player"
        self._black = "Bot"
        self._san_moves: list[str] = []
        self._last_move: str | None = None
        self._message: str = "your move (White)"
        self._status: str = "in_progress"
        self._result: str | None = None
        self._winner: str | None = None
        self._over: bool = False

    def _refresh_status(self) -> None:
        status, result, winner = _outcome_fields(self._board)
        self._status = status
        self._result = result
        self._winner = winner
        if status != "in_progress":
            self._over = True

    def _bot_move(self) -> None:
        legal = list(self._board.legal_moves)
        if not legal:
            return
        idx = workflow.random().randrange(len(legal))
        move = legal[idx]
        self._san_moves.append(self._board.san(move))
        self._board.push(move)
        self._last_move = move.uci()

    @workflow.run
    async def run(self, white: str = "Player", black: str = "Bot") -> dict[str, Any]:
        self._white = white
        self._black = black

        await workflow.wait_condition(lambda: self._over)

        pgn = " ".join(self._san_moves)
        game_id = await workflow.execute_activity(
            record_chess_game,
            args=[
                self._white,
                self._black,
                self._result or "*",
                self._winner,
                len(self._san_moves),
                pgn,
            ],
            start_to_close_timeout=datetime.timedelta(seconds=15),
        )

        return {
            "white": self._white,
            "black": self._black,
            "status": self._status,
            "result": self._result,
            "winner": self._winner,
            "moves": len(self._san_moves),
            "pgn": pgn,
            "record_id": game_id,
        }

    @workflow.signal
    async def move(self, uci: str) -> None:
        if self._over:
            return
        if self._board.turn != chess.WHITE:
            self._message = "not your turn"
            return
        try:
            move = chess.Move.from_uci(uci)
        except ValueError:
            self._message = f"invalid move format: {uci}"
            return
        if move not in self._board.legal_moves:
            self._message = f"illegal move: {uci}"
            return

        # Apply the human (White) move.
        self._san_moves.append(self._board.san(move))
        self._board.push(move)
        self._last_move = uci
        self._refresh_status()

        # Bot (Black) responds with a random legal move.
        if not self._over and self._board.turn == chess.BLACK:
            self._bot_move()
            self._refresh_status()

        if self._over:
            self._message = "game over"
        else:
            self._message = "your move (White)"

    @workflow.signal
    async def resign(self) -> None:
        if self._over:
            return
        self._status = "resigned"
        self._result = "0-1"
        self._winner = "black"
        self._over = True
        self._message = "you resigned"

    @workflow.query
    def state(self) -> dict[str, Any]:
        return {
            "white": self._white,
            "black": self._black,
            "fen": self._board.fen(),
            "turn": "white" if self._board.turn == chess.WHITE else "black",
            "legal_moves": [m.uci() for m in self._board.legal_moves],
            "last_move": self._last_move,
            "check": self._board.is_check(),
            "status": self._status,
            "result": self._result,
            "winner": self._winner,
            "move_count": len(self._san_moves),
            "san_moves": self._san_moves,
            "message": self._message,
            "over": self._over,
        }
