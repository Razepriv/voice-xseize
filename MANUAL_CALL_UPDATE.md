# Manual Call Data Update Guide

Since Bolna's API doesn't provide access to historical call data (they only show it in their dashboard), you can manually update calls using these methods:

## Method 1: Using the UI (Recommended)

### Step 1: Get Call Data from Bolna Dashboard
1. Log in to Bolna: https://app.bolna.ai
2. Navigate to your calls/executions
3. For each call, copy:
   - Call ID (execution ID)
   - Status (completed, failed, etc.)
   - Duration (in seconds)
   - Transcript (full conversation text)
   - Recording URL (if available)

### Step 2: Update via API Call
For each call you want to update, use this curl command:

```bash
# Get your auth token first (from browser cookies after logging in)
# Or use the API directly from the browser console

# Update a call
curl -X PATCH 'http://localhost:5000/api/calls/YOUR_CALL_ID' \
  -H 'Content-Type: application/json' \
  -H 'Cookie: connect.sid=YOUR_SESSION_COOKIE' \
  -d '{
    "status": "completed",
    "duration": 120,
    "transcription": "Agent: Hello! How can I help you today?\nUser: I need information...",
    "recordingUrl": "https://bolna-recordings.s3.amazonaws.com/xxx.mp3"
  }'
```

## Method 2: Using Browser Console (Easiest)

1. Open your application in the browser and log in
2. Open Developer Tools (F12)
3. Go to the Console tab
4. Run this function to update a call:

```javascript
async function updateCall(callId, data) {
  const response = await fetch(`/api/calls/${callId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data)
  });
  const result = await response.json();
  console.log('Updated:', result);
  return result;
}

// Example usage:
updateCall('edd0a16a-b2d7-4b4d-93c6-fd0297609f9b', {
  status: 'completed',
  duration: 180,
  transcription: 'Full conversation text here...',
  recordingUrl: 'https://bolna.ai/recording-url'
});
```

## Method 3: Bulk Update Script

Create a JSON file with your call data and use this script:

### Step 1: Create `call-updates.json`

```json
[
  {
    "callId": "edd0a16a-b2d7-4b4d-93c6-fd0297609f9b",
    "status": "completed",
    "duration": 180,
    "transcription": "Agent: Hello...\nUser: Hi...",
    "recordingUrl": "https://bolna.ai/recording1.mp3"
  },
  {
    "callId": "2823d1e7-10e7-45ec-bcbe-4ee1c14c624d",
    "status": "completed",
    "duration": 120,
    "transcription": "Agent: Good morning...",
    "recordingUrl": "https://bolna.ai/recording2.mp3"
  }
]
```

### Step 2: Run bulk update script

```bash
cd /workspaces/Megna-Voice
export $(cat .env | grep -v '^#' | xargs)
npx tsx scripts/bulk-update-calls.ts call-updates.json
```

I'll create the bulk update script for you...

## Call IDs from Your Database

Based on the earlier script run, here are your call IDs:

1. **edd0a16a-b2d7-4b4d-93c6-fd0297609f9b** (Bolna: 84604315-0953-4860-a3e4-ee0026b194b6)
2. **2823d1e7-10e7-45ec-bcbe-4ee1c14c624d** (Bolna: 6e441662-3942-4110-abf3-c3e717d034fa)
3. **4c12e93e-8dc3-4a8c-9e6b-f2c25d0b1a22** (Bolna: d7938431-7262-4b85-b6c5-c9581b62cf8d)
4. **91e8e41d-efe0-4b3f-ad44-0712ca92da3a** (Bolna: cde7bb67-87ed-475a-8b8b-eab1e8b6dd8a)
5. **b0bfc967-a6d0-413b-b5d2-f7302b298506** (Bolna: f0896716-26de-4d74-9f21-1f594d2d2b7a)

Use these IDs when updating calls.

## Tips

- **Transcript Format**: Can be plain text or formatted with "Speaker: Message" on each line
- **Duration**: Should be in seconds
- **Status**: Use: `completed`, `in_progress`, `failed`, `cancelled`
- **Recording URL**: Direct link to the audio file (MP3, WAV, etc.)

## Note

Going forward, all new calls will automatically capture this data through webhooks, so you won't need to manually update them!
