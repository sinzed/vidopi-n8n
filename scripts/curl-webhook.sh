#!/usr/bin/env bash
# curl -X POST http://localhost:5678/webhook/vidopi-wait?executionId=YOUR_EXECUTION_ID&requestId=YOUR_REQUEST_ID \
#   -H "Content-Type: application/json" \
#   -d '{"status": "completed", "video_url": "https://example.com/cut-video.mp4"}'


curl -X POST http://localhost:5678/webhook-waiting/36 \
  -H "Content-Type: application/json" \
  -d '{"status": "completed", "video_url": "https://example.com/cut-video.mp4"}'