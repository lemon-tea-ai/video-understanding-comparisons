#!/bin/bash

# Video Understanding Comparisons Backend Server
# Configured to handle large video uploads (up to 500MB)

cd "$(dirname "$0")"

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Run the Python script that has hardcoded uvicorn settings
python run.py

