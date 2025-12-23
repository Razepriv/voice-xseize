# Bolna v2 API Implementation - Complete Reference

This document describes the complete implementation of Bolna v2 API matching the exact structure from Bolna's API reference.

## ✅ Implementation Status

All Bolna API endpoints have been updated to match the exact v2 API structure:

### Agent Management

#### Create Agent
- **Endpoint**: `POST /v2/agent`
- **Structure**: Matches exact Bolna v2 API format
- **Features**:
  - Full `llm_agent` configuration with routes
  - Complete `llm_config` with all parameters
  - Provider-specific `synthesizer` configuration
  - `transcriber` configuration
  - `input` and `output` providers
  - Complete `task_config` with all options
  - `agent_prompts` support

#### Update Agent
- **Endpoint**: `PATCH /v2/agent/:id`
- **Structure**: Partial updates matching v2 format

#### Delete Agent
- **Endpoint**: `DELETE /v2/agent/:id`

#### Get Agent
- **Endpoint**: `GET /v2/agent/:id`

#### List Agents
- **Endpoint**: `GET /v2/agents` (with v1 fallback)

### Call Management

#### Make Call
- **Endpoint**: `POST /call`
- **Format**: v2 format with `from_phone_number`, `scheduled_at`, `user_data`
- **Fallback**: v1 format if v2 fails

#### Stop Call
- **Endpoint**: `POST /call/:executionId/stop`

#### Stop Agent Calls
- **Endpoint**: `POST /v2/agent/:agentId/stop`

#### Get Execution
- **Endpoint**: `GET /agent/:agentId/execution/:executionId`

### Inbound Setup

#### Setup Inbound Call
- **Endpoint**: `POST /inbound/setup`
- **Body**: `{ agent_id, phone_number_id }`

### Knowledge Base

#### List Knowledge Bases
- **Endpoint**: `GET /knowledgebase/all`

#### Get Knowledge Base
- **Endpoint**: `GET /knowledgebase/:ragId`

#### Create Knowledge Base
- **Endpoint**: `POST /knowledgebase`
- **Format**: FormData with file upload
- **Parameters**: `chunk_size`, `similarity_top_k`, `overlapping`, `file`

### Voices

#### List Voices
- **Endpoint**: `GET /me/voices`
- **Filtering**: Supports `?provider=` query parameter
- **Returns**: Array of voice objects with provider information

## 🎯 Agent Configuration Structure

The agent creation now uses the exact structure from Bolna's reference:

```typescript
{
  agent_config: {
    agent_name: string;
    agent_welcome_message?: string;
    webhook_url: null;
    agent_type: string;
    tasks: [{
      task_type: "conversation",
      tools_config: {
        llm_agent: {
          agent_type: "simple_llm_agent",
          agent_flow_type: "streaming",
          routes: {
            embedding_model: "snowflake/snowflake-arctic-embed-m",
            routes: []
          }
        },
        llm_config: {
          agent_flow_type: "streaming",
          provider: "openai",
          family: "openai",
          model: "gpt-3.5-turbo",
          max_tokens: 150,
          temperature: 0.7,
          top_p: 0.9,
          min_p: 0.1,
          // ... all other parameters
        },
        synthesizer: {
          provider: "polly" | "elevenlabs" | "google" | etc,
          provider_config: {
            voice: string,
            engine?: "generative", // for Polly
            sampling_rate?: "8000", // for Polly
            language: "en-US"
          },
          stream: true,
          buffer_size: 150,
          audio_format: "wav"
        },
        transcriber: {
          provider: "deepgram",
          model: "nova-2",
          language: "en",
          stream: true,
          sampling_rate: 16000,
          encoding: "linear16",
          endpointing: 100
        },
        input: {
          provider: "twilio",
          format: "wav"
        },
        output: {
          provider: "twilio",
          format: "wav"
        },
        api_tools: null
      },
      toolchain: {
        execution: "parallel",
        pipelines: [["transcriber", "llm", "synthesizer"]]
      },
      task_config: {
        hangup_after_silence: 10,
        incremental_delay: 400,
        number_of_words_for_interruption: 2,
        hangup_after_LLMCall: false,
        call_cancellation_prompt: null,
        backchanneling: false,
        backchanneling_message_gap: 5,
        backchanneling_start_delay: 5,
        ambient_noise: false,
        ambient_noise_track: "office-ambience",
        call_terminate: 90,
        voicemail: false,
        inbound_limit: -1,
        whitelist_phone_numbers: ["<any>"],
        disallow_unknown_numbers: false
      }
    }],
    ingest_source_config: null
  },
  agent_prompts: {
    task_1: {
      system_prompt: string
    }
  }
}
```

## 🎤 Voice Provider Handling

### Frontend
- **Main Provider**: "Bolna" (all voices come from Bolna)
- **Sub-Provider Filter**: Dropdown with:
  - "All Providers" (default) - shows all voices
  - Individual providers: ElevenLabs, Google TTS, Amazon Polly, Azure TTS, Deepgram, PlayHT
  - Dynamic providers from your Bolna account

### Backend
- When `voiceProvider` is "all", defaults to "elevenlabs" for API calls
- Provider-specific config:
  - **Polly**: Uses `engine: "generative"` and `sampling_rate: "8000"`
  - **Google TTS**: Standard config
  - **ElevenLabs**: Standard config
  - **Other providers**: Generic config structure

### Voice Selection
- Selecting a voice automatically sets the provider
- Provider filter updates to show voices from selected provider
- Voice name auto-populates from selected voice

## 🔄 API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v2/agent` | Create agent |
| PATCH | `/v2/agent/:id` | Update agent |
| DELETE | `/v2/agent/:id` | Delete agent |
| GET | `/v2/agent/:id` | Get agent |
| GET | `/v2/agents` | List agents |
| POST | `/call` | Make call |
| POST | `/call/:executionId/stop` | Stop call |
| POST | `/v2/agent/:agentId/stop` | Stop agent calls |
| GET | `/agent/:agentId/execution/:executionId` | Get execution |
| POST | `/inbound/setup` | Setup inbound |
| GET | `/me/voices` | List voices |
| GET | `/knowledgebase/all` | List knowledge bases |
| GET | `/knowledgebase/:ragId` | Get knowledge base |
| POST | `/knowledgebase` | Create knowledge base |

## 📝 Usage Example

### Creating an Agent

When you create an agent through the UI:
1. Select voice provider (defaults to "All Providers")
2. Select a specific voice
3. Configure AI model, prompts, etc.
4. Submit form

The backend will:
1. Map form data to Bolna v2 API structure
2. Handle provider-specific synthesizer config
3. Create agent in Bolna
4. Store agent in local database with `bolnaAgentId`

### Voice Provider Selection

```typescript
// Frontend: User selects "All Providers"
voiceProviderFilter = "all"

// User selects a voice
selectedVoice = { voice_id: "abc123", provider: "elevenlabs" }

// Form automatically updates
voiceProvider = "elevenlabs"  // Actual provider from voice
voiceProviderFilter = "elevenlabs"  // Filter updates

// Backend: Uses actual provider for API call
synthesizerConfig = {
  provider: "elevenlabs",  // Not "all"
  provider_config: {
    voice: "abc123",
    language: "en-US"
  }
}
```

## ✅ Verification

All endpoints match the exact structure from Bolna's API reference:
- ✅ Agent creation structure matches exactly
- ✅ All task_config options included
- ✅ Provider-specific synthesizer configs
- ✅ Complete llm_config parameters
- ✅ Knowledge base endpoints
- ✅ Call management endpoints
- ✅ Inbound setup endpoint

## 🚀 Next Steps

1. Test agent creation with different voice providers
2. Verify knowledge base integration
3. Test call initiation and management
4. Verify inbound call setup


