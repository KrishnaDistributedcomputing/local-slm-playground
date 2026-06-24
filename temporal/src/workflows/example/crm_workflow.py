"""A CRM lead modelled as a long-running Temporal workflow.

Each contact/lead is its own workflow instance that owns the deal state. Sales
actions arrive as signals (`advance`, `set_stage`, `add_note`, `win`,
`disqualify`); the current snapshot is read via the `state` query. A durable
Temporal timer fires a "follow-up reminder" whenever a lead goes untouched for
too long — exactly the kind of reliable, stateful background work Temporal is
built for. Every change is persisted to Supabase.
"""
from __future__ import annotations

import asyncio
import datetime
from typing import Any

from temporalio import workflow

with workflow.unsafe.imports_passed_through():
    from ...activities.crm_store import record_activity, upsert_contact

# Ordered sales pipeline. "Won" and "Lost" are terminal.
STAGES: list[str] = ["New", "Contacted", "Qualified", "Proposal", "Won"]
_ACTIVITY_TIMEOUT = datetime.timedelta(seconds=15)


@workflow.defn
class CrmLeadWorkflow:
    def __init__(self) -> None:
        self._id: str = ""
        self._name: str = ""
        self._email: str | None = None
        self._company: str | None = None
        self._owner: str | None = None
        self._value: float = 0.0
        self._stage: str = "New"
        self._status: str = "active"  # active | won | lost
        self._notes: list[dict[str, str]] = []
        self._over: bool = False
        # Bumped on every change so the run loop wakes up and persists.
        self._revision: int = 0
        # How many of self._notes have been written to the Supabase timeline.
        self._recorded: int = 0
        self._followup_minutes: int = 1

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
            upsert_contact,
            args=[
                self._id,
                self._name,
                self._email,
                self._company,
                self._value,
                self._stage,
                self._status,
                self._owner,
                len(self._notes),
            ],
            start_to_close_timeout=_ACTIVITY_TIMEOUT,
        )

    async def _sync_timeline(self) -> None:
        """Durably write any not-yet-recorded notes to the Supabase timeline."""
        while self._recorded < len(self._notes):
            note = self._notes[self._recorded]
            await workflow.execute_activity(
                record_activity,
                args=[self._id, note["kind"], note["detail"]],
                start_to_close_timeout=_ACTIVITY_TIMEOUT,
            )
            self._recorded += 1

    # ----- entrypoint ----------------------------------------------------
    @workflow.run
    async def run(
        self,
        contact_id: str,
        name: str,
        email: str | None = None,
        company: str | None = None,
        value: float = 0.0,
        owner: str | None = None,
        followup_minutes: int = 1,
    ) -> dict[str, Any]:
        self._id = contact_id
        self._name = name
        self._email = email
        self._company = company
        self._value = float(value)
        self._owner = owner
        self._followup_minutes = max(1, int(followup_minutes))

        self._log("created", f"Lead created in stage {self._stage}")

        # Main loop: persist on every change (and durably record each new
        # activity), nudging with a follow-up reminder if the lead goes quiet.
        while not self._over:
            await self._persist()
            await self._sync_timeline()
            seen = self._revision
            try:
                await workflow.wait_condition(
                    lambda: self._over or self._revision != seen,
                    timeout=datetime.timedelta(minutes=self._followup_minutes),
                )
            except asyncio.TimeoutError:
                if not self._over:
                    self._log("reminder", "Follow-up reminder: this lead has gone quiet")
                    self._touch()

        await self._persist()
        await self._sync_timeline()
        return {
            "id": self._id,
            "name": self._name,
            "stage": self._stage,
            "status": self._status,
            "value": self._value,
            "notes": len(self._notes),
        }

    # ----- signals -------------------------------------------------------
    @workflow.signal
    async def advance(self) -> None:
        if self._over:
            return
        idx = STAGES.index(self._stage) if self._stage in STAGES else 0
        if idx >= len(STAGES) - 1:
            # Already at the last pipeline stage ("Won").
            self._stage = "Won"
            self._status = "won"
            self._over = True
            self._log("won", "Deal won")
        else:
            self._stage = STAGES[idx + 1]
            if self._stage == "Won":
                self._status = "won"
                self._over = True
            self._log("stage", f"Moved to {self._stage}")
        self._touch()

    @workflow.signal
    async def set_stage(self, stage: str) -> None:
        if self._over or stage not in STAGES:
            return
        self._stage = stage
        if stage == "Won":
            self._status = "won"
            self._over = True
            self._log("won", "Deal won")
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
    async def win(self) -> None:
        if self._over:
            return
        self._stage = "Won"
        self._status = "won"
        self._over = True
        self._log("won", "Deal won")
        self._touch()

    @workflow.signal
    async def disqualify(self, reason: str = "") -> None:
        if self._over:
            return
        self._status = "lost"
        self._over = True
        self._log("lost", reason or "Lead disqualified")
        self._touch()

    # ----- query ---------------------------------------------------------
    @workflow.query
    def state(self) -> dict[str, Any]:
        idx = STAGES.index(self._stage) if self._stage in STAGES else 0
        return {
            "id": self._id,
            "name": self._name,
            "email": self._email,
            "company": self._company,
            "owner": self._owner,
            "value": self._value,
            "stage": self._stage,
            "stage_index": idx,
            "stages": STAGES,
            "status": self._status,
            "over": self._over,
            "notes": self._notes,
            "notes_count": len(self._notes),
        }
