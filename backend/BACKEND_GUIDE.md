# Backend Setup & Running Guide

## Quick Start

### First Time Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file with your API key
# Get your API key from: https://makersuite.google.com/app/apikey
cp env.example .env
# Then edit .env and replace 'your_gemini_api_key_here' with your actual API key
```

**Important**: The `.env` file is required and must contain your `GEMINI_API_KEY`. The server will not start without it.

### Running the Server

```bash
cd backend
source venv/bin/activate
python run.py
```

Or use the bash script:
```bash
./start.sh
```

The server will start on `http://localhost:8000` and automatically handle video uploads up to **500MB**.

---

## Large Video Upload Support

### How It Works

The backend is configured to handle large video uploads (up to 500MB by default):

1. **Streaming Upload**: Files are processed in 1MB chunks (not loaded entirely into memory)
2. **Size Validation**: Checked during upload, not after
3. **Auto Cleanup**: Partial files are deleted automatically on error
4. **Server Configuration**: Uvicorn is configured via `run.py` with hardcoded settings

### Configuration

Maximum upload size is defined in `backend/app/config.py`:
```python
max_file_size: int = 500 * 1024 * 1024  # 500MB
```

To change the limit:
1. Edit `backend/app/config.py` line 44
2. Restart the server with `python run.py`
3. The new limit is applied automatically!

### Why `run.py` Instead of Direct Uvicorn?

**Problem**: FastAPI/Uvicorn has a default ~100MB request body limit, causing 413 errors for larger videos.

**Solution**: The `run.py` script automatically configures Uvicorn with:
- `limit_max_requests=settings.max_file_size` - Matches your config (500MB)
- `timeout_keep_alive=120` - 2 minute timeout for large uploads
- Other optimized settings for video handling

No manual command-line parameters needed!

---

## Troubleshooting

### "GEMINI_API_KEY is not set" Error

**Cause**: The `.env` file is missing or doesn't contain the API key  
**Solution**: 
1. Copy the example: `cp env.example .env`
2. Edit `.env` and add your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
3. Make sure the line looks like: `GEMINI_API_KEY=AIzaSy...your_key_here`

### "413 Content Too Large" Error

**Cause**: Video exceeds the configured limit  
**Solution**: 
- Reduce video size, OR
- Increase `max_file_size` in `config.py` and restart

### Connection Reset During Upload

**Cause**: Network timeout for very large files  
**Solution**: Increase timeout in `run.py`:
```python
timeout_keep_alive=300,  # 5 minutes instead of 2
```

### Port 8000 Already in Use

**Solution**: Kill the existing process or change the port
```bash
# Kill process on port 8000
lsof -ti:8000 | xargs kill -9

# Or edit run.py to use a different port
port=8001,
```

---

## Server Features

✅ Streams video uploads in 1MB chunks (memory efficient)  
✅ Validates file size during upload (not after)  
✅ Automatically cleans up partial files on error  
✅ Supports videos up to 500MB by default  
✅ Keeps connections alive for 2 minutes during uploads  
✅ Auto-reload on code changes (development mode)  

---

## Development vs Production

**Development** (current setup in `run.py`):
```python
uvicorn.run(
    "app.main:app",
    reload=True,  # Auto-reload on changes
    log_level="info",
)
```

**Production** (commented in `run.py`):
```python
uvicorn.run(
    "app.main:app",
    workers=4,  # Multiple worker processes
    reload=False,  # No auto-reload
)
```

For production, uncomment the production section in `run.py`.

---

## Testing Large Uploads

Test with curl:
```bash
curl -X POST "http://localhost:8000/api/video/upload" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@/path/to/your/video.mp4"
```

Expected response:
```json
{
  "id": "uuid-here",
  "filename": "video.mp4",
  "size": 209715200,
  "content_type": "video/mp4",
  "path": "./uploads/uuid-here.mp4"
}
```

---

## Key Files

| File | Purpose |
|------|---------|
| `run.py` | Server runner with hardcoded uvicorn settings |
| `start.sh` | Bash wrapper that runs `run.py` |
| `env.example` | Template for `.env` file (copy and configure) |
| `.env` | **Your API key** (create from `env.example`, not tracked in git) |
| `app/main.py` | FastAPI application |
| `app/config.py` | Configuration (including `max_file_size`) |
| `app/api/video.py` | Video upload endpoint with streaming |
| `app/api/compare.py` | Model comparison endpoints |

## Security Notes

- ✅ `.env` file is in `.gitignore` (never committed to git)
- ✅ API key is only read from `.env` file
- ✅ No hardcoded API keys in the codebase
- ⚠️ Keep your `.env` file secure and never share it publicly

