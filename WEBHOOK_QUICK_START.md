# Quick Start: Webhook Configuration & Real-time Updates

## What Was Fixed

✅ **Date/Time Random Updates** - Implemented smart update strategy that:
- Only updates `endedAt` once (prevents multiple overwrites)
- Only updates duration if new value is greater
- Preserves original timestamps

✅ **Real-time Updates** - Full webhook implementation with:
- Call status updates (ringing → in-progress → completed)
- Transcript delivery
- Recording URLs
- Cost tracking
- Dashboard metrics refresh

✅ **Scripts for Management** - 4 utility scripts created

## Quick Start (3 Steps)

### Step 1: Configure Webhooks
```bash
npx tsx scripts/configure-bolna-webhooks.ts <your-org-id> https://platform.automitra.ai
```

### Step 2: Test Webhook
```bash
npx tsx scripts/test-webhook.ts <your-org-id>
```

### Step 3: Fetch Previous Calls
```bash
npx tsx scripts/fetch-call-data.ts <your-org-id> calls-export.json
```

## Available Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `fetch-call-data.ts` | Export all calls with transcripts/recordings | `npx tsx scripts/fetch-call-data.ts <orgId>` |
| `configure-bolna-webhooks.ts` | Set webhook URLs for all agents | `npx tsx scripts/configure-bolna-webhooks.ts <orgId>` |
| `test-webhook.ts` | Test webhook endpoint with sample data | `npx tsx scripts/test-webhook.ts <orgId>` |
| `sync-bolna-calls.ts` | Sync missing data from Bolna API | `npx tsx scripts/sync-bolna-calls.ts <orgId>` |

## What Gets Updated via Webhook

When Bolna sends a webhook, platform receives:
- ✅ Call Status (initiated → ringing → in-progress → completed/failed)
- ✅ Call Duration (in seconds)
- ✅ Transcript (full conversation text)
- ✅ Recording URL (link to MP3/audio file)
- ✅ Cost (per-minute billing)
- ✅ Metadata (custom data from Bolna)

All updates are sent **real-time to connected browser clients** via WebSocket.

## Webhook Endpoint

```
POST https://platform.automitra.ai/api/webhooks/bolna/call-status

Expected payload:
{
  "id": "bolna-call-id",
  "status": "completed",
  "conversation_duration": 120,
  "total_cost": 0.50,
  "transcript": "...",
  "recording_url": "https://...",
  "context_details": {
    "recipient_data": {
      "callId": "platform-call-id",
      "organizationId": "org-id"
    }
  }
}
```

## Monitoring

Check server logs for webhook processing:
```bash
# Look for webhook entries while making a test call
grep "Bolna Webhook" <server-output>

# You should see:
# 🔔 [Bolna Webhook] Received at: ...
# ✅ [Bolna Webhook] Found call ...
# 📊 [Bolna Webhook] Data received: Status, Duration, Transcript, ...
# 🚀 [Bolna Webhook] Emitting call:updated to org:...
```

## Browser Display

When webhooks are received, the browser:
1. Shows real-time call status changes
2. Updates duration counter
3. Displays transcript when available
4. Shows recording link when available
5. Updates dashboard metrics

**No page refresh needed** - all updates happen live via WebSocket.

## Troubleshooting

### Webhooks not arriving?
```bash
# 1. Test webhook endpoint
npx tsx scripts/test-webhook.ts <orgId>

# 2. Verify Bolna has correct URL configured
# Log into Bolna portal → Agent settings → Check webhook_url

# 3. Check server is running
npm run dev

# 4. Verify domain is accessible
curl https://platform.automitra.ai/api/webhooks/bolna/call-status
```

### Missing transcripts/recordings?
```bash
# Check what data you have
npx tsx scripts/fetch-call-data.ts <orgId> calls.json

# Try syncing from Bolna
npx tsx scripts/sync-bolna-calls.ts <orgId>
```

### Real-time updates not showing?
1. Refresh browser
2. Check WebSocket connection: Open DevTools → Network → WS
3. Look for `useWebSocket` in console
4. Verify server is emitting updates: `grep "Emitting call:updated"`

## Domain Configuration

The system is configured for: **https://platform.automitra.ai**

If using a different domain, update:
```bash
# Set in .env
PUBLIC_WEBHOOK_URL=https://your-domain.com

# Or pass when configuring
npx tsx scripts/configure-bolna-webhooks.ts <orgId> https://your-domain.com
```

## Complete Documentation

For detailed setup, troubleshooting, and advanced configuration:
See [WEBHOOK_SETUP_COMPLETE.md](./WEBHOOK_SETUP_COMPLETE.md)

## Database Schema

All call data is stored in the `calls` table:
- `id` - Unique call ID
- `bolnaCallId` - Bolna's call ID
- `status` - Current call status
- `duration` - Call length in seconds
- `transcription` - Full transcript
- `recordingUrl` - URL to recording
- `bolnaCostPerMinute` - Cost in USD
- `startedAt`, `endedAt` - Timestamps
- `metadata` - Additional data

Date/time issue fixed: Fields only updated when necessary, not on every webhook.
