"""HTTP API + static web UI for the chess game.

Browsers cannot use the Temporal SDK directly, so this FastAPI app bridges HTTP to
Temporal: it starts chess workflows, relays moves (signals), reads board state
(queries), and exposes the Supabase-backed game history. It serves the single-page
UI at `/`.
"""
from __future__ import annotations

import asyncio
import uuid
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from temporalio.client import Client

from .activities.chess_store import get_recent_games
from .classics import get_classic_positions, list_classics
from .config import settings
from .workflows.example.chess_workflow import ChessGameWorkflow

app = FastAPI(title="Chess Game")

_STATIC_DIR = Path(__file__).parent / "static"
_client: Client | None = None


async def get_client() -> Client:
    global _client
    if _client is None:
        _client = await Client.connect(
            settings.temporal_address, namespace=settings.temporal_namespace
        )
    return _client


class NewGame(BaseModel):
    white: str = "Player"
    black: str = "Bot"


class Move(BaseModel):
    uci: str


@app.get("/")
def index() -> FileResponse:
    return FileResponse(_STATIC_DIR / "index.html")


@app.post("/api/games")
async def create_game(body: NewGame) -> dict[str, Any]:
    client = await get_client()
    workflow_id = f"chess-{body.white.lower()}-{uuid.uuid4().hex[:8]}"
    handle = await client.start_workflow(
        ChessGameWorkflow.run,
        args=[body.white, body.black],
        id=workflow_id,
        task_queue=settings.temporal_task_queue,
    )
    state = await handle.query(ChessGameWorkflow.state)
    return {"id": workflow_id, "state": state}


@app.get("/api/games/{workflow_id}")
async def game_state(workflow_id: str) -> dict[str, Any]:
    client = await get_client()
    handle = client.get_workflow_handle(workflow_id)
    return await handle.query(ChessGameWorkflow.state)


@app.post("/api/games/{workflow_id}/move")
async def submit_move(workflow_id: str, body: Move) -> dict[str, Any]:
    client = await get_client()
    handle = client.get_workflow_handle(workflow_id)

    before = await handle.query(ChessGameWorkflow.state)
    await handle.signal(ChessGameWorkflow.move, body.uci)

    # Wait until the workflow has processed this move (move count changes, the
    # turn returns to White, or the game ends / a message updates).
    state = before
    for _ in range(200):
        state = await handle.query(ChessGameWorkflow.state)
        if (
            state["move_count"] != before["move_count"]
            or state["over"]
            or state["message"] != before["message"]
        ):
            break
        await asyncio.sleep(0.02)

    result: dict[str, Any] | None = None
    if state["over"]:
        result = await handle.result()
    return {"state": state, "result": result}


@app.post("/api/games/{workflow_id}/resign")
async def resign(workflow_id: str) -> dict[str, Any]:
    client = await get_client()
    handle = client.get_workflow_handle(workflow_id)
    await handle.signal(ChessGameWorkflow.resign)
    for _ in range(200):
        state = await handle.query(ChessGameWorkflow.state)
        if state["over"]:
            break
        await asyncio.sleep(0.02)
    result = await handle.result()
    return {"state": state, "result": result}


@app.get("/api/history")
def history(limit: int = 10) -> dict[str, Any]:
    try:
        return {"rows": get_recent_games(limit)}
    except Exception as exc:  # pragma: no cover - surfaced to UI
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/classics")
def classics() -> dict[str, Any]:
    return {"games": list_classics()}


@app.get("/api/classics/{game_id}")
def classic(game_id: str) -> dict[str, Any]:
    try:
        return get_classic_positions(game_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"unknown classic game: {game_id}")
