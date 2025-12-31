# Migration Guide: Async Job System

## What Changed?

Your video comparison app now supports **background jobs** that won't fail when your screen locks or computer sleeps.

## Quick Summary

### Before ❌
- API calls blocked until completion (10-30 minutes)
- Timeouts if screen locked
- No progress updates
- Lost everything if connection dropped

### After ✅
- API returns immediately with job ID
- Jobs run in background
- Real-time progress updates
- Survives screen lock, sleep, app restarts
- Can check status anytime

## For Users

### Nothing Changed!
The UI works exactly the same - just click "Compare" or "Run Batch" as before.

### What's Better:
1. **Progress bar shows up** - You see 0-100% progress
2. **Lock screen safely** - Message tells you it's safe to lock
3. **No more timeouts** - Long videos and large batches work reliably

### How to Use:

1. Upload video(s) and enter prompt(s) as normal
2. Click "Compare" or "Run Batch Comparison"
3. You'll see a progress bar with percentage and status
4. **You can now safely lock your screen** 🎉
5. When you unlock, the progress will have continued
6. Results appear automatically when complete

## For Developers

### New Endpoints

```python
# Old (still works, but can timeout)
POST /api/compare
POST /api/batch-compare

# New (recommended for all long-running tasks)
POST /api/compare-async         # Returns job_id immediately
POST /api/batch-compare-async   # Returns job_id immediately

# Job management
GET  /api/jobs                  # List all jobs
GET  /api/jobs/{job_id}         # Get job status
GET  /api/jobs/{job_id}/result  # Get completed job result
POST /api/jobs/{job_id}/cancel  # Cancel running job
DELETE /api/jobs/{job_id}       # Delete job
POST /api/jobs/cleanup          # Clean up old jobs
```

### Example Usage

#### Python (using httpx)

```python
import httpx
import asyncio

async def run_comparison(video_id: str, prompt: str):
    async with httpx.AsyncClient() as client:
        # Start job
        response = await client.post(
            "http://localhost:8000/api/compare-async",
            json={
                "video_id": video_id,
                "prompt": prompt,
                "models": ["gemini-3-pro-preview"]
            }
        )
        job_id = response.json()["job_id"]
        
        # Poll for status
        while True:
            await asyncio.sleep(2)
            status = await client.get(f"http://localhost:8000/api/jobs/{job_id}")
            job = status.json()
            
            print(f"Progress: {job['progress']}% - {job['progress_message']}")
            
            if job['status'] == 'completed':
                result = await client.get(f"http://localhost:8000/api/jobs/{job_id}/result")
                return result.json()
            elif job['status'] == 'failed':
                raise Exception(job['error'])

# Run it
result = asyncio.run(run_comparison("video-id", "Analyze this video"))
```

#### JavaScript/TypeScript (in browser)

```typescript
async function runComparison(videoId: string, prompt: string) {
  // Start job
  const response = await fetch('http://localhost:8000/api/compare-async', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      video_id: videoId,
      prompt: prompt,
      models: ['gemini-3-pro-preview']
    })
  })
  
  const { job_id } = await response.json()
  
  // Poll for status
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      const statusResponse = await fetch(`http://localhost:8000/api/jobs/${job_id}`)
      const job = await statusResponse.json()
      
      console.log(`Progress: ${job.progress}% - ${job.progress_message}`)
      
      if (job.status === 'completed') {
        clearInterval(interval)
        const resultResponse = await fetch(`http://localhost:8000/api/jobs/${job_id}/result`)
        resolve(await resultResponse.json())
      } else if (job.status === 'failed') {
        clearInterval(interval)
        reject(new Error(job.error))
      }
    }, 2000) // Poll every 2 seconds
  })
}
```

#### cURL

```bash
# Start job
JOB_ID=$(curl -X POST http://localhost:8000/api/compare-async \
  -H "Content-Type: application/json" \
  -d '{
    "video_id": "your-video-id",
    "prompt": "Analyze this video",
    "models": ["gemini-3-flash-preview"]
  }' | jq -r '.job_id')

echo "Job ID: $JOB_ID"

# Check status (run multiple times)
curl http://localhost:8000/api/jobs/$JOB_ID | jq '.status, .progress, .progress_message'

# Get result when completed
curl http://localhost:8000/api/jobs/$JOB_ID/result | jq
```

### Testing

Use the included test script:

```bash
cd backend

# Test single comparison
python test_async_jobs.py <video_id>

# Test batch comparison  
python test_async_jobs.py --batch <video_id1> <video_id2>

# List all jobs
python test_async_jobs.py --list
```

### Job Lifecycle

```
1. Client calls /api/compare-async
   ↓
2. Server creates job, returns job_id immediately
   ↓
3. Server starts background task
   ↓
4. Client polls /api/jobs/{job_id} every 2 seconds
   ↓
5. Job updates progress: 0% → 10% → 20% → ... → 100%
   ↓
6. Job completes, result stored in job.result
   ↓
7. Client retrieves result from /api/jobs/{job_id}/result
   ↓
8. (Optional) Client deletes job to clean up
```

## Migration Checklist

### Backend Changes ✅
- [x] Created `app/jobs.py` - Job queue system
- [x] Created `app/api/jobs.py` - Job API endpoints
- [x] Updated `app/api/compare.py` - Added async endpoints
- [x] Updated `app/main.py` - Registered job routes
- [x] Jobs persist to `./jobs/` directory

### Frontend Changes ✅
- [x] Added job polling logic
- [x] Updated UI to show progress bar
- [x] Added progress percentage and message
- [x] Added helpful "safe to lock screen" message
- [x] Automatic result retrieval on completion

### No Breaking Changes ✅
- Old endpoints (`/api/compare`, `/api/batch-compare`) still work
- Existing functionality unchanged
- Only additions, no removals

## Recommended Next Steps

1. **Test the new system** with a few videos
2. **Lock your screen** during a comparison to verify it works
3. **Check the jobs directory** to see persisted job files
4. **Try the test script** to understand the API

## Architecture

```
┌──────────────┐
│   Frontend   │
│  (Next.js)   │
└──────┬───────┘
       │ POST /api/compare-async
       ↓
┌──────────────────────────┐
│   FastAPI Backend        │
│                          │
│  ┌────────────────────┐ │
│  │ Job Queue          │ │
│  │ - Create job       │ │
│  │ - Return job_id    │ │
│  └────────────────────┘ │
│                          │
│  ┌────────────────────┐ │
│  │ Background Worker  │ │
│  │ - Run comparison   │ │
│  │ - Update progress  │ │
│  │ - Store result     │ │
│  └────────────────────┘ │
└──────────────────────────┘
       │
       ↓
   ./jobs/
   ├── job1.json (status, progress, result)
   ├── job2.json
   └── ...
```

## Troubleshooting

**Q: My job is stuck at 20%**
A: Check backend logs. The job might be waiting on API response from Gemini.

**Q: I restarted the backend, what happens to running jobs?**
A: Jobs are saved to disk. The job will resume, but the background task needs to be restarted manually or will auto-restart on next server start.

**Q: Can I run multiple jobs at once?**
A: Yes! The system handles concurrent jobs. Each runs independently.

**Q: How do I clean up old jobs?**
A: Use `POST /api/jobs/cleanup?days=7` to delete jobs older than 7 days.

**Q: The frontend still uses sync endpoints**
A: No, it was updated to use async endpoints. Check `page.tsx` - it calls `-async` endpoints.

## Files Modified

```
backend/
├── app/
│   ├── jobs.py              (NEW - Job queue system)
│   ├── api/
│   │   ├── jobs.py          (NEW - Job API endpoints)
│   │   ├── compare.py       (MODIFIED - Added async endpoints)
│   │   └── main.py          (MODIFIED - Added job routes)
│   └── ...
├── jobs/                    (NEW - Auto-created directory)
├── test_async_jobs.py       (NEW - Test script)
└── ...

frontend/
└── src/app/page.tsx         (MODIFIED - Added polling logic)

Documentation:
├── BACKGROUND_JOBS.md       (NEW - Detailed docs)
├── MIGRATION_GUIDE.md       (NEW - This file)
└── README.md                (MODIFIED - Added note about new feature)
```

## Support

For issues or questions:
1. Check logs: Backend should show job progress in console
2. Check job files: `ls -la backend/jobs/`
3. Use test script: `python test_async_jobs.py --list`
4. Review [BACKGROUND_JOBS.md](./BACKGROUND_JOBS.md) for details

