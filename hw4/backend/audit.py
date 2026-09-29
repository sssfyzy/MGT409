"""Privacy-conscious, logically append-only JSON audit of shopping-agent runs."""

import json
import re
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from pydantic_ai.messages import ModelMessage, ModelRequest, ModelResponse, ToolCallPart, ToolReturnPart


AUDIT_PATH = Path(__file__).resolve().parent.parent / "output" / "audit_trail.json"
_write_lock = threading.Lock()
_ARG_KEYS = {"product_id", "query", "size", "max_price", "strictly_under", "limit", "garment_type"}
_RESULT_KEYS = {
    "product_id", "name", "price", "size", "quantity", "size_listed",
    "color_specific_stock_known", "product_count", "result_limit", "found", "error",
}


def _time(value: datetime | None = None) -> str:
    return (value or datetime.now(timezone.utc)).isoformat()


def _short_text(value: Any, limit: int = 100) -> str:
    text = str(value)
    text = re.sub(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", "[email redacted]", text)
    text = re.sub(r"\b(?:sk|pk)-[A-Za-z0-9_-]{8,}\b", "[key redacted]", text)
    return text[:limit] + ("…" if len(text) > limit else "")


def short_args(args: dict[str, Any]) -> dict[str, Any]:
    """Keep useful product-search parameters; never log account or full-message data."""
    return {
        key: _short_text(value) if isinstance(value, str) else value
        for key, value in args.items() if key in _ARG_KEYS and isinstance(value, (str, int, float, bool))
    }


def short_result(value: Any) -> dict[str, Any]:
    """Summarize a tool result without copying descriptions or shopper information."""
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (TypeError, ValueError):
            return {"result_type": "text", "characters": len(value)}
    if not isinstance(value, dict):
        return {"result_type": type(value).__name__}
    result = {
        key: _short_text(item) if isinstance(item, str) else item
        for key, item in value.items()
        if key in _RESULT_KEYS and isinstance(item, (str, int, float, bool))
    }
    products = value.get("products")
    if isinstance(products, list):
        result["match_count"] = len(products)
        result["product_ids"] = [
            _short_text(item["product_id"], 100) for item in products[:6]
            if isinstance(item, dict) and isinstance(item.get("product_id"), str)
        ]
    alternatives = value.get("alternatives")
    if isinstance(alternatives, list):
        result["alternative_count"] = len(alternatives)
        result["alternative_product_ids"] = [
            _short_text(item["product_id"], 100) for item in alternatives[:6]
            if isinstance(item, dict) and isinstance(item.get("product_id"), str)
        ]
    stock = value.get("size_stock")
    if isinstance(stock, list):
        result["size_rows"] = len(stock)
    types = value.get("garment_types")
    if isinstance(types, list):
        result["garment_type_count"] = len(types)
    return result


def append_events(events: list[dict[str, Any]]) -> None:
    """Append records to a valid JSON array; refuse to erase a malformed prior log."""
    if not events:
        return
    AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _write_lock:
        if AUDIT_PATH.exists():
            previous = json.loads(AUDIT_PATH.read_text(encoding="utf-8"))
            if not isinstance(previous, list):
                raise ValueError("Existing audit trail must be a JSON array")
        else:
            previous = []
        previous.extend(events)
        AUDIT_PATH.write_text(
            json.dumps(previous, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )


def log_run(
    messages: list[ModelMessage], *, stop_reason: str,
    product_ids: list[str] | None = None, model_finish_reason: str | None = None,
    error_type: str | None = None,
) -> None:
    """Record completed tool calls plus the run's final stop reason."""
    run_id = uuid4().hex
    pending: list[tuple[ToolCallPart, datetime | None]] = []
    events: list[dict[str, Any]] = []
    for message in messages:
        if isinstance(message, ModelResponse):
            for part in message.parts:
                if isinstance(part, ToolCallPart):
                    pending.append((part, message.timestamp))
        elif isinstance(message, ModelRequest):
            for part in message.parts:
                if not isinstance(part, ToolReturnPart):
                    continue
                match = next((i for i, (call, _) in enumerate(pending)
                              if call.tool_call_id == part.tool_call_id
                              and call.tool_name == part.tool_name), None)
                if match is None:
                    continue
                call, called_at = pending.pop(match)
                try:
                    arguments = call.args_as_dict()
                except (TypeError, ValueError):
                    arguments = {}
                events.append({
                    "time": _time(part.timestamp or called_at),
                    "run_id": run_id,
                    "event": "tool_call",
                    "tool_name": call.tool_name,
                    "tool_kind": call.tool_kind or ("output" if call.tool_name == "final_result" else "function"),
                    "args": short_args(arguments),
                    "result": short_result(part.content),
                    "stop_reason": "continue",
                })
    for call, called_at in pending:
        try:
            arguments = call.args_as_dict()
        except (TypeError, ValueError):
            arguments = {}
        events.append({
            "time": _time(called_at), "run_id": run_id, "event": "tool_call",
            "tool_name": call.tool_name,
            "tool_kind": call.tool_kind or ("output" if call.tool_name == "final_result" else "function"),
            "args": short_args(arguments),
            "result": {"status": "no_return_recorded"}, "stop_reason": "interrupted",
        })
    result: dict[str, Any] = {"product_ids": (product_ids or [])[:6]}
    if model_finish_reason:
        result["model_finish_reason"] = _short_text(model_finish_reason, 40)
    if error_type:
        result["error_type"] = _short_text(error_type, 80)
    events.append({
        "time": _time(), "run_id": run_id, "event": "run_stop",
        "tool_name": None, "args": {}, "result": result,
        "stop_reason": stop_reason,
    })
    append_events(events)


def log_shortcut(
    *, tool_name: str, args: dict[str, Any], result: dict[str, Any],
    product_ids: list[str],
) -> None:
    """Log the verified SQL shortcut, which does not enter the model loop."""
    run_id = uuid4().hex
    append_events([
        {
            "time": _time(), "run_id": run_id, "event": "tool_call",
            "tool_name": tool_name, "tool_kind": "function",
            "args": short_args(args),
            "result": short_result(result), "stop_reason": "continue",
        },
        {
            "time": _time(), "run_id": run_id, "event": "run_stop",
            "tool_name": None, "args": {},
            "result": {"product_ids": product_ids[:6]},
            "stop_reason": "verified_sql_shortcut",
        },
    ])
