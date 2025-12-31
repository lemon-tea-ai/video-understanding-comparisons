"""
Background job queue system for long-running video comparison tasks.
Supports persistence so jobs continue even if the screen locks or computer sleeps.
"""

import json
import os
import asyncio
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, List
from pathlib import Path
from pydantic import BaseModel
import uuid


class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class JobType(str, Enum):
    SINGLE_COMPARE = "single_compare"
    BATCH_COMPARE = "batch_compare"


class Job(BaseModel):
    job_id: str
    job_type: JobType
    status: JobStatus
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    progress: int = 0  # 0-100
    progress_message: Optional[str] = None
    request_data: Dict[str, Any]
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class JobQueue:
    """
    Simple file-based job queue with persistence.
    Jobs are stored as JSON files so they survive app restarts.
    """
    
    def __init__(self, storage_dir: str = "./jobs"):
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(exist_ok=True)
        self._running_tasks: Dict[str, asyncio.Task] = {}
        self._lock = asyncio.Lock()
    
    def _get_job_path(self, job_id: str) -> Path:
        """Get the file path for a job."""
        return self.storage_dir / f"{job_id}.json"
    
    async def create_job(self, job_type: JobType, request_data: Dict[str, Any]) -> str:
        """Create a new job and return its ID."""
        job_id = str(uuid.uuid4())
        job = Job(
            job_id=job_id,
            job_type=job_type,
            status=JobStatus.PENDING,
            created_at=datetime.utcnow().isoformat(),
            request_data=request_data
        )
        
        async with self._lock:
            # Save to disk with immediate flush
            with open(self._get_job_path(job_id), 'w') as f:
                json.dump(job.model_dump(), f, indent=2)
                f.flush()  # Force write to disk immediately
                os.fsync(f.fileno())  # Ensure OS writes to disk
        
        return job_id
    
    async def get_job(self, job_id: str) -> Optional[Job]:
        """Get a job by ID."""
        job_path = self._get_job_path(job_id)
        if not job_path.exists():
            return None
        
        async with self._lock:
            with open(job_path, 'r') as f:
                data = json.load(f)
                return Job(**data)
    
    async def update_job(
        self,
        job_id: str,
        status: Optional[JobStatus] = None,
        progress: Optional[int] = None,
        progress_message: Optional[str] = None,
        result: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None
    ):
        """Update job status and data."""
        job = await self.get_job(job_id)
        if not job:
            return
        
        if status:
            job.status = status
            if status == JobStatus.RUNNING and not job.started_at:
                job.started_at = datetime.utcnow().isoformat()
            elif status in [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED]:
                job.completed_at = datetime.utcnow().isoformat()
        
        if progress is not None:
            job.progress = progress
        
        if progress_message is not None:
            job.progress_message = progress_message
        
        if result is not None:
            job.result = result
        
        if error is not None:
            job.error = error
        
        async with self._lock:
            with open(self._get_job_path(job_id), 'w') as f:
                json.dump(job.model_dump(), f, indent=2)
                f.flush()  # Force write to disk immediately
                os.fsync(f.fileno())  # Ensure OS writes to disk
    
    async def list_jobs(self, limit: int = 50) -> List[Job]:
        """List all jobs, most recent first."""
        jobs = []
        
        async with self._lock:
            job_files = sorted(
                self.storage_dir.glob("*.json"),
                key=lambda p: p.stat().st_mtime,
                reverse=True
            )
            
            for job_file in job_files[:limit]:
                with open(job_file, 'r') as f:
                    data = json.load(f)
                    jobs.append(Job(**data))
        
        return jobs
    
    async def delete_job(self, job_id: str):
        """Delete a job."""
        job_path = self._get_job_path(job_id)
        async with self._lock:
            if job_path.exists():
                job_path.unlink()
    
    def start_background_task(self, job_id: str, coroutine):
        """Start a background task for a job."""
        task = asyncio.create_task(coroutine)
        self._running_tasks[job_id] = task
        
        # Clean up task reference when done
        def cleanup(t):
            self._running_tasks.pop(job_id, None)
        
        task.add_done_callback(cleanup)
        return task
    
    async def cancel_job(self, job_id: str):
        """Cancel a running job."""
        if job_id in self._running_tasks:
            self._running_tasks[job_id].cancel()
        
        await self.update_job(job_id, status=JobStatus.CANCELLED)
    
    async def cleanup_old_jobs(self, days: int = 7):
        """Delete jobs older than specified days."""
        from datetime import timedelta
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        jobs = await self.list_jobs(limit=1000)
        for job in jobs:
            created = datetime.fromisoformat(job.created_at)
            if created < cutoff:
                await self.delete_job(job.job_id)


# Global job queue instance
job_queue = JobQueue()

