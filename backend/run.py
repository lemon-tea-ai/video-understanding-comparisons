#!/usr/bin/env python3
"""
Uvicorn server runner with hardcoded settings for large video uploads.
Run this instead of using uvicorn command directly.
"""
import uvicorn
from app.config import settings

if __name__ == "__main__":
    # Configure uvicorn with settings optimized for large video uploads and long-running analysis
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # Auto-reload on code changes (disable in production)
        
        # CRITICAL: Set maximum request body size to match our app config (500MB)
        limit_max_requests=settings.max_file_size,
        
        # CRITICAL: Increase timeout for long-running video analysis
        # Note: For very long requests, the timeout is primarily controlled by the client
        # and the individual API call timeouts (Gemini SDK has its own timeout handling)
        timeout_keep_alive=120,  # Keep connection alive for 2 minutes between requests
        
        # Optional: Configure logging
        log_level="info",
    )
    
    # For production, use these settings instead:
    # uvicorn.run(
    #     "app.main:app",
    #     host="0.0.0.0",
    #     port=8000,
    #     workers=4,  # Multiple worker processes
    #     limit_max_requests=settings.max_file_size,
    #     timeout_keep_alive=120,
    #     log_level="info",
    # )

