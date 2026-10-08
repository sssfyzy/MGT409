"""Real localhost HTTP checks. No external model run, payment, reset, or resolution."""

from datetime import datetime, timezone
import hashlib
import json
import httpx
from backend.config import ROOT


def hashes():
    return {n: hashlib.sha256((ROOT / "data" / n).read_bytes()).hexdigest()
            for n in ("campus_customs.db", "campus_customs_new.db")}


def main():
    before = hashes()
    key = json.loads((ROOT / "data/operator_access.json").read_text(encoding="utf-8"))["access_key"]
    with httpx.Client(base_url="http://127.0.0.1:8000", timeout=15, trust_env=False) as client:
        health = client.get("/health"); health.raise_for_status()
        tickets = client.get("/tickets"); tickets.raise_for_status()
        cash_before = client.get("/cash"); cash_before.raise_for_status()
        connected = client.post("/session", json={"access_key": key,
                    "display_name": "P7 read-only verification"})
        connected.raise_for_status()
        headers = {"X-CSRF-Token": connected.json()["csrf_token"]}
        session = client.get("/session"); session.raise_for_status()
        pending = client.get("/payments/pending"); pending.raise_for_status()
        events = client.get("/events", params={"limit": 200})
        events.raise_for_status()
        cash_after = client.get("/cash"); cash_after.raise_for_status()
        client.delete("/session", headers=headers).raise_for_status()
    after = hashes()
    evidence = {"recorded_at_utc": datetime.now(timezone.utc).isoformat(),
                "source": "Real localhost HTTP server started with main:app from backend folder",
                "live_model_calls": 0, "health": health.json(), "tickets_before": tickets.json(),
                "cash_before": cash_before.json(), "cash_after": cash_after.json(),
                "operator_session_verified": session.json()["authenticated"],
                "pending_proposal_count": len(pending.json()["proposals"]),
                "event_count": len(events.json()["events"]),
                "database_hashes_before": before, "database_hashes_after": after,
                "passed": before == after and cash_before.json() == cash_after.json()
                          and session.json()["authenticated"]}
    (ROOT / "output/p7_http_smoke.json").write_text(json.dumps(evidence, indent=2), encoding="utf-8")
    print(json.dumps({"passed": evidence["passed"], "event_count": evidence["event_count"],
                      "live_model_calls": 0, "databases_unchanged": before == after}, indent=2))
    raise SystemExit(0 if evidence["passed"] else 1)


if __name__ == "__main__":
    main()
