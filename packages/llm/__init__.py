from __future__ import annotations
"""
CueBI — LLM Router
Returns the right LLM provider based on user/org preference.
Falls back gracefully if a key is missing.
"""

from typing import Optional
from .base import BaseLLMProvider


def get_llm_provider(
    provider: str = "openai",
    api_key: Optional[str] = None,
) -> BaseLLMProvider:
    """
    Returns an initialized LLM provider.

    Args:
        provider: 'openai' | 'anthropic'
        api_key: User's own API key (BYOK). Falls back to env var.

    Raises:
        ValueError: if provider is unknown or no API key found.
    """
    if provider == "openai":
        from .openai_provider import OpenAIProvider
        return OpenAIProvider(api_key=api_key)

    elif provider == "anthropic":
        from .anthropic_provider import AnthropicProvider
        return AnthropicProvider(api_key=api_key)

    else:
        raise ValueError(
            f"Unknown LLM provider '{provider}'. "
            f"Supported: 'openai', 'anthropic'"
        )


__all__ = ["get_llm_provider", "BaseLLMProvider"]