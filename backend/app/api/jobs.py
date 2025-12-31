"""
API endpoints for job management and status tracking.
"""

from fastapi import APIRouter, HTTPException
from typing import List
from app.jobs import job_queue, Job, JobStatus

router = APIRouter()


@router.get("/jobs", response_model=List[Job])
async def list_jobs(limit: int = 50):
    """List all jobs, most recent first."""
    return await job_queue.list_jobs(limit=limit)


@router.get("/jobs/{job_id}", response_model=Job)
async def get_job_status(job_id: str):
    """Get the status of a specific job."""
    job = await job_queue.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("/jobs/{job_id}/cancel")
async def cancel_job(job_id: str):
    """Cancel a running job."""
    job = await job_queue.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job.status not in [JobStatus.PENDING, JobStatus.RUNNING]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel job with status: {job.status}"
        )
    
    await job_queue.cancel_job(job_id)
    return {"message": "Job cancelled", "job_id": job_id}


@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    """Delete a job and its results."""
    job = await job_queue.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    await job_queue.delete_job(job_id)
    return {"message": "Job deleted", "job_id": job_id}


@router.get("/jobs/{job_id}/result")
async def get_job_result(job_id: str):
    """Get the result of a completed job."""
    job = await job_queue.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job.status != JobStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail=f"Job is not completed yet. Current status: {job.status}"
        )
    
    if not job.result:
        raise HTTPException(status_code=404, detail="Job result not found")
    
    return job.result


@router.post("/jobs/cleanup")
async def cleanup_old_jobs(days: int = 7):
    """Clean up jobs older than specified days."""
    await job_queue.cleanup_old_jobs(days=days)
    return {"message": f"Cleaned up jobs older than {days} days"}

