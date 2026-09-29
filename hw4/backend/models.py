"""Request and response shapes for the shopping chat API."""

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    page_path: str = Field(default="/", max_length=200)
    product_id: str | None = Field(default=None, max_length=100)


class AgentReply(BaseModel):
    """Structured decision from the model; IDs are checked against SQLite."""

    message: str
    product_ids: list[str]


class ChatProduct(BaseModel):
    product_id: str
    name: str
    price: float
    image_url: str
    description: str
    product_url: str


class ChatResponse(BaseModel):
    message: str
    products: list[ChatProduct]


class ChatHistoryMessage(BaseModel):
    role: str
    text: str
    products: list[ChatProduct]


class ChatHistoryResponse(BaseModel):
    messages: list[ChatHistoryMessage]
