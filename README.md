# Video Understanding Comparisons

Compare video understanding capabilities across different Gemini models. Upload a video, enter a prompt, and see how Gemini 3 Pro Preview, 3 Flash Preview, 2.5 Pro, and 2.5 Flash each interpret the video content.

## Features

- **Video Upload**: Upload any video file for analysis
- **Custom Prompts**: Enter your own video understanding prompts
- **Multi-Model Comparison**: Runs your prompt through 4 Gemini models in parallel
- **AI Evaluation**: Uses Gemini 3 Pro Preview to score and evaluate each model's response
- **Detailed Analysis**: View strengths, weaknesses, and reasoning for each model

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

1. **Upload a Video**: Click "Upload Video" and select a video file
2. **Enter a Prompt**: Type your video understanding question or use a suggested prompt
3. **Compare Models**: Click "Compare All Models" to run the analysis
4. **Review Results**: Each model's response is scored and evaluated by Gemini 3 Pro Preview
5. **Expand Details**: Click on any model card to see the full response, strengths, and weaknesses

## Models Compared

| Model | Description |
|-------|-------------|
| **Gemini 3 Pro Preview** | Latest pro model (also used for final evaluation) |
| **Gemini 3 Flash Preview** | Latest flash model with fast inference |
| **Gemini 2.5 Pro** | Second generation pro model |
| **Gemini 2.5 Flash** | Second generation flash model |

## API Endpoints

### Video Upload
```
POST /api/video/upload
Content-Type: multipart/form-data
```

### Compare Models
```
POST /api/compare
Content-Type: application/json

{
  "video_id": "uuid",
  "prompt": "Describe this video"
}
```

## Tech Stack

**Frontend**
- Next.js 14
- TypeScript
- Tailwind CSS
- Framer Motion
- Lucide Icons

**Backend**
- FastAPI
- Python 3.9+
- Google Generative AI SDK
- Pydantic

## License

MIT
