"""P7 FastAPI routes. All shop access is through the MCP connection."""

import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import json
import logging
import os
from pathlib import Path
import secrets
import sys
from typing import Callable, Literal
from uuid import uuid4

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from starlette.middleware.trustedhost import TrustedHostMiddleware
from backend.agent import AgentTeam
from backend.audit import redact
from backend.auth import ALLOWED_ORIGINS, COOKIE_NAME, OperatorSessions
from backend.config import ROOT


class StrictInput(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SessionInput(StrictInput):
    access_key: str = Field(min_length=32, max_length=256)
    display_name: str = Field(default="Student operator", min_length=1, max_length=100)


class RunInput(StrictInput):
    read_only: bool = True


class ApprovalInput(StrictInput):
    action_id: str = Field(min_length=64, max_length=64)
    confirm: Literal[True]
    confirmed_assumptions: bool = False


class ResetInput(StrictInput):
    confirm: Literal[True]


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_app(*, team_factory: Callable[[], AgentTeam] = AgentTeam,
               operator_key: str | None = None, access_file: Path | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        team = team_factory()
        key = operator_key or os.getenv("CAMPUS_OPERATOR_KEY") or secrets.token_urlsafe(48)
        app.state.operators = OperatorSessions(key)
        # Test fixtures supply their own key; production saves only to ignored local data.
        if operator_key is None or access_file is not None:
            destination = access_file or ROOT / "data/operator_access.json"
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text(json.dumps({"access_key": key, "purpose": "Local human operator session"}),
                                   encoding="utf-8")
            logging.getLogger("uvicorn.error").info("Local operator access file: %s", destination)
        app.state.team = team
        app.state.jobs = {}
        app.state.active_job_id = None
        app.state.operation_lock = asyncio.Lock()
        app.state.tasks = set()
        app.state.generation = 0
        async with team:
            try:
                yield
            finally:
                tasks = list(app.state.tasks)
                for task in tasks:
                    task.cancel()
                if tasks:
                    await asyncio.gather(*tasks, return_exceptions=True)

    app = FastAPI(title="Campus Customs Operations", version="0.7.0", lifespan=lifespan)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=["localhost", "127.0.0.1"])
    app.add_middleware(CORSMiddleware, allow_origins=sorted(ALLOWED_ORIGINS),
                       allow_credentials=True, allow_methods=["GET", "POST", "DELETE"],
                       allow_headers=["Content-Type", "X-CSRF-Token"])

    @app.middleware("http")
    async def no_store(request: Request, call_next):
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        return response

    async def shop(tool: str, arguments: dict | None = None):
        try:
            return (await app.state.team.mcp.client.call_tool(tool, arguments or {})).data
        except Exception as exc:
            raise HTTPException(503, redact(f"Shop tool unavailable: {exc}")) from exc

    def idle():
        if app.state.active_job_id is not None or app.state.operation_lock.locked():
            raise HTTPException(409, "A shop operation is in progress; wait for it to finish")

    @app.get("/health")
    async def health():
        return {"status": "ok", "model": "gpt-6-luna", "provider": "portkey",
                "generation": app.state.generation}

    @app.post("/session")
    async def connect_operator(body: SessionInput, request: Request, response: Response):
        app.state.operators.check_origin(request)
        token, session = app.state.operators.create(body.access_key, body.display_name)
        response.set_cookie(COOKIE_NAME, token, httponly=True, samesite="strict", max_age=8 * 3600,
                            secure=False, path="/")  # This app is loopback HTTP only.
        return {"authenticated": True, "operator": session.identity, "csrf_token": session.csrf_token}

    @app.get("/session")
    async def session_status(request: Request):
        try:
            session = app.state.operators.require(request)
            return {"authenticated": True, "operator": session.identity, "csrf_token": session.csrf_token}
        except HTTPException:
            return {"authenticated": False}

    @app.delete("/session")
    async def disconnect_operator(request: Request, response: Response):
        app.state.operators.require(request, mutation=True)
        app.state.operators.sessions.pop(request.cookies.get(COOKIE_NAME, ""), None)
        response.delete_cookie(COOKIE_NAME, path="/")
        return {"authenticated": False}

    @app.get("/tickets")
    async def tickets():
        result = await shop("list_tickets", {"status": "all"})
        return {**result, "generation": app.state.generation}

    async def run_job(job_id: str, ticket_id: int, read_only: bool):
        job = app.state.jobs[job_id]
        try:
            async with app.state.operation_lock:
                job["status"] = "running"
                result = await app.state.team.run_ticket(ticket_id, read_only=read_only, run_id=job_id)
                job["result"] = result.model_dump(mode="json")
                job["status"] = "completed" if result.status == "review_ready" else result.status
        except asyncio.CancelledError:
            job["status"] = "cancelled"
            raise
        except Exception as exc:
            job["status"] = "error"
            job["error"] = redact(str(exc))
        finally:
            job["finished_at_utc"] = now()
            app.state.active_job_id = None

    @app.post("/tickets/{ticket_id}/run", status_code=202)
    async def run_ticket(ticket_id: int, body: RunInput, request: Request):
        app.state.operators.require(request, mutation=True)
        idle()
        queue = await shop("list_tickets", {"status": "all"})
        ticket = next((t for t in queue["tickets"] if t["id"] == ticket_id), None)
        if ticket is None:
            raise HTTPException(404, "Ticket not found")
        if ticket["status"] != "open":
            raise HTTPException(409, "Ticket is already resolved; reset before a fresh resolution run")
        idle()
        job_id = uuid4().hex
        job = {"run_id": job_id, "ticket_id": ticket_id, "status": "queued",
               "read_only": body.read_only, "generation": app.state.generation,
               "created_at_utc": now(), "result": None}
        app.state.jobs[job_id] = job
        app.state.active_job_id = job_id
        task = asyncio.create_task(run_job(job_id, ticket_id, body.read_only))
        app.state.tasks.add(task)
        task.add_done_callback(app.state.tasks.discard)
        return {"run_id": job_id, "status": "queued", "read_only": body.read_only,
                "status_url": f"/runs/{job_id}"}

    @app.get("/runs/{run_id}")
    async def run_status(run_id: str):
        if run_id not in app.state.jobs:
            raise HTTPException(404, "Run not found")
        return app.state.jobs[run_id]

    @app.get("/events")
    async def events(after: int | None = Query(default=None, ge=0),
                     limit: int = Query(default=100, ge=1, le=200), run_id: str | None = None):
        path = app.state.team.audit.path
        def read_events():
            return json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
        history = await asyncio.to_thread(read_events)
        matching = [e for e in history if (after is None or e["sequence"] > after)
                    and (run_id is None or e["run_id"] == run_id)]
        selected = matching[-limit:] if after is None else matching[:limit]
        cursor = selected[-1]["sequence"] if selected else after or 0
        return {"events": selected, "next_after": cursor,
                "has_more": after is not None and len(matching) > len(selected)}

    @app.get("/cash")
    async def cash():
        state = await shop("get_shop_state")
        checking = next((r for r in state["cash_accounts"] if r["name"] == "checking"), None)
        if checking is None:
            raise HTTPException(404, "Checking account not found")
        return {"shop_date": state["shop_date"], "account": checking,
                "generation": app.state.generation}

    @app.get("/payments/pending")
    async def pending_payments(request: Request):
        app.state.operators.require(request)
        return {"proposals": [r["proposal"] for r in app.state.team.pending_proposals.values()],
                "generation": app.state.generation}

    @app.post("/payments/approve")
    async def approve_payment(body: ApprovalInput, request: Request):
        session = app.state.operators.require(request, mutation=True)
        idle()
        pending = app.state.team.pending_proposals.get(body.action_id)
        if pending is None:
            raise HTTPException(404, "Pending proposal not found; prepare it again")
        async with app.state.operation_lock:
            try:
                return await app.state.team.approve_payment(pending["proposal"],
                    human_identity=session.identity, confirmed_assumptions=body.confirmed_assumptions)
            except Exception as exc:
                raise HTTPException(409, redact(str(exc))) from exc

    @app.post("/reset")
    async def reset_database(body: ResetInput, request: Request):
        session = app.state.operators.require(request, mutation=True)
        idle()
        async with app.state.operation_lock:
            try:
                result = await app.state.team.reset_database(human_identity=session.identity)
                app.state.generation += 1
                return {**result, "generation": app.state.generation}
            except Exception as exc:
                raise HTTPException(409, redact(str(exc))) from exc

    return app


app = create_app()
