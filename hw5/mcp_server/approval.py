"""Signed capabilities, not model-provided approval flags. No database access."""

import base64
import hashlib
import hmac
import json
import time
from typing import Any


def canonical(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()


def sign_capability(payload: dict, secret: str, lifetime: int = 300) -> str:
    if len(secret) < 32:
        raise ValueError("A private approval secret of at least 32 characters is required")
    body = canonical({**payload, "expires_at": int(time.time()) + lifetime})
    encoded = base64.urlsafe_b64encode(body).decode()
    signature = hmac.new(secret.encode(), encoded.encode(), hashlib.sha256).hexdigest()
    return encoded + "." + signature


def verify_capability(token: str, secret: str, purpose: str) -> dict:
    if len(secret) < 32:
        raise ValueError("Approval execution is disabled without a private approval secret")
    try:
        encoded, signature = token.split(".", 1)
        expected = hmac.new(secret.encode(), encoded.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise ValueError("Invalid approval signature")
        payload = json.loads(base64.urlsafe_b64decode(encoded))
        if payload["purpose"] != purpose or payload["expires_at"] < time.time():
            raise ValueError("Wrong-purpose or expired approval")
        return payload
    except (KeyError, TypeError, UnicodeError, json.JSONDecodeError) as exc:
        raise ValueError("Malformed approval") from exc


def issue_payment_approval(proposal: dict, approved_by: str, secret: str,
                           *, confirmed_assumptions: bool = False) -> str:
    """Trusted human-route helper only. Never register this as an agent tool.

    A later authenticated route must establish the human click before calling
    this helper. Merely invoking this function does not establish human intent.
    """
    if not approved_by.strip() or approved_by.lower() in {
        "boss", "inventory", "accounting", "facilities", "customer_service", "agent"
    }:
        raise ValueError("An identified human approver is required")
    if not proposal.get("ready_for_approval"):
        raise ValueError("This proposal has unresolved payment blockers")
    if proposal.get("assumptions") and not confirmed_assumptions:
        raise ValueError("The human must explicitly confirm purchase assumptions")
    return sign_capability({"purpose": "payment", "action": proposal["action"],
                            "approved_by": approved_by.strip(),
                            "confirmed_assumptions": confirmed_assumptions}, secret)
