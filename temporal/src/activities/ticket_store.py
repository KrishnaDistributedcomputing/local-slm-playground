"""Supabase-backed activities for the Support Ticket Desk.

Persists support tickets and their event timeline to the Supabase Postgres
database. Each ticket is driven by a long-running Temporal workflow
(`SupportTicketWorkflow`); these activities perform the real reads/writes via
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
        CREATE TABLE IF NOT EXISTS support_tickets (
            id          TEXT PRIMARY KEY,
            subject     TEXT NOT NULL,
            requester   TEXT,
            channel     TEXT,
            priority    TEXT NOT NULL DEFAULT 'Normal',
            stage       TEXT NOT NULL DEFAULT 'New',
            status      TEXT NOT NULL DEFAULT 'open',
            notes_count INTEGER NOT NULL DEFAULT 0,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS support_activities (
            id         BIGSERIAL PRIMARY KEY,
            ticket_id  TEXT NOT NULL,
            kind       TEXT NOT NULL,
            detail     TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        """
    )


@activity.defn
def upsert_ticket(
    ticket_id: str,
    subject: str,
    requester: str | None,
    channel: str | None,
    priority: str,
    stage: str,
    status: str,
    notes_count: int,
) -> str:
    """Insert or update a support ticket and return its id."""
    conn = _connect()
    try:
        with conn, conn.cursor() as cur:
            _ensure_tables(cur)
            cur.execute(
                """
                INSERT INTO support_tickets
                    (id, subject, requester, channel, priority, stage, status, notes_count, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, now())
                ON CONFLICT (id) DO UPDATE SET
                    subject     = EXCLUDED.subject,
                    requester   = EXCLUDED.requester,
                    channel     = EXCLUDED.channel,
                    priority    = EXCLUDED.priority,
                    stage       = EXCLUDED.stage,
                    status      = EXCLUDED.status,
                    notes_count = EXCLUDED.notes_count,
                    updated_at  = now();
                """,
                (ticket_id, subject, requester, channel, priority, stage, status, notes_count),
            )
        return ticket_id
    finally:
        conn.close()


@activity.defn
def record_ticket_event(ticket_id: str, kind: str, detail: str = "") -> int:
    """Append an entry to a ticket's event timeline and return its row id."""
    conn = _connect()
    try:
        with conn, conn.cursor() as cur:
            _ensure_tables(cur)
            cur.execute(
                """
                INSERT INTO support_activities (ticket_id, kind, detail)
                VALUES (%s, %s, %s)
                RETURNING id;
                """,
                (ticket_id, kind, detail),
            )
            row_id = cur.fetchone()[0]
        return int(row_id)
    finally:
        conn.close()


@activity.defn
def list_tickets(limit: int = 50) -> list[dict[str, Any]]:
    """Return support tickets ordered by most recently updated."""
    conn = _connect()
    try:
        with conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            _ensure_tables(cur)
            cur.execute(
                """
                SELECT id, subject, requester, channel, priority, stage, status,
                       notes_count, created_at, updated_at
                FROM support_tickets
                ORDER BY updated_at DESC
                LIMIT %s;
                """,
                (limit,),
            )
            rows = cur.fetchall()
        return [
            {
                "id": r["id"],
                "subject": r["subject"],
                "requester": r["requester"],
                "channel": r["channel"],
                "priority": r["priority"],
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
def get_ticket_events(ticket_id: str, limit: int = 50) -> list[dict[str, Any]]:
    """Return the event timeline for a single ticket, newest first."""
    conn = _connect()
    try:
        with conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            _ensure_tables(cur)
            cur.execute(
                """
                SELECT kind, detail, created_at
                FROM support_activities
                WHERE ticket_id = %s
                ORDER BY created_at DESC
                LIMIT %s;
                """,
                (ticket_id, limit),
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
