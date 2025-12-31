# Batch Mode with Background Jobs - Detailed Explanation

## Overview

Batch mode allows you to run **multiple videos** with **multiple prompts** in a single operation. With the background job system, you can safely lock your screen while processing dozens or even hundreds of video-prompt combinations.

## How It Works

### The Math

```
Videos × Prompts = Total Comparisons

Examples:
- 2 videos × 3 prompts = 6 comparisons
- 5 videos × 4 prompts = 20 comparisons  
- 10 videos × 8 prompts = 80 comparisons
```

Each comparison runs all selected models (up to 4) in parallel, then evaluates the results.

## Execution Flow

### 1. Job Creation (Instant)

```
User clicks "Run 5 × 3 = 15 Comparisons"
         ↓
Frontend → POST /api/batch-compare-async
         ↓
Backend creates ONE job for entire batch
         ↓
Backend returns job_id immediately (< 1 second)
         ↓
User sees: "Starting batch comparison..."
```

**Key Point:** The API returns immediately. You're NOT waiting for the batch to complete.

### 2. Background Processing

```
Backend starts async task:

For each video in [video1, video2, video3]:
  For each prompt in [prompt1, prompt2, prompt3]:
    
    ┌─────────────────────────────────────┐
    │ Processing: video1 + prompt1        │
    │                                     │
    │ 1. Load video from disk             │
    │ 2. Run 4 models in parallel:        │
    │    ├─ Gemini 3 Pro    → API call   │
    │    ├─ Gemini 3 Flash  → API call   │
    │    ├─ Gemini 2.5 Pro  → API call   │
    │    └─ Gemini 2.5 Flash → API call  │
    │ 3. Evaluate results                 │
    │ 4. Store comparison result          │
    │ 5. Update progress: 17% → 23%       │
    └─────────────────────────────────────┘
    
    Move to next combination...
```

**Key Point:** Combinations are processed **sequentially**, but within each combination, models run **in parallel**.

### 3. Progress Updates

```python
# Progress calculation for batch jobs
total_combinations = len(videos) * len(prompts)
current_combo = 0

for video in videos:
    for prompt in prompts:
        current_combo += 1
        
        # Progress: 10% (start) to 90% (processing)
        progress = 10 + (current_combo / total_combinations) * 80
        
        update_job(
            progress=progress,
            message=f"Processing combination {current_combo}/{total_combinations}..."
        )
        
        # Process this combination...
```

Progress breakdown:
- **0-5%**: Job initialization
- **5-10%**: Video validation
- **10-90%**: Processing combinations (scales with number of combos)
- **90-100%**: Finalizing results

### 4. Frontend Polling

```typescript
// Frontend polls every 2 seconds
const interval = setInterval(async () => {
  const job = await fetch(`/api/jobs/${job_id}`).then(r => r.json())
  
  setProgress(job.progress)
  setMessage(job.progress_message)
  
  if (job.status === 'completed') {
    clearInterval(interval)
    displayResults(job.result)
  }
}, 2000)
```

**What you see:**
```
Running batch analysis...
████████████░░░░░░░░░░░░░ 45%
45% complete
Processing combination 7/15...

💡 This task runs in the background - you can safely lock your screen
```

## Example Scenarios

### Scenario 1: Small Batch (Testing)

**Configuration:**
- 2 videos
- 2 prompts
- 2 models (Flash only for speed)
- = 4 combinations

**Timeline:**
```
00:00 - Job created
00:02 - Combo 1/4: video1 + prompt1 (Progress: 30%)
00:25 - Combo 2/4: video1 + prompt2 (Progress: 50%)
00:48 - Combo 3/4: video2 + prompt1 (Progress: 70%)
01:10 - Combo 4/4: video2 + prompt2 (Progress: 90%)
01:30 - Complete! (Progress: 100%)
```

**Total time:** ~90 seconds

### Scenario 2: Medium Batch (Production)

**Configuration:**
- 5 videos (each 2-3 minutes long)
- 4 prompts
- 4 models (all models)
- = 20 combinations

**Timeline:**
```
00:00 - Job created
00:05 - Combo 1/20 (5%)
02:30 - Combo 5/20 (30%)
05:00 - Combo 10/20 (55%)
07:30 - Combo 15/20 (80%)
10:00 - Complete! (100%)
```

**Total time:** ~10 minutes

**💡 You can lock your screen at any point during these 10 minutes!**

### Scenario 3: Large Batch (Overnight)

**Configuration:**
- 20 videos
- 8 prompts  
- 4 models
- = 160 combinations

**Timeline:**
```
00:00 - Job created, you go to dinner
00:30 - 10 combinations done (8%)
01:00 - 20 combinations done (15%)
02:00 - 40 combinations done (28%)
...
06:00 - 140 combinations done (90%)
06:45 - Complete! (100%)
```

**Total time:** ~6-7 hours

**💡 Your MacBook was probably asleep most of this time - the job continues when it wakes up!**

## Result Structure

After completion, the result contains all comparisons:

```json
{
  "comparisons": [
    {
      "video_id": "video1",
      "prompt": "Provide a summary",
      "results": [
        {
          "model_name": "Gemini 3 Pro",
          "response": "This video shows...",
          "latency_ms": 15234,
          "error": null
        },
        {
          "model_name": "Gemini 3 Flash",
          "response": "The video depicts...",
          "latency_ms": 12456,
          "error": null
        },
        // ... more models
      ],
      "evaluation": [
        {
          "model_name": "Gemini 3 Pro",
          "score": 9,
          "reasoning": "Excellent detail...",
          "strengths": ["Comprehensive", "Accurate timestamps"],
          "weaknesses": ["Slightly verbose"]
        },
        // ... more evaluations
      ],
      "overall_summary": "Gemini 3 Pro provided the most detailed analysis..."
    },
    // ... 19 more comparisons for 5 videos × 4 prompts
  ],
  "total_videos": 5,
  "total_prompts": 4,
  "total_combinations": 20
}
```

## UI Display

The frontend displays batch results as a list of cards:

```
┌─────────────────────────────────────────────────┐
│ Batch Summary                                   │
│ Videos: 5 | Prompts: 4 | Total: 20 comparisons  │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 📹 Video 1 (abc123-video-id)                    │
│ 📝 "Provide a detailed second-by-second..."     │
│                                                 │
│ Summary: Gemini 3 Pro provided most detail...  │
│                                                 │
│ ┌──────────────┐  ┌──────────────┐             │
│ │ Gemini 3 Pro │  │ Gemini Flash │             │
│ │ Score: 9/10  │  │ Score: 8/10  │             │
│ │ 15.2s        │  │ 12.5s        │             │
│ │ ✓ Great      │  │ ✓ Fast       │             │
│ └──────────────┘  └──────────────┘             │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 📹 Video 1 (abc123-video-id)                    │
│ 📝 "Analyze editing and suggest improvements"   │
│ ...                                             │
└─────────────────────────────────────────────────┘

... 18 more cards
```

## Why Sequential Processing?

**Q: Why process combinations one at a time instead of all at once?**

**A: API rate limits and memory constraints:**

1. **Gemini API Rate Limits**
   - Too many parallel requests = rate limit errors
   - Sequential processing respects API limits
   
2. **Memory Usage**
   - Each video loads into memory (~100-500 MB)
   - Processing 20 videos simultaneously = OOM errors
   - Sequential = stable memory usage

3. **Predictable Progress**
   - Easy to calculate: "Combo 5/20 = 25% done"
   - Clear progress updates for users

**But models within each combo run in parallel!**
- For combo 1 (video1 + prompt1): All 4 models analyze simultaneously
- This gives you the speed boost where it matters

## Testing Batch Mode

### Through UI:

1. Click "Batch Mode" toggle
2. Upload 2-3 videos
3. Select 2 prompts
4. Select 2 models (Flash models for speed)
5. Click "Run 2 × 2 = 4 Comparisons"
6. **Lock your screen** (Cmd+Ctrl+Q)
7. Wait 2 minutes
8. Unlock - see progress has continued!

### Through Command Line:

```bash
# Use the included test script
./test_batch_example.sh

# Or test with Python
cd backend
python test_async_jobs.py --batch video-id-1 video-id-2
```

### Through curl:

```bash
# Start batch job
curl -X POST http://localhost:8000/api/batch-compare-async \
  -H "Content-Type: application/json" \
  -d '{
    "video_ids": ["video1", "video2"],
    "prompts": ["Summary", "Analysis"],
    "models": ["gemini-3-flash-preview"]
  }'

# Returns: {"job_id": "abc123...", "status": "pending", ...}

# Poll status
watch -n 2 "curl -s http://localhost:8000/api/jobs/abc123 | jq '.progress, .progress_message'"

# Get result when done
curl http://localhost:8000/api/jobs/abc123/result | jq
```

## Tips & Best Practices

### 1. Start Small
- Test with 2 videos × 2 prompts first
- Verify everything works before scaling up

### 2. Choose Models Wisely
- Flash models for speed (10-15s per video)
- Pro models for quality (20-30s per video)
- Mix: 1 Pro + 1 Flash for balance

### 3. Estimate Time
```
Rough formula:
Time = (videos × prompts × models × 15 seconds) + overhead

Example:
5 videos × 3 prompts × 2 models × 15s = 450s = 7.5 minutes
Add 20% overhead = ~9 minutes total
```

### 4. Check Progress Anytime
```bash
# List all jobs
curl http://localhost:8000/api/jobs | jq

# Check specific job
curl http://localhost:8000/api/jobs/{job-id} | jq '.status, .progress'
```

### 5. Cancel if Needed
```bash
curl -X POST http://localhost:8000/api/jobs/{job-id}/cancel
```

## Troubleshooting

### "Job stuck at 45%"
- Normal if processing a long video
- Check backend logs for current activity
- Each combination can take 20-60 seconds

### "Job failed at combo 5/20"
- Check backend logs for specific error
- Likely: API rate limit or video file issue
- Job will have error in `.error` field

### "I locked my screen, did the job stop?"
- No! Check progress when you unlock
- Job continues in background
- Progress will have advanced

### "Can I restart the backend?"
- Yes, jobs persist to disk
- However, background task needs manual restart
- Better: let job finish before restarting

## Advanced: Custom Batch Processing

You can create custom batch jobs using the API:

```python
import httpx
import asyncio

async def custom_batch_analysis():
    async with httpx.AsyncClient() as client:
        # Create custom video-prompt pairs
        pairs = [
            ("video1", "Focus on audio quality"),
            ("video1", "Focus on visual composition"),
            ("video2", "Focus on pacing and editing"),
            ("video2", "Focus on color grading"),
            # ... more custom pairs
        ]
        
        # Start batch job
        response = await client.post(
            "http://localhost:8000/api/batch-compare-async",
            json={
                "video_ids": [p[0] for p in pairs],
                "prompts": [p[1] for p in pairs],
                "models": ["gemini-3-flash-preview"]
            }
        )
        
        job_id = response.json()["job_id"]
        
        # Monitor progress
        while True:
            await asyncio.sleep(3)
            job = await client.get(f"http://localhost:8000/api/jobs/{job_id}")
            job_data = job.json()
            
            if job_data["status"] == "completed":
                return job_data["result"]
            
            print(f"{job_data['progress']}%: {job_data['progress_message']}")

# Run it
result = asyncio.run(custom_batch_analysis())
```

## Summary

**Batch Mode with Background Jobs:**

✅ Process multiple video-prompt combinations in one go  
✅ Single job handles entire batch  
✅ Sequential processing with parallel model execution  
✅ Real-time progress updates  
✅ Safe to lock screen during processing  
✅ Results stored with all comparisons  
✅ Perfect for bulk analysis tasks  

**Use Cases:**
- Testing multiple prompts on same video
- Analyzing video library with standard questions
- A/B testing prompt variations
- Large-scale video content analysis
- Overnight batch processing

**Lock your screen with confidence!** 🔒✨

