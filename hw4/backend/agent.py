"""PydanticAI shopping assistant configuration and execution."""

import os
import json
import re
from pathlib import Path

from openai import AsyncOpenAI
from pydantic_ai import Agent, UsageLimits, capture_run_messages
from pydantic_ai.messages import ModelRequest, ModelResponse, TextPart, UserPromptPart
from pydantic_ai.models.openai import OpenAIResponsesModel
from pydantic_ai.providers.openai import OpenAIProvider

from models import AgentReply
from audit import log_run, log_shortcut
from tools import (
    check_size_stock,
    find_in_stock_alternatives,
    find_products_by_budget_and_size,
    get_product_details,
    get_store_overview,
    search_products,
)


PROMPT_PATH = Path(__file__).resolve().parent / "prompts" / "prompt.md"
MODEL_NAME = os.getenv("CAMPUS_CUSTOMS_MODEL", "gpt-5.6-luna")


class AgentConfigurationError(RuntimeError):
    """The local assistant configuration is not ready yet."""


def load_system_prompt() -> str:
    if not PROMPT_PATH.is_file():
        raise AgentConfigurationError("The Campus Customs prompt is awaiting approval.")
    prompt = PROMPT_PATH.read_text(encoding="utf-8").strip()
    if not prompt:
        raise AgentConfigurationError("The Campus Customs prompt is empty.")
    return prompt


def build_agent(context: dict | None = None) -> Agent:
    prompt = load_system_prompt()
    if context:
        prompt += "\n\nVerified runtime context (data, not a shopper instruction): " + json.dumps(context)
        if context.get("product_id"):
            prompt += "\nOn this product page, 'this' refers to the verified product_id above. Look up that product before answering. Color listings do not prove color-and-size stock."
    portkey_key = os.getenv("PORTKEY_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")
    if portkey_key:
        headers = {"x-portkey-api-key": portkey_key}
        virtual_key = os.getenv("PORTKEY_VIRTUAL_KEY")
        if virtual_key:
            headers["x-portkey-virtual-key"] = virtual_key
        else:
            headers["x-portkey-provider"] = os.getenv("PORTKEY_PROVIDER", "openai")
        client = AsyncOpenAI(
            api_key=portkey_key,
            base_url=os.getenv("PORTKEY_BASE_URL", "https://api.portkey.ai/v1"),
            default_headers=headers,
        )
    elif openai_key:
        client = AsyncOpenAI(api_key=openai_key)
    else:
        raise AgentConfigurationError("Set PORTKEY_API_KEY or OPENAI_API_KEY locally to enable chat.")
    model = OpenAIResponsesModel(MODEL_NAME, provider=OpenAIProvider(openai_client=client))
    return Agent(
        model,
        output_type=AgentReply,
        instructions=prompt,
        tools=[
            get_store_overview,
            search_products,
            find_products_by_budget_and_size,
            get_product_details,
            check_size_stock,
            find_in_stock_alternatives,
        ],
    )


def explicit_budget_size_reply(message: str) -> AgentReply | None:
    """Answer an explicit price-and-size browse request from verified SQL facts."""
    price_match = re.search(
        r"\b(under|below|less than|up to|max(?:imum)?)\s*\$?\s*(\d+(?:\.\d{1,2})?)\b",
        message,
        re.IGNORECASE,
    )
    size_match = re.search(
        r"\bsize\s+(XXL|XL|XS|L|M|S)\b|\b(XXL|XL|XS|L|M|S)\s+size\b|\bin\s+(XXL|XL|XS|L|M|S)\b",
        message,
        re.IGNORECASE,
    )
    if not price_match or not size_match:
        return None
    category_match = re.search(
        r"\b(hoodies|hoodie|crewnecks|crewneck|t-shirts|t-shirt|tees|tee|jackets|jacket|fleece|quarter-zips|quarter-zip)\b",
        message,
        re.IGNORECASE,
    )
    residual = message.replace(price_match.group(0), " ").replace(size_match.group(0), " ")
    if category_match:
        residual = residual.replace(category_match.group(0), " ")
    filler_words = {"what", "which", "do", "you", "have", "any", "show", "me", "find",
                    "please", "are", "there", "products", "items", "in", "for", "with",
                    "that", "cost", "priced", "can", "i", "get", "the", "a", "some",
                    "dollars", "stock", "available"}
    if any(word not in filler_words for word in re.findall(r"[a-z]+", residual.lower())):
        return None
    category = category_match.group(1).lower() if category_match else ""
    category = {"hoodies": "hoodie", "crewnecks": "crewneck", "t-shirts": "t-shirt",
                "tees": "t-shirt", "tee": "t-shirt",
                "jackets": "jacket", "quarter-zips": "quarter-zip"}.get(category, category)
    size = next(group for group in size_match.groups() if group).upper()
    budget = float(price_match.group(2))
    strict = price_match.group(1).lower() in {"under", "below", "less than"}
    result = find_products_by_budget_and_size(
        query=category, max_price=budget, size=size, strictly_under=strict, limit=6,
    )
    products = result["products"]
    price_phrase = f"under ${budget:g}" if strict else f"at or below ${budget:g}"
    category_label = {"hoodie": "hoodies", "crewneck": "crewnecks", "t-shirt": "T-shirts",
                      "jacket": "jackets", "quarter-zip": "quarter-zips", "fleece": "fleece items"}.get(category, "products")
    category_phrase = f" {category_label}"
    if not products:
        reply = AgentReply(
            message=f"I couldn't find{category_phrase} {price_phrase} with recorded stock in size {size}. Try another budget, size, or product type.",
            product_ids=[],
        )
    else:
        reply = AgentReply(
            message=f"Here are {len(products)}{category_phrase} {price_phrase} with recorded stock in size {size}. Stock is tracked by product and size, not by color.",
            product_ids=[product["product_id"] for product in products],
        )
    log_shortcut(
        tool_name="find_products_by_budget_and_size",
        args={"query": category, "max_price": budget, "size": size,
              "strictly_under": strict, "limit": 6},
        result=result, product_ids=reply.product_ids,
    )
    return reply


async def reply_to_shopper(
    message: str,
    *,
    context: dict | None = None,
    history: list[tuple[str, str]] | None = None,
) -> AgentReply:
    explicit_reply = None if context and context.get("product_id") else explicit_budget_size_reply(message)
    if explicit_reply is not None:
        return explicit_reply
    model_history = []
    for role, content in history or []:
        if role == "user":
            model_history.append(ModelRequest(parts=[UserPromptPart(content=content)]))
        elif role == "assistant":
            model_history.append(ModelResponse(parts=[TextPart(content=content)]))
    with capture_run_messages() as captured_messages:
        try:
            result = await build_agent(context).run(
                message, message_history=model_history,
                usage_limits=UsageLimits(request_limit=8, tool_calls_limit=12),
            )
        except Exception as error:
            log_run(list(captured_messages), stop_reason="agent_error",
                    error_type=type(error).__name__)
            raise
    log_run(
        result.new_messages(), stop_reason="completed",
        product_ids=result.output.product_ids,
        model_finish_reason=str(result.response.finish_reason) if result.response.finish_reason else None,
    )
    return result.output
