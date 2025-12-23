# API Configuration Guide

## Overview

Megna Voice integrates with multiple external APIs to provide a complete AI voice agent platform. This guide will help you configure all necessary API integrations.

## Table of Contents

1. [Required APIs](#required-apis)
2. [Optional APIs](#optional-apis)
3. [Step-by-Step Setup](#step-by-step-setup)
4. [Webhook Configuration](#webhook-configuration)
5. [Testing Your Setup](#testing-your-setup)
6. [Troubleshooting](#troubleshooting)

---

## Required APIs

### 1. Supabase (Authentication & Database)

**Purpose:** User authentication, database storage, and real-time subscriptions

**Setup:**
1. Go to [https://supabase.com](https://supabase.com)
2. Click "New Project"
3. Fill in project details and create
4. Navigate to Project Settings > API
5. Copy the following:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` key → `SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
6. Navigate to Project Settings > Database
7. Copy `Connection String` (Transaction mode) → `DATABASE_URL`

**Environment Variables:**
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
DATABASE_URL="postgresql://postgres.your-project:password@aws-0-region.pooler.supabase.com:6543/postgres"
```

**Cost:** Free tier available (up to 500MB database, 2GB file storage)

---

### 2. Bolna AI (Voice Agent Platform)

**Purpose:** AI voice agent orchestration, voice synthesis, speech recognition

**Setup:**
1. Go to [https://bolna.ai](https://bolna.ai)
2. Sign up for an account
3. Navigate to your Dashboard
4. Copy your API key from Settings or API section

**Environment Variables:**
```bash
BOLNA_API_KEY=bn-your-api-key-here
```

**Features:**
- Create and manage AI voice agents
- Configure voice models (ElevenLabs, Google TTS, Amazon Polly)
- LLM integration (OpenAI, Anthropic, etc.)
- Knowledge base management
- Call initiation and management
- Real-time transcription
- Call analytics

**Pricing:** Check [Bolna AI Pricing](https://bolna.ai/pricing)

---

### 3. Exotel (Telephony & SMS)

**Purpose:** Phone number provisioning, call routing, SMS services

**Setup:**
1. Go to [https://exotel.com](https://exotel.com)
2. Sign up for an account
3. Navigate to Settings > API Credentials
4. Copy the following:
   - `API Key` → `EXOTEL_API_KEY`
   - `API Token/Secret` → `EXOTEL_API_SECRET`
   - `Account SID` → `EXOTEL_SID`

**Environment Variables:**
```bash
EXOTEL_API_KEY=your-api-key
EXOTEL_API_SECRET=your-api-secret
EXOTEL_SID=your-account-sid
```

**Features:**
- Virtual phone number provisioning
- Outbound call initiation
- Inbound call handling
- SMS sending (single & bulk)
- Call recording
- Call analytics
- Customer whitelist management

**Pricing:** Check [Exotel Pricing](https://exotel.com/pricing)

---

## Optional APIs

### 4. OpenAI (AI Summaries & Analysis)

**Purpose:** Enhanced AI features for call summaries and lead qualification

**Setup:**
1. Go to [https://platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Navigate to API Keys
4. Click "Create new secret key"
5. Copy the key

**Environment Variables:**
```bash
OPENAI_API_KEY=sk-your-openai-api-key-here
```

**Features (when enabled):**
- Automatic call transcription summaries
- Lead qualification analysis
- Meeting summaries with action items
- Intelligent insights extraction

**Note:** The application works fully without OpenAI. If not configured, these AI enhancement features will return placeholder messages.

**Pricing:** Check [OpenAI Pricing](https://openai.com/pricing)

---

## Step-by-Step Setup

### Initial Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Megna-Voice
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create .env file**
   ```bash
   cp .env.example .env
   ```

4. **Configure environment variables**

   Edit `.env` and add your API credentials:

   ```bash
   # Required
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   SUPABASE_ANON_KEY=your-anon-key
   DATABASE_URL="postgresql://..."
   SESSION_SECRET=$(openssl rand -base64 32)
   BOLNA_API_KEY=bn-your-key
   EXOTEL_API_KEY=your-key
   EXOTEL_API_SECRET=your-secret
   EXOTEL_SID=your-sid
   PUBLIC_WEBHOOK_URL=https://your-domain.com

   # Optional
   OPENAI_API_KEY=sk-your-key
   PORT=5000
   ```

5. **Run database migrations**
   ```bash
   npm run db:push
   ```

6. **Start the application**
   ```bash
   npm run dev
   ```

---

## Webhook Configuration

Webhooks allow external services to notify your application about events (call status changes, recordings, etc.).

### For Local Development (using ngrok)

1. **Install ngrok**
   ```bash
   # macOS
   brew install ngrok

   # Or download from https://ngrok.com
   ```

2. **Start your application**
   ```bash
   npm run dev
   ```

3. **Start ngrok**
   ```bash
   ngrok http 5000
   ```

4. **Copy the HTTPS URL**
   ```
   Forwarding: https://abc123.ngrok.io -> http://localhost:5000
   ```

5. **Update .env**
   ```bash
   PUBLIC_WEBHOOK_URL=https://abc123.ngrok.io
   ```

6. **Restart your application**

### For Production Deployment

1. Deploy your application to a hosting service (e.g., Railway, Render, AWS, etc.)
2. Get your production domain (e.g., `https://api.yourdomain.com`)
3. Update `.env`:
   ```bash
   PUBLIC_WEBHOOK_URL=https://api.yourdomain.com
   ```

### Webhook Endpoints

The application exposes these webhook endpoints:

| Service | Event | Endpoint |
|---------|-------|----------|
| Bolna | Call Status Updates | `POST /api/webhooks/bolna/call-status` |
| Exotel | Call Status Updates | `POST /api/webhooks/exotel/call-status` |
| Exotel | Recording Status | `POST /api/webhooks/exotel/call-status` |

### Configure Webhooks in External Services

#### Bolna Webhooks
Configure in Bolna dashboard when creating/updating agents:
- Webhook URL: `{PUBLIC_WEBHOOK_URL}/api/webhooks/bolna/call-status`

#### Exotel Webhooks
Configure when making calls via the API:
- Status Callback: `{PUBLIC_WEBHOOK_URL}/api/webhooks/exotel/call-status`
- Recording Callback: `{PUBLIC_WEBHOOK_URL}/api/webhooks/exotel/call-status`

These are automatically set by the application when initiating calls.

---

## Testing Your Setup

### 1. Test Database Connection

```bash
npm run db:push
```

Expected output: `✓ Database schema pushed successfully`

### 2. Test API Connections

Start the application and check the console for:

```
✓ Connected to database
✓ Bolna API configured
✓ Exotel API configured
⚠ OpenAI API not configured (optional)
✓ Server listening on port 5000
```

### 3. Test Authentication

1. Navigate to `http://localhost:5000`
2. Try to sign up/login
3. If successful, you should see the dashboard

### 4. Test Bolna Integration

```bash
# Get available voices
curl http://localhost:5000/api/bolna/voices \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"

# Get available models
curl http://localhost:5000/api/bolna/models \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

### 5. Test Exotel Integration

```bash
# Get phone numbers
curl http://localhost:5000/api/phone-numbers/sync \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

### 6. Test Webhook Reception

```bash
# Test webhook endpoint is accessible
curl -X POST https://your-ngrok-url.ngrok.io/api/webhooks/bolna/call-status \
  -H "Content-Type: application/json" \
  -d '{"call_id": "test", "status": "completed"}'
```

---

## Troubleshooting

### Issue: "Bolna API is not configured"

**Cause:** Missing or invalid `BOLNA_API_KEY`

**Solution:**
1. Check `.env` file has `BOLNA_API_KEY` set
2. Verify the key is correct (starts with `bn-`)
3. Restart the application

---

### Issue: "Exotel API is not configured"

**Cause:** Missing Exotel credentials

**Solution:**
1. Ensure all three variables are set:
   - `EXOTEL_API_KEY`
   - `EXOTEL_API_SECRET`
   - `EXOTEL_SID`
2. Verify credentials from Exotel dashboard
3. Restart the application

---

### Issue: "Failed to connect to database"

**Cause:** Invalid `DATABASE_URL`

**Solution:**
1. Check the connection string format:
   ```
   postgresql://user:password@host:port/database
   ```
2. Verify credentials in Supabase dashboard
3. Ensure you're using the "Transaction" mode connection string
4. Check if your IP is allowed in Supabase (check connection pooling settings)

---

### Issue: Webhooks not received

**Cause:** `PUBLIC_WEBHOOK_URL` not accessible or incorrect

**Solution:**
1. Verify ngrok is running (for local dev)
2. Test webhook URL is publicly accessible:
   ```bash
   curl https://your-webhook-url.com/api/webhooks/bolna/call-status
   ```
3. Check firewall settings
4. Ensure HTTPS (not HTTP) for production

---

### Issue: "OpenAI features not working"

**Cause:** Missing `OPENAI_API_KEY` (optional feature)

**Solution:**
1. Add `OPENAI_API_KEY` to `.env` if you want AI summaries
2. Or continue without it - app works fully without OpenAI
3. Restart the application

---

### Issue: Authentication errors

**Cause:** Supabase configuration issues

**Solution:**
1. Verify all Supabase variables are set correctly
2. Check Supabase dashboard for project status
3. Ensure `SESSION_SECRET` is set (generate with: `openssl rand -base64 32`)
4. Clear browser cookies and try again

---

## API Endpoints Reference

### Voice Agents
- `GET /api/ai-agents` - List all AI agents
- `POST /api/ai-agents` - Create new agent
- `GET /api/ai-agents/:id` - Get agent details
- `PATCH /api/ai-agents/:id` - Update agent
- `DELETE /api/ai-agents/:id` - Delete agent

### Calls
- `GET /api/calls` - List all calls
- `POST /api/calls/initiate` - Initiate a call
- `GET /api/calls/:id` - Get call details
- `PATCH /api/calls/:id` - Update call

### Bolna Integration
- `GET /api/bolna/voices` - Get available voices
- `GET /api/bolna/models` - Get available AI models
- `GET /api/bolna/knowledge-bases` - List knowledge bases
- `POST /api/bolna/knowledge-bases` - Upload knowledge base file
- `POST /api/bolna/inbound/setup` - Setup inbound calling

### Exotel Integration
- `GET /api/phone-numbers` - List phone numbers
- `GET /api/phone-numbers/sync` - Sync from Exotel
- `POST /api/exotel/sms` - Send SMS
- `POST /api/exotel/sms/bulk` - Send bulk SMS
- `GET /api/exotel/calls` - List Exotel calls

### Campaigns & Leads
- `GET /api/campaigns` - List campaigns
- `POST /api/campaigns` - Create campaign
- `GET /api/leads` - List leads
- `POST /api/leads` - Create lead
- `POST /api/leads/upload` - Bulk upload leads (CSV)

### Analytics
- `GET /api/dashboard/metrics` - Dashboard metrics
- `GET /api/analytics/metrics` - Analytics metrics
- `GET /api/analytics/calls` - Call analytics
- `GET /api/analytics/agents` - Agent performance

---

## Security Best Practices

1. **Never commit `.env` file** - It contains sensitive credentials
2. **Use strong SESSION_SECRET** - Generate with: `openssl rand -base64 32`
3. **Rotate API keys regularly** - Update in Supabase, Bolna, Exotel dashboards
4. **Use HTTPS in production** - Never use HTTP for PUBLIC_WEBHOOK_URL
5. **Restrict Supabase RLS policies** - Enable row-level security for production
6. **Monitor API usage** - Check dashboards for unusual activity
7. **Use environment-specific keys** - Different keys for dev/staging/production

---

## Support & Resources

- **Supabase Docs:** https://supabase.com/docs
- **Bolna AI Docs:** https://docs.bolna.ai
- **Exotel Docs:** https://developer.exotel.com
- **OpenAI Docs:** https://platform.openai.com/docs

---

## Next Steps

After completing the API configuration:

1. ✅ Test all integrations
2. ✅ Create your first AI agent
3. ✅ Provision phone numbers
4. ✅ Upload leads and create campaigns
5. ✅ Initiate test calls
6. ✅ Monitor analytics and performance

**Ready to deploy?** Check out the deployment guide in the main README.
