#!/bin/bash
# Quick test of batch mode with curl

echo "🚀 Testing Batch Mode Background Jobs"
echo "======================================"
echo ""

# Get a few video IDs from uploads
cd backend
VIDEO_IDS=($(ls uploads/*.mp4 | head -3 | xargs -n1 basename | sed 's/\.[^.]*$//'))

if [ ${#VIDEO_IDS[@]} -lt 1 ]; then
    echo "❌ No videos found in backend/uploads/"
    echo "Please upload some videos through the UI first"
    exit 1
fi

echo "📹 Found ${#VIDEO_IDS[@]} videos:"
for vid in "${VIDEO_IDS[@]}"; do
    echo "   - $vid"
done
echo ""

# Use 2 videos and 2 prompts = 4 combinations
VIDEO_1=${VIDEO_IDS[0]}
VIDEO_2=${VIDEO_IDS[1]:-${VIDEO_IDS[0]}}  # Use first video twice if only 1 exists

PROMPT_1="Provide a brief summary of this video in 2-3 sentences."
PROMPT_2="What are the main visual elements in this video?"

echo "🎬 Creating batch job:"
echo "   Videos: $VIDEO_1, $VIDEO_2"
echo "   Prompts: 2"
echo "   Total: 2 videos × 2 prompts = 4 comparisons"
echo ""

# Start the batch job
RESPONSE=$(curl -s -X POST http://localhost:8000/api/batch-compare-async \
  -H "Content-Type: application/json" \
  -d "{
    \"video_ids\": [\"$VIDEO_1\", \"$VIDEO_2\"],
    \"prompts\": [\"$PROMPT_1\", \"$PROMPT_2\"],
    \"models\": [\"gemini-3-flash-preview\", \"gemini-2.5-flash\"]
  }")

# Extract job ID
JOB_ID=$(echo $RESPONSE | jq -r '.job_id')

if [ "$JOB_ID" == "null" ]; then
    echo "❌ Failed to create job"
    echo "$RESPONSE"
    exit 1
fi

echo "✅ Batch job created!"
echo "   Job ID: $JOB_ID"
echo ""
echo "💡 You can now lock your screen - the batch will continue!"
echo ""
echo "📊 Polling for status (Ctrl+C to stop polling - job continues)..."
echo ""

# Poll for status
while true; do
    sleep 3
    
    JOB=$(curl -s http://localhost:8000/api/jobs/$JOB_ID)
    STATUS=$(echo $JOB | jq -r '.status')
    PROGRESS=$(echo $JOB | jq -r '.progress')
    MESSAGE=$(echo $JOB | jq -r '.progress_message // "Processing..."')
    
    TIMESTAMP=$(date +"%H:%M:%S")
    printf "[%s] Status: %-10s | Progress: %3d%% | %s\n" "$TIMESTAMP" "$STATUS" "$PROGRESS" "$MESSAGE"
    
    if [ "$STATUS" == "completed" ]; then
        echo ""
        echo "✅ Batch job completed!"
        echo ""
        echo "📊 Results Summary:"
        echo "==================="
        
        RESULT=$(curl -s http://localhost:8000/api/jobs/$JOB_ID/result)
        
        TOTAL_COMPARISONS=$(echo $RESULT | jq -r '.total_combinations')
        echo "Total comparisons completed: $TOTAL_COMPARISONS"
        echo ""
        
        # Show first comparison as example
        echo "Example - First Comparison:"
        FIRST_VIDEO=$(echo $RESULT | jq -r '.comparisons[0].video_id')
        FIRST_PROMPT=$(echo $RESULT | jq -r '.comparisons[0].prompt' | cut -c1-60)
        echo "  Video: $FIRST_VIDEO"
        echo "  Prompt: ${FIRST_PROMPT}..."
        echo ""
        
        echo "  Model Results:"
        echo $RESULT | jq -r '.comparisons[0].results[] | "    - \(.model_name): \(.latency_ms / 1000)s"'
        
        echo ""
        echo "🎉 Full results available at:"
        echo "   GET http://localhost:8000/api/jobs/$JOB_ID/result"
        break
    elif [ "$STATUS" == "failed" ]; then
        echo ""
        echo "❌ Batch job failed!"
        ERROR=$(echo $JOB | jq -r '.error')
        echo "   Error: $ERROR"
        break
    elif [ "$STATUS" == "cancelled" ]; then
        echo ""
        echo "⚠️  Batch job was cancelled"
        break
    fi
done

