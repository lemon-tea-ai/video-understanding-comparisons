from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
import asyncio
import json
import os

from google import genai
from google.genai import types

from app.config import settings
from app.api.video import get_video_path
from app.jobs import job_queue, JobType, JobStatus

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


class BatchCompareRequest(BaseModel):
    video_ids: list[str]  # Multiple videos
    prompts: list[str]  # Multiple prompts
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


class BatchCompareResponse(BaseModel):
    comparisons: list[CompareResponse]
    total_videos: int
    total_prompts: int
    total_combinations: int


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
        print(f"[{model_name}] Starting video analysis...")
        
        # Upload the video file
        with open(video_path, "rb") as f:
            video_bytes = f.read()
        
        print(f"[{model_name}] Video loaded ({len(video_bytes) / 1024 / 1024:.1f} MB)")
        
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
        
        print(f"[{model_name}] Sending request to Gemini API...")
        
        # Generate response
        # Note: Google Generative AI SDK handles timeouts internally
        # Default timeout is typically 600 seconds (10 minutes) for long operations
        response = client.models.generate_content(
            model=model_id,
            contents=[
                video_part,
                prompt
            ]
        )
        
        latency_ms = (time.time() - start_time) * 1000
        print(f"[{model_name}] Completed in {latency_ms/1000:.1f}s")
        
        return ModelResult(
            model_name=model_name,
            model_id=model_id,
            response=response.text,
            latency_ms=latency_ms
        )
        
    except Exception as e:
        latency_ms = (time.time() - start_time) * 1000
        print(f"[{model_name}] Error after {latency_ms/1000:.1f}s: {str(e)}")
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
    """Use Gemini 3 Pro Preview to evaluate all model results."""
    import time
    
    start_time = time.time()
    print("[EVALUATION] Starting model evaluation...")
    
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
    
    eval_prompt += """Evaluate each model's response based on how well it addresses the user's specific question. Consider:

1. **Relevance & Accuracy**: Does it directly answer what was asked? Are details correct?
2. **Completeness**: Is the analysis thorough and comprehensive for the question type?
3. **Specificity**: Are examples, observations, and recommendations concrete and actionable?
4. **Timestamps**: If requested, are they accurate, well-formatted, and appropriately detailed?
5. **Technical Insight**: For specialized prompts (editing, audio, color, etc), does it demonstrate domain expertise?
6. **Actionability**: Are suggestions practical and implementable with clear guidance?
7. **Organization**: Is information well-structured and easy to follow?

Weight criteria based on the prompt's focus (e.g., prioritize timestamp accuracy for temporal analysis, actionability for editing suggestions, technical accuracy for production reviews).

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
        print("[EVALUATION] Sending evaluation request to Gemini API...")
        response = client.models.generate_content(
            model="gemini-3-pro-preview",
            contents=[eval_prompt]
        )
        
        elapsed = time.time() - start_time
        print(f"[EVALUATION] Completed in {elapsed:.1f}s")
        
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
        elapsed = time.time() - start_time
        print(f"[EVALUATION] Error after {elapsed:.1f}s: {e}")
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
    import time
    overall_start = time.time()
    
    print(f"\n{'='*60}")
    print(f"[COMPARE] Starting comparison for video: {request.video_id}")
    print(f"[COMPARE] Prompt length: {len(request.prompt)} characters")
    print(f"{'='*60}\n")
    
    # Validate video exists
    video_path = get_video_path(request.video_id)
    if not video_path or not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail="Video not found")
    
    video_size_mb = os.path.getsize(video_path) / 1024 / 1024
    print(f"[COMPARE] Video size: {video_size_mb:.1f} MB")
    
    client = get_client()
    
    # Determine which models to run
    selected_models = request.models if request.models else list(MODELS.keys())
    print(f"[COMPARE] Running {len(selected_models)} models: {', '.join(selected_models)}")
    
    # Validate selected models
    for model in selected_models:
        if model not in MODELS:
            raise HTTPException(
                status_code=400, 
                detail=f"Unknown model: {model}. Available: {list(MODELS.keys())}"
            )
    
    # Run selected models in parallel
    print(f"[COMPARE] Starting parallel model execution...")
    tasks = [
        run_model_on_video(client, name, MODELS[name], video_path, request.prompt)
        for name in selected_models
    ]
    
    results = await asyncio.gather(*tasks)
    models_elapsed = time.time() - overall_start
    print(f"[COMPARE] All models completed in {models_elapsed:.1f}s")
    
    # Print individual model latencies
    print(f"[COMPARE] Individual model latencies:")
    for result in results:
        if result.latency_ms:
            print(f"  - {result.model_name}: {result.latency_ms/1000:.2f}s ({result.latency_ms:.0f}ms)")
        else:
            print(f"  - {result.model_name}: N/A")
    
    # Evaluate results using Gemini 3 Pro Preview
    evaluations, summary = await evaluate_results(client, request.prompt, list(results))
    
    total_elapsed = time.time() - overall_start
    print(f"\n{'='*60}")
    print(f"[COMPARE] Total comparison completed in {total_elapsed:.1f}s")
    print(f"{'='*60}\n")
    
    return CompareResponse(
        video_id=request.video_id,
        prompt=request.prompt,
        results=list(results),
        evaluation=evaluations if evaluations else None,
        overall_summary=summary if summary else None
    )


@router.post("/batch-compare", response_model=BatchCompareResponse)
async def batch_compare_video_understanding(request: BatchCompareRequest):
    """
    Batch compare: Run multiple videos with multiple prompts.
    
    Creates a comparison for each video-prompt combination.
    For example: 2 videos × 3 prompts = 6 comparisons
    
    Processes combinations sequentially to avoid overwhelming the API.
    """
    import time
    overall_start = time.time()
    
    print(f"\n{'='*60}")
    print(f"[BATCH] Starting batch comparison")
    print(f"[BATCH] Videos: {len(request.video_ids)}")
    print(f"[BATCH] Prompts: {len(request.prompts)}")
    print(f"[BATCH] Total combinations: {len(request.video_ids) * len(request.prompts)}")
    print(f"{'='*60}\n")
    
    # Validate all videos exist
    for video_id in request.video_ids:
        video_path = get_video_path(video_id)
        if not video_path or not os.path.exists(video_path):
            raise HTTPException(status_code=404, detail=f"Video not found: {video_id}")
    
    client = get_client()
    selected_models = request.models if request.models else list(MODELS.keys())
    
    # Validate selected models
    for model in selected_models:
        if model not in MODELS:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown model: {model}. Available: {list(MODELS.keys())}"
            )
    
    comparisons = []
    total_combinations = len(request.video_ids) * len(request.prompts)
    current_combo = 0
    
    # Process each video-prompt combination
    for video_id in request.video_ids:
        video_path = get_video_path(video_id)
        video_size_mb = os.path.getsize(video_path) / 1024 / 1024
        
        for prompt in request.prompts:
            current_combo += 1
            print(f"\n[BATCH] Processing combination {current_combo}/{total_combinations}")
            print(f"[BATCH] Video: {video_id} ({video_size_mb:.1f} MB)")
            print(f"[BATCH] Prompt: {prompt[:80]}{'...' if len(prompt) > 80 else ''}")
            
            combo_start = time.time()
            
            # Run selected models in parallel for this combination
            tasks = [
                run_model_on_video(client, name, MODELS[name], video_path, prompt)
                for name in selected_models
            ]
            
            results = await asyncio.gather(*tasks)
            
            # Print individual model latencies
            print(f"[BATCH] Model latencies for this combination:")
            for result in results:
                if result.latency_ms:
                    print(f"  - {result.model_name}: {result.latency_ms/1000:.2f}s ({result.latency_ms:.0f}ms)")
                else:
                    print(f"  - {result.model_name}: N/A")
            
            # Evaluate results
            evaluations, summary = await evaluate_results(client, prompt, list(results))
            
            combo_elapsed = time.time() - combo_start
            print(f"[BATCH] Combination completed in {combo_elapsed:.1f}s")
            
            comparisons.append(CompareResponse(
                video_id=video_id,
                prompt=prompt,
                results=list(results),
                evaluation=evaluations if evaluations else None,
                overall_summary=summary if summary else None
            ))
    
    total_elapsed = time.time() - overall_start
    print(f"\n{'='*60}")
    print(f"[BATCH] All {total_combinations} combinations completed in {total_elapsed:.1f}s")
    print(f"[BATCH] Average per combination: {total_elapsed/total_combinations:.1f}s")
    print(f"{'='*60}\n")
    
    return BatchCompareResponse(
        comparisons=comparisons,
        total_videos=len(request.video_ids),
        total_prompts=len(request.prompts),
        total_combinations=total_combinations
    )


class JobResponse(BaseModel):
    job_id: str
    status: str
    message: str


async def _run_comparison_job(job_id: str, request_data: dict):
    """Background task to run a comparison job with live progress updates."""
    import time
    
    # Progress updater task
    progress_task = None
    stop_progress_updates = False
    
    async def update_progress_periodically():
        """Update progress every 2 seconds with estimated completion."""
        nonlocal stop_progress_updates
        start_time = time.time()
        estimated_duration = 60  # Estimated 60 seconds for models
        
        while not stop_progress_updates:
            elapsed = time.time() - start_time
            # Progress from 20% to 75% based on time (leaving room for evaluation)
            estimated_progress = min(20 + int((elapsed / estimated_duration) * 55), 75)
            
            await job_queue.update_job(
                job_id,
                progress=estimated_progress,
                progress_message=f"Processing models... ({int(elapsed)}s elapsed)"
            )
            await asyncio.sleep(2)  # Update every 2 seconds
    
    try:
        await job_queue.update_job(
            job_id,
            status=JobStatus.RUNNING,
            progress=10,
            progress_message="Starting comparison..."
        )
        
        # Extract request data
        video_id = request_data["video_id"]
        prompt = request_data["prompt"]
        selected_models = request_data.get("models") or list(MODELS.keys())
        
        # Validate video exists
        video_path = get_video_path(video_id)
        if not video_path or not os.path.exists(video_path):
            raise Exception("Video not found")
        
        client = get_client()
        
        await job_queue.update_job(
            job_id,
            progress=20,
            progress_message=f"Running {len(selected_models)} models in parallel..."
        )
        
        # Start the progress updater task
        progress_task = asyncio.create_task(update_progress_periodically())
        
        # Run selected models in parallel (faster!)
        tasks = [
            run_model_on_video(client, name, MODELS[name], video_path, prompt)
            for name in selected_models
        ]
        
        results = await asyncio.gather(*tasks)
        
        # Stop the progress updater
        stop_progress_updates = True
        if progress_task:
            await progress_task
        
        await job_queue.update_job(
            job_id,
            progress=80,
            progress_message="Models completed. Evaluating results..."
        )
        
        # Evaluate results
        evaluations, summary = await evaluate_results(client, prompt, list(results))
        
        # Prepare result
        result = {
            "video_id": video_id,
            "prompt": prompt,
            "results": [r.model_dump() for r in results],
            "evaluation": [e.model_dump() for e in evaluations] if evaluations else None,
            "overall_summary": summary if summary else None
        }
        
        await job_queue.update_job(
            job_id,
            status=JobStatus.COMPLETED,
            progress=100,
            progress_message="Comparison completed",
            result=result
        )
        
    except Exception as e:
        print(f"[JOB {job_id}] Error: {e}")
        import traceback
        traceback.print_exc()
        
        # Stop progress updater if it's running
        stop_progress_updates = True
        if progress_task:
            try:
                await progress_task
            except:
                pass
        
        await job_queue.update_job(
            job_id,
            status=JobStatus.FAILED,
            error=str(e)
        )


async def _run_batch_comparison_job(job_id: str, request_data: dict):
    """Background task to run a batch comparison job with live progress updates."""
    import time
    
    try:
        await job_queue.update_job(
            job_id,
            status=JobStatus.RUNNING,
            progress=5,
            progress_message="Starting batch comparison..."
        )
        
        # Extract request data
        video_ids = request_data["video_ids"]
        prompts = request_data["prompts"]
        selected_models = request_data.get("models") or list(MODELS.keys())
        
        total_combinations = len(video_ids) * len(prompts)
        
        # Validate all videos exist
        for video_id in video_ids:
            video_path = get_video_path(video_id)
            if not video_path or not os.path.exists(video_path):
                raise Exception(f"Video not found: {video_id}")
        
        client = get_client()
        comparisons = []
        current_combo = 0
        
        # Process each video-prompt combination
        for video_id in video_ids:
            video_path = get_video_path(video_id)
            
            for prompt in prompts:
                current_combo += 1
                base_progress = int(10 + ((current_combo - 1) / total_combinations) * 85)
                
                await job_queue.update_job(
                    job_id,
                    progress=base_progress,
                    progress_message=f"Processing combination {current_combo}/{total_combinations}..."
                )
                
                # Progress updater for this combination
                stop_progress_updates = False
                combo_start_time = time.time()
                estimated_combo_duration = 60  # Estimate 60 seconds per combo
                
                async def update_combo_progress():
                    """Update progress during this combination's execution."""
                    nonlocal stop_progress_updates
                    combo_progress_range = int(85 / total_combinations)
                    
                    while not stop_progress_updates:
                        elapsed = time.time() - combo_start_time
                        progress_in_combo = min(int((elapsed / estimated_combo_duration) * combo_progress_range), combo_progress_range - 5)
                        current_progress = base_progress + progress_in_combo
                        
                        await job_queue.update_job(
                            job_id,
                            progress=current_progress,
                            progress_message=f"Combo {current_combo}/{total_combinations}: Processing... ({int(elapsed)}s)"
                        )
                        await asyncio.sleep(2)
                
                # Start progress updater
                progress_task = asyncio.create_task(update_combo_progress())
                
                # Run selected models in parallel for this combination
                tasks = [
                    run_model_on_video(client, name, MODELS[name], video_path, prompt)
                    for name in selected_models
                ]
                
                results = await asyncio.gather(*tasks)
                
                # Stop progress updater
                stop_progress_updates = True
                await progress_task
                
                # Update for evaluation phase
                eval_progress = base_progress + int(0.8 * (85 / total_combinations))
                await job_queue.update_job(
                    job_id,
                    progress=eval_progress,
                    progress_message=f"Combo {current_combo}/{total_combinations}: Evaluating..."
                )
                
                # Evaluate results
                evaluations, summary = await evaluate_results(client, prompt, results)
                
                comparisons.append({
                    "video_id": video_id,
                    "prompt": prompt,
                    "results": [r.model_dump() for r in results],
                    "evaluation": [e.model_dump() for e in evaluations] if evaluations else None,
                    "overall_summary": summary if summary else None
                })
        
        # Prepare result
        result = {
            "comparisons": comparisons,
            "total_videos": len(video_ids),
            "total_prompts": len(prompts),
            "total_combinations": total_combinations
        }
        
        await job_queue.update_job(
            job_id,
            status=JobStatus.COMPLETED,
            progress=100,
            progress_message="Batch comparison completed",
            result=result
        )
        
    except Exception as e:
        print(f"[JOB {job_id}] Error: {e}")
        import traceback
        traceback.print_exc()
        
        await job_queue.update_job(
            job_id,
            status=JobStatus.FAILED,
            error=str(e)
        )


@router.post("/compare-async", response_model=JobResponse)
async def compare_video_understanding_async(request: CompareRequest):
    """
    Compare video understanding across multiple Gemini models (async version).
    
    Returns immediately with a job ID. Poll /api/jobs/{job_id} for status.
    
    This endpoint is ideal for long-running tasks as it won't timeout
    even if your screen locks or computer sleeps.
    """
    # Validate video exists
    video_path = get_video_path(request.video_id)
    if not video_path or not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Validate selected models
    selected_models = request.models if request.models else list(MODELS.keys())
    for model in selected_models:
        if model not in MODELS:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown model: {model}. Available: {list(MODELS.keys())}"
            )
    
    # Create job
    job_id = await job_queue.create_job(
        job_type=JobType.SINGLE_COMPARE,
        request_data={
            "video_id": request.video_id,
            "prompt": request.prompt,
            "models": selected_models
        }
    )
    
    # Start background task
    job_queue.start_background_task(
        job_id,
        _run_comparison_job(job_id, {
            "video_id": request.video_id,
            "prompt": request.prompt,
            "models": selected_models
        })
    )
    
    return JobResponse(
        job_id=job_id,
        status="pending",
        message="Job created successfully. Poll /api/jobs/{job_id} for status."
    )


@router.post("/batch-compare-async", response_model=JobResponse)
async def batch_compare_video_understanding_async(request: BatchCompareRequest):
    """
    Batch compare video understanding (async version).
    
    Returns immediately with a job ID. Poll /api/jobs/{job_id} for status.
    
    This endpoint is ideal for long-running batch tasks as it won't timeout
    even if your screen locks or computer sleeps.
    """
    # Validate all videos exist
    for video_id in request.video_ids:
        video_path = get_video_path(video_id)
        if not video_path or not os.path.exists(video_path):
            raise HTTPException(status_code=404, detail=f"Video not found: {video_id}")
    
    # Validate selected models
    selected_models = request.models if request.models else list(MODELS.keys())
    for model in selected_models:
        if model not in MODELS:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown model: {model}. Available: {list(MODELS.keys())}"
            )
    
    # Create job
    job_id = await job_queue.create_job(
        job_type=JobType.BATCH_COMPARE,
        request_data={
            "video_ids": request.video_ids,
            "prompts": request.prompts,
            "models": selected_models
        }
    )
    
    # Start background task
    job_queue.start_background_task(
        job_id,
        _run_batch_comparison_job(job_id, {
            "video_ids": request.video_ids,
            "prompts": request.prompts,
            "models": selected_models
        })
    )
    
    return JobResponse(
        job_id=job_id,
        status="pending",
        message="Batch job created successfully. Poll /api/jobs/{job_id} for status."
    )

