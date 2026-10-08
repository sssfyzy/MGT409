"""Portkey-only production model; never fall back to another provider/model."""

import os
from pathlib import Path
from dotenv import load_dotenv
from openai import AsyncOpenAI
from pydantic_ai.models.openai import OpenAIResponsesModel
from pydantic_ai.providers.openai import OpenAIProvider

ROOT = Path(__file__).resolve().parents[1]
MODEL_NAME = "gpt-6-luna"


def build_model() -> OpenAIResponsesModel:
    load_dotenv(ROOT / ".env", override=False)
    key = os.getenv("PORTKEY_API_KEY")
    if not key:
        raise RuntimeError("PORTKEY_API_KEY is required; set it locally, not in code")
    base_url = os.getenv("PORTKEY_BASE_URL", "https://api.portkey.ai/v1")
    if not base_url.startswith("https://api.portkey.ai/"):
        raise RuntimeError("This homework requires the Portkey HTTPS gateway")
    headers = {"x-portkey-api-key": key}
    if os.getenv("PORTKEY_VIRTUAL_KEY"):
        headers["x-portkey-virtual-key"] = os.environ["PORTKEY_VIRTUAL_KEY"]
    else:
        headers["x-portkey-provider"] = os.getenv("PORTKEY_PROVIDER", "openai")
    client = AsyncOpenAI(api_key=key, base_url=base_url, default_headers=headers,
                         timeout=35, max_retries=0)
    return OpenAIResponsesModel(MODEL_NAME, provider=OpenAIProvider(openai_client=client))
