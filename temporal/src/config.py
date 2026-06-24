from __future__ import annotations
from pydantic import Field
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    temporal_address: str = Field("temporal:7233", env="TEMPORAL_ADDRESS")
    temporal_namespace: str = Field("default", env="TEMPORAL_NAMESPACE")
    temporal_task_queue: str = Field("main", env="TEMPORAL_TASK_QUEUE")
    supabase_url: str = Field("http://supabase:8000", env="SUPABASE_URL")
    supabase_service_role_key: str = Field("dev-service-role-key", env="SUPABASE_SERVICE_ROLE_KEY")

    # Direct Postgres connection to the Supabase database (used by game activities).
    supabase_db_host: str = Field("supabase-db", env="SUPABASE_DB_HOST")
    supabase_db_port: int = Field(5432, env="SUPABASE_DB_PORT")
    supabase_db_user: str = Field("supabase", env="SUPABASE_DB_USER")
    supabase_db_password: str = Field("supabase", env="SUPABASE_DB_PASSWORD")
    supabase_db_name: str = Field("supabase", env="SUPABASE_DB_NAME")

    class Config:
        case_sensitive = False

settings = Settings()
