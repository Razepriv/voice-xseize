# 🔧 Webhook Real-Time Data Issue - Solution

## 📊 Diagnostic Summary

### Problems Identified:

1. **❌ All 9 recent calls stuck in "initiated" status for 2-4 days**
   - No duration, recording, or transcription data received
   - Confirms webhooks are NOT working

2. **⚠️ PUBLIC_WEBHOOK_URL missing protocol**
   - Current: `platform.automitra.ai`
   - Expected: `https://platform.automitra.ai`
   - This may cause Bolna/Exotel to reject or fail webhook deliveries

3. **⚠️ Call status polling is DISABLED**
   - Polling mechanism exists but commented out
   - Would serve as fallback when webhooks fail

## 🎯 Solutions Implemented

### Solution 1: Fix Agent Webhook URLs

Run this script to update all existing agents with correct webhook URLs:

```bash
npx tsx scripts/fix-agent-webhooks.ts
```

This will:
- ✅ Check all agents in database
- ✅ Fetch current webhook URLs from Bolna
- ✅ Update any incorrect webhook URLs
- ✅ Add `https://` protocol if missing

### Solution 2: Fix Environment Variable

Update your `.env` file:

```env
# Before
PUBLIC_WEBHOOK_URL=platform.automitra.ai

# After  
PUBLIC_WEBHOOK_URL=https://platform.automitra.ai
```

### Solution 3: Enable Call Polling as Fallback

Edit `server/routes.ts` (lines 598-607) to enable automatic polling:

```typescript
// BEFORE (currently commented out):
// if (latestCall?.bolnaCallId) {
//   console.log(`🔄 [Call Initiate] Starting automatic polling for call ${latestCall.bolnaCallId}`);
//   startCallPolling(
//     latestCall.bolnaCallId,
//     latestCall.id,
//     user.organizationId,
//     (app as any).emitCallUpdate,
//     (app as any).emitMetricsUpdate
//   );
// }

// AFTER (uncommented):
if (latestCall?.bolnaCallId) {
  console.log(`🔄 [Call Initiate] Starting automatic polling for call ${latestCall.bolnaCallId}`);
  startCallPolling(
    latestCall.bolnaCallId,
    latestCall.id,
    user.organizationId,
    (app as any).emitCallUpdate,
    (app as any).emitMetricsUpdate
  );
}
```

**Benefits:**
- Polls Bolna API every 10 seconds for call status
- Automatically stops when call completes
- Works as backup if webhooks fail
- Emits real-time updates via Socket.IO

### Solution 4: Verify Webhook Accessibility

Test if your webhook endpoint is publicly accessible:

```bash
curl -X POST https://platform.automitra.ai/api/webhooks/bolna/call-status \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-call-id",
    "status": "completed",
    "conversation_duration": 60
  }'
```

Expected response: `{"received":true,"matched":false}`

If you get connection errors, check:
- ✅ Server is running
- ✅ Port 5000 (or your PORT) is accessible
- ✅ Firewall allows incoming connections
- ✅ Domain/DNS properly configured
- ✅ HTTPS certificate valid

## 🚀 Implementation Steps

### Step 1: Fix Environment Variable
```bash
# Edit .env file
notepad .env
# Change PUBLIC_WEBHOOK_URL to include https://
# Save and restart server
```

### Step 2: Fix Existing Agents
```bash
npx tsx scripts/fix-agent-webhooks.ts
```

### Step 3: Enable Polling (Recommended)
```bash
# Edit server/routes.ts and uncomment polling code
# Then restart server
npm run dev
```

### Step 4: Test with New Call

1. Make a new test call from the platform
2. Monitor logs for:
   ```
   🔄 [Poll] Starting status polling for call <bolna-call-id>
   🔍 [Poll] Attempt 1/90 for <bolna-call-id>
   [Bolna Webhook] Received at: <timestamp>
   [Bolna Webhook] ✅ Found call <call-id>
   [Bolna Webhook] 🚀 Emitting call:updated
   ```

3. Check browser console for:
   ```
   [CallHistory] Received call:updated {status: "in_progress", ...}
   [Dashboard] Received metrics:updated event
   ```

4. Verify in UI:
   - Call status changes from "initiated" → "in_progress" → "completed"
   - Duration shows up when call ends
   - Recording URL appears
   - Dashboard metrics update in real-time

## 🔍 Monitoring & Debugging

### Check Polling Status
```bash
# View active polling jobs
curl http://localhost:5000/api/debug/polling-stats
```

### Monitor Webhook Logs
Look for these log patterns:
```
✅ [Bolna Webhook] Full payload: {...}
✅ [Bolna Webhook] Found call <id>
✅ [Bolna Webhook] Status mapped: completed -> completed
✅ [Bolna Webhook] 🚀 Emitting call:updated
✅ [Bolna Webhook] 📊 Metrics emitted
```

### Test Manually
```bash
# Simulate Bolna webhook
curl -X POST http://localhost:5000/api/webhooks/bolna/call-status \
  -H "Content-Type: application/json" \
  -d '{
    "id": "737df246-c113-4c1a-a06d-3f47e20b4623",
    "status": "completed",
    "conversation_duration": 125,
    "total_cost": 0.05,
    "context_details": {
      "recipient_data": {
        "callId": "b0e436c2-9639-40c9-8cdd-535c76f2fb07",
        "organizationId": "<your-org-id>"
      }
    }
  }'
```

## 🎯 Expected Results

After implementing these fixes:

1. **New calls** will have polling enabled as backup
2. **Webhook URLs** will be correctly formatted with `https://`
3. **Real-time updates** will work via either:
   - Webhooks (primary) - instant updates when Bolna/Exotel sends callbacks
   - Polling (fallback) - checks every 10s if webhooks fail
4. **Dashboard** will show live metrics
5. **Call History** will update automatically

## ⚠️ If Issues Persist

If webhooks still don't work after these fixes:

1. **Check Bolna Dashboard**
   - Login to https://dashboard.bolna.ai
   - View recent calls
   - Check webhook delivery status
   - Look for failed webhook attempts

2. **Verify Network Access**
   - Is your server publicly accessible?
   - Try accessing https://platform.automitra.ai from external network
   - Check firewall/security group rules
   - Verify domain resolves correctly: `nslookup platform.automitra.ai`

3. **Check Server Logs**
   - Look for connection errors
   - Check if webhook endpoint is being hit
   - Verify authentication/authorization not blocking webhooks

4. **Contact Bolna Support**
   - Email: support@bolna.ai
   - Provide: Agent IDs, Call IDs, Expected webhook URL
   - Ask about webhook retry policy and delivery logs

## 📚 Architecture Overview

```
┌─────────────┐         ┌──────────────┐         ┌──────────────┐
│   Bolna     │ webhook │    Server    │ Socket  │   Frontend   │
│   API       │────────>│  /webhooks/  │────────>│  Dashboard   │
└─────────────┘         │  bolna       │         └──────────────┘
                        │              │
      ↑                 │  emitCall    │
      │ poll (backup)   │  Update()    │
      └─────────────────┤              │
                        └──────────────┘
```

**Primary Path (Webhooks):**
1. Bolna sends POST to /api/webhooks/bolna/call-status
2. Server updates database
3. Server emits Socket.IO event to organization room
4. Frontend receives update and refreshes UI

**Fallback Path (Polling):**
1. After call initiated, start polling timer
2. Every 10s, fetch call details from Bolna API
3. Update database if status changed
4. Emit Socket.IO events
5. Stop polling when call completes or after 15 minutes

Both paths emit the same Socket.IO events, ensuring UI always stays updated.
