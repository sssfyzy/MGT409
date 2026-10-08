"""Typed role reports, runtime limits, and the team's public result."""

from enum import Enum
from typing import Any, Literal
from pydantic import BaseModel, Field


class Role(str, Enum):
    BOSS = "boss"
    INVENTORY = "inventory"
    ACCOUNTING = "accounting"
    FACILITIES = "facilities"
    CUSTOMER_SERVICE = "customer_service"


class ExecutionLimits(BaseModel):
    model_requests: int = Field(default=18, ge=1, le=18)
    tool_calls: int = Field(default=30, ge=1, le=30)
    total_tokens: int = Field(default=35000, ge=1, le=35000)
    seconds: float = Field(default=120, gt=0, le=120)
    delegation_depth: int = Field(default=3, ge=0, le=3)


class AgentReport(BaseModel):
    summary: str = Field(max_length=1800)
    facts: list[str] = Field(default_factory=list, max_length=12)
    calculations: list[str] = Field(default_factory=list, max_length=8)
    uncertainties: list[str] = Field(default_factory=list, max_length=8)
    recommendation: str = Field(default="", max_length=1800)
    draft_message: str | None = Field(default=None, max_length=2400)
    proposed_actions: list[dict[str, Any]] = Field(default_factory=list, max_length=8)
    needs_human_decision: bool = False


class TeamResult(BaseModel):
    run_id: str
    ticket_id: int
    status: Literal["review_ready", "blocked", "error"]
    read_only: bool
    report: AgentReport | None = None
    agents_worked: list[Role] = Field(default_factory=list)
    contributions: list[dict[str, Any]] = Field(default_factory=list)
    payment_proposals: list[dict[str, Any]] = Field(default_factory=list)
    usage: dict[str, Any] = Field(default_factory=dict)
    error: str | None = None


class HumanApprovalRequest(BaseModel):
    """Future route payload; human identity must come from its trusted session."""
    action_id: str
    confirmed_assumptions: bool = False
