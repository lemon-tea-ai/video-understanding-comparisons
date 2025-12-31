#!/usr/bin/env python3
"""
Test script for async job system.

This demonstrates how jobs continue to run even if you lock your screen.

Usage:
    python test_async_jobs.py <video_id>
"""

import asyncio
import sys
import httpx
from datetime import datetime


async def test_async_comparison(video_id: str, prompt: str):
    """Test async comparison endpoint."""
    
    print(f"\n{'='*60}")
    print(f"Testing Async Comparison")
    print(f"Video ID: {video_id}")
    print(f"Prompt: {prompt[:50]}...")
    print(f"{'='*60}\n")
    
    base_url = "http://localhost:8000/api"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Start the job
        print("📤 Starting comparison job...")
        response = await client.post(
            f"{base_url}/compare-async",
            json={
                "video_id": video_id,
                "prompt": prompt,
                "models": ["gemini-3-flash-preview", "gemini-2.5-flash"]
            }
        )
        
        if response.status_code != 200:
            print(f"❌ Error: {response.status_code}")
            print(response.text)
            return
        
        job_data = response.json()
        job_id = job_data["job_id"]
        
        print(f"✅ Job created: {job_id}")
        print(f"📊 Status: {job_data['status']}")
        print(f"💡 You can now lock your screen - the job will continue!\n")
        
        # Poll for status
        print("Polling for status...\n")
        
        while True:
            await asyncio.sleep(2)  # Poll every 2 seconds
            
            status_response = await client.get(f"{base_url}/jobs/{job_id}")
            job = status_response.json()
            
            timestamp = datetime.now().strftime("%H:%M:%S")
            status = job["status"]
            progress = job["progress"]
            message = job.get("progress_message") or "Processing..."
            
            print(f"[{timestamp}] Status: {status:10} | Progress: {progress:3}% | {message}")
            
            if status == "completed":
                print(f"\n✅ Job completed!")
                print(f"\n{'='*60}")
                print("RESULTS:")
                print(f"{'='*60}\n")
                
                # Get result
                result_response = await client.get(f"{base_url}/jobs/{job_id}/result")
                result = result_response.json()
                
                for model_result in result["results"]:
                    print(f"📊 {model_result['model_name']}")
                    print(f"   Latency: {model_result['latency_ms']/1000:.2f}s")
                    if model_result.get("error"):
                        print(f"   ❌ Error: {model_result['error']}")
                    else:
                        response_text = model_result["response"][:200]
                        print(f"   Response: {response_text}...")
                    print()
                
                if result.get("overall_summary"):
                    print(f"\n📝 Summary: {result['overall_summary']}")
                
                break
                
            elif status == "failed":
                print(f"\n❌ Job failed: {job.get('error')}")
                break
                
            elif status == "cancelled":
                print(f"\n⚠️ Job was cancelled")
                break


async def test_batch_comparison(video_ids: list, prompts: list):
    """Test async batch comparison endpoint."""
    
    print(f"\n{'='*60}")
    print(f"Testing Async Batch Comparison")
    print(f"Videos: {len(video_ids)}")
    print(f"Prompts: {len(prompts)}")
    print(f"Total combinations: {len(video_ids) * len(prompts)}")
    print(f"{'='*60}\n")
    
    base_url = "http://localhost:8000/api"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Start the batch job
        print("📤 Starting batch comparison job...")
        response = await client.post(
            f"{base_url}/batch-compare-async",
            json={
                "video_ids": video_ids,
                "prompts": prompts,
                "models": ["gemini-3-flash-preview"]
            }
        )
        
        if response.status_code != 200:
            print(f"❌ Error: {response.status_code}")
            print(response.text)
            return
        
        job_data = response.json()
        job_id = job_data["job_id"]
        
        print(f"✅ Batch job created: {job_id}")
        print(f"💡 You can now lock your screen - the batch will continue!\n")
        
        # Poll for status
        print("Polling for status...\n")
        
        while True:
            await asyncio.sleep(3)  # Poll every 3 seconds for batch
            
            status_response = await client.get(f"{base_url}/jobs/{job_id}")
            job = status_response.json()
            
            timestamp = datetime.now().strftime("%H:%M:%S")
            status = job["status"]
            progress = job["progress"]
            message = job.get("progress_message") or "Processing..."
            
            print(f"[{timestamp}] Status: {status:10} | Progress: {progress:3}% | {message}")
            
            if status == "completed":
                print(f"\n✅ Batch job completed!")
                print(f"\nTotal comparisons: {job['result']['total_combinations']}")
                break
                
            elif status == "failed":
                print(f"\n❌ Batch job failed: {job.get('error')}")
                break
                
            elif status == "cancelled":
                print(f"\n⚠️ Batch job was cancelled")
                break


async def list_jobs():
    """List all jobs."""
    
    print(f"\n{'='*60}")
    print("All Jobs")
    print(f"{'='*60}\n")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get("http://localhost:8000/api/jobs")
        jobs = response.json()
        
        if not jobs:
            print("No jobs found.")
            return
        
        for job in jobs[:10]:  # Show last 10 jobs
            created = job['created_at'][:19]
            print(f"Job ID: {job['job_id']}")
            print(f"  Type: {job['job_type']}")
            print(f"  Status: {job['status']}")
            print(f"  Progress: {job['progress']}%")
            print(f"  Created: {created}")
            if job.get('error'):
                print(f"  Error: {job['error']}")
            print()


async def main():
    """Main test function."""
    
    if len(sys.argv) < 2:
        print("Usage:")
        print("  Test single comparison:")
        print("    python test_async_jobs.py <video_id>")
        print()
        print("  Test batch comparison:")
        print("    python test_async_jobs.py --batch <video_id1> <video_id2> ...")
        print()
        print("  List all jobs:")
        print("    python test_async_jobs.py --list")
        print()
        print("Example:")
        print("  python test_async_jobs.py abc123-video-id")
        return
    
    if sys.argv[1] == "--list":
        await list_jobs()
        return
    
    if sys.argv[1] == "--batch":
        video_ids = sys.argv[2:]
        if len(video_ids) < 1:
            print("❌ Provide at least one video ID for batch mode")
            return
        
        prompts = [
            "Provide a brief summary of this video.",
            "What are the key visual elements in this video?"
        ]
        
        await test_batch_comparison(video_ids, prompts)
        return
    
    # Single comparison
    video_id = sys.argv[1]
    prompt = "Provide a detailed analysis of this video with timestamps."
    
    await test_async_comparison(video_id, prompt)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n⚠️ Interrupted by user")
        print("💡 Note: The job is still running on the server!")
        print("   Use --list to check its status")

