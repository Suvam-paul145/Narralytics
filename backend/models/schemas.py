from typing import Any

from pydantic import BaseModel, Field


class ConversationTurn(BaseModel):
    role: str
    content: str


class QueryRequest(BaseModel):
    prompt: str
    dataset_id: str
    output_count: int = Field(default=1, ge=1, le=2)
    history: list[ConversationTurn] = Field(default_factory=list)
    session_id: str | None = None


class ChatRequest(BaseModel):
    message: str
    dataset_id: str
    history: list[ConversationTurn] = Field(default_factory=list)
    session_id: str | None = None


class ChartSpec(BaseModel):
    chart_id: str | None = None
    label: str | None = None
    approach: str | None = None
    sql: str
    chart_type: str
    x_key: str
    y_key: str
    color_by: str | None = None
    title: str
    insight: str | None = None
    category: str | None = None


class ChartResult(BaseModel):
    spec: ChartSpec
    data: list[dict[str, Any]] = Field(default_factory=list)
    raw_sql: str | None = None
    error: str | None = None


class QueryResponse(BaseModel):
    cannot_answer: bool = False
    reason: str | None = None
    dataset_id: str | None = None
    output_count: int = 1
    options: list[ChartResult] = Field(default_factory=list)


class ChatResponse(BaseModel):
    answer: str
    supporting_sql: str | None = None
    data_used: list[dict[str, Any]] = Field(default_factory=list)
    cannot_answer: bool = False
    forecast: dict[str, Any] | None = None
    is_forecast: bool = False
    disclaimer: str | None = None
