# Quick Start: Testing Background Jobs

## 🚀 Test It Right Now (5 minutes)

### Step 1: Start the Backend (if not running)

```bash
cd backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
python run.py
```

### Step 2: Start the Frontend (if not running)

```bash
cd frontend
npm run dev
```

### Step 3: Test Through the UI

1. Open http://localhost:3000
2. Upload a video (any video file)
3. Enter a prompt or select a suggested one
4. Click **"Compare X Models"**
5. 🎉 **You'll see a progress bar!**
6. 💡 **Notice the message: "This task runs in the background - you can safely lock your screen"**
7. **Try it!** Lock your screen (`Cmd+Ctrl+Q` on Mac)
8. Wait 30 seconds
9. Unlock your screen
10. **The progress bar has continued!** ✅

### Step 4: Test With Command Line (Optional)

First, get a video ID from an uploaded video:

```bash
# Upload a video through the UI first, then check:
ls backend/uploads/
# You'll see files like: abc123-def456-ghi789.mp4
# The video ID is: abc123-def456-ghi789
```

Now test the async API:

```bash
cd backend

# Test single comparison
python test_async_jobs.py <your-video-id>

# Example:
python test_async_jobs.py abc123-def456-ghi789
```

You'll see output like:

```
============================================================
Testing Async Comparison
Video ID: abc123-def456-ghi789
Prompt: Provide a detailed analysis of this video...
============================================================

📤 Starting comparison job...
✅ Job created: xyz789-abc123-def456
📊 Status: pending
💡 You can now lock your screen - the job will continue!

Polling for status...

[14:23:45] Status: running    | Progress:  10% | Starting comparison...
[14:23:47] Status: running    | Progress:  20% | Running 2 models...
[14:23:49] Status: running    | Progress:  80% | Evaluating results...
[14:23:51] Status: completed  | Progress: 100% | Comparison completed

✅ Job completed!

============================================================
RESULTS:
============================================================

📊 Gemini 3 Flash
   Latency: 12.34s
   Response: This video shows a person walking through...

📊 Gemini 2.5 Flash
   Latency: 11.56s
   Response: The video depicts an outdoor scene...
```

**Now try locking your screen while it runs!** 🔒

## 🧪 Test Batch Mode

### Through UI:

1. Click **"Batch Mode"** button in top-right
2. Upload 2-3 videos
3. Select 2 prompts from the suggestions
4. Click **"Run X × Y = Z Comparisons"**
5. Watch the progress bar update for each combination
6. Lock your screen - it continues! 🎉

### Command Line:

```bash
python test_async_jobs.py --batch video-id-1 video-id-2
```

## 📊 Check Job Status

### List All Jobs:

```bash
python test_async_jobs.py --list
```

Or use curl:

```bash
curl http://localhost:8000/api/jobs | jq
```

### Check Specific Job:

```bash
curl http://localhost:8000/api/jobs/<job-id> | jq
```

## 🧹 Clean Up Old Jobs

```bash
curl -X POST http://localhost:8000/api/jobs/cleanup?days=1
```

This deletes jobs older than 1 day.

## 🐛 Troubleshooting

### "Connection refused"
→ Make sure backend is running on port 8000

### "Job failed"
→ Check backend logs for detailed error
→ Verify video exists: `ls backend/uploads/`

### "Progress stuck"
→ Normal - Gemini API calls can take time
→ Check backend logs to see what's happening

### Job files location
```bash
ls -la backend/jobs/
```

Each job is saved as a JSON file.

## ✨ What's Happening Behind the Scenes

When you click "Compare":

1. **Frontend** → `POST /api/compare-async` → **Backend**
2. **Backend** creates a job file in `./jobs/`
3. **Backend** starts background task
4. **Backend** returns job_id immediately (no waiting!)
5. **Frontend** polls `/api/jobs/{job_id}` every 2 seconds
6. **Backend** updates job progress: 10% → 20% → ... → 100%
7. **Frontend** shows progress bar in real-time
8. When complete, **Frontend** fetches result and displays it

**The magic:** Steps 3-6 happen in the background. Even if you:
- Lock your screen
- Close the browser tab  
- Put computer to sleep
- Lose network connection briefly

The job continues on the backend! When you come back, just refresh and check the job status.

## 📖 Learn More

- [BACKGROUND_JOBS.md](./BACKGROUND_JOBS.md) - Detailed technical documentation
- [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - For developers integrating this

## 🎉 That's It!

You now have a robust background job system that:
- ✅ Never times out
- ✅ Survives screen locks
- ✅ Shows real-time progress
- ✅ Persists across restarts
- ✅ Works with batch operations

Enjoy stress-free long-running video comparisons! 🚀

