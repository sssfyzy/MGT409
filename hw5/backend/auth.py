"""Local operator sessions: possession of a private access code, cookie, and CSRF."""

from dataclasses import dataclass
import hmac
import secrets
import time
from fastapi import HTTPException, Request

COOKIE_NAME = "campus_hw5_operator"
ALLOWED_ORIGINS = {"http://localhost:8000", "http://127.0.0.1:8000",
                   "http://localhost:5173", "http://127.0.0.1:5173"}


@dataclass
class OperatorSession:
    identity: str
    csrf_token: str
    expires_at: float


class OperatorSessions:
    def __init__(self, access_key: str):
        if len(access_key) < 32:
            raise ValueError("Operator access key must have at least 32 characters")
        self.access_key = access_key
        self.sessions: dict[str, OperatorSession] = {}

    @staticmethod
    def check_origin(request: Request):
        if request.headers.get("origin") not in ALLOWED_ORIGINS | {None}:
            raise HTTPException(403, "This origin is not allowed to control the local shop")
        if request.headers.get("sec-fetch-site") == "cross-site":
            raise HTTPException(403, "Cross-site control request refused")

    def create(self, access_key: str, display_name: str) -> tuple[str, OperatorSession]:
        if not hmac.compare_digest(access_key, self.access_key):
            raise HTTPException(401, "Invalid operator access code")
        identity = display_name.strip()
        if not identity or identity.lower() in {
            "boss", "inventory", "accounting", "facilities", "customer service", "customer_service", "agent"
        }:
            raise HTTPException(422, "Use a human operator name")
        now = time.time()
        self.sessions = {k: v for k, v in self.sessions.items() if v.expires_at > now}
        session = OperatorSession(identity, secrets.token_urlsafe(32), now + 8 * 3600)
        token = secrets.token_urlsafe(48)
        self.sessions[token] = session
        return token, session

    def require(self, request: Request, *, mutation: bool = False) -> OperatorSession:
        token = request.cookies.get(COOKIE_NAME, "")
        session = self.sessions.get(token)
        if session is None or session.expires_at <= time.time():
            self.sessions.pop(token, None)
            raise HTTPException(401, "Connect as a human operator first")
        if mutation:
            self.check_origin(request)
            if not hmac.compare_digest(request.headers.get("x-csrf-token", ""), session.csrf_token):
                raise HTTPException(403, "Missing or invalid operator confirmation token")
        return session
