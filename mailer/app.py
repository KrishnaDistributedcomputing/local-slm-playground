"""Tiny mail API.

Bridges the browser UI to a local Mailpit instance:
- POST /api/email/send   -> sends a message via SMTP (captured by Mailpit)
- GET  /api/email/messages       -> list captured messages (proxied)
- GET  /api/email/messages/{id}  -> full message (proxied)
- DELETE /api/email/messages     -> clear the inbox (proxied)

Mailpit is both the SMTP server (it captures everything sent to it) and the
store we read "received" mail from, so this single service covers send + receive
for local development.
"""
from __future__ import annotations

import os
import smtplib
from email.message import EmailMessage

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

SMTP_HOST = os.environ.get("SMTP_HOST", "mailpit")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "1025"))
MAILPIT_API = os.environ.get("MAILPIT_API", "http://mailpit:8025")

app = FastAPI(title="Mailer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # dev only
    allow_methods=["*"],
    allow_headers=["*"],
)


class OutgoingEmail(BaseModel):
    # Plain strings (not EmailStr): this is a local dev mail sandbox, so we
    # intentionally accept reserved/test domains like example.test.
    sender: str = "noreply@example.com"
    to: str
    subject: str
    body: str
    html: bool = False


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/email/send")
def send_email(email: OutgoingEmail) -> dict[str, str]:
    msg = EmailMessage()
    msg["From"] = email.sender
    msg["To"] = email.to
    msg["Subject"] = email.subject
    if email.html:
        msg.set_content("This message requires an HTML-capable viewer.")
        msg.add_alternative(email.body, subtype="html")
    else:
        msg.set_content(email.body)

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.send_message(msg)
    except OSError as exc:  # connection/SMTP errors
        raise HTTPException(status_code=502, detail=f"SMTP send failed: {exc}")

    return {"status": "sent"}


@app.get("/api/email/messages")
def list_messages(limit: int = 50) -> dict:
    try:
        resp = httpx.get(f"{MAILPIT_API}/api/v1/messages", params={"limit": limit}, timeout=10)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Mailpit unavailable: {exc}")
    return resp.json()


@app.get("/api/email/messages/{message_id}")
def get_message(message_id: str) -> dict:
    try:
        resp = httpx.get(f"{MAILPIT_API}/api/v1/message/{message_id}", timeout=10)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Mailpit unavailable: {exc}")
    return resp.json()


@app.delete("/api/email/messages")
def clear_messages() -> dict[str, str]:
    try:
        resp = httpx.delete(f"{MAILPIT_API}/api/v1/messages", timeout=10)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Mailpit unavailable: {exc}")
    return {"status": "cleared"}
