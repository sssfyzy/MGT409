"""Append-only event history, preserving existing events with atomic replacement."""

from contextlib import contextmanager
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import tempfile
import threading
import time
from typing import Any

_LOCK = threading.RLock()


def redact(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): "[redacted]" if str(k).lower() in {
            "approval", "write_token", "authorization", "api_key", "secret"
        } else redact(v) for k, v in value.items()}
    if isinstance(value, (tuple, list)):
        return [redact(v) for v in value]
    if isinstance(value, str):
        for name in ("PORTKEY_API_KEY", "PORTKEY_VIRTUAL_KEY", "CAMPUS_APPROVAL_SECRET"):
            secret = os.getenv(name)
            if secret:
                value = value.replace(secret, "[redacted]")
        return value
    return value


@contextmanager
def _file_lock(path: Path):
    with path.open("a+b") as handle:
        handle.seek(0, 2)
        if handle.tell() == 0:
            handle.write(b"0")
            handle.flush()
        handle.seek(0)
        if os.name == "nt":
            import msvcrt
            msvcrt.locking(handle.fileno(), msvcrt.LK_LOCK, 1)
        else:
            import fcntl
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            handle.seek(0)
            if os.name == "nt":
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


class AuditTrail:
    def __init__(self, path: Path):
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)

    def append(self, *, run_id: str, ticket_id: int, agent: str, event: str,
               data: dict | None = None) -> None:
        with _LOCK, _file_lock(self.path.with_suffix(".json.lock")):
            events = json.loads(self.path.read_text(encoding="utf-8")) if self.path.exists() else []
            if not isinstance(events, list):
                raise ValueError("Existing audit trail must be a JSON array; refusing to overwrite it")
            events.append({"sequence": len(events) + 1,
                           "timestamp_utc": datetime.now(timezone.utc).isoformat(),
                           "run_id": run_id, "ticket_id": ticket_id, "agent": agent,
                           "event": event, "data": redact(data or {})})
            temporary = None
            try:
                with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=self.path.parent,
                                                 delete=False, suffix=".tmp") as handle:
                    temporary = Path(handle.name)
                    json.dump(events, handle, ensure_ascii=False, indent=2, allow_nan=False)
                    handle.flush()
                    os.fsync(handle.fileno())
                for attempt in range(6):
                    try:
                        os.replace(temporary, self.path)
                        break
                    except PermissionError:
                        if attempt == 5:
                            raise
                        # OneDrive/antivirus may briefly hold a just-written file.
                        time.sleep(0.05 * (attempt + 1))
            finally:
                if temporary is not None and temporary.exists():
                    temporary.unlink()
