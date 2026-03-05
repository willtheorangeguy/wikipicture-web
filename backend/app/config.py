import json
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    redis_url: str = "redis://redis:6379/0"
    # Store as plain str to avoid pydantic-settings trying to json.loads() it.
    # Accepts either a comma-separated string or a JSON array string.
    allowed_origins: str = "http://localhost:3000,http://localhost"
    max_photos_per_upload: int = 50
    max_upload_bytes: int = 100 * 1024 * 1024  # 100MB
    rate_limit_uploads_per_hour: int = 5
    rate_limit_photos_per_day: int = 100
    job_ttl_seconds: int = 3600  # 1 hour
    temp_dir: str = "/tmp/wikipicture"
    environment: str = "production"

    @property
    def allowed_origins_list(self) -> list[str]:
        v = self.allowed_origins.strip()
        if v.startswith("["):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                pass
        return [origin.strip() for origin in v.split(",") if origin.strip()]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
