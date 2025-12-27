from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import video, compare
from app.config import settings

app = FastAPI(
    title="Video Understanding Comparisons API",
    description="Compare video understanding across different Gemini models",
    version="0.1.0",
)

# Configure maximum request body size (for large video uploads)
app.state.max_body_size = settings.max_file_size

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(video.router, prefix="/api", tags=["video"])
app.include_router(compare.router, prefix="/api", tags=["compare"])


@app.get("/")
async def root():
    return {
        "name": "Video Understanding Comparisons API",
        "version": "0.1.0",
        "status": "running",
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}

