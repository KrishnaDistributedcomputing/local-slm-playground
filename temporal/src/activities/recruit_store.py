"""Supabase-backed activities for the Recruiting Pipeline (ATS).

Persists job candidates and their event timeline to the Supabase Postgres
database. Each candidate is driven by a long-running Temporal workflow
(`RecruitCandidateWorkflow`); these activities perform the real reads/writes via
psycopg2, mirroring the CRM example.
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


def _ensure_tables(cur) -> None:
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS recruit_candidates (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            role        TEXT,
            email       TEXT,
            source      TEXT,
            stage       TEXT NOT NULL DEFAULT 'Applied',
            status      TEXT NOT NULL DEFAULT 'active',
            notes_count INTEGER NOT NULL DEFAULT 0,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS recruit_activities (
            id           BIGSERIAL PRIMARY KEY,
            candidate_id TEXT NOT NULL,
            kind         TEXT NOT NULL,
            detail       TEXT NOT NULL DEFAULT '',
            created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        """
    )


@activity.defn
def upsert_candidate(
    candidate_id: str,
    name: str,
    role: str | None,
    email: str | None,
    source: str | None,
    stage: str,
    status: str,
    notes_count: int,
) -> str:
    """Insert or update a candidate and return its id."""
    conn = _connect()
    try:
        with conn, conn.cursor() as cur:
            _ensure_tables(cur)
            cur.execute(
                """
                INSERT INTO recruit_candidates
                    (id, name, role, email, source, stage, status, notes_count, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, now())
                ON CONFLICT (id) DO UPDATE SET
                    name        = EXCLUDED.name,
                    role        = EXCLUDED.role,
                    email       = EXCLUDED.email,
                    source      = EXCLUDED.source,
                    stage       = EXCLUDED.stage,
                    status      = EXCLUDED.status,
                    notes_count = EXCLUDED.notes_count,
                    updated_at  = now();
                """,
                (candidate_id, name, role, email, source, stage, status, notes_count),
            )
        return candidate_id
    finally:
        conn.close()


@activity.defn
def record_candidate_event(candidate_id: str, kind: str, detail: str = "") -> int:
    """Append an entry to a candidate's event timeline and return its row id."""
    conn = _connect()
    try:
        with conn, conn.cursor() as cur:
            _ensure_tables(cur)
            cur.execute(
                """
                INSERT INTO recruit_activities (candidate_id, kind, detail)
                VALUES (%s, %s, %s)
                RETURNING id;
                """,
                (candidate_id, kind, detail),
            )
            row_id = cur.fetchone()[0]
        return int(row_id)
    finally:
        conn.close()


@activity.defn
def list_candidates(limit: int = 50) -> list[dict[str, Any]]:
    """Return candidates ordered by most recently updated."""
    conn = _connect()
    try:
        with conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            _ensure_tables(cur)
            cur.execute(
                """
                SELECT id, name, role, email, source, stage, status,
                       notes_count, created_at, updated_at
                FROM recruit_candidates
                ORDER BY updated_at DESC
                LIMIT %s;
                """,
                (limit,),
            )
            rows = cur.fetchall()
        return [
            {
                "id": r["id"],
                "name": r["name"],
                "role": r["role"],
                "email": r["email"],
                "source": r["source"],
                "stage": r["stage"],
                "status": r["status"],
                "notes_count": r["notes_count"],
                "created_at": r["created_at"].isoformat(),
                "updated_at": r["updated_at"].isoformat(),
            }
            for r in rows
        ]
    finally:
        conn.close()


@activity.defn
def get_candidate_events(candidate_id: str, limit: int = 50) -> list[dict[str, Any]]:
    """Return the event timeline for a single candidate, newest first."""
    conn = _connect()
    try:
        with conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            _ensure_tables(cur)
            cur.execute(
                """
                SELECT kind, detail, created_at
                FROM recruit_activities
                WHERE candidate_id = %s
                ORDER BY created_at DESC
                LIMIT %s;
                """,
                (candidate_id, limit),
            )
            rows = cur.fetchall()
        return [
            {
                "kind": r["kind"],
                "detail": r["detail"],
                "created_at": r["created_at"].isoformat(),
            }
            for r in rows
        ]
    finally:
        conn.close()
