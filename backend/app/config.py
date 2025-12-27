from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import os

# Get absolute path to .env file
_env_file_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")


class Settings(BaseSettings):
    """Application settings."""
    
    model_config = SettingsConfigDict(
        env_file=_env_file_path,
        env_file_encoding="utf-8",
        extra="ignore"
    )
    
    # API Settings
    app_name: str = "Video Understanding Comparisons API"
    debug: bool = True
    
    # CORS
    cors_origins: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    
    # Gemini API - REQUIRED: Must be set in .env file
    gemini_api_key: str
    
    # File Storage
    upload_dir: str = "./uploads"
    max_file_size: int = 500 * 1024 * 1024  # 500MB


# Debug: Check environment variable BEFORE loading settings
env_api_key = os.environ.get('GEMINI_API_KEY')
if env_api_key:
    masked_env = env_api_key[:10] + "..." + env_api_key[-4:] if len(env_api_key) > 14 else "***"
    print(f"[DEBUG] GEMINI_API_KEY found in environment: {masked_env}")
    print(f"[DEBUG] WARNING: Environment variable will OVERRIDE .env file!")
else:
    print(f"[DEBUG] GEMINI_API_KEY not in environment, will use .env file")

print(f"[DEBUG] Looking for .env at: {_env_file_path}")
print(f"[DEBUG] .env exists: {os.path.exists(_env_file_path)}")

# Read .env file directly to show what's in it
if os.path.exists(_env_file_path):
    with open(_env_file_path, 'r') as f:
        for line in f:
            if line.strip().startswith('GEMINI_API_KEY'):
                parts = line.strip().split('=', 1)
                if len(parts) == 2:
                    file_key = parts[1].strip().strip('"').strip("'")
                    masked_file = file_key[:10] + "..." + file_key[-4:] if len(file_key) > 14 else "***"
                    print(f"[DEBUG] .env file contains: GEMINI_API_KEY={masked_file} (length: {len(file_key)})")

settings = Settings()

# Validate API key is present
if not settings.gemini_api_key:
    raise ValueError(
        "GEMINI_API_KEY is not set! Please create a .env file in the backend directory "
        f"at: {_env_file_path}\n"
        "Add this line to the file: GEMINI_API_KEY=your_api_key_here"
    )

# Debug: Show masked API key to verify it loaded
masked_key = settings.gemini_api_key[:10] + "..." + settings.gemini_api_key[-4:] if len(settings.gemini_api_key) > 14 else "***"
print(f"[DEBUG] Final API key loaded by Settings: {masked_key} (length: {len(settings.gemini_api_key)})")
print(f"[DEBUG] Key starts with: {settings.gemini_api_key[:7]}")

# Create directories if they don't exist
os.makedirs(settings.upload_dir, exist_ok=True)

