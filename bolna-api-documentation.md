# Bolna API Documentation

Complete API reference for Bolna Voice AI platform.

---

## Table of Contents

1. [Introduction](#introduction)
2. [Authentication](#authentication)
3. [Pagination](#pagination)
4. [Agent APIs](#agent-apis)
5. [Making Phone Calls](#making-phone-calls)
6. [Executions & Calls Data](#executions--calls-data)
7. [Phone Numbers](#phone-numbers)
8. [Inbound Agents](#inbound-agents)
9. [Batches](#batches)
10. [Knowledgebases](#knowledgebases)
11. [Providers](#providers)
12. [Sub Accounts](#sub-accounts)
13. [Voice](#voice)
14. [User](#user)

---

## Introduction

### What is the Bolna API?

The Bolna API enables you to programmatically create, configure, and manage Voice AI agents from your applications. Build voice AI capabilities into your products using simple HTTP requests from any programming language.

Bolna API features:
- Consistent, resource-oriented URLs
- Handles application/json request bodies
- Returns responses in JSON format
- Utilizes standard HTTP response codes
- Standard authentication methods
- Standard HTTP verbs

**Note:** You must have a valid Bolna account to generate and use APIs.

### Base URL

```
https://api.bolna.ai
```

---

## Authentication

### How to Generate an API Key

1. Login to the dashboard at https://platform.bolna.ai
2. Navigate to the **Developers** tab from the left menu bar after login
3. Click the button **Generate a new API Key**
4. Save your API Key securely

**Important:** The API Key will be shown only once. Please save it somewhere secure.

### Using the API Key

To authenticate your API requests, you must include your API Key in the Authorization header of HTTP requests as a Bearer token:

```
Authorization: Bearer <api_key>
```

### Example of an Authenticated API Request

```bash
GET https://api.bolna.ai/agent/all
Headers:
  Authorization: Bearer <api_key>
```

---

## Pagination

Bolna APIs support pagination using the `page_number` and `page_size` query parameters.

### Query Parameters

- `page_number` - The page number to retrieve (starting from 1)
- `page_size` - Number of records per page

### Response Fields

The API response includes:
- `page_number` - Current page number
- `page_size` - Number of records per page
- `total` - Total number of records
- `has_more` - Boolean indicating if more pages are available
- `data` - Array of records for the current page

You can utilize `has_more` in the API response to determine if you should fetch the next page.

---

## Agent APIs

Explore Bolna Voice AI Agent APIs for creating, managing, and executing autonomous voice agents.

### Endpoints

```
POST   /v2/agent
GET    /v2/agent/:agent_id
PUT    /v2/agent/:agent_id
PATCH  /v2/agent/:agent_id
GET    /v2/agent/all
GET    /v2/agent/:agent_id/executions
GET    /v2/agent/:agent_id/execution/:execution_id
DELETE /v2/agent/:agent_id
POST   /v2/agent/:agent_id/stop
```

### Agent Object Attributes

#### `agent_config`

- `agent_name` (string, required) - Name of the agent
- `agent_welcome_message` (string, required) - Initial agent welcome message. You can pass dynamic values using variables enclosed within `{}`
- `webhook_url` (string, required) - Get real-time details of call progress and call data on a webhook
- `tasks` (array, required) - Definitions and configuration for the agentic tasks
- `agent_type` (string) - Type of agent
- `ingest_source_config` (object) - Configuration for data ingestion source

#### `agent_prompts`

Prompts to be provided to the agent. It can have multiple tasks of the form `task_<task_id>`.

### Create Agent

**Endpoint:** `POST /v2/agent`

Creates a new Bolna Voice AI agent with specified configuration and prompts.

**Request Example:**

```bash
curl --request POST \
  --url https://api.bolna.ai/v2/agent \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
    "agent_config": {
      "agent_name": "Alfred",
      "tasks": [
        {
          "task_type": "conversation",
          "tools_config": {
            "llm_agent": {
              "agent_type": "simple_llm_agent",
              "agent_flow_type": "streaming",
              "routes": {
                "embedding_model": "snowflake/snowflake-arctic-embed-m",
                "routes": [
                  {
                    "route_name": "politics",
                    "utterances": [
                      "Who do you think will win the elections?",
                      "Whom would you vote for?"
                    ],
                    "response": "Hey, thanks but I do not have opinions on politics",
                    "score_threshold": 0.9
                  }
                ]
              },
              "llm_config": {
                "agent_flow_type": "streaming",
                "provider": "openai",
                "family": "openai",
                "model": "gpt-4.1-mini",
                "max_tokens": 150,
                "temperature": 0.1
              }
            },
            "synthesizer": {
              "provider": "elevenlabs",
              "provider_config": {
                "voice": "Nila",
                "voice_id": "V9LCAAi4tTlqe9JadbCo",
                "model": "eleven_turbo_v2_5"
              },
              "stream": true,
              "buffer_size": 250,
              "audio_format": "wav"
            },
            "transcriber": {
              "provider": "deepgram",
              "model": "nova-3",
              "language": "hi",
              "stream": true,
              "sampling_rate": 16000,
              "encoding": "linear16",
              "endpointing": 250
            }
          },
          "task_config": {
            "hangup_after_silence": 10,
            "incremental_delay": 400,
            "call_terminate": 90
          }
        }
      ],
      "agent_welcome_message": "How are you doing Bruce?",
      "webhook_url": null,
      "agent_type": "other"
    },
    "agent_prompts": {
      "task_1": {
        "system_prompt": "What is the Ultimate Question of Life, the Universe, and Everything?"
      }
    }
  }'
```

**Response (200):**

```json
{
  "agent_id": "3c90c3cc-0d44-4b50-8888-8dd25736052a",
  "status": "created"
}
```

### Get Agent

**Endpoint:** `GET /v2/agent/:agent_id`

Retrieves configuration and details of a specific agent.

### Update Agent

**Endpoint:** `PUT /v2/agent/:agent_id`

Updates agent configurations, tasks, and prompts to refine behavior and capabilities.

### Patch Update Agent

**Endpoint:** `PATCH /v2/agent/:agent_id`

Partially updates specific agent attributes. Currently supports updating:
- `agent_name`
- `agent_welcome_message`
- `webhook_url`
- `synthesizer`
- `agent_prompts`
- `ingest_source_config`

### List All Agents

**Endpoint:** `GET /v2/agent/all`

Retrieves all agents under your account.

### Get Agent Execution

**Endpoint:** `GET /v2/agent/:agent_id/execution/:execution_id`

Retrieves details of a specific execution for an agent.

### Get All Agent Executions

**Endpoint:** `GET /v2/agent/:agent_id/executions`

Retrieves all executions performed by a specific agent.

**Query Parameters:**
- `page_number` (integer) - Page number for pagination
- `page_size` (integer) - Number of records per page
- `status` (string) - Filter by call status
- `call_type` (string) - Filter inbound or outbound calls
- `provider` (string) - Filter by conversation provider
- `voicemail` (boolean) - Filter by voicemail
- `batch_id` (string) - Filter by specific batch_id
- `created_at_gte` (datetime) - Filter executions created after this datetime
- `created_at_lte` (datetime) - Filter executions created before this datetime

**Request Example:**

```bash
curl --request GET \
  --url https://api.bolna.ai/v2/agent/{agent_id}/executions \
  --header 'Authorization: Bearer <token>'
```

**Response (200):**

```json
{
  "page_number": 1,
  "page_size": 20,
  "total": 150,
  "has_more": true,
  "data": [
    {
      "id": "4c06b4d1-4096-4561-919a-4f94539c8d4a",
      "agent_id": "3c90c3cc-0d44-4b50-8888-8dd25736052a",
      "batch_id": "baab7cdc833145bf8dd260ff1f0a3f21",
      "conversation_time": 123,
      "total_cost": 12.5,
      "status": "completed",
      "transcript": "...",
      "created_at": "2024-01-23T01:14:37Z",
      "updated_at": "2024-01-29T18:31:22Z",
      "cost_breakdown": {
        "llm": 4.2,
        "network": 1.2,
        "platform": 2,
        "synthesizer": 6.8,
        "transcriber": 0.7
      },
      "telephony_data": {
        "duration": 42,
        "to_number": "+10123456789",
        "from_number": "+19876543007",
        "recording_url": "https://bolna-call-recordings.s3.us-east-1.amazonaws.com/...",
        "hosted_telephony": true,
        "provider": "twilio",
        "call_type": "outbound"
      }
    }
  ]
}
```

### Delete Agent

**Endpoint:** `DELETE /v2/agent/:agent_id`

Deletes a specific agent.

### Stop Agent Queued Calls

**Endpoint:** `POST /v2/agent/:agent_id/stop`

Stops all queued calls for a specific agent. This prevents any pending calls from being executed.

**Note:** This stops ALL queued calls for the given agent.

---

## Making Phone Calls

Explore Bolna Calling APIs to invoke outbound Voice AI phone calls from your agents.

### Endpoints

```
POST /call
POST /call/:execution_id/stop
```

### Make Phone Call

**Endpoint:** `POST /call`

Initiates an outbound phone call using a Bolna Voice AI agent.

**Request Body:**
- `agent_id` (string, required) - Agent ID which will initiate the outbound call
- `recipient_phone_number` (string, required) - Phone number of the recipient with country code (E.164 format)
- `from_phone_number` (string) - Phone number of the sender with country code (E.164 format)
- `scheduled_at` (string) - Scheduled date and time in ISO 8601 format with timezone
- `user_data` (object) - Additional user dynamic variables as defined in the agent prompt

**Request Example:**

```bash
curl --request POST \
  --url https://api.bolna.ai/call \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
    "agent_id": "123e4567-e89b-12d3-a456-426655440000",
    "recipient_phone_number": "+10123456789",
    "from_phone_number": "+19876543007",
    "scheduled_at": "2025-08-21T10:35:00",
    "user_data": {
      "variable1": "value1",
      "variable2": "value2"
    }
  }'
```

**Response (200):**

```json
{
  "message": "done",
  "status": "queued",
  "execution_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

### Stop Phone Call

**Endpoint:** `POST /call/:execution_id/stop`

Stops an ongoing or queued phone call.

---

## Executions & Calls Data

Access your Voice AI agents' call and conversation history using Bolna Executions APIs.

### Endpoints

```
GET /executions/:execution_id
GET /executions/:execution_id/log
GET /batch/:batch_id/executions
GET /v2/agent/:agent_id/executions
```

### Get Execution Details

**Endpoint:** `GET /executions/:execution_id`

Retrieves detailed information about a specific execution/call.

### Get Execution Raw Logs

**Endpoint:** `GET /executions/:execution_id/log`

Fetches raw logs of a specific phone call execution. This includes information such as prompts, requests, and responses by the models.

### List Batch Executions

**Endpoint:** `GET /batch/:batch_id/executions`

Retrieves all executions for a specific batch.

**Request Example:**

```bash
curl --request GET \
  --url https://api.bolna.ai/batches/{batch_id}/executions \
  --header 'Authorization: Bearer <token>'
```

**Response (200):**

```json
[
  {
    "id": 7432382142914,
    "conversation_time": 123,
    "total_cost": 12.5,
    "transcript": "...",
    "createdAt": "2024-01-23T01:14:37Z",
    "updatedAt": "2024-01-29T18:31:22Z",
    "usage_breakdown": {
      "synthesizerCharacters": 123,
      "synthesizerModel": "polly",
      "transcriberDuration": 123,
      "transcriberModel": "deepgram",
      "llmTokens": 123,
      "llmModel": {
        "gpt-3.5-turbo-16k": {
          "output": 28,
          "input": 1826
        }
      }
    }
  }
]
```

---

## Phone Numbers

Manage your phone numbers effectively using Bolna APIs.

### Endpoints

```
POST   /phone-numbers/all
GET    /phone-numbers/search
POST   /phone-numbers/buy
DELETE /phone-numbers/:phone_number_id
```

### List Phone Numbers

**Endpoint:** `GET /phone-numbers/all`

Retrieves all phone numbers associated with your account.

**Request Example:**

```bash
curl --request GET \
  --url https://api.bolna.ai/phone-numbers/all \
  --header 'Authorization: Bearer <token>'
```

**Response (200):**

```json
[
  {
    "id": "3c90c3cc0d444b5088888dd25736052a",
    "humanized_created_at": "5 minutes ago",
    "created_at": "2024-01-23T05:14:37Z",
    "updated_at": "2024-02-29T04:22:89Z",
    "renewal_at": "17th Dec, 2024",
    "phone_number": "+19876543210",
    "agent_id": "3c90c3cc-0d44-4b50-8888-8dd25736052a",
    "price": "$5.0",
    "telephony_provider": "twilio",
    "rented": true
  }
]
```

### Search Phone Numbers

**Endpoint:** `GET /phone-numbers/search`

Searches for available phone numbers to purchase.

### Search Phone Numbers

**Endpoint:** `GET /phone-numbers/search`

Searches for available phone numbers to purchase.

### Buy Phone Number

**Endpoint:** `POST /phone-numbers/buy`

Purchases a phone number for use with Bolna Voice AI agents.

**Request Body:**
- `country` (string, required) - Country code for the phone number (e.g., "US")
- `phone_number` (string, required) - E.164 formatted phone number, including country code

**Request Example:**

```bash
curl --request POST \
  --url https://api.bolna.ai/phone-numbers/buy \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
    "country": "US",
    "phone_number": "+19876543210"
  }'
```

**Response (200):**

```json
{
  "id": "133b9a7d-59b1-49c4-b62a-c4924503e38b",
  "agent_id": null,
  "bolna_owned": true,
  "deleted": false,
  "renewal": true,
  "payment_uuid": "de36c363-6a2d-4e83-ba5b-fbb8d0ac8c32",
  "phone_number": "+19876543210",
  "price": 500,
  "telephony_provider": "twilio",
  "telephony_sid": "19876543210",
  "created_at": "2025-07-27T20:51:49.468787",
  "updated_at": "2025-07-27T20:51:49.468796"
}
```

### Delete Phone Number

**Endpoint:** `DELETE /phone-numbers/:phone_number_id`

Deletes a purchased phone number to stop billing and remove it permanently from your active inventory.

**Request Example:**

```bash
curl --request DELETE \
  --url https://api.bolna.ai/phone-numbers/{phone_number_id} \
  --header 'Authorization: Bearer <token>'
```

**Response (200):**

```json
{
  "message": "The phone number has been removed from your account",
  "state": "deleted"
}
```

---

## Inbound Agents

Discover how to set up Bolna Voice AI agents to answer inbound calls.

### Endpoints

```
POST /inbound/setup
POST /inbound/unlink
```

### Set Inbound Agent

**Endpoint:** `POST /inbound/setup`

Configures a Bolna Voice AI agent to handle inbound calls automatically by associating it with a specific phone number.

**Request Body:**
- `agent_id` (string, required) - The agent ID to handle inbound calls
- `phone_number_id` (string, required) - The phone number ID to associate with the agent

**Request Example:**

```bash
curl --request POST \
  --url https://api.bolna.ai/inbound/setup \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
    "agent_id": "3c90c3cc-0d44-4b50-8888-8dd25736052a",
    "phone_number_id": "123e4567-e89b-12d3-a456-426614174000"
  }'
```

**Response (200):**

```json
{
  "url": "https://api.bolna.ai/inbound_call?agent_id=3c90c3cc-0d44-4b50-8888-8dd25736052a&user_id=28f9c34b-8eb0-4af5-8689-c2f6c4daec22",
  "phone_number": "+19876543210",
  "id": "3c90c3cc0d444b5088888dd25736052a"
}
```

### Unlink Inbound Agent

**Endpoint:** `POST /inbound/unlink`

Removes the association between an agent and a phone number.

---

## Batches

Create and schedule multiple Bolna Voice AI calls together for efficient call management.

### Endpoints

```
POST   /batches
POST   /batches/schedule
POST   /batches/:batch_id/stop
GET    /batches/:batch_id
GET    /batches/:batch_id/executions
GET    /batches/:agent_id/all
DELETE /batches/:batch_id
```

### Create Batch

**Endpoint:** `POST /batches`

Creates a new batch of calls to execute multiple calls together.

**Note:** Specific request/response schema details available through the Bolna dashboard or API documentation.

### Schedule Batch

**Endpoint:** `POST /batches/:batch_id/schedule`

Schedules a batch for execution at a specific time.

**Request Body (form-data):**
- `scheduled_at` (string, required) - The scheduled date and time in ISO 8601 format (e.g., "2024-06-04T22:40:00.000Z")

**Request Example:**

```bash
curl --request POST \
  --url https://api.bolna.ai/batches/{batch_id}/schedule \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: multipart/form-data' \
  --form scheduled_at=2024-06-04T22:40:00.000Z
```

### Stop Batch

**Endpoint:** `POST /batches/:batch_id/stop`

Stops all calls in a batch.

### Get Batch

**Endpoint:** `GET /batches/:batch_id`

Retrieves details of a specific batch.

**Request Example:**

```bash
curl --request GET \
  --url https://api.bolna.ai/batches/{batch_id} \
  --header 'Authorization: Bearer <token>'
```

**Response (200):**

```json
{
  "batch_id": "3c90c3cc0d444b5088888dd25736052a",
  "humanized_created_at": "5 minutes ago",
  "created_at": "2024-01-23T05:14:37Z",
  "updated_at": "2024-02-29T04:22:89Z",
  "status": "scheduled",
  "scheduled_at": "2024-01-29T08:30:00Z",
  "from_phone_number": "+19876543007",
  "file_name": "customers.csv",
  "valid_contacts": 7,
  "total_contacts": 11,
  "execution_status": {
    "completed": 1,
    "ringing": 10,
    "in-progress": 15
  }
}
```

### List All Batches

**Endpoint:** `GET /batches/:agent_id/all`

Lists all batches associated with a particular agent.

**Request Example:**

```bash
curl --request GET \
  --url https://api.bolna.ai/batches/{agent_id}/all \
  --header 'Authorization: Bearer <token>'
```

### List Batch Executions

**Endpoint:** `GET /batches/:batch_id/executions`

Retrieves all executions for a specific batch.

### Delete Batch

**Endpoint:** `DELETE /batches/:batch_id`

Deletes a specific batch.

**Request Example:**

```bash
curl --request DELETE \
  --url https://api.bolna.ai/batches/{batch_id} \
  --header 'Authorization: Bearer <token>'
```

**Response (200):**

```json
{
  "message": "success",
  "state": "deleted"
}
```

---

## Knowledgebases

Learn how to ingest and add knowledgebases to Bolna Voice AI agents.

### Endpoints

```
POST   /knowledgebase
GET    /knowledgebase/:rag_id
GET    /knowledgebase/all
DELETE /knowledgebase/:rag_id
```

### Create Knowledgebase

**Endpoint:** `POST /knowledgebase`

Creates a new knowledgebase for use with agents.

### Get Knowledgebase

**Endpoint:** `GET /knowledgebase/:rag_id`

Retrieves details of a specific knowledgebase.

### List All Knowledgebases

**Endpoint:** `GET /knowledgebase/all`

Lists all knowledgebases associated with your account.

### Delete Knowledgebase

**Endpoint:** `DELETE /knowledgebase/:rag_id`

Deletes a specific knowledgebase.

---

## Providers

Manage API keys and credentials for external providers (OpenAI, Deepgram, ElevenLabs, etc.).

### Endpoints

```
POST   /providers
GET    /providers
DELETE /providers/:provider_id
```

### Add Provider

**Endpoint:** `POST /providers`

Adds a new provider (API key/credential) to your account.

**Request Body:**
- `provider_name` (string, required) - Name of the provider (e.g., "OPENAI_API_KEY", "DEEPGRAM_API_KEY")
- `provider_value` (string, required) - The API key or credential value

**Note:** Specific request/response schema details available through the Bolna dashboard.

### List Providers

**Endpoint:** `GET /providers`

Retrieves all providers configured for your account.

**Request Example:**

```bash
curl --request GET \
  --url https://api.bolna.ai/providers \
  --header 'Authorization: Bearer <token>'
```

**Response (200):**

```json
[
  {
    "provider_id": "3c90c3cc-0d44-4b50-8888-8dd25736052a",
    "provider_name": "OPENAI_API_KEY",
    "provider_value": "xxxxxxxaz",
    "humanized_created_at": "7 hours ago",
    "created_at": "2024-01-29T12:44:12Z"
  }
]
```

### Remove Provider

**Endpoint:** `DELETE /providers/:provider_id`

Removes a provider from your account.

---

## Sub Accounts

**Note:** Sub-account APIs are an enterprise feature for managing multiple organizational accounts.

Manage sub-accounts for your organization, including the ability to create, retrieve, and delete sub-accounts programmatically.

### Endpoints

```
POST   /sub-accounts
GET    /sub-accounts
DELETE /sub-accounts/:sub_account_id
```

### Features

- Create test or development sub-accounts
- Manage sub-accounts for different clients or teams
- Delete sub-accounts and all their associated data
- Maintain clean organizational structure

**Note:** Contact [enterprise@bolna.ai](mailto:enterprise@bolna.ai) or schedule a call at [https://bolna.ai/meet](https://bolna.ai/meet) for more information about enterprise features.

---

## Voice

APIs for accessing voices and generating test transcripts for Bolna Voice AI agents.

### Endpoints

```
GET /me/voices
```

### List All Voices

**Endpoint:** `GET /me/voices`

Retrieves all available voices that can be used with Bolna Voice AI agents.

---

## User

APIs for managing user information and settings.

### Endpoints

```
GET  /user/me
POST /user/custom-model
```

### Get User Details

**Endpoint:** `GET /user/me`

Retrieves information about the authenticated user.

**Request Example:**

```bash
curl --request GET \
  --url https://api.bolna.ai/user/me \
  --header 'Authorization: Bearer <token>'
```

**Response (200):**

```json
{
  "id": "3c90c3cc-0d44-4b50-8888-8dd25736052a",
  "name": "Bruce Wayne",
  "email": "bruce@example.com",
  "wallet": 42.42,
  "concurrency": {
    "max": 10,
    "current": 7
  }
}
```

### Add Custom Model

**Endpoint:** `POST /user/custom-model`

Adds a custom model configuration for your account.

---

## Next Steps

Ready to integrate Bolna into your application? Here are some recommended next steps:

1. **Create an agent** - Use the `/v2/agent` endpoint to programmatically create your first agent
2. **Make outbound calls** - Use the `/call` endpoint to start making calls from your application
3. **Get execution details** - Use the `/executions/:execution_id` endpoint to retrieve call results
4. **Review configuration options** - Understand available agent configuration parameters
5. **Explore advanced features** - Learn about custom function calls and webhook configuration

For additional support:
- **Status**: Check system status at https://status.bolna.ai
- **Support**: Contact support@bolna.ai
- **Dashboard**: Access your dashboard at https://platform.bolna.ai
- **GitHub**: View open-source resources at https://github.com/bolna-ai/bolna
- **Discord**: Join the community at https://discord.com/invite/59kQWGgnm8

---

## Additional Resources

### Webhooks

Configure webhooks to receive real-time updates about call progress and data. Set the `webhook_url` in your agent configuration to receive events.

### Dynamic Variables

Pass dynamic variables in the `user_data` object when making calls. These variables can be referenced in your agent prompts using the `{variable_name}` syntax.

### E.164 Phone Number Format

All phone numbers must be in E.164 format, which includes:
- Plus sign (+)
- Country code
- Phone number (without spaces or special characters)

Example: `+19876543210`

### Error Handling

The API uses standard HTTP response codes:
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (invalid API key)
- `404` - Not Found
- `500` - Internal Server Error

---

**Last Updated:** January 2026

**API Version:** v2

**Documentation Source:** https://www.bolna.ai/docs/api-reference/introduction
