"""A job candidate modelled as a long-running Temporal workflow.

Each candidate is its own workflow instance that owns the application state.
Recruiting actions arrive as signals (`advance`, `set_stage`, `add_note`,
`hire`, `reject`); the current snapshot is read via the `state` query. A durable
Temporal timer fires a "follow-up reminder" whenever a candidate goes untouched
for too long. Every change is persisted to Supabase.
"""
from __future__ import annotations

import asyncio
import datetime
from typing import Any

from temporalio import workflow

with workflow.unsafe.imports_passed_through():
    from ...activities.recruit_store import record_candidate_event, upsert_candidate

# Ordered recruiting pipeline. "Hired" is terminal.
STAGES: list[str] = ["Applied", "Screened", "Interview", "Offer", "Hired"]
_ACTIVITY_TIMEOUT = datetime.timedelta(seconds=15)


@workflow.defn
class RecruitCandidateWorkflow:
    def __init__(self) -> None:
        self._id: str = ""
        self._name: str = ""
        self._role: str | None = None
        self._email: str | None = None
        self._source: str | None = None
        self._stage: str = "Applied"
        self._status: str = "active"  # active | hired | rejected
        self._notes: list[dict[str, str]] = []
        self._over: bool = False
        self._revision: int = 0
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
            upsert_candidate,
            args=[
                self._id,
                self._name,
                self._role,
                self._email,
                self._source,
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
                record_candidate_event,
                args=[self._id, note["kind"], note["detail"]],
                start_to_close_timeout=_ACTIVITY_TIMEOUT,
            )
            self._recorded += 1

    # ----- entrypoint ----------------------------------------------------
    @workflow.run
    async def run(
        self,
        candidate_id: str,
        name: str,
        role: str | None = None,
        email: str | None = None,
        source: str | None = None,
        followup_minutes: int = 1,
    ) -> dict[str, Any]:
        self._id = candidate_id
        self._name = name
        self._role = role
        self._email = email
        self._source = source
        self._followup_minutes = max(1, int(followup_minutes))

        self._log("created", f"Candidate added in stage {self._stage}")

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
                    self._log("reminder", "Follow-up reminder: this candidate has gone quiet")
                    self._touch()

        await self._persist()
        await self._sync_timeline()
        return {
            "id": self._id,
            "name": self._name,
            "stage": self._stage,
            "status": self._status,
            "role": self._role,
            "notes": len(self._notes),
        }

    # ----- signals -------------------------------------------------------
    @workflow.signal
    async def advance(self) -> None:
        if self._over:
            return
        idx = STAGES.index(self._stage) if self._stage in STAGES else 0
        if idx >= len(STAGES) - 1:
            self._stage = "Hired"
            self._status = "hired"
            self._over = True
            self._log("hired", "Candidate hired")
        else:
            self._stage = STAGES[idx + 1]
            if self._stage == "Hired":
                self._status = "hired"
                self._over = True
                self._log("hired", "Candidate hired")
            else:
                self._log("stage", f"Moved to {self._stage}")
        self._touch()

    @workflow.signal
    async def set_stage(self, stage: str) -> None:
        if self._over or stage not in STAGES:
            return
        self._stage = stage
        if stage == "Hired":
            self._status = "hired"
            self._over = True
            self._log("hired", "Candidate hired")
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
    async def hire(self) -> None:
        if self._over:
            return
        self._stage = "Hired"
        self._status = "hired"
        self._over = True
        self._log("hired", "Candidate hired")
        self._touch()

    @workflow.signal
    async def reject(self, reason: str = "") -> None:
        if self._over:
            return
        self._status = "rejected"
        self._over = True
        self._log("rejected", reason or "Candidate rejected")
        self._touch()

    # ----- query ---------------------------------------------------------
    @workflow.query
    def state(self) -> dict[str, Any]:
        idx = STAGES.index(self._stage) if self._stage in STAGES else 0
        return {
            "id": self._id,
            "name": self._name,
            "role": self._role,
            "email": self._email,
            "source": self._source,
            "stage": self._stage,
            "stage_index": idx,
            "stages": STAGES,
            "status": self._status,
            "over": self._over,
            "notes": self._notes,
            "notes_count": len(self._notes),
        }
