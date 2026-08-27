from __future__ import annotations

import argparse
import importlib.metadata
import inspect
import json
import os
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from deepagents import create_deep_agent
from langchain_openai import ChatOpenAI
from pydantic import SecretStr

from northlight.settings import get_settings


@dataclass(frozen=True)
class ProbeResult:
    python: str
    deepagents_version: str
    langchain_openai_version: str
    create_deep_agent_signature: str
    model: str
    base_url: str
    api_key_available: bool
    agent_constructed: bool
    live_tool_call: str
    error: str | None = None


def build_model() -> ChatOpenAI:
    settings = get_settings()
    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key:
        raise RuntimeError("DEEPSEEK_API_KEY is not available in the current process")
    return ChatOpenAI(
        model=settings.model_name,
        base_url=settings.model_base_url,
        api_key=SecretStr(api_key),
        temperature=0,
        streaming=True,
    )


def run_probe(live: bool) -> ProbeResult:
    settings = get_settings()
    signature = str(inspect.signature(create_deep_agent))
    api_key_available = bool(os.getenv("DEEPSEEK_API_KEY"))
    constructed = False
    live_status = "not_requested"
    error: str | None = None

    try:
        model = build_model()

        def add_numbers(a: int, b: int) -> int:
            """Add two integers."""
            return a + b

        agent = create_deep_agent(
            model=model,
            tools=[add_numbers],
            system_prompt=(
                "You are a runtime compatibility probe. Use add_numbers for arithmetic and "
                "return the tool result without extra claims."
            ),
        )
        constructed = agent is not None
        if live:
            result: dict[str, Any] = agent.invoke(
                {"messages": [{"role": "user", "content": "What is 19 + 23?"}]}
            )
            text = str(result.get("messages", [])[-1].content)
            if "42" not in text:
                raise RuntimeError("live agent response did not contain the expected tool result")
            live_status = "passed"
    except Exception as exc:  # probe must preserve the exact external failure
        error = f"{type(exc).__name__}: {exc}"
        if live:
            live_status = "failed"

    return ProbeResult(
        python=sys.version.split()[0],
        deepagents_version=importlib.metadata.version("deepagents"),
        langchain_openai_version=importlib.metadata.version("langchain-openai"),
        create_deep_agent_signature=signature,
        model=settings.model_name,
        base_url=settings.model_base_url,
        api_key_available=api_key_available,
        agent_constructed=constructed,
        live_tool_call=live_status,
        error=error,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Probe DeepSeek and Deep Agents compatibility")
    parser.add_argument("--live", action="store_true", help="Perform one real tool-calling request")
    parser.add_argument("--output", type=Path, help="Optional JSON evidence path")
    args = parser.parse_args()
    result = run_probe(args.live)
    payload = json.dumps(asdict(result), ensure_ascii=False, indent=2)
    print(payload)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(payload + "\n", encoding="utf-8")
    return 0 if result.agent_constructed and result.live_tool_call != "failed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
