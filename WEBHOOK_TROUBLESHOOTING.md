# Webhook Troubleshooting Guide

## Issue
Calls are being made but webhook updates are not being received from Bolna.

## Current Status
- ✅ Webhook URL configured: `https://7b8c477bdcbe.ngrok-free.app/api/webhooks/bolna/call-status`
- ✅ Webhook endpoint accessible and working (tested manually)
- ✅ Agent "priya" has webhook URL set correctly
- ❌ Bolna not sending webhook callbacks

## What to Check

### 1. Bolna Dashboard
Visit https://dashboard.bolna.ai and check:
- Go to "Calls" or "Call Logs"
- Find your recent call (ID: `07ad5999-b283-4e3a-80f8-6d6b44b34b0a`)
- Check if the call shows "completed" status
- Look for any webhook delivery failures

### 2. Webhook Delivery Logs in Bolna
- Check if Bolna has a "Webhooks" or "Logs" section
- Look for webhook delivery attempts
- Check for any error messages (4xx, 5xx errors)

### 3. Common Issues

**Issue**: Bolna might only send webhooks for:
- Call completion (not intermediate statuses)
- Successful calls (not failed/cancelled)
- After recording is processed (delayed)

**Solution**: Bolna might batch or delay webhooks. Wait 2-3 minutes after call ends.

**Issue**: ngrok URL changed
**Solution**: Your current ngrok URL: `https://7b8c477bdcbe.ngrok-free.app`
If ngrok restarted, you need to update all agents again.

### 4. Testing Webhook Manually

Test if webhooks work:

```bash
curl -X POST https://7b8c477bdcbe.ngrok-free.app/api/webhooks/bolna/call-status \
  -H "Content-Type: application/json" \
  -d '{
    "call_id": "YOUR_BOLNA_CALL_ID",
    "status": "completed",
    "duration": 60,
    "transcript": "Test transcript here",
    "recording_url": "https://example.com/recording.mp3",
    "metadata": {
      "callId": "YOUR_DB_CALL_ID",
      "organizationId": "YOUR_ORG_ID"
    }
  }'
```

Replace:
- `YOUR_BOLNA_CALL_ID` - from Bolna dashboard
- `YOUR_DB_CALL_ID` - from your database
- `YOUR_ORG_ID` - your organization ID

## Immediate Actions

### Run this script to update recent calls:
```bash
cd /workspaces/Megna-Voice
npx tsx scripts/check-recent-calls.ts
```

### Monitor webhook logs in real-time:
```bash
tail -f /tmp/app.log | grep "Bolna Webhook"
```

### Make a test call:
1. Make a new call using "priya" agent
2. Answer the call and talk for 10-20 seconds
3. Hang up
4. Wait 2-3 minutes
5. Check logs: `tail -50 /tmp/app.log | grep "Bolna Webhook"`

## Enhanced Logging

The webhook endpoint now logs:
- ✅ Timestamp of webhook received
- ✅ Full JSON payload from Bolna
- ✅ Which call was matched
- ✅ Status updates

Check logs with:
```bash
tail -100 /tmp/app.log | strings | grep -A 5 "Bolna Webhook"
```

## Alternative: Polling Solution

If webhooks continue to fail, we can implement a polling mechanism:

1. After initiating a call, start polling Bolna API every 10 seconds
2. Check call status via `/v1/calls/{call_id}` endpoint
3. Update database when status changes
4. Stop polling when call is completed/failed

Would you like me to implement this polling solution?

## Contact Bolna Support

If webhook issues persist:
1. Email: support@bolna.ai
2. Ask about webhook delivery for call ID: `07ad5999-b283-4e3a-80f8-6d6b44b34b0a`
3. Provide your webhook URL: `https://7b8c477bdcbe.ngrok-free.app/api/webhooks/bolna/call-status`
4. Ask if there are any webhook filtering or rate limiting policies

## Next Steps

1. **Make a test call** and wait 3 minutes
2. **Check Bolna dashboard** for webhook delivery status  
3. **Review application logs** for webhook receipts
4. If still no webhooks, **implement polling solution**
