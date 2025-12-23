# Implementation Summary: Real-time Webhook & Call Management

## Issues Fixed

### 1. ✅ Date/Time Randomly Updating
**Problem**: Call timestamps (startedAt, endedAt) were being randomly overwritten on each webhook update.

**Root Cause**: Webhook handler was updating all fields on every request without checking if data already existed.

**Solution Implemented**:
```typescript
// Smart update strategy - only update when necessary
if (callDuration !== undefined && callDuration > 0) {
  if (!call.duration || callDuration > call.duration) {
    updates.duration = callDuration; // Only update if new value is greater
  }
}

// Only set endedAt once
if ((status === 'completed' || status === 'failed') && !call.endedAt) {
  updates.endedAt = new Date(); // Set only on first completion event
}

// Only add missing data
if (transcript && !call.transcription) {
  updates.transcription = transcript; // Don't overwrite existing
}
```

**File Modified**: [server/routes.ts](server/routes.ts#L810-L840)

---

## New Scripts Created

### 1. `fetch-call-data.ts`
Export all calls with transcripts, recordings, and URLs.

```bash
npx tsx scripts/fetch-call-data.ts <organizationId> [outputFile]
```

**Output**: JSON file with:
- All calls for organization
- Transcript and recording URLs
- Summary of missing data
- Status breakdown

**Use Case**: Audit all calls, identify missing recordings, generate reports

---

### 2. `configure-bolna-webhooks.ts`
Set webhook URLs for all agents in your organization.

```bash
npx tsx scripts/configure-bolna-webhooks.ts <organizationId> [domain]
```

**What it does**:
- Finds all agents with Bolna IDs
- Configures webhook URL
- Updates database with webhook settings
- Provides Bolna portal instructions

**Use Case**: Initial setup, update webhook domain, reconfigure after DNS changes

---

### 3. `test-webhook.ts`
Test webhook endpoint with real call data.

```bash
npx tsx scripts/test-webhook.ts <organizationId>
```

**What it does**:
- Gets a recent call from database
- Sends webhook payload to endpoint
- Verifies response
- Shows success/error details

**Use Case**: Verify webhook endpoint is working, debug delivery issues

---

### 4. `sync-bolna-calls.ts`
Sync missing data from Bolna API for historical calls.

```bash
npx tsx scripts/sync-bolna-calls.ts <organizationId>
```

**What it does**:
- Finds calls with missing transcripts/recordings
- Queries Bolna API for complete data
- Updates database with retrieved data
- Shows completion summary

**Use Case**: Backfill historical call data, fill gaps

---

## Real-time Update System

### Architecture
```
Bolna Portal (Voice Provider)
    ↓ (POST webhook)
https://platform.automitra.ai/api/webhooks/bolna/call-status
    ↓
Node.js Backend (Process webhook)
    ↓
Database Update (Save call data)
    ↓ (WebSocket emit)
Browser Clients (Display updates)
    ↓
User sees updates in real-time
```

### Data Received per Webhook
```json
{
  "id": "bolna-call-id",
  "status": "completed",
  "conversation_duration": 125,
  "total_cost": 0.625,
  "transcript": "Full call transcript...",
  "recording_url": "https://recordings.bolna.ai/xyz.mp3",
  "context_details": {
    "recipient_data": {
      "callId": "platform-call-id",
      "organizationId": "org-id"
    }
  }
}
```

### Real-time Features
- ✅ Live call status updates (initiated → ringing → in-progress → completed)
- ✅ Real-time duration counter
- ✅ Transcript display when available
- ✅ Recording links added automatically
- ✅ Cost tracking and display
- ✅ Dashboard metrics auto-update
- ✅ WebSocket emission to all connected clients
- ✅ Browser notification when call completes

---

## Setup Instructions

### Quick Start (5 minutes)

```bash
# 1. Start server if not running
npm run dev

# 2. Find your organization ID
npx tsx scripts/fetch-call-data.ts <any-id>
# This will list all organizations

# 3. Configure webhooks
npx tsx scripts/configure-bolna-webhooks.ts your-org-id https://platform.automitra.ai

# 4. Test webhook
npx tsx scripts/test-webhook.ts your-org-id

# 5. Make a call and monitor logs
# You should see "🔔 [Bolna Webhook] Received at:" in server logs
```

### Complete Setup

1. **Environment Configuration**
   - Ensure `PUBLIC_WEBHOOK_URL=https://platform.automitra.ai` in `.env`

2. **Configure in Bolna**
   - Log into Bolna portal
   - Go to Agent settings
   - Set webhook URL: `https://platform.automitra.ai/api/webhooks/bolna/call-status`

3. **Verify Connection**
   ```bash
   curl https://platform.automitra.ai/api/webhooks/bolna/call-status
   # Should return 405 Method Not Allowed (POST required)
   ```

4. **Test with Script**
   ```bash
   npx tsx scripts/test-webhook.ts your-org-id
   ```

5. **Monitor Logs**
   - Run `npm run dev` and look for "Bolna Webhook" messages
   - Make a test call
   - Watch updates appear in real-time

---

## Files Modified

| File | Changes |
|------|---------|
| [server/routes.ts](server/routes.ts) | Updated webhook handler with smart update strategy |
| [server/routes.ts](server/routes.ts) | Fixed date/time random updates |
| NEW: [scripts/fetch-call-data.ts](scripts/fetch-call-data.ts) | Created call export script |
| NEW: [scripts/configure-bolna-webhooks.ts](scripts/configure-bolna-webhooks.ts) | Created webhook config script |
| NEW: [scripts/test-webhook.ts](scripts/test-webhook.ts) | Created webhook test script |
| NEW: [scripts/sync-bolna-calls.ts](scripts/sync-bolna-calls.ts) | Created data sync script |
| NEW: [WEBHOOK_SETUP_COMPLETE.md](WEBHOOK_SETUP_COMPLETE.md) | Complete webhook documentation |
| NEW: [WEBHOOK_QUICK_START.md](WEBHOOK_QUICK_START.md) | Quick reference guide |

---

## Database Schema Unchanged

The `calls` table already has all necessary fields:
- `bolnaCallId` - Link to Bolna
- `status` - Call state
- `duration` - Seconds
- `transcription` - Text
- `recordingUrl` - URL
- `bolnaCostPerMinute` - Cost
- `startedAt`, `endedAt` - Timestamps
- `metadata` - Extra data

No migrations needed - schema was already complete.

---

## Domain Configuration

The system is set up for: **https://platform.automitra.ai**

If you need to change the domain:

```bash
# Update environment
echo 'PUBLIC_WEBHOOK_URL=https://your-domain.com' >> .env

# Reconfigure webhooks
npx tsx scripts/configure-bolna-webhooks.ts your-org-id https://your-domain.com

# Test new domain
npx tsx scripts/test-webhook.ts your-org-id
```

---

## Monitoring & Troubleshooting

### Check if Webhooks are Being Received
```bash
# In server terminal, while making a call, look for:
# 🔔 [Bolna Webhook] Received at: 2024-01-17T...
# ✅ [Bolna Webhook] Found call abc123
# 📊 [Bolna Webhook] Data received: Status, Duration, Transcription, ...
# 🚀 [Bolna Webhook] Emitting call:updated to org:org-id
```

### Verify Call Data
```bash
# Export and check
npx tsx scripts/fetch-call-data.ts your-org-id calls.json
cat calls.json | jq '.[] | {id, status, duration, recordingUrl, transcription}'
```

### Test Endpoint Directly
```bash
npx tsx scripts/test-webhook.ts your-org-id
# Should show successful webhook processing
```

### Check Browser
1. Open https://platform.automitra.ai/call-history
2. Make a test call
3. Watch the row update in real-time
4. Open browser DevTools → Console to see WebSocket messages

---

## Performance Notes

- ✅ Non-blocking webhook processing (async)
- ✅ Efficient database updates (only changed fields)
- ✅ WebSocket emission only to connected clients
- ✅ Indexed database queries for fast lookups
- ✅ Smart caching of timestamps (prevent overwrites)

---

## Security Considerations

- ✅ Organization isolation enforced (org_id validation)
- ✅ Call ownership verified before updates
- ✅ Webhook logs contain call data (be aware of PII)
- ✅ Consider adding API key authentication to webhook

Optional: Add API key validation
```typescript
// In routes.ts, before webhook handler
app.use('/api/webhooks/bolna', (req, res, next) => {
  if (req.headers['x-api-key'] !== process.env.WEBHOOK_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});
```

---

## Next Steps

1. **Immediate**: Run quick start commands to verify setup
2. **Today**: Make a test call and verify real-time updates appear
3. **This week**: Configure all agents in your organization
4. **Ongoing**: Monitor logs, use scripts to manage call data

---

## Support & Documentation

- **Quick Start**: [WEBHOOK_QUICK_START.md](WEBHOOK_QUICK_START.md) - 5-minute guide
- **Complete Setup**: [WEBHOOK_SETUP_COMPLETE.md](WEBHOOK_SETUP_COMPLETE.md) - Full documentation
- **Scripts Help**: Run each script with no arguments for usage
- **Server Logs**: Watch npm output for [Bolna Webhook] messages
- **Database**: Check `calls` table for data persistence

---

## Summary of Improvements

| Feature | Before | After |
|---------|--------|-------|
| Date/time updates | ❌ Random overwrites | ✅ Smart idempotent |
| Real-time webhooks | ❌ Manual polling | ✅ Event-driven |
| Transcript delivery | ❌ Missing/incomplete | ✅ Full support |
| Recording URLs | ❌ Not captured | ✅ Automatic capture |
| Cost tracking | ❌ Manual entry | ✅ Automatic |
| Management scripts | ❌ None | ✅ 4 utility scripts |
| Documentation | ❌ Minimal | ✅ Comprehensive |

---

**All changes have been committed and pushed to the repository.**

Ready to use! 🚀
