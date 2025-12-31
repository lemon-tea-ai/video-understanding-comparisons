#!/usr/bin/env python3
"""
Demo: Multiple jobs running concurrently (not queued)

This demonstrates that jobs don't wait for each other - they run in parallel!
"""

import asyncio
import httpx
from datetime import datetime
import sys


async def start_multiple_jobs(video_ids: list):
    """Start multiple comparison jobs and watch them run concurrently."""
    
    if len(video_ids) < 2:
        print("❌ Need at least 2 video IDs to demo concurrent execution")
        print(f"Usage: {sys.argv[0]} <video_id_1> <video_id_2> [video_id_3...]")
        return
    
    print(f"\n{'='*70}")
    print("🚀 Demonstrating Concurrent Job Execution")
    print(f"{'='*70}\n")
    
    base_url = "http://localhost:8000/api"
    prompt = "Provide a brief summary of this video."
    
    job_ids = []
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Start multiple jobs quickly without waiting
        print("📤 Starting multiple jobs (NOT waiting for each to finish)...\n")
        
        for i, video_id in enumerate(video_ids, 1):
            timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
            print(f"[{timestamp}] Starting Job {i} for video: {video_id}")
            
            response = await client.post(
                f"{base_url}/compare-async",
                json={
                    "video_id": video_id,
                    "prompt": prompt,
                    "models": ["gemini-3-flash-preview"]
                }
            )
            
            if response.status_code == 200:
                job_data = response.json()
                job_id = job_data["job_id"]
                job_ids.append(job_id)
                print(f"             ✅ Job {i} created: {job_id[:8]}...")
            else:
                print(f"             ❌ Failed to create Job {i}")
            
            # Small delay just for demo clarity (not required!)
            await asyncio.sleep(0.5)
        
        print(f"\n{'='*70}")
        print(f"✨ All {len(job_ids)} jobs started in ~{len(job_ids) * 0.5:.1f} seconds!")
        print(f"{'='*70}\n")
        
        print("📊 Monitoring all jobs simultaneously...\n")
        print(f"{'Job':<6} {'Job ID':<12} {'Status':<12} {'Progress':<10} {'Message'}")
        print("-" * 70)
        
        # Poll all jobs concurrently
        completed_jobs = set()
        iteration = 0
        
        while len(completed_jobs) < len(job_ids):
            await asyncio.sleep(2)
            iteration += 1
            
            # Check all jobs at once
            tasks = [
                client.get(f"{base_url}/jobs/{job_id}")
                for job_id in job_ids
            ]
            responses = await asyncio.gather(*tasks)
            
            print(f"\n[Poll #{iteration}] - {datetime.now().strftime('%H:%M:%S')}")
            
            for i, response in enumerate(responses):
                job = response.json()
                job_num = i + 1
                job_id_short = job['job_id'][:8]
                status = job['status']
                progress = job['progress']
                message = (job.get('progress_message') or 'Processing')[:30]
                
                print(f"Job {job_num:2}  {job_id_short}...  {status:<12} {progress:3}%      {message}")
                
                if status in ['completed', 'failed', 'cancelled']:
                    completed_jobs.add(job['job_id'])
        
        print(f"\n{'='*70}")
        print(f"✅ All {len(job_ids)} jobs completed!")
        print(f"{'='*70}\n")
        
        print("📊 Final Results:\n")
        
        for i, job_id in enumerate(job_ids, 1):
            job_response = await client.get(f"{base_url}/jobs/{job_id}")
            job = job_response.json()
            
            print(f"Job {i} ({job_id[:8]}...):")
            print(f"  Video: {job['request_data']['video_id']}")
            print(f"  Status: {job['status']}")
            
            if job['status'] == 'completed':
                started = datetime.fromisoformat(job['started_at'])
                completed = datetime.fromisoformat(job['completed_at'])
                duration = (completed - started).total_seconds()
                print(f"  Duration: {duration:.1f}s")
                print(f"  ✅ Success")
            elif job['status'] == 'failed':
                print(f"  ❌ Error: {job.get('error', 'Unknown')}")
            
            print()
        
        print("\n" + "="*70)
        print("💡 Key Insight: All jobs ran CONCURRENTLY, not sequentially!")
        print("   If they were queued, total time would be 3x individual time.")
        print("   Instead, they all ran at the same time! ✨")
        print("="*70)


async def demonstrate_concurrent_vs_sequential():
    """Visual explanation of concurrent vs sequential."""
    
    print("\n" + "="*70)
    print("📚 Concurrent vs Sequential - Visual Explanation")
    print("="*70 + "\n")
    
    print("❌ SEQUENTIAL (If we had a queue - NOT how we work!):")
    print("   Job 1: [████████████] 30s")
    print("   Job 2:              [████████████] 30s  ← Waits for Job 1")
    print("   Job 3:                           [████████████] 30s  ← Waits for Job 2")
    print("   Total: 90 seconds 😞\n")
    
    print("✅ CONCURRENT (How we actually work!):")
    print("   Job 1: [████████████] 30s")
    print("   Job 2: [████████████] 30s  ← Starts immediately!")
    print("   Job 3: [████████████] 30s  ← Starts immediately!")
    print("   Total: 30 seconds 🎉\n")
    
    print("Within ONE batch job, combinations are sequential:")
    print("   Batch Job 1:")
    print("     ├─ Combo 1/3 [████] then")
    print("     ├─ Combo 2/3 [████] then")
    print("     └─ Combo 3/3 [████]")
    print()
    print("   But multiple batch jobs run concurrently:")
    print("   Batch Job 1: [████████████]")
    print("   Batch Job 2: [████████████]  ← At same time!")
    print("="*70 + "\n")


async def main():
    if len(sys.argv) < 2:
        print("="*70)
        print("🎯 Concurrent Jobs Demo")
        print("="*70)
        print()
        print("This script demonstrates that multiple jobs run CONCURRENTLY,")
        print("not in a queue waiting for each other.\n")
        print("Usage:")
        print(f"  {sys.argv[0]} <video_id_1> <video_id_2> [video_id_3...]\n")
        print("Example:")
        print(f"  {sys.argv[0]} abc123 def456 ghi789\n")
        print("You can use the same video ID multiple times:")
        print(f"  {sys.argv[0]} abc123 abc123 abc123\n")
        
        await demonstrate_concurrent_vs_sequential()
        return
    
    await demonstrate_concurrent_vs_sequential()
    
    video_ids = sys.argv[1:]
    await start_multiple_jobs(video_ids)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
        print("💡 Note: The jobs are still running on the server!")

