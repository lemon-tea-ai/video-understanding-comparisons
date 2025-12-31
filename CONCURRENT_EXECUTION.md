# Concurrent Job Execution - How Multiple Jobs Work

## TL;DR

**🎯 Multiple jobs run CONCURRENTLY (in parallel), NOT in a queue!**

You can start 10 jobs, and they'll all process simultaneously. They don't wait for each other.

## Visual Explanation

### ✅ How It Actually Works (Concurrent)

```
Timeline: 14:00:00 ────────────────────────────► 14:00:30

Job 1: [████████████████████████████] 
Job 2: [████████████████████████████] ← Running at same time!
Job 3: [████████████████████████████] ← Running at same time!

Total time: ~30 seconds
```

All three jobs process simultaneously. They don't block each other.

### ❌ NOT How It Works (Would be a queue)

```
Timeline: 14:00:00 ─────────────────────────────────────────────────► 14:01:30

Job 1: [████████████████████████████] 
Job 2:                                [████████████████████████████] ← Waits!
Job 3:                                                              [████████] ← Waits!

Total time: ~90 seconds
```

This is NOT what happens. We don't have a queue.

## The Code That Makes It Concurrent

```python
# From backend/app/jobs.py

class JobQueue:
    def __init__(self):
        self._running_tasks: Dict[str, asyncio.Task] = {}  # Can hold MULTIPLE tasks
    
    def start_background_task(self, job_id: str, coroutine):
        """Start a background task for a job."""
        task = asyncio.create_task(coroutine)  # ← Creates concurrent task!
        self._running_tasks[job_id] = task      # ← Stores alongside other tasks
        return task
```

**Key:** `asyncio.create_task()` doesn't block. It starts the task and returns immediately, allowing the next job to start.

## Two Levels of Execution

### Level 1: Multiple Jobs (CONCURRENT ✅)

```python
# You can start jobs rapidly
job1 = start_job(video1, prompt1)  # Returns immediately
job2 = start_job(video2, prompt2)  # Returns immediately  
job3 = start_job(video3, prompt3)  # Returns immediately

# All 3 are now processing in parallel!
```

**Example:**
- User 1 starts a comparison at 14:00:00
- User 2 starts a batch job at 14:00:05
- User 3 starts another comparison at 14:00:10
- **All three jobs run simultaneously!**

### Level 2: Within ONE Batch Job (SEQUENTIAL)

```python
# Inside a single batch job
async def _run_batch_comparison_job(job_id, request_data):
    for video in videos:
        for prompt in prompts:
            # Process this combination (sequential)
            results = await process_combination(video, prompt)
            
            # But within this combination, models run in parallel!
            tasks = [run_model(m) for m in models]
            await asyncio.gather(*tasks)  # ← Parallel!
```

**Example:**
- Batch Job processes combos 1, 2, 3 sequentially
- But for combo 1, all 4 models analyze simultaneously
- This prevents overloading the Gemini API

## Real-World Scenarios

### Scenario 1: Multiple Users

```
User A starts: 5 videos × 3 prompts = 15 combos (Job #1)
User B starts: 2 videos × 2 prompts = 4 combos  (Job #2)
User C starts: 1 video  × 1 prompt  = 1 combo   (Job #3)

All three jobs run in parallel!

Progress at 14:05:00:
- Job #1: 40% (6/15 combos done)
- Job #2: 75% (3/4 combos done)
- Job #3: 100% (completed!)
```

### Scenario 2: Same User, Multiple Jobs

```
You start Job #1: Analyze 10 videos with "Summary" prompt
Don't wait! Start Job #2: Analyze same 10 videos with "Editing" prompt

Both jobs run concurrently!

Instead of: 20 minutes + 20 minutes = 40 minutes (sequential)
You get:    20 minutes (both running at once)
```

### Scenario 3: Lock Screen During Multiple Jobs

```
14:00 - Start Job #1 (20 minute batch)
14:05 - Start Job #2 (15 minute batch)
14:10 - Lock your screen 🔒
14:30 - Unlock screen
        ├─ Job #1: Completed! ✅
        └─ Job #2: Completed! ✅

Both continued while screen was locked!
```

## Testing Concurrent Execution

### Quick Test:

```bash
cd /path/to/video-understanding-comparisons

# Get a video ID from uploads
VIDEO_ID=$(ls backend/uploads/*.mp4 | head -1 | xargs basename | sed 's/\.[^.]*$//')

# Start 3 jobs quickly (use same video, that's fine!)
python test_concurrent_jobs.py $VIDEO_ID $VIDEO_ID $VIDEO_ID
```

You'll see output like:

```
📤 Starting multiple jobs (NOT waiting for each to finish)...

[14:30:00.123] Starting Job 1 for video: abc123
             ✅ Job 1 created: abc123ab...
[14:30:00.456] Starting Job 2 for video: abc123
             ✅ Job 2 created: def456cd...
[14:30:00.789] Starting Job 3 for video: abc123
             ✅ Job 3 created: ghi789ef...

✨ All 3 jobs started in ~1.5 seconds!

📊 Monitoring all jobs simultaneously...

[Poll #1] - 14:30:02
Job  1  abc123ab...  running      20%      Running 1 model...
Job  2  def456cd...  running      20%      Running 1 model...
Job  3  ghi789ef...  running      20%      Running 1 model...

[Poll #2] - 14:30:04
Job  1  abc123ab...  running      80%      Evaluating results...
Job  2  def456cd...  running      80%      Evaluating results...
Job  3  ghi789ef...  running      80%      Evaluating results...

[Poll #3] - 14:30:06
Job  1  abc123ab...  completed    100%     Comparison completed
Job  2  def456cd...  completed    100%     Comparison completed
Job  3  ghi789ef...  completed    100%     Comparison completed

✅ All 3 jobs completed!

💡 Key Insight: All jobs ran CONCURRENTLY, not sequentially!
```

## API Rate Limits Consideration

**Q: Won't running multiple jobs hit API rate limits?**

**A: Good question! Here's the balance:**

1. **Each job is independent** - They can run concurrently
2. **Within each job, we control parallelism** - Only 4 models per combo
3. **Gemini API has generous rate limits** - Typically handles 60+ requests/minute
4. **If you hit limits** - Individual API calls will slow down, but jobs continue

**In practice:**
- Running 2-3 jobs concurrently: ✅ No problem
- Running 10+ jobs concurrently: ⚠️ Might hit rate limits
- The jobs won't fail, they'll just slow down a bit

## Benefits of Concurrent Execution

### 1. **Multiple Users**
- App can handle multiple users simultaneously
- Each user's job doesn't block others

### 2. **Efficient Testing**
- Test different prompts on same video set
- Run experiments in parallel

### 3. **Time Savings**
```
Sequential: 30min + 30min + 30min = 90 minutes
Concurrent: max(30min, 30min, 30min) = 30 minutes
Savings: 60 minutes! 🎉
```

### 4. **Resource Utilization**
- Better CPU utilization
- Network bandwidth used efficiently
- API quota used productively

## Monitoring All Jobs

```bash
# List all running jobs
curl http://localhost:8000/api/jobs | jq '.[] | select(.status == "running") | {job_id, progress, progress_message}'

# Watch multiple jobs
watch -n 2 'curl -s http://localhost:8000/api/jobs | jq ".[] | select(.status == \"running\") | {job_id: .job_id[0:8], progress, message: .progress_message}"'
```

Example output:

```json
{
  "job_id": "abc12345",
  "progress": 45,
  "message": "Processing combination 9/20..."
}
{
  "job_id": "def67890",
  "progress": 60,
  "message": "Processing combination 6/10..."
}
{
  "job_id": "ghi13579",
  "progress": 90,
  "message": "Evaluating results..."
}
```

## System Resource Usage

**Memory:**
- Each job loads one video at a time (~100-500 MB)
- 10 concurrent jobs ≈ 1-5 GB memory
- Modern MacBooks handle this easily

**CPU:**
- Mostly waiting on API calls (I/O bound)
- Minimal CPU usage per job
- Can run many jobs concurrently

**Network:**
- Each API call: ~10-100 MB upload
- Most time spent waiting for API response
- Network bandwidth rarely a bottleneck

## Summary

| Aspect | Behavior |
|--------|----------|
| **Multiple Jobs** | Run concurrently (parallel) ✅ |
| **Job Creation** | Instant, doesn't wait ✅ |
| **Within One Batch** | Combos processed sequentially |
| **Within One Combo** | Models run in parallel ✅ |
| **Lock Screen** | All jobs continue ✅ |
| **API Rate Limits** | Managed, rarely an issue ✅ |
| **Memory** | ~100-500 MB per active combo |

## Key Takeaways

1. ✅ **No Queue** - Jobs start immediately and run in parallel
2. ✅ **Independent** - Each job is separate, doesn't block others  
3. ✅ **Scalable** - Can handle multiple users/jobs simultaneously
4. ✅ **Efficient** - Saves time by parallel processing
5. ✅ **Reliable** - Lock screen, all jobs continue

**Start multiple jobs with confidence!** 🚀

