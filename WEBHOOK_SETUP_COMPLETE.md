# Complete Webhook Setup Guide for Bolna Integration

This guide walks you through setting up real-time webhook updates with Bolna for call status, transcripts, recordings, and costs.

## Overview

The webhook system enables:
- ✅ Real-time call status updates (ringing, in-progress, completed, failed)
- ✅ Automatic transcript delivery
- ✅ Recording URL capture
- ✅ Cost tracking and billing
- ✅ Metadata and call details
- ✅ Dashboard metrics auto-update

## Architecture

```
Bolna (Voice Platform)
    ↓
    └─→ POST /api/webhooks/bolna/call-status
        ↓
    Platform Backend (Node.js/Express)
        ↓
        ├─→ Update Call Record (Database)
        ├─→ Emit Real-time Updates (WebSocket)
        └─→ Update Dashboard Metrics
    ↓
Browser Clients (Real-time display)
```

## Setup Steps

### 1. Environment Configuration

Ensure these environment variables are set:

```bash
# .env file
PUBLIC_WEBHOOK_URL=https://platform.automitra.ai
BOLNA_API_KEY=your_bolna_api_key
DATABASE_URL=postgresql://...
```

### 2. Webhook Endpoint Verification

The webhook endpoint is automatically created at:
```
POST https://platform.automitra.ai/api/webhooks/bolna/call-status
```

Test it's accessible:
```bash
npx tsx scripts/test-webhook.ts <organizationId>
```

### 3. Configure Bolna Agents

Run the configuration script to set webhooks for all agents:

```bash
npx tsx scripts/configure-bolna-webhooks.ts <organizationId> https://platform.automitra.ai
```

This script will:
- ✅ Find all agents in your organization
- ✅ Set webhook URL in Bolna configuration
- ✅ Configure event types to capture
- ✅ Store configuration in database

### 4. Verify in Bolna Portal

1. Log in to Bolna Portal (https://portal.bolna.ai or your instance)
2. Go to Agent Settings
3. Find your agent
4. Verify webhook settings:
   - **URL**: `https://platform.automitra.ai/api/webhooks/bolna/call-status`
   - **Events**: `call_status`, `transcription`, `recording`, `cost`, `metadata`

### 5. Webhook Payload Structure

The webhook sends this payload:

```json
{
  "id": "bolna-call-id-12345",
  "status": "completed",
  "conversation_duration": 245,
  "total_cost": 1.25,
  "transcript": "Full call transcript here...",
  "recording_url": "https://bolna.ai/recordings/abc123.mp3",
  "context_details": {
    "recipient_data": {
      "callId": "platform-call-id",
      "organizationId": "org-123"
    }
  },
  "telephony_data": {
    "recording_url": "https://bolna.ai/recordings/abc123.mp3"
  },
  "call_details": {
    "duration": 245,
    "timestamp": "2024-01-17T10:30:00Z"
  },
  "metadata": {
    "agent_id": "agent-123",
    "caller_id": "callerid",
    "custom_data": {}
  }
}
```

## Data Flow and Updates

### When Webhook is Received

1. **Validation**
   - Verify call exists in database
   - Check organization ownership
   - Validate payload structure

2. **Data Updates** (Smart Update Strategy)
   - Status: Always update if changed
   - Duration: Update only if greater than current
   - Transcription: Add only if missing
   - Recording: Add only if missing
   - EndedAt: Set only once when call completes
   - Cost: Store if provided

3. **Real-time Emission**
   - Emit via WebSocket to connected clients
   - Update dashboard metrics
   - Trigger analytics recalculation

### Preventing Date/Time Issues

The system prevents random date updates with:
- Only updating `endedAt` once (guards against multiple end events)
- Only updating duration if new value is greater
- Only adding transcription/recording if they're missing
- Preserving `createdAt` and `startedAt` from first webhook

## Monitoring and Debugging

### View Webhook Logs

Check your server logs for webhook processing:

```bash
# Look for webhook entries
grep "Bolna Webhook" server.log

# Example output:
# 🔔 [Bolna Webhook] Received at: 2024-01-17T10:30:45.123Z
# ✅ [Bolna Webhook] Found call 12345 for Bolna ID xyz
# 📊 [Bolna Webhook] Data received: Status, Duration, Transcription, etc.
# 🚀 [Bolna Webhook] Emitting call:updated to org:org-123
```

### Test Webhook Manually

```bash
npx tsx scripts/test-webhook.ts <organizationId> https://platform.automitra.ai
```

### Fetch Call Data for Analysis

```bash
npx tsx scripts/fetch-call-data.ts <organizationId> output.json
```

This exports:
- All calls with their data
- Missing recordings/transcripts
- Status summary

## Troubleshooting

### Webhook Not Received

**Check:**
1. Webhook URL is publicly accessible: `curl https://platform.automitra.ai/api/webhooks/bolna/call-status`
2. Server is running: `npm run dev`
3. Firewall allows incoming requests
4. Bolna has correct webhook URL configured

**Fix:**
```bash
# Restart server
npm run dev

# Reconfigure webhook
npx tsx scripts/configure-bolna-webhooks.ts <organizationId>
```

### Data Not Updating in Real-time

**Check:**
1. WebSocket connection is established: Check browser console for `WebSocket connected`
2. Server emitters are working: Look for `🚀 Emitting call:updated` in logs
3. Database updates are persisting: Check database directly

**Fix:**
```bash
# Test webhook endpoint
npx tsx scripts/test-webhook.ts <organizationId>

# Check if call was updated
npx tsx scripts/fetch-call-data.ts <organizationId>
```

### Missing Transcripts or Recordings

**Check:**
1. Bolna is configured to capture transcripts: `transcription` in payload
2. Recording is enabled in Bolna agent settings
3. Webhook is receiving the data: Check server logs

**Fetch missing data:**
```bash
npx tsx scripts/fetch-call-data.ts <organizationId> calls.json
# Review "Calls with missing recordings" section
```

## Advanced Configuration

### Custom Webhook Headers

To add authentication headers to webhook requests (if Bolna supports):

```typescript
// In configure-bolna-webhooks.ts
const webhookConfig = {
  webhook_url: webhookUrl,
  webhook_events: [...],
  webhook_headers: {
    "Authorization": `Bearer ${process.env.BOLNA_API_KEY}`,
    "X-Custom-Header": "value"
  }
}
```

### Webhook Retry Logic

The backend automatically handles webhook retries via:
- Database persistence of all received data
- Idempotent updates (same data won't duplicate)
- Status code 202 Accepted for async processing

### Custom Metadata Handling

Add custom metadata in your Bolna agent creation:

```javascript
const agent = {
  name: "Sales Agent",
  // ... other config
  webhook_url: "https://platform.automitra.ai/api/webhooks/bolna/call-status",
  metadata: {
    department: "sales",
    campaign_id: "campaign-123",
    custom_field: "value"
  }
}
```

## Performance Considerations

- **Webhook Processing**: Async, non-blocking
- **Real-time Emission**: WebSocket to connected clients only
- **Database**: Indexed queries for fast lookups
- **Metrics**: Cached and updated on webhook receipt

## Security Notes

- ✅ Organization isolation enforced (organizational_id validation)
- ✅ Call ownership verified before updates
- ✅ Webhook payload logged (be aware of sensitive data)
- ✅ No authentication required (Bolna IP-based, if available)

To add API key authentication:
```typescript
// In routes.ts
app.post('/api/webhooks/bolna/call-status', (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.WEBHOOK_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}, webhookHandler);
```

## Example: End-to-End Test

```bash
# 1. Start server
npm run dev

# 2. Configure webhooks
npx tsx scripts/configure-bolna-webhooks.ts org-123 https://platform.automitra.ai

# 3. Make a test call (via UI or API)
curl -X POST https://platform.automitra.ai/api/calls/initiate \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "agent-123",
    "recipientPhone": "+1234567890"
  }'

# 4. Monitor logs for webhooks
# Open server terminal and look for "🔔 [Bolna Webhook]" entries

# 5. Verify data export
npx tsx scripts/fetch-call-data.ts org-123 calls.json

# 6. Check browser for real-time updates
# Open platform.automitra.ai and view Call History for live updates
```

## Support

For issues or questions:
1. Check server logs: `grep "Bolna Webhook"`
2. Run diagnostic scripts: `npx tsx scripts/fetch-call-data.ts <orgId>`
3. Test webhook: `npx tsx scripts/test-webhook.ts <orgId>`
4. Check Bolna portal configuration
5. Verify domain availability: `curl https://platform.automitra.ai`
