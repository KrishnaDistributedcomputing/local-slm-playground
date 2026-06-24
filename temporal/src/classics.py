"""Famous classic chess games for study/replay.

Each game is stored as a list of SAN moves. The web API turns these into a sequence
of board positions (FENs) using python-chess so the UI can step through them.
"""
from __future__ import annotations

from typing import Any

import chess

# Move lists are in Standard Algebraic Notation (SAN).
CLASSIC_GAMES: dict[str, dict[str, Any]] = {
    "opera": {
        "name": "Opera Game — Morphy vs Duke of Brunswick (1858)",
        "lesson": "Rapid development, open lines, and a classic queen sacrifice mating attack.",
        "moves": [
            "e4", "e5", "Nf3", "d6", "d4", "Bg4", "dxe5", "Bxf3", "Qxf3", "dxe5",
            "Bc4", "Nf6", "Qb3", "Qe7", "Nc3", "c6", "Bg5", "b5", "Nxb5", "cxb5",
            "Bxb5+", "Nbd7", "O-O-O", "Rd8", "Rxd7", "Rxd7", "Rd1", "Qe6", "Bxd7+", "Nxd7",
            "Qb8+", "Nxb8", "Rd8#",
        ],
        "notes": {
            1: "Morphy grabs the center. Controlling e4/d4 is the first principle of the opening.",
            5: "d4 strikes the center immediately, opening lines for the pieces before the opponent develops.",
            6: "...Bg4 pins the knight, but in an open position this bishop will soon become a liability.",
            9: "Qxf3 — Morphy recaptures with the queen, keeping every move purposeful and aimed at development.",
            11: "Bc4 develops with tempo, eyeing the weak f7 square — the soul of attacking chess.",
            13: "Qb3 double-attacks b7 and f7, forcing Black into passive defense.",
            17: "Bg5 pins the knight to the queen, piling pressure on the pinned d7 knight to come.",
            19: "Nxb5! A sacrifice to rip open the b-file and expose Black's uncastled king.",
            21: "Bxb5+ regains material with check while keeping the initiative — Black is hopelessly behind in development.",
            23: "O-O-O! Morphy castles AND brings his rook to the open d-file with gain of tempo. Textbook coordination.",
            25: "Rxd7! The first heavy-piece sacrifice, demolishing Black's only defender.",
            29: "Bxd7+ drags the defenders away; every Black move is forced.",
            31: "Qb8+!! The famous queen sacrifice — deflecting the knight to set up mate.",
            33: "Rd8# — checkmate. Morphy mated with his last two pieces while Black's army sat undeveloped. Lesson: develop fast, open lines, and attack the king.",
        },
    },
    "immortal": {
        "name": "The Immortal Game — Anderssen vs Kieseritzky (1851)",
        "lesson": "Romantic-era brilliance: Anderssen sacrifices a bishop, both rooks, and the queen to mate.",
        "moves": [
            "e4", "e5", "f4", "exf4", "Bc4", "Qh4+", "Kf1", "b5", "Bxb5", "Nf6",
            "Nf3", "Qh6", "d3", "Nh5", "Nh4", "Qg5", "Nf5", "c6", "g4", "Nf6",
            "Rg1", "cxb5", "h4", "Qg6", "h5", "Qg5", "Qf3", "Ng8", "Bxf4", "Qf6",
            "Nc3", "Bc5", "Nd5", "Qxb2", "Bd6", "Bxg1", "e5", "Qxa1+", "Ke2", "Na6",
            "Nxg7+", "Kd8", "Qf6+", "Nxf6", "Be7#",
        ],
        "notes": {
            3: "f4 — the King's Gambit. White offers a pawn to seize the center and open the f-file.",
            6: "...Qh4+ is tempting but brings the queen out too early; she becomes a target.",
            7: "Kf1 — White gives up castling rights, judging the active king is acceptable for the attack.",
            29: "Bxf4 — White ignores threats and keeps developing toward Black's king.",
            31: "Nc3! Offering the rook on a1: Anderssen values attacking momentum over material.",
            33: "Nd5! A second piece sacrifice, gaining time by hitting the queen.",
            35: "Bd6!! The immortal move — sacrificing the bishop to block the c-file and trap the king.",
            37: "e5 cuts off the queen's defense of g7 while Black grabs a rook with check.",
            41: "Nxg7+ continues the king-hunt; Black's extra material is irrelevant.",
            43: "Qf6+!! Queen sacrifice to clear the path for the bishop's mating blow.",
            45: "Be7# — mate with three minor pieces after sacrificing queen and both rooks. Pure Romantic chess.",
        },
    },
    "evergreen": {
        "name": "The Evergreen Game — Anderssen vs Dufresne (1852)",
        "lesson": "A model combinational finish with a beautiful queen and rook mating net.",
        "moves": [
            "e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "b4", "Bxb4", "c3", "Ba5",
            "d4", "exd4", "O-O", "d3", "Qb3", "Qf6", "e5", "Qg6", "Re1", "Nge7",
            "Ba3", "b5", "Qxb5", "Rb8", "Qa4", "Bb6", "Nbd2", "Bb7", "Ne4", "Qf5",
            "Bxd3", "Qh5", "Nf6+", "gxf6", "exf6", "Rg8", "Rad1", "Qxf3", "Rxe7+", "Nxe7",
            "Qxd7+", "Kxd7", "Bf5+", "Ke8", "Bd7+", "Kf8", "Bxe7#",
        ],
        "notes": {
            7: "b4 — the Evans Gambit. White sacrifices a pawn to accelerate development and seize the center.",
            11: "d4 blasts open the center while Black is still uncastled.",
            19: "Re1 places the rook on the open file behind the e-pawn, aiming at Black's king.",
            33: "Nf6+! A piece sacrifice to shatter the pawns around the Black king.",
            37: "Rad1 — Anderssen brings his LAST piece into the attack before finishing. Coordinate before you combine.",
            39: "Rxe7+!! The start of the famous finish, deflecting the knight.",
            41: "Qxd7+!! A queen sacrifice luring the king into a mating net.",
            43: "Bf5+ — the bishops take over, driving the king to its doom.",
            47: "Bxe7# — a picturesque mate. The 'Evergreen' brilliancy: develop, sacrifice, and mate in harmony.",
        },
    },
    "kasparov_topalov": {
        "name": "Kasparov vs Topalov (Wijk aan Zee, 1999)",
        "lesson": "One of the greatest modern combinations — a deep king-hunt sacrifice.",
        "moves": [
            "e4", "d6", "d4", "Nf6", "Nc3", "g6", "Be3", "Bg7", "Qd2", "c6",
            "f3", "b5", "Nge2", "Nbd7", "Bh6", "Bxh6", "Qxh6", "Bb7", "a3", "e5",
            "O-O-O", "Qe7", "Kb1", "a6", "Nc1", "O-O-O", "Nb3", "exd4", "Rxd4", "c5",
            "Rd1", "Nb6", "g3", "Kb8", "Na5", "Ba8", "Bh3", "d5", "Qf4+", "Ka7",
            "Rhe1", "d4", "Nd5", "Nbxd5", "exd5", "Qd6", "Rxd4", "cxd4", "Re7+", "Kb6",
            "Qxd4+", "Kxa5", "b4+", "Ka4", "Qc3", "Qxd5", "Ra7", "Bb7", "Rxb7", "Qc4",
            "Qxf6", "Kxa3", "Qxa6+", "Kxb4", "c3+", "Kxc3", "Qa1+", "Kd2", "Qb2+", "Kd1",
            "Bf1", "Rd2", "Rd7", "Rxd7", "Bxc4", "bxc4", "Qxh8", "Rd3", "Qa8", "c3",
            "Qa4+", "Ke1", "f4", "f5", "Kc1", "Rd2", "Qa7",
        ],
        "notes": {
            15: "Bh6 trades off the strong fianchettoed bishop, a typical plan against the Pirc/Modern setup.",
            49: "Rxd4!? cxd4 50. Re7+!! — Kasparov begins one of the deepest combinations ever played.",
            52: "Qxd4+!! A queen sacrifice that initiates a forced king-hunt across the entire board.",
            53: "...Kxa5 — the Black king is dragged from a7 all the way toward a1 over the next moves.",
            59: "Ra7! Quietly redirecting the rook into the attack mid-combination — astonishing calculation.",
            63: "Qxf6 — White has regained the queen and emerges with a winning material advantage.",
            70: "Qb2+ — the king-hunt finally nets decisive material; the rest is technique.",
        },
    },
    "fischer_byrne": {
        "name": "The Game of the Century — D. Byrne vs Fischer (1956)",
        "lesson": "13-year-old Fischer's stunning queen sacrifice and windmill tactics.",
        "moves": [
            "Nf3", "Nf6", "c4", "g6", "Nc3", "Bg7", "d4", "O-O", "Bf4", "d5",
            "Qb3", "dxc4", "Qxc4", "c6", "e4", "Nbd7", "Rd1", "Nb6", "Qc5", "Bg4",
            "Bg5", "Na4", "Qa3", "Nxc3", "bxc3", "Nxe4", "Bxe7", "Qb6", "Bc4", "Nxc3",
            "Bc5", "Rfe8+", "Kf1", "Be6", "Bxb6", "Bxc4+", "Kg1", "Ne2+", "Kf1", "Nxd4+",
            "Kg1", "Ne2+", "Kf1", "Nc3+", "Kg1", "axb6", "Qb4", "Ra4", "Qxb6", "Nxd1",
            "h3", "Rxa2", "Kh2", "Nxf2", "Re1", "Rxe1", "Qd8+", "Bf8", "Nxe1", "Bd5",
            "Nf3", "Ne4", "Qb8", "b5", "h4", "h5", "Ne5", "Kg7", "Kg1", "Bc5+",
            "Kf1", "Ng3+", "Ke1", "Bb4+", "Kd1", "Bb3+", "Kc1", "Ne2+", "Kb1", "Nc3+",
            "Kc1", "Rc2#",
        ],
        "notes": {
            11: "Qb3 pressures Black's center; Fischer responds with a daring pawn sacrifice for activity.",
            21: "...Na4!! Fischer offers his knight to expose White's misplaced queen — a stunning idea from a 13-year-old.",
            33: "...Be6!! The immortal move: Fischer gives up his queen, foreseeing a decisive flurry of checks.",
            34: "Bxb6 — White takes the queen, but Fischer's minor pieces will dominate.",
            36: "...Bxc4+ begins a 'windmill' of discovered checks, harvesting White's pieces.",
            50: "...Nxd1 — the dust settles: Fischer has rook, two bishops and a knight for the queen — winning.",
            81: "...Rc2# — a clean mate to crown 'The Game of the Century'. Lesson: deep calculation justifies sacrifice.",
        },
    },
}


def list_classics() -> list[dict[str, str]]:
    return [
        {"id": gid, "name": g["name"], "lesson": g["lesson"]}
        for gid, g in CLASSIC_GAMES.items()
    ]


_PIECE_NAMES = {
    chess.PAWN: "pawn",
    chess.KNIGHT: "knight",
    chess.BISHOP: "bishop",
    chess.ROOK: "rook",
    chess.QUEEN: "queen",
    chess.KING: "king",
}


def _describe(board: "chess.Board", move: "chess.Move", san: str) -> str:
    """Build a plain-English description of a move from the position before it."""
    mover = "White" if board.turn == chess.WHITE else "Black"
    piece = board.piece_at(move.from_square)
    to_sq = chess.square_name(move.to_square)
    from_sq = chess.square_name(move.from_square)

    # Castling.
    if board.is_castling(move):
        side = "kingside (short)" if chess.square_file(move.to_square) > 4 else "queenside (long)"
        return f"{mover} castles {side}, tucking the king to safety and activating the rook."

    pname = _PIECE_NAMES.get(piece.piece_type, "piece") if piece else "piece"

    if board.is_en_passant(move):
        action = f"captures en passant on {to_sq}"
    elif board.is_capture(move):
        captured = board.piece_at(move.to_square)
        cap_name = _PIECE_NAMES.get(captured.piece_type, "piece") if captured else "piece"
        action = f"captures the {cap_name} on {to_sq}"
    else:
        action = f"moves the {pname} from {from_sq} to {to_sq}"

    if move.promotion:
        action += f", promoting to a {_PIECE_NAMES.get(move.promotion, 'queen')}"

    desc = f"{mover} {action}"

    if san.endswith("#"):
        desc += " — checkmate! The game is over."
    elif san.endswith("+"):
        desc += ", giving check."
    else:
        desc += "."
    return desc


def get_classic_positions(game_id: str) -> dict[str, Any]:
    """Return the full sequence of positions for a classic game.

    Each ply contains the resulting FEN, the SAN played, the move number, the side
    to move, an automatic plain-English description, and (where available) a curated
    expert note explaining the idea behind the move.
    """
    game = CLASSIC_GAMES.get(game_id)
    if game is None:
        raise KeyError(game_id)

    notes = game.get("notes", {})
    board = chess.Board()
    plies: list[dict[str, Any]] = [
        {
            "ply": 0,
            "san": None,
            "uci": None,
            "fen": board.fen(),
            "side": "white",
            "move_no": 0,
            "desc": "Starting position. White to move. Use the controls to step through the game.",
            "note": game["lesson"],
        }
    ]
    for i, san in enumerate(game["moves"], start=1):
        move = board.parse_san(san)
        uci = move.uci()
        side = "white" if board.turn == chess.WHITE else "black"
        desc = _describe(board, move, san)
        board.push(move)
        plies.append(
            {
                "ply": i,
                "san": san,
                "uci": uci,
                "fen": board.fen(),
                "side": side,
                "move_no": (i + 1) // 2,
                "desc": desc,
                "note": notes.get(i),
            }
        )

    return {
        "id": game_id,
        "name": game["name"],
        "lesson": game["lesson"],
        "plies": plies,
    }
