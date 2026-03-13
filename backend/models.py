from pydantic import BaseModel
from typing import Optional, List

class ConversationTurn(BaseModel):
    role: str       # "user" | "assistant"
    content: str

class QueryRequest(BaseModel):
    prompt:  str
    history: List[ConversationTurn] = []

class ChatRequest(BaseModel):
    message: str
    history: List[ConversationTurn] = []

class ChartSpec(BaseModel):
    cannot_answer: bool          = False
    reason:        Optional[str] = None
    sql:           Optional[str] = None
    chart_type:    Optional[str] = None
    x_key:         Optional[str] = None
    y_key:         Optional[str] = None
    color_by:      Optional[str] = None
    title:         Optional[str] = None
    label:         Optional[str] = None
    approach:      Optional[str] = None
    insight:       Optional[str] = None

class DualChartOption(BaseModel):
    spec:    ChartSpec
    data:    list      = []
    raw_sql: Optional[str] = None
    error:   Optional[str] = None

class DualDashboardResponse(BaseModel):
    cannot_answer: bool               = False
    reason:        Optional[str]      = None
    option_a:      Optional[DualChartOption] = None
    option_b:      Optional[DualChartOption] = None

class ChatResponse(BaseModel):
    answer:        str
    supporting_sql: Optional[str] = None
    data_used:     list           = []
    cannot_answer: bool           = False
