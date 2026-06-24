"""HTTP API + static web UI for the small CRM.

Browsers cannot talk to Temporal directly, so this FastAPI app bridges HTTP to
Temporal: it starts a `CrmLeadWorkflow` per contact, relays sales actions as
signals, reads deal state via queries, and lists the Supabase-backed pipeline.
It serves the single-page UI at `/`.
"""
from __future__ import annotations

import asyncio
import re
import uuid
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from temporalio.client import Client

from .activities.crm_store import get_activities, list_contacts
from .config import settings
from .workflows.example.crm_workflow import CrmLeadWorkflow

app = FastAPI(title="Mini CRM")

# Allow the local frontend (and other dev origins) to call the CRM API directly.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

_STATIC_DIR = Path(__file__).parent / "static"
_client: Client | None = None


async def get_client() -> Client:
    global _client
    if _client is None:
        _client = await Client.connect(
            settings.temporal_address, namespace=settings.temporal_namespace
        )
    return _client


class NewContact(BaseModel):
    name: str
    email: str | None = None
    company: str | None = None
    value: float = 0.0
    owner: str | None = None
    followup_minutes: int = 1


class Note(BaseModel):
    text: str


class Stage(BaseModel):
    stage: str


class Disqualify(BaseModel):
    reason: str = ""


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "lead"


@app.get("/")
def index() -> FileResponse:
    return FileResponse(_STATIC_DIR / "crm.html")


@app.get("/api/contacts")
def contacts(limit: int = 50) -> dict[str, Any]:
    try:
        return {"rows": list_contacts(limit)}
    except Exception as exc:  # pragma: no cover - surfaced to UI
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/contacts")
async def create_contact(body: NewContact) -> dict[str, Any]:
    client = await get_client()
    contact_id = f"crm-{_slug(body.name)}-{uuid.uuid4().hex[:8]}"
    handle = await client.start_workflow(
        CrmLeadWorkflow.run,
        args=[
            contact_id,
            body.name,
            body.email,
            body.company,
            body.value,
            body.owner,
            body.followup_minutes,
        ],
        id=contact_id,
        task_queue=settings.temporal_task_queue,
    )
    state = await handle.query(CrmLeadWorkflow.state)
    return {"id": contact_id, "state": state}


@app.get("/api/contacts/{contact_id}")
async def contact_state(contact_id: str) -> dict[str, Any]:
    client = await get_client()
    handle = client.get_workflow_handle(contact_id)
    try:
        state = await handle.query(CrmLeadWorkflow.state)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    timeline = get_activities(contact_id)
    return {"state": state, "timeline": timeline}


async def _signal_and_read(contact_id: str, signal, *args) -> dict[str, Any]:
    client = await get_client()
    handle = client.get_workflow_handle(contact_id)
    before = await handle.query(CrmLeadWorkflow.state)
    await handle.signal(signal, *args)

    # Wait until the workflow has processed the signal (state changes or ends).
    state = before
    for _ in range(200):
        state = await handle.query(CrmLeadWorkflow.state)
        if (
            state["stage"] != before["stage"]
            or state["status"] != before["status"]
            or state["notes_count"] != before["notes_count"]
        ):
            break
        await asyncio.sleep(0.02)
    return state


@app.post("/api/contacts/{contact_id}/advance")
async def advance(contact_id: str) -> dict[str, Any]:
    state = await _signal_and_read(contact_id, CrmLeadWorkflow.advance)
    return {"state": state}


@app.post("/api/contacts/{contact_id}/stage")
async def set_stage(contact_id: str, body: Stage) -> dict[str, Any]:
    state = await _signal_and_read(contact_id, CrmLeadWorkflow.set_stage, body.stage)
    return {"state": state}


@app.post("/api/contacts/{contact_id}/note")
async def add_note(contact_id: str, body: Note) -> dict[str, Any]:
    state = await _signal_and_read(contact_id, CrmLeadWorkflow.add_note, body.text)
    return {"state": state}


@app.post("/api/contacts/{contact_id}/win")
async def win(contact_id: str) -> dict[str, Any]:
    state = await _signal_and_read(contact_id, CrmLeadWorkflow.win)
    return {"state": state}


@app.post("/api/contacts/{contact_id}/disqualify")
async def disqualify(contact_id: str, body: Disqualify) -> dict[str, Any]:
    state = await _signal_and_read(
        contact_id, CrmLeadWorkflow.disqualify, body.reason
    )
    return {"state": state}
