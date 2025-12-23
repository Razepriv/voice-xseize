# Bolna & Exotel API Integration - Complete Guide

This document describes the complete integration with Bolna AI and Exotel APIs, including all available endpoints and features.

## ✅ What's Been Implemented

### Bolna AI Integration (v2 API)

All endpoints now use **real-time API calls** to Bolna's v2 API with full feature support:

#### 1. **Voice Management**
- **GET `/api/bolna/voices`** - Fetch all available voices from Bolna
  - Returns real-time list of voices from your Bolna account
  - Includes voice ID, name, provider, language, gender
  - Used in AI Agent creation form

#### 2. **AI Model Management**
- **GET `/api/bolna/models`** - Fetch all available AI models
  - Returns real-time list of models (GPT-3.5, GPT-4, etc.)
  - Includes model name, provider, family
  - Used in AI Agent configuration

#### 3. **Knowledge Base Management**
- **GET `/api/bolna/knowledge-bases`** - List all knowledge bases
- **GET `/api/bolna/knowledge-bases/:ragId`** - Get specific knowledge base
- **POST `/api/bolna/knowledge-bases`** - Create knowledge base (requires file upload)

#### 4. **Agent Management**
- **POST `/api/ai-agents`** - Create agent (uses Bolna v2 API)
  - Creates agent in both local database and Bolna
  - Supports full v2 agent configuration
  - Includes voice, model, prompts, tasks configuration
- **PATCH `/api/ai-agents/:id`** - Update agent (syncs to Bolna)
- **DELETE `/api/ai-agents/:id`** - Delete agent (removes from Bolna)

#### 5. **Call Management**
- **POST `/api/calls/initiate`** - Initiate call (uses Bolna v2 API)
  - Supports scheduled calls
  - Includes user data/metadata
  - Fallback to v1 if v2 fails
- **POST `/api/bolna/agents/:agentId/stop`** - Stop all calls for an agent
- **POST `/api/bolna/calls/:executionId/stop`** - Stop specific call
- **GET `/api/bolna/agents/:agentId/executions/:executionId`** - Get call execution details

#### 6. **Inbound Call Setup**
- **POST `/api/bolna/inbound/setup`** - Setup inbound call routing
  - Links agent to phone number
  - Enables inbound call handling

### Exotel Integration

All Exotel features are now fully integrated:

#### 1. **Phone Number Management**
- **GET `/api/exotel/phone-numbers`** - List all phone numbers
- **GET `/api/exotel/phone-numbers/:phoneSid`** - Get specific phone number
- **POST `/api/exotel/phone-numbers/:phoneSid`** - Update phone number
- **GET `/api/exotel/available-phone-numbers`** - Search available numbers
- **POST `/api/exotel/provision-phone-number`** - Provision new number
- **DELETE `/api/exotel/phone-numbers/:phoneSid`** - Release phone number

#### 2. **Call Management**
- **GET `/api/exotel/calls`** - List all calls (with filters)
- **GET `/api/exotel/calls/:callSid`** - Get call details
- **POST `/api/exotel/calls`** - Make a call

#### 3. **SMS Management**
- **POST `/api/exotel/sms`** - Send SMS
- **POST `/api/exotel/sms/bulk`** - Send bulk SMS
- **GET `/api/exotel/sms`** - Get SMS messages

#### 4. **Customer Whitelist**
- **GET `/api/exotel/whitelist`** - Get whitelist
- **POST `/api/exotel/whitelist`** - Add to whitelist
- **DELETE `/api/exotel/whitelist/:whitelistSid`** - Remove from whitelist

## 🔧 Configuration

### Environment Variables Required

```env
# Bolna API
BOLNA_API_KEY=your-bolna-api-key

# Exotel API
EXOTEL_API_KEY=your-exotel-api-key
EXOTEL_API_SECRET=your-exotel-api-secret
EXOTEL_SID=your-exotel-sid

# Webhook URL (for callbacks)
PUBLIC_WEBHOOK_URL=https://your-domain.com
```

## 📝 Usage Examples

### Fetching Voices (Frontend)

```typescript
const { data: voices } = useQuery({
  queryKey: ['/api/bolna/voices'],
});

// Voices will be automatically loaded when creating an agent
```

### Creating an Agent with Bolna

When you create an agent via `/api/ai-agents`, it automatically:
1. Creates the agent in your local database
2. Creates the agent in Bolna using v2 API
3. Links them together via `bolnaAgentId`
4. Stores full Bolna configuration in `bolnaConfig`

### Initiating a Call

```typescript
POST /api/calls/initiate
{
  "agentId": "agent-uuid",
  "recipientPhone": "+1234567890",
  "contactName": "John Doe",
  "fromPhone": "+0987654321", // optional
  "leadId": "lead-uuid" // optional
}
```

This will:
1. Create call record in database
2. Initiate call via Bolna v2 API
3. Optionally bridge via Exotel
4. Return call details with execution ID

### Setting Up Inbound Calls

```typescript
POST /api/bolna/inbound/setup
{
  "agentId": "bolna-agent-id",
  "phoneNumberId": "exotel-phone-number-id"
}
```

## 🎯 Real-Time Features

All endpoints now fetch **real-time data** from Bolna and Exotel APIs:

- ✅ Voices are fetched live from Bolna when creating agents
- ✅ Models are fetched live from Bolna
- ✅ Phone numbers are fetched live from Exotel
- ✅ All agent operations sync with Bolna in real-time
- ✅ Call status updates in real-time via webhooks

## 🔄 API Version

- **Bolna**: Using v2 API endpoints matching exact Bolna API structure:
  - `POST /v2/agent` - Create agent (with full v2 config structure)
  - `PATCH /v2/agent/:id` - Update agent
  - `DELETE /v2/agent/:id` - Delete agent
  - `GET /v2/agent/:id` - Get agent
  - `POST /v2/agent/:id/stop` - Stop all agent calls
  - `POST /call/:executionId/stop` - Stop specific call
  - `GET /agent/:agentId/execution/:executionId` - Get execution details
  - `POST /call` - Make call (v2 format)
  - `POST /inbound/setup` - Setup inbound calls
  - `GET /me/voices` - List voices
  - `GET /knowledgebase/all` - List knowledge bases
  - `GET /knowledgebase/:ragId` - Get knowledge base
  - `POST /knowledgebase` - Create knowledge base
- **Exotel**: Using v1 API endpoints (standard Exotel API)

## 🚀 Frontend Integration

The frontend automatically:
- Fetches voices when the agent creation dialog opens
- Fetches models when configuring AI settings
- Fetches phone numbers when assigning to agents
- Displays real-time data from APIs

## 📊 Error Handling

All endpoints include proper error handling:
- Returns detailed error messages
- Logs errors to console
- Gracefully handles API failures
- Provides fallback mechanisms where applicable

## 🔐 Authentication

All endpoints require authentication via `isAuthenticated` middleware:
- Uses Supabase Auth sessions
- Validates user organization
- Ensures tenant isolation

## 📚 Additional Resources

- [Bolna API Documentation](https://www.bolna.ai/docs)
- [Exotel API Documentation](https://developer.exotel.com/api)

## 🆘 Troubleshooting

### Voices not loading
- Check `BOLNA_API_KEY` is set correctly
- Verify API key has proper permissions
- Check network connectivity to Bolna API

### Models not loading
- Verify API key permissions
- Check if models endpoint is accessible
- Review error logs for details

### Calls not initiating
- Verify agent has `bolnaAgentId` set
- Check phone number format
- Ensure webhook URL is configured
- Review Bolna API error messages

### Exotel integration issues
- Verify all three Exotel credentials are set
- Check account status in Exotel dashboard
- Verify phone numbers are provisioned
- Review Exotel API error responses

