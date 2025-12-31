# Background Job System for Long-Running Tasks

## Problem Solved

Previously, long-running video comparisons would fail when:
- Your MacBook screen locks
- Your computer goes to sleep  
- Network connection is unstable
- The browser tab loses focus

## Solution

We've implemented a **background job queue system** that:

✅ Runs tasks in the background independently of HTTP requests  
✅ Survives screen locks and computer sleep  
✅ Persists job state to disk (survives app restarts)  
✅ Provides real-time progress updates  
✅ Allows you to check status at any time  
✅ Supports cancelling running jobs  

## How It Works

### Backend Architecture

1. **Job Queue (`app/jobs.py`)**: 
   - File-based persistence (jobs stored as JSON in `./jobs/` directory)
   - Each job has a unique ID, status, progress, and result
   - Jobs continue running even if the API server restarts

2. **Background Task Execution**:
   - Jobs run as async background tasks
   - Progress is updated throughout execution
   - Results are stored when complete

3. **New API Endpoints**:
   ```
   POST /api/compare-async          - Start single comparison (returns job ID)
   POST /api/batch-compare-async    - Start batch comparison (returns job ID)
   GET  /api/jobs/{job_id}           - Get job status and progress
   GET  /api/jobs/{job_id}/result    - Get completed job result
   POST /api/jobs/{job_id}/cancel    - Cancel a running job
   GET  /api/jobs                    - List all jobs
   DELETE /api/jobs/{job_id}         - Delete a job
   ```

### Frontend Changes

The frontend now:
1. Calls async endpoints that return immediately with a job ID
2. Polls the job status every 2 seconds
3. Displays a progress bar with percentage and status message
4. Automatically retrieves results when the job completes
5. Shows helpful message that screen can be safely locked

## Usage

### Single Video Comparison

```typescript
// Start the job
const response = await fetch('http://localhost:8000/api/compare-async', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    video_id: "your-video-id",
    prompt: "Analyze this video...",
    models: ["gemini-3-pro-preview", "gemini-2.5-flash"]
  })
})

const { job_id } = await response.json()

// Poll for status
const checkStatus = async () => {
  const statusResponse = await fetch(`http://localhost:8000/api/jobs/${job_id}`)
  const job = await statusResponse.json()
  
  console.log(`Progress: ${job.progress}% - ${job.progress_message}`)
  
  if (job.status === 'completed') {
    console.log('Result:', job.result)
  } else if (job.status === 'failed') {
    console.error('Error:', job.error)
  }
}

// Poll every 2 seconds
const interval = setInterval(checkStatus, 2000)
```

### Batch Comparison

```typescript
const response = await fetch('http://localhost:8000/api/batch-compare-async', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    video_ids: ["video-1", "video-2", "video-3"],
    prompts: ["Prompt 1", "Prompt 2"],
    models: ["gemini-3-pro-preview"]
  })
})

const { job_id } = await response.json()
// Then poll for status as above
```

## Job Status Flow

```
PENDING → RUNNING → COMPLETED
                  ↘ FAILED
                  ↘ CANCELLED
```

- **PENDING**: Job created, waiting to start
- **RUNNING**: Job is currently executing (0-100% progress)
- **COMPLETED**: Job finished successfully, result available
- **FAILED**: Job encountered an error
- **CANCELLED**: Job was manually cancelled

## File Structure

```
backend/
├── app/
│   ├── jobs.py              # Job queue system
│   ├── api/
│   │   ├── jobs.py          # Job API endpoints
│   │   └── compare.py       # Updated with async endpoints
│   └── main.py              # Registers job routes
├── jobs/                    # Job state files (created automatically)
│   ├── abc123...json        # Job data persisted as JSON
│   └── def456...json
└── uploads/                 # Video uploads

frontend/
└── src/app/page.tsx         # Updated with polling logic
```

## Benefits

### For Users
- ✅ Can lock screen during long comparisons
- ✅ Real-time progress updates
- ✅ No more timeout errors
- ✅ Can check on jobs later
- ✅ Multiple jobs can queue up

### For Developers  
- ✅ Clean separation of concerns
- ✅ Easy to add more job types
- ✅ Built-in persistence
- ✅ Simple REST API
- ✅ No external dependencies (no Redis/Celery needed)

## Configuration

Job files are stored in `./jobs/` directory by default. You can change this in `app/jobs.py`:

```python
job_queue = JobQueue(storage_dir="./custom-jobs-dir")
```

## Cleanup

Old completed jobs can be cleaned up:

```bash
curl -X POST http://localhost:8000/api/jobs/cleanup?days=7
```

This deletes jobs older than 7 days.

## Migration from Old Endpoints

The old synchronous endpoints still work:
- `POST /api/compare` - Synchronous (blocks until complete)
- `POST /api/batch-compare` - Synchronous (blocks until complete)

The new async endpoints are recommended for:
- Videos longer than 1 minute
- Batch operations with 3+ combinations
- Any scenario where reliability is important

## Troubleshooting

**Job stuck in RUNNING state?**
- Check backend logs for errors
- Restart the backend server (job will resume from disk)

**Job failed immediately?**
- Check that video exists: `GET /api/video/{video_id}`
- Verify API key is configured correctly
- Check backend logs for detailed error

**Progress not updating?**
- Jobs update progress at key milestones
- Some steps (like model API calls) may take time without progress updates

## Future Enhancements

Possible improvements:
- WebSocket support for real-time updates (instead of polling)
- Job priority queue
- Concurrent job execution limits
- Email notifications on completion
- Job scheduling
- Retry failed jobs

