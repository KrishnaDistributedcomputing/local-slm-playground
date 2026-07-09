"""Supabase-backed activities for the small CRM.

Persists CRM contacts (leads) and their activity timeline to the Supabase
Postgres database. Each contact is driven by a long-running Temporal workflow
(`CrmLeadWorkflow`); these activities perform the real reads/writes via psycopg2,
mirroring the chess example.
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
        CREATE TABLE IF NOT EXISTS crm_contacts (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            email       TEXT,
            company     TEXT,
            value       NUMERIC NOT NULL DEFAULT 0,
            stage       TEXT NOT NULL DEFAULT 'New',
            status      TEXT NOT NULL DEFAULT 'active',
            owner       TEXT,
            notes_count INTEGER NOT NULL DEFAULT 0,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS crm_activities (
            id         BIGSERIAL PRIMARY KEY,
            contact_id TEXT NOT NULL,
            kind       TEXT NOT NULL,
            detail     TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        """
    )


@activity.defn
def upsert_contact(
    contact_id: str,
    name: str,
    email: str | None,
    company: str | None,
    value: float,
    stage: str,
    status: str,
    owner: str | None,
    notes_count: int,
) -> str:
    """Insert or update a CRM contact and return its id."""
    conn = _connect()
    try:
        with conn, conn.cursor() as cur:
            _ensure_tables(cur)
            cur.execute(
                """
                INSERT INTO crm_contacts
                    (id, name, email, company, value, stage, status, owner, notes_count, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, now())
                ON CONFLICT (id) DO UPDATE SET
                    name        = EXCLUDED.name,
                    email       = EXCLUDED.email,
                    company     = EXCLUDED.company,
                    value       = EXCLUDED.value,
                    stage       = EXCLUDED.stage,
                    status      = EXCLUDED.status,
                    owner       = EXCLUDED.owner,
                    notes_count = EXCLUDED.notes_count,
                    updated_at  = now();
                """,
                (contact_id, name, email, company, value, stage, status, owner, notes_count),
            )
        return contact_id
    finally:
        conn.close()


@activity.defn
def record_activity(contact_id: str, kind: str, detail: str = "") -> int:
    """Append an entry to a contact's activity timeline and return its row id."""
    conn = _connect()
    try:
        with conn, conn.cursor() as cur:
            _ensure_tables(cur)
            cur.execute(
                """
                INSERT INTO crm_activities (contact_id, kind, detail)
                VALUES (%s, %s, %s)
                RETURNING id;
                """,
                (contact_id, kind, detail),
            )
            row_id = cur.fetchone()[0]
        return int(row_id)
    finally:
        conn.close()


@activity.defn
def list_contacts(limit: int = 50) -> list[dict[str, Any]]:
    """Return CRM contacts ordered by most recently updated."""
    conn = _connect()
    try:
        with conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            _ensure_tables(cur)
            cur.execute(
                """
                SELECT id, name, email, company, value, stage, status, owner,
                       notes_count, created_at, updated_at
                FROM crm_contacts
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
                "email": r["email"],
                "company": r["company"],
                "value": float(r["value"]),
                "stage": r["stage"],
                "status": r["status"],
                "owner": r["owner"],
                "notes_count": r["notes_count"],
                "created_at": r["created_at"].isoformat(),
                "updated_at": r["updated_at"].isoformat(),
            }
            for r in rows
        ]
    finally:
        conn.close()


def get_contact(contact_id: str) -> dict[str, Any] | None:
    """Return one CRM contact snapshot from Postgres, if present."""
    conn = _connect()
    try:
        with conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            _ensure_tables(cur)
            cur.execute(
                """
                SELECT id, name, email, company, value, stage, status, owner,
                       notes_count, created_at, updated_at
                FROM crm_contacts
                WHERE id = %s;
                """,
                (contact_id,),
            )
            row = cur.fetchone()
        if row is None:
            return None
        return {
            "id": row["id"],
            "name": row["name"],
            "email": row["email"],
            "company": row["company"],
            "value": float(row["value"]),
            "stage": row["stage"],
            "status": row["status"],
            "owner": row["owner"],
            "notes_count": row["notes_count"],
            "created_at": row["created_at"].isoformat(),
            "updated_at": row["updated_at"].isoformat(),
        }
    finally:
        conn.close()


@activity.defn
def get_activities(contact_id: str, limit: int = 50) -> list[dict[str, Any]]:
    """Return the activity timeline for a single contact, newest first."""
    conn = _connect()
    try:
        with conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            _ensure_tables(cur)
            cur.execute(
                """
                SELECT kind, detail, created_at
                FROM crm_activities
                WHERE contact_id = %s
                ORDER BY created_at DESC
                LIMIT %s;
                """,
                (contact_id, limit),
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
