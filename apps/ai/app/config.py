from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """AI service environment (Appendix A). Each value is optional until the phase that uses it."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str | None = None
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None
    ai_service_hmac_secret: str | None = None
    llm_provider: Literal["anthropic", "openai"] = "anthropic"
    llm_api_key: str | None = None
    embedding_model: str | None = None
    judge0_url: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
