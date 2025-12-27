from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import uuid
import os
import aiofiles

from app.config import settings

router = APIRouter()


class VideoMetadata(BaseModel):
    id: str
    filename: str
    size: int
    content_type: str
    path: str


# In-memory store for video metadata
video_store: dict[str, VideoMetadata] = {}


@router.post("/video/upload", response_model=VideoMetadata)
async def upload_video(file: UploadFile = File(...)):
    """Upload a video file for analysis."""
    
    # Validate file type
    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Please upload a video file."
        )
    
    # Generate unique ID
    video_id = str(uuid.uuid4())
    
    # Get file extension
    original_filename = file.filename or "video"
    ext = os.path.splitext(original_filename)[1] or ".mp4"
    
    # Create filename with ID
    filename = f"{video_id}{ext}"
    filepath = os.path.join(settings.upload_dir, filename)
    
    # Save file using streaming to handle large files efficiently
    total_size = 0
    chunk_size = 1024 * 1024  # 1MB chunks
    
    try:
        async with aiofiles.open(filepath, "wb") as f:
            while chunk := await file.read(chunk_size):
                total_size += len(chunk)
                
                # Check size limit while streaming
                if total_size > settings.max_file_size:
                    # Delete partial file
                    await f.close()
                    if os.path.exists(filepath):
                        os.remove(filepath)
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large. Maximum size is {settings.max_file_size // (1024*1024)}MB"
                    )
                
                await f.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        # Clean up partial file on error
        if os.path.exists(filepath):
            os.remove(filepath)
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # Create metadata
    metadata = VideoMetadata(
        id=video_id,
        filename=original_filename,
        size=total_size,
        content_type=file.content_type or "video/mp4",
        path=filepath,
    )
    
    # Store metadata
    video_store[video_id] = metadata
    
    return metadata


@router.get("/video/{video_id}")
async def get_video(video_id: str):
    """Get video file by ID."""
    
    if video_id not in video_store:
        raise HTTPException(status_code=404, detail="Video not found")
    
    metadata = video_store[video_id]
    
    if not os.path.exists(metadata.path):
        raise HTTPException(status_code=404, detail="Video file not found")
    
    return FileResponse(
        metadata.path,
        media_type=metadata.content_type,
        filename=metadata.filename,
    )


@router.get("/video/{video_id}/metadata", response_model=VideoMetadata)
async def get_video_metadata(video_id: str):
    """Get video metadata by ID."""
    
    if video_id not in video_store:
        raise HTTPException(status_code=404, detail="Video not found")
    
    return video_store[video_id]


def get_video_path(video_id: str) -> Optional[str]:
    """Get the file path for a video ID."""
    if video_id in video_store:
        return video_store[video_id].path
    return None

