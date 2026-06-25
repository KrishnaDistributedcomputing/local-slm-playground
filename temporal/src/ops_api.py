"""HTTP API for the Ops apps: Support Ticket Desk + Recruiting Pipeline.

Browsers cannot talk to Temporal directly, so this FastAPI app bridges HTTP to
Temporal. It starts a `SupportTicketWorkflow` per ticket and a
`RecruitCandidateWorkflow` per candidate, relays actions as signals, reads state
via queries, and lists the Supabase-backed pipelines. Two new business apps,
one service.
"""
from __future__ import annotations

import asyncio
import re
import time
import uuid
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from temporalio.client import Client

from .activities.recruit_store import get_candidate_events, list_candidates
from .activities.ticket_store import get_ticket_events, list_tickets
from .config import settings
from .workflows.example.recruit_workflow import RecruitCandidateWorkflow
from .workflows.example.ticket_workflow import SupportTicketWorkflow

app = FastAPI(title="Ops Desk")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

_client: Client | None = None


async def get_client() -> Client:
    global _client
    if _client is None:
        _client = await Client.connect(
            settings.temporal_address, namespace=settings.temporal_namespace
        )
    return _client


def _slug(value: str, fallback: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or fallback


async def _signal_and_read(wf_id: str, state_query, signal, *args) -> dict[str, Any]:
    client = await get_client()
    handle = client.get_workflow_handle(wf_id)
    before = await handle.query(state_query)
    await handle.signal(signal, *args)

    state = before
    for _ in range(200):
        state = await handle.query(state_query)
        if (
            state["stage"] != before["stage"]
            or state["status"] != before["status"]
            or state["notes_count"] != before["notes_count"]
        ):
            break
        await asyncio.sleep(0.02)
    return state


# --------------------------------------------------------------------------
# Models
# --------------------------------------------------------------------------
class NewTicket(BaseModel):
    subject: str
    requester: str | None = None
    channel: str | None = None
    priority: str = "Normal"
    sla_minutes: int = 1


class NewCandidate(BaseModel):
    name: str
    role: str | None = None
    email: str | None = None
    source: str | None = None
    followup_minutes: int = 1


class Note(BaseModel):
    text: str


class Stage(BaseModel):
    stage: str


class Reason(BaseModel):
    reason: str = ""


# --------------------------------------------------------------------------
# Health
# --------------------------------------------------------------------------
@app.get("/api/health")
async def health() -> dict[str, Any]:
    services: list[dict[str, Any]] = []

    start = time.perf_counter()
    try:
        await asyncio.wait_for(get_client(), timeout=5)
        services.append(
            {
                "name": "Temporal",
                "status": "up",
                "latency_ms": round((time.perf_counter() - start) * 1000),
            }
        )
    except Exception as exc:  # pragma: no cover
        services.append({"name": "Temporal", "status": "down", "error": str(exc)[:200]})

    start = time.perf_counter()
    try:
        tickets = await asyncio.to_thread(list_tickets, 1000)
        candidates = await asyncio.to_thread(list_candidates, 1000)
        services.append(
            {
                "name": "Supabase DB",
                "status": "up",
                "latency_ms": round((time.perf_counter() - start) * 1000),
                "detail": f"{len(tickets)} tickets, {len(candidates)} candidates",
            }
        )
    except Exception as exc:  # pragma: no cover
        services.append({"name": "Supabase DB", "status": "down", "error": str(exc)[:200]})

    overall = "up" if all(s["status"] == "up" for s in services) else "degraded"
    return {"overall": overall, "services": services, "checked_at": time.time()}


@app.get("/")
def index() -> dict[str, Any]:
    return {
        "service": "Ops Desk",
        "apps": ["Support Ticket Desk", "Recruiting Pipeline"],
        "endpoints": ["/api/tickets", "/api/candidates", "/api/health"],
    }


# --------------------------------------------------------------------------
# Support tickets
# --------------------------------------------------------------------------
@app.get("/api/tickets")
def tickets(limit: int = 50) -> dict[str, Any]:
    try:
        return {"rows": list_tickets(limit)}
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/tickets")
async def create_ticket(body: NewTicket) -> dict[str, Any]:
    client = await get_client()
    ticket_id = f"tkt-{_slug(body.subject, 'ticket')}-{uuid.uuid4().hex[:8]}"
    handle = await client.start_workflow(
        SupportTicketWorkflow.run,
        args=[
            ticket_id,
            body.subject,
            body.requester,
            body.channel,
            body.priority,
            body.sla_minutes,
        ],
        id=ticket_id,
        task_queue=settings.temporal_task_queue,
    )
    state = await handle.query(SupportTicketWorkflow.state)
    return {"id": ticket_id, "state": state}


@app.get("/api/tickets/{ticket_id}")
async def ticket_state(ticket_id: str) -> dict[str, Any]:
    client = await get_client()
    handle = client.get_workflow_handle(ticket_id)
    try:
        state = await handle.query(SupportTicketWorkflow.state)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    timeline = get_ticket_events(ticket_id)
    return {"state": state, "timeline": timeline}


@app.post("/api/tickets/{ticket_id}/advance")
async def ticket_advance(ticket_id: str) -> dict[str, Any]:
    state = await _signal_and_read(
        ticket_id, SupportTicketWorkflow.state, SupportTicketWorkflow.advance
    )
    return {"state": state}


@app.post("/api/tickets/{ticket_id}/stage")
async def ticket_set_stage(ticket_id: str, body: Stage) -> dict[str, Any]:
    state = await _signal_and_read(
        ticket_id, SupportTicketWorkflow.state, SupportTicketWorkflow.set_stage, body.stage
    )
    return {"state": state}


@app.post("/api/tickets/{ticket_id}/note")
async def ticket_add_note(ticket_id: str, body: Note) -> dict[str, Any]:
    state = await _signal_and_read(
        ticket_id, SupportTicketWorkflow.state, SupportTicketWorkflow.add_note, body.text
    )
    return {"state": state}


@app.post("/api/tickets/{ticket_id}/escalate")
async def ticket_escalate(ticket_id: str, body: Reason) -> dict[str, Any]:
    state = await _signal_and_read(
        ticket_id, SupportTicketWorkflow.state, SupportTicketWorkflow.escalate, body.reason
    )
    return {"state": state}


@app.post("/api/tickets/{ticket_id}/resolve")
async def ticket_resolve(ticket_id: str) -> dict[str, Any]:
    state = await _signal_and_read(
        ticket_id, SupportTicketWorkflow.state, SupportTicketWorkflow.resolve
    )
    return {"state": state}


# --------------------------------------------------------------------------
# Recruiting candidates
# --------------------------------------------------------------------------
@app.get("/api/candidates")
def candidates(limit: int = 50) -> dict[str, Any]:
    try:
        return {"rows": list_candidates(limit)}
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/candidates")
async def create_candidate(body: NewCandidate) -> dict[str, Any]:
    client = await get_client()
    candidate_id = f"cand-{_slug(body.name, 'candidate')}-{uuid.uuid4().hex[:8]}"
    handle = await client.start_workflow(
        RecruitCandidateWorkflow.run,
        args=[
            candidate_id,
            body.name,
            body.role,
            body.email,
            body.source,
            body.followup_minutes,
        ],
        id=candidate_id,
        task_queue=settings.temporal_task_queue,
    )
    state = await handle.query(RecruitCandidateWorkflow.state)
    return {"id": candidate_id, "state": state}


@app.get("/api/candidates/{candidate_id}")
async def candidate_state(candidate_id: str) -> dict[str, Any]:
    client = await get_client()
    handle = client.get_workflow_handle(candidate_id)
    try:
        state = await handle.query(RecruitCandidateWorkflow.state)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    timeline = get_candidate_events(candidate_id)
    return {"state": state, "timeline": timeline}


@app.post("/api/candidates/{candidate_id}/advance")
async def candidate_advance(candidate_id: str) -> dict[str, Any]:
    state = await _signal_and_read(
        candidate_id, RecruitCandidateWorkflow.state, RecruitCandidateWorkflow.advance
    )
    return {"state": state}


@app.post("/api/candidates/{candidate_id}/stage")
async def candidate_set_stage(candidate_id: str, body: Stage) -> dict[str, Any]:
    state = await _signal_and_read(
        candidate_id,
        RecruitCandidateWorkflow.state,
        RecruitCandidateWorkflow.set_stage,
        body.stage,
    )
    return {"state": state}


@app.post("/api/candidates/{candidate_id}/note")
async def candidate_add_note(candidate_id: str, body: Note) -> dict[str, Any]:
    state = await _signal_and_read(
        candidate_id,
        RecruitCandidateWorkflow.state,
        RecruitCandidateWorkflow.add_note,
        body.text,
    )
    return {"state": state}


@app.post("/api/candidates/{candidate_id}/hire")
async def candidate_hire(candidate_id: str) -> dict[str, Any]:
    state = await _signal_and_read(
        candidate_id, RecruitCandidateWorkflow.state, RecruitCandidateWorkflow.hire
    )
    return {"state": state}


@app.post("/api/candidates/{candidate_id}/reject")
async def candidate_reject(candidate_id: str, body: Reason) -> dict[str, Any]:
    state = await _signal_and_read(
        candidate_id,
        RecruitCandidateWorkflow.state,
        RecruitCandidateWorkflow.reject,
        body.reason,
    )
    return {"state": state}
