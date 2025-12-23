# Bolna API Compliance Check & Fixes

## Issues Fixed

### 1. ✅ Agent Creation - `agent_prompts` Structure
**Issue**: According to Bolna API docs, `agent_prompts` must be at the **top level** of the request, not inside `agent_config`.

**Fixed**:
- Created `BolnaAgentRequestV2` interface with correct structure
- Updated `createAgent()` to include `agent_prompts` at top level
- Ensured `agent_prompts` is always included (required by API)

**API Structure** (per docs):
```json
{
  "agent_config": { ... },
  "agent_prompts": {
    "task_1": {
      "system_prompt": "..."
    }
  }
}
```

### 2. ✅ Agent Update - PATCH Method
**Issue**: PATCH updates were not including `agent_prompts` at top level.

**Fixed**:
- Updated `updateAgent()` to include `agent_prompts` at top level when updating system prompt
- PATCH method correctly supports: `agent_name`, `agent_welcome_message`, `webhook_url`, `synthesizer`, `agent_prompts`, `ingest_source_config` (per API docs)

### 3. ✅ ElevenLabs Voice Configuration
**Issue**: ElevenLabs requires both `voice` and `voice_id` in `provider_config`.

**Fixed**:
- Both `createAgent()` and `updateAgent()` now ensure:
  - `voice` field is set
  - `voice_id` field is set (required for ElevenLabs)
  - `model` is set to "eleven_turbo_v2_5"
  - `sampling_rate` is set to "16000"

## Endpoints Verified

### ✅ Agent Endpoints
- **POST /v2/agent** - Create agent (fixed structure)
- **PATCH /v2/agent/{agent_id}** - Partial update (fixed)
- **PUT /v2/agent/{agent_id}** - Full update (not currently used, but available)
- **GET /v2/agent/{agent_id}** - Get agent
- **DELETE /v2/agent/{agent_id}** - Delete agent

### ✅ Knowledge Base Endpoints
- **POST /knowledgebase** - Create knowledge base (matches API)
- **GET /knowledgebase/{rag_id}** - Get knowledge base (matches API)
- **GET /knowledgebase/all** - List knowledge bases (custom endpoint, wraps Bolna API)

### ⚠️ Batch Endpoints (Not Yet Implemented)
According to API docs, there should be:
- **GET /batches/{batch_id}** - Get batch details for bulk calling campaigns

**Status**: Not currently implemented. Would need to be added for campaign bulk calling functionality.

## Testing Checklist

### Agent Creation
- [ ] Create agent with system prompt → Verify `agent_prompts` is at top level
- [ ] Create agent with ElevenLabs voice → Verify `voice` and `voice_id` are both set
- [ ] Create agent with Polly voice → Verify correct structure
- [ ] Create agent without system prompt → Verify default prompt is used

### Agent Update
- [ ] Update agent name → Verify PATCH request structure
- [ ] Update system prompt → Verify `agent_prompts` is at top level
- [ ] Update voice → Verify synthesizer config is correct
- [ ] Update multiple fields → Verify partial update works

### Knowledge Base
- [ ] Upload PDF → Verify multipart/form-data structure
- [ ] Get knowledge base → Verify response structure
- [ ] List knowledge bases → Verify response handling

### Voice Configuration
- [ ] ElevenLabs voice → Verify `voice`, `voice_id`, `model`, `sampling_rate`
- [ ] Polly voice → Verify `voice`, `engine`, `language`, `sampling_rate`
- [ ] Deepgram voice → Verify `voice`, `model`, `sampling_rate`

## Additional Fixes (Based on Reference Code)

### 4. ✅ Inbound Setup - Fixed `phone_number_id` Parameter
**Issue**: API expects `phone_number_id` (UUID) not `phone_number` (string) + `provider`.

**Fixed**:
- Updated `setupInboundCall()` to accept `phone_number_id` (UUID)
- Added helper `getPhoneNumberIdByPhoneNumber()` to look up ID from phone number string
- Function now supports both UUID and phone number string (for backward compatibility)
- Automatically looks up phone number ID if phone number string is provided

**API Structure** (per reference):
```json
{
  "agent_id": "...",
  "phone_number_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

## All Endpoints Verified Against Reference Code

### ✅ Agent Endpoints
- **POST /v2/agent** - Create agent ✓ (structure fixed)
- **PATCH /v2/agent/{agent_id}** - Partial update ✓ (structure fixed)
- **GET /v2/agent/{agent_id}** - Get agent ✓
- **DELETE /v2/agent/{agent_id}** - Delete agent ✓

### ✅ Call Endpoints
- **POST /call** - Make a call ✓
  - Supports: `agent_id`, `recipient_phone_number`, `from_phone_number`, `scheduled_at`, `user_data`
- **POST /call/{execution_id}/stop** - Stop a call ✓
- **GET /agent/{agent_id}/execution/{execution_id}** - Get execution ✓

### ✅ Inbound Setup
- **POST /inbound/setup** - Setup inbound call ✓ (fixed to use `phone_number_id`)

### ✅ Agent Management
- **POST /v2/agent/{agent_id}/stop** - Stop agent calls ✓

### ✅ Knowledge Base Endpoints
- **POST /knowledgebase** - Create knowledge base ✓
  - Uses multipart/form-data with: `file`, `chunk_size`, `similarity_top_k`, `overlapping`
- **GET /knowledgebase/{rag_id}** - Get knowledge base ✓
- **GET /knowledgebase/all** - List all knowledge bases ✓

### ✅ Voice Endpoints
- **GET /me/voices** - List all voices ✓

### ⚠️ Batch Endpoints (Not Yet Implemented)
- **GET /batches/{batch_id}** - Get batch details for bulk calling campaigns

## Next Steps

1. **Add Batch Endpoints** (if needed for campaigns):
   - Implement `getBatch(batchId)` in `BolnaClient`
   - Add route handler in `routes.ts`
   - Test batch retrieval for campaign bulk calling

2. **Test All Endpoints**:
   - Run integration tests against Bolna API
   - Verify all request/response structures match API docs
   - Test error handling
   - Test phone number ID lookup for inbound setup

3. **Documentation**:
   - Update API documentation with correct request structures
   - Add examples for each endpoint
   - Document phone number ID requirement for inbound setup

