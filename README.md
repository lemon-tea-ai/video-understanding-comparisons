# Video Understanding Comparisons

Compare video understanding capabilities across different Gemini models. Upload videos, enter prompts, and see how Gemini 3 Pro Preview, 3 Flash Preview, 2.5 Pro, and 2.5 Flash each interpret the video content.

## 🎉 New: Background Job System

**Long-running comparisons now work even when your screen locks!** 

The app now uses a background job queue system that:
- ✅ Continues processing videos even if your MacBook sleeps
- ✅ Shows real-time progress updates (0-100%)
- ✅ Never times out on long videos or batch operations
- ✅ Persists jobs to disk (survives app restarts)
- ✅ Allows checking job status at any time

**👉 See [BACKGROUND_JOBS.md](./BACKGROUND_JOBS.md) for detailed documentation.**

## Features

- **Single & Batch Mode**: Analyze one video or run bulk comparisons across multiple videos and prompts
- **Video Upload**: Upload video files (up to 500MB) for analysis
- **Custom & Suggested Prompts**: Use specialized prompts for detailed analysis, editing recommendations, audio/visual improvements, and more
- **Flexible Model Selection**: Choose which models to compare (all 4 or any subset)
- **Multi-Model Comparison**: Runs your prompt through selected Gemini models in parallel
- **AI Evaluation**: Uses Gemini 3 Pro Preview to score and evaluate each model's response based on the prompt type
- **Detailed Analysis**: View scores, strengths, weaknesses, and reasoning for each model
- **Batch Processing**: Run multiple video-prompt combinations automatically (e.g., 5 videos × 3 prompts = 15 comparisons)

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   Frontend      │     │    Backend      │
│   (Next.js)     │────▶│   (FastAPI)     │
│   Port 3000     │     │   Port 8000     │
└─────────────────┘     └────────┬────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
                    ▼            ▼            ▼            ▼
              ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
              │Gemini   │  │Gemini   │  │Gemini   │  │Gemini   │
              │3 Pro    │  │3 Flash  │  │2.5 Pro  │  │2.5 Flash│
              └─────────┘  └─────────┘  └─────────┘  └─────────┘
```

## Setup

### Prerequisites

- Python 3.9+
- Node.js 18+
- Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

### Backend Setup

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
# Edit .env and add your actual API key

# Run the server (hardcoded config for large video uploads)
python run.py
```

**Important**: You must create a `.env` file with your `GEMINI_API_KEY`. Copy `env.example` to `.env` and add your API key from [Google AI Studio](https://makersuite.google.com/app/apikey).

**Note**: The server is configured to handle video uploads up to 500MB. The `run.py` script automatically configures Uvicorn with the correct settings.

## Performance & Timeouts

- **Single Comparison**: 10-minute timeout per request
- **Batch Comparison**: 30-minute timeout for the entire batch
- **Model Execution**: Runs in parallel for faster results
- **Large Videos**: Processing time increases with video size and complexity
- **API Limits**: Respects Google Generative AI SDK default timeouts (typically 10 minutes per model call)

For very long videos or complex prompts, expect longer processing times. The app displays progress indicators during analysis.

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run the development server
npm run dev
```

### Access the App

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Single Mode (Default)

1. **Upload a Video**: Click "Upload Video" and select a video file
2. **Select Models**: Choose which Gemini models to compare (default: all 4)
3. **Enter a Prompt**: Type your video understanding question or select a suggested prompt
   - **Detailed Analysis**: Second-by-second breakdown with visual and audio elements
   - **Editing Suggestions**: Find the best hooks, identify cuts, and optimize pacing
   - **Audio Improvements**: Recommendations for mixing, noise reduction, and enhancement
   - **Caption Optimization**: Text overlay timing, placement, and readability suggestions
   - **And more**: Color grading, B-roll suggestions, thumbnail creation, transitions
4. **Compare Models**: Click "Compare Models" to run the analysis
5. **Review Results**: Each model's response is scored and evaluated by Gemini 3 Pro Preview
6. **Expand Details**: Click on any model card to see the full response, strengths, and weaknesses

### Batch Mode

1. **Enable Batch Mode**: Click the "Batch Mode" toggle in the header
2. **Upload Multiple Videos**: Click "Upload Videos" and select multiple video files
3. **Select Prompts**: Check the prompts you want to run on all videos
4. **Select Models**: Choose which models to use for comparisons
5. **Run Batch**: Click the batch comparison button (shows total combinations)
6. **View Results**: All video-prompt combinations are processed and displayed with summaries

## Models Compared

| Model | Description | Use Case |
|-------|-------------|----------|
| **Gemini 3 Pro Preview** | Latest pro model with advanced reasoning | Complex analysis, evaluation tasks |
| **Gemini 3 Flash Preview** | Latest flash model with fast inference | Quick analysis, real-time applications |
| **Gemini 2.5 Pro** | Second generation pro model | Balanced performance and quality |
| **Gemini 2.5 Flash** | Second generation flash model | Fast processing, cost-effective |

**Note**: Gemini 3 Pro Preview is also used as the evaluator to score all model responses.

## Suggested Prompts

The app includes 9 specialized prompt templates for different video analysis tasks:

1. **Detailed Second-by-Second Analysis** - Comprehensive breakdown of visual and audio elements with timestamps
2. **Professional Editing Perspective** - Identify hooks, highlight reels, trim suggestions, and pacing improvements
3. **Trimming Recommendations** - Precise cut points for different video lengths (15s, 30s, 60s, full version)
4. **Audio Improvements** - Mixing, noise reduction, dialogue clarity, and volume optimization
5. **Text & Caption Optimization** - Caption timing, readability, placement, and typo fixes
6. **Transition & Pacing** - Improve cuts, transitions, rhythm, and narrative flow
7. **Color Grading & Visual Enhancement** - Exposure, white balance, color correction, and LUT suggestions
8. **B-roll & Supplementary Footage** - Recommendations for B-roll shots, cutaways, and visual alternatives
9. **Thumbnail Creation** - Identify best frames, composition tips, and A/B testing alternatives

Each prompt is crafted to elicit detailed, actionable responses with specific timestamps and technical recommendations.

## Tips & Best Practices

- **Model Selection**: Start with all 4 models to see differences, then narrow down to specific models for focused testing
- **Batch Processing**: Use batch mode for systematic testing across multiple videos (e.g., comparing content styles, testing consistency)
- **Prompt Design**: The more specific your prompt, the more useful the evaluation. Include desired output format, required details, and success criteria
- **Video Size**: Smaller videos (under 100MB) process faster. Consider compressing large videos if processing time is critical
- **Timeouts**: If you hit timeouts with very long videos, try:
  - Breaking the video into shorter segments
  - Using simpler prompts
  - Running fewer models at once
- **Evaluation Criteria**: The AI evaluator weighs criteria based on your prompt (e.g., prioritizes timestamps for temporal analysis, actionability for editing prompts)

## Troubleshooting

### Backend Issues

**"Address already in use" error**
```bash
# Find and kill the process on port 8000
lsof -ti:8000 | xargs kill -9
# Or on Windows:
# netstat -ano | findstr :8000
# taskkill /PID <PID> /F
```

**"GEMINI_API_KEY is not set" error**
- Ensure you've created a `.env` file in the `backend/` directory
- Verify the file contains: `GEMINI_API_KEY=your_actual_key`
- Make sure there are no extra spaces or quotes around the key
- Restart the server after adding the key

**Video upload fails**
- Check that the `backend/uploads/` directory exists and is writable
- Verify video file is under 500MB
- Ensure video format is supported (mp4, mov, avi, webm, mkv)

### Frontend Issues

**Cannot connect to backend**
- Verify backend is running on `http://localhost:8000`
- Check browser console for CORS errors
- Ensure both frontend and backend are running simultaneously

**Batch mode not processing all combinations**
- Check backend logs for specific errors
- Verify all videos uploaded successfully (green checkmarks)
- Try with fewer combinations if hitting timeouts

## API Endpoints

### Video Upload
```
POST /api/video/upload
Content-Type: multipart/form-data

Response: { "id": "uuid", "filename": "...", "size": bytes, "content_type": "..." }
```

### Single Comparison
```
POST /api/compare
Content-Type: application/json

{
  "video_id": "uuid",
  "prompt": "Describe this video",
  "models": ["gemini-3-pro-preview", "gemini-2.5-flash"]  // optional, defaults to all
}
```

### Batch Comparison
```
POST /api/batch-compare
Content-Type: application/json

{
  "video_ids": ["uuid1", "uuid2"],
  "prompts": ["prompt 1", "prompt 2"],
  "models": ["gemini-3-pro-preview"]  // optional, defaults to all
}
```

### Available Models
```
GET /api/models

Response: { "models": ["gemini-3-pro-preview", "gemini-3-flash-preview", ...] }
```

## Tech Stack

**Frontend**
- Next.js 14
- TypeScript
- Tailwind CSS
- Framer Motion (animations)
- Lucide Icons
- clsx (utility)

**Backend**
- FastAPI
- Python 3.9+
- Google Generative AI SDK (google-genai)
- Pydantic & Pydantic Settings
- Uvicorn (ASGI server)
- python-multipart (file uploads)
- aiofiles (async file operations)

## License

MIT
