"""A support ticket modelled as a long-running Temporal workflow.

Each ticket is its own workflow instance that owns the ticket state. Support
actions arrive as signals (`advance`, `set_stage`, `add_note`, `escalate`,
`resolve`); the current snapshot is read via the `state` query. A durable
Temporal timer fires an "SLA reminder" whenever an open ticket goes untouched
for too long. Every change is persisted to Supabase.
"""
from __future__ import annotations

import asyncio
import datetime
from typing import Any

from temporalio import workflow

with workflow.unsafe.imports_passed_through():
    from ...activities.ticket_store import record_ticket_event, upsert_ticket

# Ordered support pipeline. "Resolved" is terminal.
STAGES: list[str] = ["New", "Triaged", "Replied", "Escalated", "Resolved"]
_ACTIVITY_TIMEOUT = datetime.timedelta(seconds=15)


@workflow.defn
class SupportTicketWorkflow:
    def __init__(self) -> None:
        self._id: str = ""
        self._subject: str = ""
        self._requester: str | None = None
        self._channel: str | None = None
        self._priority: str = "Normal"
        self._stage: str = "New"
        self._status: str = "open"  # open | resolved | closed
        self._notes: list[dict[str, str]] = []
        self._over: bool = False
        self._revision: int = 0
        self._recorded: int = 0
        self._sla_minutes: int = 1

    # ----- helpers -------------------------------------------------------
    def _touch(self) -> None:
        self._revision += 1

    def _log(self, kind: str, detail: str = "") -> None:
        self._notes.append(
            {
                "kind": kind,
                "detail": detail,
                "at": workflow.now().isoformat(),
            }
        )

    async def _persist(self) -> None:
        await workflow.execute_activity(
            upsert_ticket,
            args=[
                self._id,
                self._subject,
                self._requester,
                self._channel,
                self._priority,
                self._stage,
                self._status,
                len(self._notes),
            ],
            start_to_close_timeout=_ACTIVITY_TIMEOUT,
        )

    async def _sync_timeline(self) -> None:
        while self._recorded < len(self._notes):
            note = self._notes[self._recorded]
            await workflow.execute_activity(
                record_ticket_event,
                args=[self._id, note["kind"], note["detail"]],
                start_to_close_timeout=_ACTIVITY_TIMEOUT,
            )
            self._recorded += 1

    # ----- entrypoint ----------------------------------------------------
    @workflow.run
    async def run(
        self,
        ticket_id: str,
        subject: str,
        requester: str | None = None,
        channel: str | None = None,
        priority: str = "Normal",
        sla_minutes: int = 1,
    ) -> dict[str, Any]:
        self._id = ticket_id
        self._subject = subject
        self._requester = requester
        self._channel = channel
        self._priority = priority or "Normal"
        self._sla_minutes = max(1, int(sla_minutes))

        self._log("created", f"Ticket opened in stage {self._stage}")

        while not self._over:
            await self._persist()
            await self._sync_timeline()
            seen = self._revision
            try:
                await workflow.wait_condition(
                    lambda: self._over or self._revision != seen,
                    timeout=datetime.timedelta(minutes=self._sla_minutes),
                )
            except asyncio.TimeoutError:
                if not self._over:
                    self._log("reminder", "SLA reminder: this ticket is awaiting a response")
                    self._touch()

        await self._persist()
        await self._sync_timeline()
        return {
            "id": self._id,
            "subject": self._subject,
            "stage": self._stage,
            "status": self._status,
            "priority": self._priority,
            "notes": len(self._notes),
        }

    # ----- signals -------------------------------------------------------
    @workflow.signal
    async def advance(self) -> None:
        if self._over:
            return
        idx = STAGES.index(self._stage) if self._stage in STAGES else 0
        if idx >= len(STAGES) - 1:
            self._stage = "Resolved"
            self._status = "resolved"
            self._over = True
            self._log("resolved", "Ticket resolved")
        else:
            self._stage = STAGES[idx + 1]
            if self._stage == "Resolved":
                self._status = "resolved"
                self._over = True
                self._log("resolved", "Ticket resolved")
            else:
                self._log("stage", f"Moved to {self._stage}")
        self._touch()

    @workflow.signal
    async def set_stage(self, stage: str) -> None:
        if self._over or stage not in STAGES:
            return
        self._stage = stage
        if stage == "Resolved":
            self._status = "resolved"
            self._over = True
            self._log("resolved", "Ticket resolved")
        else:
            self._log("stage", f"Moved to {stage}")
        self._touch()

    @workflow.signal
    async def add_note(self, text: str) -> None:
        if self._over or not text:
            return
        self._log("note", text)
        self._touch()

    @workflow.signal
    async def escalate(self, reason: str = "") -> None:
        if self._over:
            return
        self._stage = "Escalated"
        self._priority = "Urgent"
        self._log("escalated", reason or "Ticket escalated")
        self._touch()

    @workflow.signal
    async def resolve(self) -> None:
        if self._over:
            return
        self._stage = "Resolved"
        self._status = "resolved"
        self._over = True
        self._log("resolved", "Ticket resolved")
        self._touch()

    @workflow.signal
    async def close(self, reason: str = "") -> None:
        if self._over:
            return
        self._status = "closed"
        self._over = True
        self._log("closed", reason or "Ticket closed")
        self._touch()

    # ----- query ---------------------------------------------------------
    @workflow.query
    def state(self) -> dict[str, Any]:
        idx = STAGES.index(self._stage) if self._stage in STAGES else 0
        return {
            "id": self._id,
            "subject": self._subject,
            "requester": self._requester,
            "channel": self._channel,
            "priority": self._priority,
            "stage": self._stage,
            "stage_index": idx,
            "stages": STAGES,
            "status": self._status,
            "over": self._over,
            "notes": self._notes,
            "notes_count": len(self._notes),
        }
