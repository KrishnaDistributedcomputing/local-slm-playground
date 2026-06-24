"""Supabase-backed activities for the chess game.

Persists finished chess games to a `chess_games` table in the Supabase Postgres
database. Connects directly via psycopg2 (the existing supabase_core activities are
stubs; these perform real reads/writes).
"""
from __future__ import annotations

import logging
from typing import Any

import psycopg2
import psycopg2.extras
from temporalio import activity

from ..config import settings

logger = logging.getLogger(__name__)


def _connect():
    return psycopg2.connect(
        host=settings.supabase_db_host,
        port=settings.supabase_db_port,
        user=settings.supabase_db_user,
        password=settings.supabase_db_password,
        dbname=settings.supabase_db_name,
    )


def _ensure_table(cur) -> None:
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS chess_games (
            id BIGSERIAL PRIMARY KEY,
            white TEXT NOT NULL,
            black TEXT NOT NULL,
            result TEXT NOT NULL,
            winner TEXT,
            moves INTEGER NOT NULL,
            pgn TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        """
    )


@activity.defn
def record_chess_game(
    white: str, black: str, result: str, winner: str | None, moves: int, pgn: str
) -> int:
    """Persist a finished chess game and return its row id."""
    logger.info("recording chess game white=%s black=%s result=%s", white, black, result)
    conn = _connect()
    try:
        with conn, conn.cursor() as cur:
            _ensure_table(cur)
            cur.execute(
                """
                INSERT INTO chess_games (white, black, result, winner, moves, pgn)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id;
                """,
                (white, black, result, winner, moves, pgn),
            )
            row_id = cur.fetchone()[0]
        return int(row_id)
    finally:
        conn.close()


@activity.defn
def get_recent_games(limit: int = 10) -> list[dict[str, Any]]:
    """Return the most recently finished chess games from Supabase."""
    conn = _connect()
    try:
        with conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            _ensure_table(cur)
            cur.execute(
                """
                SELECT white, black, result, winner, moves, created_at
                FROM chess_games
                ORDER BY created_at DESC
                LIMIT %s;
                """,
                (limit,),
            )
            rows = cur.fetchall()
        return [
            {
                "white": r["white"],
                "black": r["black"],
                "result": r["result"],
                "winner": r["winner"],
                "moves": r["moves"],
                "created_at": r["created_at"].isoformat(),
            }
            for r in rows
        ]
    finally:
        conn.close()
