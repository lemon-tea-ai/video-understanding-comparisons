from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import asyncio
import json
import os

from google import genai
from google.genai import types

from app.config import settings
from app.api.video import get_video_path

router = APIRouter()


# Initialize the Gemini client
def get_client():
    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY is not configured"
        )
    print(f"[DEBUG] Creating Gemini client with key: {settings.gemini_api_key[:10]}...{settings.gemini_api_key[-4:]}")
    return genai.Client(api_key=settings.gemini_api_key)


# Model configurations
MODELS = {
    "gemini-3-pro-preview": "gemini-3-pro-preview",
    "gemini-3-flash-preview": "gemini-3-flash-preview",
    "gemini-2.5-flash": "gemini-2.5-flash",
    "gemini-2.5-pro": "gemini-2.5-pro",
}


class CompareRequest(BaseModel):
    video_id: str
    prompt: str
    models: Optional[list[str]] = None  # If None, use all models


class ModelResult(BaseModel):
    model_name: str
    model_id: str
    response: str
    error: Optional[str] = None
    latency_ms: Optional[float] = None


class EvaluationScore(BaseModel):
    model_name: str
    score: int  # 1-10
    reasoning: str
    strengths: list[str]
    weaknesses: list[str]


class CompareResponse(BaseModel):
    video_id: str
    prompt: str
    results: list[ModelResult]
    evaluation: Optional[list[EvaluationScore]] = None
    overall_summary: Optional[str] = None


async def run_model_on_video(
    client: genai.Client,
    model_name: str,
    model_id: str,
    video_path: str,
    prompt: str
) -> ModelResult:
    """Run a single model on the video with the given prompt."""
    import time
    
    start_time = time.time()
    
    try:
        # Upload the video file
        with open(video_path, "rb") as f:
            video_bytes = f.read()
        
        # Determine mime type from extension
        ext = os.path.splitext(video_path)[1].lower()
        mime_types = {
            ".mp4": "video/mp4",
            ".mov": "video/quicktime",
            ".avi": "video/x-msvideo",
            ".webm": "video/webm",
            ".mkv": "video/x-matroska",
        }
        mime_type = mime_types.get(ext, "video/mp4")
        
        # Create the video part
        video_part = types.Part.from_bytes(
            data=video_bytes,
            mime_type=mime_type
        )
        
        # Generate response
        response = client.models.generate_content(
            model=model_id,
            contents=[
                video_part,
                prompt
            ]
        )
        
        latency_ms = (time.time() - start_time) * 1000
        
        return ModelResult(
            model_name=model_name,
            model_id=model_id,
            response=response.text,
            latency_ms=latency_ms
        )
        
    except Exception as e:
        latency_ms = (time.time() - start_time) * 1000
        return ModelResult(
            model_name=model_name,
            model_id=model_id,
            response="",
            error=str(e),
            latency_ms=latency_ms
        )


async def evaluate_results(
    client: genai.Client,
    prompt: str,
    results: list[ModelResult]
) -> tuple[list[EvaluationScore], str]:
    """Use Gemini 2.0 Pro to evaluate all model results."""
    
    # Build the evaluation prompt
    eval_prompt = f"""You are an expert evaluator of AI video understanding capabilities.

The user asked the following question about a video:
"{prompt}"

Here are the responses from different AI models:

"""
    
    for result in results:
        if result.error:
            eval_prompt += f"### {result.model_name}\n[ERROR: {result.error}]\n\n"
        else:
            eval_prompt += f"### {result.model_name}\n{result.response}\n\n"
    
    eval_prompt += """Please evaluate each model's response based on:
1. Accuracy and relevance to the question
2. Level of detail and comprehensiveness
3. Clarity and organization
4. Specific observations from the video

Provide your evaluation in the following JSON format:
{
    "evaluations": [
        {
            "model_name": "model name",
            "score": 8,
            "reasoning": "Brief explanation of the score",
            "strengths": ["strength 1", "strength 2"],
            "weaknesses": ["weakness 1", "weakness 2"]
        }
    ],
    "overall_summary": "A brief comparison summary of all models"
}

Respond ONLY with the JSON, no additional text."""

    try:
        response = client.models.generate_content(
            model="gemini-3-pro-preview",
            contents=[eval_prompt]
        )
        
        # Parse the JSON response
        response_text = response.text.strip()
        
        # Handle potential markdown code blocks
        if response_text.startswith("```"):
            lines = response_text.split("\n")
            response_text = "\n".join(lines[1:-1])
        
        data = json.loads(response_text)
        
        evaluations = [
            EvaluationScore(
                model_name=e["model_name"],
                score=e["score"],
                reasoning=e["reasoning"],
                strengths=e.get("strengths", []),
                weaknesses=e.get("weaknesses", [])
            )
            for e in data["evaluations"]
        ]
        
        return evaluations, data.get("overall_summary", "")
        
    except Exception as e:
        # Return empty evaluation on error
        import traceback
        print(f"[DEBUG] Evaluation error: {e}")
        print(f"[DEBUG] Full traceback:\n{traceback.format_exc()}")
        print(f"[DEBUG] API key being used: {settings.gemini_api_key[:10]}...{settings.gemini_api_key[-4:] if settings.gemini_api_key else 'EMPTY'}")
        return [], f"Evaluation failed: {str(e)}"


@router.get("/models")
async def get_available_models():
    """Get list of available models for comparison."""
    return {"models": list(MODELS.keys())}


@router.post("/compare", response_model=CompareResponse)
async def compare_video_understanding(request: CompareRequest):
    """
    Compare video understanding across multiple Gemini models.
    
    1. Runs the video and prompt through selected models (or all if none specified)
    2. Evaluates all results using Gemini 3 Pro
    3. Returns results with scores and reasoning
    """
    
    # Validate video exists
    video_path = get_video_path(request.video_id)
    if not video_path or not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail="Video not found")
    
    client = get_client()
    
    # Determine which models to run
    selected_models = request.models if request.models else list(MODELS.keys())
    
    # Validate selected models
    for model in selected_models:
        if model not in MODELS:
            raise HTTPException(
                status_code=400, 
                detail=f"Unknown model: {model}. Available: {list(MODELS.keys())}"
            )
    
    # Run selected models in parallel
    tasks = [
        run_model_on_video(client, name, MODELS[name], video_path, request.prompt)
        for name in selected_models
    ]
    
    results = await asyncio.gather(*tasks)
    
    # Evaluate results using Gemini 2.0 Pro
    evaluations, summary = await evaluate_results(client, request.prompt, list(results))
    
    return CompareResponse(
        video_id=request.video_id,
        prompt=request.prompt,
        results=list(results),
        evaluation=evaluations if evaluations else None,
        overall_summary=summary if summary else None
    )

