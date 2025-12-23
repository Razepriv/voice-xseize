# MEGNA VOICE - COMPREHENSIVE CODEBASE ANALYSIS

**Project**: Megna Voice - AI Voice Agent Platform
**Current Branch**: claude/configure-api-endpoints-01XZQrk5VxXYz8DREc5BoogM
**Last Updated**: 2025-11-20
**Tech Stack**: Express.js + React + TypeScript + Supabase + PostgreSQL

---

## 1. OVERALL PROJECT STRUCTURE & TECHNOLOGY STACK

### Architecture Overview
```
Megna-Voice/
├── server/              (Express.js backend, Node.js/TypeScript)
├── client/              (React frontend, TypeScript/TSX)
├── shared/              (Shared TypeScript schemas, types)
├── scripts/             (Utility scripts for setup & verification)
├── migrations/          (Drizzle ORM migrations)
└── attached_assets/     (Static assets)
```

### Technology Stack

**Backend (Node.js/Express):**
- Express.js (v4.21.2) - Web framework
- TypeScript (5.6.3) - Type safety
- Drizzle ORM (0.39.1) - Database ORM
- PostgreSQL via Supabase - Primary database
- Socket.io (4.8.1) - Real-time WebSocket communication
- Multer (2.0.2) - File upload handling
- PapaParse (5.5.3) - CSV parsing for bulk uploads

**Frontend (React/Vite):**
- React (18.3.1)
- Vite (5.4.20) - Build tool
- TypeScript (5.6.3)
- TailwindCSS (3.4.17) - Styling
- React Query (5.60.5) - Server state management
- React Router (Wouter 3.3.5) - Routing
- Radix UI (multiple components) - Component library
- Framer Motion (11.13.1) - Animations
- Socket.io Client (4.8.1) - WebSocket client

**Authentication & Authorization:**
- Supabase Auth (2.45.0) - User authentication
- Express-session (1.18.1) - Session management
- Passport.js (0.7.0) - Optional auth adapter
- Basic Auth (for development/testing)

**External API Integrations:**
- OpenAI (6.9.1) - AI/LLM capabilities
- Bolna AI API (v2) - Voice agent orchestration
- Exotel API (v1) - Telephony/call management
- Supabase (PostgreSQL + Auth)

---

## 2. ALL API INTEGRATIONS

### 2.1 Bolna AI Integration (Voice Agent Orchestration)

**Configuration:**
- API Key: `BOLNA_API_KEY` (environment variable)
- Base URL: `https://api.bolna.ai`
- API Version: v2 (with v1 fallback)
- Status: ✅ Fully Integrated

**Implemented Features:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| POST `/api/ai-agents` | POST | Create new AI voice agent (integrates with Bolna) |
| PATCH `/api/ai-agents/:id` | PATCH | Update agent configuration & sync to Bolna |
| DELETE `/api/ai-agents/:id` | DELETE | Delete agent from database & Bolna |
| GET `/api/ai-agents` | GET | List all AI agents for organization |
| GET `/api/ai-agents/:id` | GET | Get single agent details |
| POST `/api/calls/initiate` | POST | Initiate voice call via Bolna v2 API |
| POST `/api/calls/initiate` (fallback) | POST | Fallback to Bolna v1 if v2 fails |
| POST `/api/bolna/agents/:agentId/stop` | POST | Stop all calls for an agent |
| POST `/api/bolna/calls/:executionId/stop` | POST | Stop specific call execution |
| GET `/api/bolna/agents/:agentId/executions/:executionId` | GET | Get execution details |
| GET `/api/bolna/voices` | GET | Fetch available voice models |
| GET `/api/bolna/models` | GET | Fetch available LLM models |
| GET `/api/bolna/knowledge-bases` | GET | List knowledge bases |
| GET `/api/bolna/knowledge-bases/:ragId` | GET | Get specific knowledge base |
| POST `/api/bolna/knowledge-bases` | POST | Create knowledge base (requires file upload) |
| POST `/api/bolna/inbound/setup` | POST | Setup inbound call routing |

**Agent Configuration in Bolna:**
```typescript
{
  agent_config: {
    agent_name: string
    agent_welcome_message: string
    agent_type: string (e.g., 'conversational')
    tasks: [{
      task_type: 'conversation'
      tools_config: {
        llm_agent: { ... }
        llm_config: { model, provider, temperature, max_tokens, ... }
        synthesizer: { provider, voice, language, ... }
        transcriber: { provider: 'deepgram', model: 'nova-2', ... }
        input: { provider: 'twilio' }
        output: { provider: 'twilio' }
      }
    }]
  }
}
```

---

### 2.2 Exotel API Integration (Telephony)

**Configuration:**
- API Key: `EXOTEL_API_KEY`
- API Secret: `EXOTEL_API_SECRET`
- SID: `EXOTEL_SID` (account identifier)
- Base URLs: 
  - Main: `https://api.exotel.com/v1/Accounts/{SID}`
  - CCM: `https://ccm-api.exotel.com`
- Status: ✅ Fully Integrated

**Implemented Features:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| GET `/api/exotel/phone-numbers` | GET | List all provisioned phone numbers |
| GET `/api/exotel/phone-numbers/:phoneSid` | GET | Get specific phone number details |
| POST `/api/exotel/phone-numbers/:phoneSid` | POST | Update phone number config |
| DELETE `/api/exotel/phone-numbers/:phoneSid` | DELETE | Release phone number |
| GET `/api/exotel/available-phone-numbers` | GET | Search available numbers to provision |
| POST `/api/exotel/provision-phone-number` | POST | Provision new phone number |
| POST `/api/phone-numbers/sync` | POST | Sync phone numbers from Exotel to database |
| GET `/api/exotel/calls` | GET | List calls with filters (date range, status) |
| GET `/api/exotel/calls/:callSid` | GET | Get specific call details & recording URL |
| POST `/api/exotel/calls` | POST | Initiate outbound call |
| POST `/api/exotel/sms` | POST | Send individual SMS |
| POST `/api/exotel/sms/bulk` | POST | Send bulk SMS |
| GET `/api/exotel/sms` | GET | Get SMS messages |
| GET `/api/exotel/whitelist` | GET | Get customer whitelist |
| POST `/api/exotel/whitelist` | POST | Add phone to whitelist |
| DELETE `/api/exotel/whitelist/:whitelistSid` | DELETE | Remove from whitelist |
| GET `/api/exotel/users` (CCM) | GET | List CCM users |
| POST `/api/exotel/users` (CCM) | POST | Create CCM user |

**Call Integration with Bolna:**
```typescript
// Combined call initiation (Bolna + Exotel)
POST /api/calls/initiate
{
  agentId: string,
  recipientPhone: string,
  contactName?: string,
  fromPhone?: string,
  leadId?: string
}
// Returns: { call, bolnaCall, exotelCall }
```

---

### 2.3 OpenAI Integration (AI/LLM)

**Configuration:**
- API Key: `OPENAI_API_KEY`
- Default Model: `gpt-5` (with fallback to gpt-4)
- Status: ✅ Integrated (Optional - graceful degradation)

**Implemented Features:**

| Function | Purpose | Model |
|----------|---------|-------|
| `generateAISummary(text)` | Summarize call transcriptions | gpt-5 |
| `analyzeLeadQualification(leadData)` | Analyze lead quality & priority | gpt-5 |
| `generateMeetingSummary(transcription)` | Generate structured meeting notes | gpt-5 |

**Usage Points:**
- Automatically called when creating leads with notes
- Automatically called when updating visits with transcription
- Called when creating calls with transcription

**Fallback Behavior:** Returns placeholder text if API key missing

---

### 2.4 Supabase Integration (Auth + Database)

**Configuration:**
- URL: `SUPABASE_URL`
- Service Role Key: `SUPABASE_SERVICE_ROLE_KEY`
- Anon Key: `SUPABASE_ANON_KEY`
- Status: ✅ Core Platform Integration

**Features:**

| Component | Purpose |
|-----------|---------|
| Supabase Auth | User sign-up, login, session management |
| PostgreSQL Database | Primary data store (via Drizzle ORM) |
| Row Level Security (RLS) | Data isolation (optional, can be configured) |
| Connection Pooling | Via Supabase Pooler (`pooler.supabase.com:6543`) |

**Session Storage:**
- Table: `sessions` (PostgreSQL)
- TTL: 7 days
- Secure cookies (httpOnly, sameSite)

---

## 3. CONFIGURATION FILES & ENVIRONMENT VARIABLES

### Critical Files

| File | Purpose | Status |
|------|---------|--------|
| `.env` | Runtime environment variables | ✅ Present (with credentials) |
| `env.template` | Template for .env setup | ✅ Present |
| `package.json` | Dependencies & scripts | ✅ Complete |
| `tsconfig.json` | TypeScript configuration | ✅ Configured |
| `vite.config.ts` | Frontend build configuration | ✅ Configured |
| `drizzle.config.ts` | ORM configuration | ✅ Configured |
| `.replit` | Replit deployment config | ✅ Configured |

### Environment Variables

**Required (Must Be Set):**
```env
# Database
DATABASE_URL="postgresql://user:password@host:port/db"

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
SUPABASE_ANON_KEY=eyJhbGc...

# Session
SESSION_SECRET=your-secret-key

# Application
PORT=5000
NODE_ENV=development|production
```

**Optional (Integrations):**
```env
# Bolna AI
BOLNA_API_KEY=bn-xxxxx

# Exotel
EXOTEL_API_KEY=xxxxx
EXOTEL_API_SECRET=xxxxx
EXOTEL_SID=your-sid

# OpenAI
OPENAI_API_KEY=sk-xxxxx

# Development/Testing
DEV_LOGIN_EMAIL=test@example.com
DEV_LOGIN_PASSWORD=password123
BASIC_AUTH_ENABLED=false|true (testing mode)
MOCK_STORAGE=false|true (in-memory storage for testing)

# Webhooks
PUBLIC_WEBHOOK_URL=https://your-domain.com (for call status webhooks)
```

### Current Status in `.env`
✅ **All critical variables are configured**
- Supabase: Connected
- Bolna API Key: Set
- Exotel Credentials: Set
- Database: Connected to Supabase
- OpenAI: Not configured (optional)

---

## 4. API ENDPOINT DEFINITIONS & ROUTES

### 4.1 Authentication Routes

```
GET  /api/login              → Login page (form)
POST /api/login              → Process login
GET  /api/signup             → Signup page (form)
POST /api/signup             → Create new account
GET  /api/logout             → Clear session & redirect
GET  /api/auth/user          → Get current authenticated user
```

### 4.2 User Management

```
GET /api/users               → List all users in organization
GET /api/auth/user           → Get current authenticated user
```

### 4.3 AI Agent Management

```
GET    /api/ai-agents              → List all AI agents
GET    /api/ai-agents/:id          → Get agent details
POST   /api/ai-agents              → Create new agent
PATCH  /api/ai-agents/:id          → Update agent
DELETE /api/ai-agents/:id          → Delete agent
```

### 4.4 Call Management

```
GET  /api/calls              → List all calls
GET  /api/calls/my           → Get my calls (by agent)
GET  /api/calls/:id          → Get call details
POST /api/calls              → Create call record
POST /api/calls/initiate     → Initiate outbound call (Bolna + Exotel)
PATCH /api/calls/:id         → Update call
```

### 4.5 Bolna Endpoints

```
GET  /api/bolna/voices       → List available voices
GET  /api/bolna/models       → List available LLM models
GET  /api/bolna/knowledge-bases         → List knowledge bases
GET  /api/bolna/knowledge-bases/:ragId  → Get KB details
POST /api/bolna/knowledge-bases         → Create KB (501 Not Implemented)
POST /api/bolna/inbound/setup           → Setup inbound routing
POST /api/bolna/agents/:agentId/stop    → Stop agent calls
POST /api/bolna/calls/:executionId/stop → Stop specific call
GET  /api/bolna/agents/:agentId/executions/:executionId → Get execution
```

### 4.6 Exotel Endpoints

```
GET  /api/exotel/phone-numbers                  → List numbers
GET  /api/exotel/phone-numbers/:phoneSid        → Get number
POST /api/exotel/phone-numbers/:phoneSid        → Update number
DELETE /api/exotel/phone-numbers/:phoneSid      → Release number
GET  /api/exotel/available-phone-numbers        → Search available
POST /api/exotel/provision-phone-number         → Provision new
GET  /api/exotel/calls                          → List calls
GET  /api/exotel/calls/:callSid                 → Get call details
POST /api/exotel/calls                          → Make call
POST /api/exotel/sms                            → Send SMS
POST /api/exotel/sms/bulk                       → Bulk SMS
GET  /api/exotel/sms                            → Get SMS messages
GET  /api/exotel/whitelist                      → Get whitelist
POST /api/exotel/whitelist                      → Add to whitelist
DELETE /api/exotel/whitelist/:whitelistSid      → Remove from whitelist
```

### 4.7 Phone Numbers Management

```
GET /api/phone-numbers       → List numbers from database
GET /api/phone-numbers/sync  → Sync Exotel numbers to database
```

### 4.8 Leads Management

```
GET  /api/leads              → List all leads
GET  /api/leads/my           → Get my leads (by agent)
GET  /api/leads/:id          → Get lead details
POST /api/leads              → Create lead
POST /api/leads/upload       → Upload CSV of leads
PATCH /api/leads/:id         → Update lead
```

### 4.9 Campaigns

```
GET  /api/campaigns          → List campaigns
GET  /api/campaigns/:id      → Get campaign
POST /api/campaigns          → Create campaign
PATCH /api/campaigns/:id     → Update campaign
DELETE /api/campaigns/:id    → Delete campaign
```

### 4.10 Knowledge Base

```
GET  /api/knowledge-base     → List knowledge base items
GET  /api/knowledge-base/:id → Get item
POST /api/knowledge-base     → Create item
PATCH /api/knowledge-base/:id → Update item
DELETE /api/knowledge-base/:id → Delete item
```

### 4.11 Contacts & Channel Partners

```
GET  /api/channel-partners         → List partners
GET  /api/channel-partners/:id     → Get partner
POST /api/channel-partners         → Create partner
POST /api/channel-partners/upload  → Upload CSV
PATCH /api/channel-partners/:id    → Update partner
GET  /api/contacts                 → (Alias for channel partners)
```

### 4.12 Visits

```
GET  /api/visits             → List visits
GET  /api/visits/my          → Get my visits (by manager)
POST /api/visits             → Create visit
PATCH /api/visits/:id        → Update visit
```

### 4.13 Webhooks (Inbound)

```
POST /api/webhooks/bolna/call-status   → Bolna call status webhook
POST /api/webhooks/exotel/call-status  → Exotel call status webhook
```

### 4.14 Analytics & Dashboard

```
GET /api/dashboard/metrics   → Get dashboard KPIs
GET /api/analytics/metrics   → Get analytics metrics (7/30/90d)
GET /api/analytics/calls     → Get call analytics
GET /api/analytics/agents    → Get agent performance
GET /api/billing/metrics     → Get billing metrics
```

### 4.15 WebSocket Events (Real-time)

```
Socket Events (Socket.io):
- join:organization        → Join org-specific room
- leave:organization       → Leave org room
- call:created             → New call created
- call:updated             → Call status changed
- agent:updated            → Agent updated
- metrics:updated          → Metrics changed
```

---

## 5. MISSING OR INCOMPLETE CONFIGURATIONS

### ❌ Incomplete Features

| Feature | Status | Issue |
|---------|--------|-------|
| **POST /api/bolna/knowledge-bases** | 501 Not Implemented | Returns error: "Requires file upload. Use management page" - Needs proper multipart/form-data handling |
| **OpenAI Integration** | Optional | API key not configured in current .env - Feature gracefully degrades |
| **Inbound Call Webhooks** | Implemented | Requires PUBLIC_WEBHOOK_URL to be properly configured for webhook callbacks |
| **Settings Page** | Stub | `/settings` page exists but is mostly empty |
| **Pipelines Page** | Stub | `/pipelines` page exists but limited functionality |

### ⚠️ Configuration Gaps

1. **Webhooks Configuration**
   - `PUBLIC_WEBHOOK_URL` is set to placeholder: `https://your-ngrok-or-domain.example.com`
   - Needs to be updated with actual domain for webhook callbacks from Bolna/Exotel
   - Webhooks are at: `/api/webhooks/bolna/call-status` and `/api/webhooks/exotel/call-status`

2. **OpenAI Features**
   - `OPENAI_API_KEY` not configured
   - Features that use it:
     - Call transcript summarization
     - Lead quality analysis
     - Meeting summaries
   - Current behavior: Returns fallback messages instead of AI-generated content

3. **Inbound Routing**
   - Bolna inbound setup available: `POST /api/bolna/inbound/setup`
   - Requires phone number to be linked to agent
   - No UI currently implemented for configuration

4. **Database Migrations**
   - Drizzle ORM configured
   - Must run: `npm run db:push` to create tables
   - Migration files stored in `/migrations` directory

### ✅ What's Complete

- **Outbound Calls**: Fully functional (Bolna + Exotel integration)
- **Agent Management**: Create, read, update, delete agents with Bolna sync
- **Phone Numbers**: Full lifecycle management (provision, configure, release)
- **SMS**: Both single and bulk SMS via Exotel
- **Lead Management**: CRUD + CSV bulk upload
- **Authentication**: Supabase or basic auth (for testing)
- **Real-time Updates**: WebSocket support for call status
- **Multi-tenancy**: Organization-based data isolation
- **Analytics**: Dashboards with metrics and KPIs

---

## 6. MAIN ENTRY POINTS & APPLICATION STARTUP

### Application Startup Flow

```
1. npm run dev
   ↓
2. server/index.ts (Main Entry Point)
   - Imports dotenv/config (loads .env)
   - Creates Express app
   - Sets up JSON/URL middleware
   - Registers all routes (server/routes.ts)
   - Configures error handling
   ↓
3. server/routes.ts (registerRoutes function)
   - Calls setupAuth(app) → server/supabaseAuth.ts
   - Registers all API routes
   - Sets up WebSocket (Socket.io)
   - Creates HTTP server
   ↓
4. server/supabaseAuth.ts (Authentication Setup)
   - Initializes express-session
   - Connects to PostgreSQL session store
   - Sets up login/signup/logout routes
   - Validates JWT tokens from Supabase
   ↓
5. Creates HTTP server listening on PORT (default 5000)
   - Server waits for requests
   - Serves frontend from /dist/public (production)
   - Or via Vite dev server (development)
```

### Startup Configuration

**Development Start:**
```bash
npm run dev
→ tsx server/index.ts (TypeScript execution)
→ Watches for file changes
→ Vite dev server for frontend (http://localhost:5000)
```

**Production Start:**
```bash
npm run build
→ Builds client: vite build
→ Bundles server: esbuild server/index.ts
→ Output: dist/index.js

npm run start
→ node dist/index.js
→ Serves bundled frontend
```

### Key Initialization Files

| File | Purpose | Initialization |
|------|---------|-----------------|
| `server/index.ts` | Entry point | Creates Express app, loads middleware, starts server |
| `server/routes.ts` | Route registration | Registers all API endpoints, WebSocket, error handling |
| `server/db.ts` | Database setup | Creates Drizzle ORM instance, Pool connection |
| `server/supabaseAuth.ts` | Auth setup | Session store, Supabase clients, login/signup |
| `server/bolna.ts` | Bolna client | Singleton instance, connects to Bolna API |
| `server/exotel.ts` | Exotel client | Singleton instance, connects to Exotel API |
| `client/src/main.tsx` | Frontend entry | React app mount, QueryClient, providers |
| `client/src/App.tsx` | Frontend router | Routes, authenticated layout, theme setup |

### Environment-Specific Behavior

**Development Mode:**
- `NODE_ENV=development`
- Vite dev server running on port 5000
- Cookies: not secure (http)
- CORS: enabled for dev tools
- File watching: enabled

**Production Mode:**
- `NODE_ENV=production`
- Static files served from dist/public
- Cookies: secure (https only)
- Error messages: sanitized
- Vite plugins: disabled

### Service Initialization Order

```
1. Load .env → environment variables
2. Create DB Pool → PostgreSQL connection
3. Create Drizzle ORM instance → Database access
4. Initialize Bolna client → Singleton
5. Initialize Exotel client → Singleton
6. Initialize Supabase clients → Admin + Auth clients
7. Express app + middleware
8. Session store → PostgreSQL
9. Auth routes → Supabase integration
10. All API routes registered
11. WebSocket setup
12. Listen on port
```

### Critical Dependencies for Startup

✅ **Must Be Present:**
- `.env` with DATABASE_URL
- `.env` with SUPABASE_URL + SERVICE_ROLE_KEY
- `.env` with SESSION_SECRET
- PostgreSQL database accessible
- Node.js 20+ (from replit.nix)

⚠️ **Optional:**
- BOLNA_API_KEY (warning if missing, but continues)
- EXOTEL credentials (warning if missing, but continues)
- OPENAI_API_KEY (graceful degradation if missing)

---

## 7. DATABASE SCHEMA & MULTI-TENANCY

### Core Tables

```sql
-- Multi-tenant isolation
organizations (id, name, domain)
users (id, organizationId, email, firstName, lastName, role, profileImageUrl)

-- Voice AI Platform
ai_agents (id, organizationId, name, description, voiceId, model, provider, 
           systemPrompt, bolnaAgentId, bolnaConfig, assignedPhoneNumberId, status)

-- Telephony
phone_numbers (id, organizationId, phoneNumber, provider, exotelSid, 
               friendlyName, capabilities, status)

-- Call Management
calls (id, organizationId, leadId, agentId, contactPhone, contactName, 
       status, direction, bolnaCallId, exotelCallSid, transcription, 
       recordingUrl, duration, exotelCostPerMinute)

-- Sales Pipeline
leads (id, organizationId, campaignId, name, email, phone, company, 
       status, assignedAgent, aiSummary, notes)

campaigns (id, organizationId, name, description, status, totalLeads, 
           createdBy, createdAt)

-- Knowledge Base
knowledge_base (id, organizationId, title, content, bolnaRagId, status)

-- Visits/Meetings
visits (id, organizationId, managerId, channelPartnerId, notes, 
        transcription, summary, duration)

-- Other
channel_partners (id, organizationId, name, email, phone, company, 
                  category, status)

sessions (sid, sess, expire) -- Express-session storage
```

### Tenant Isolation

Every table has `organizationId` field for data isolation:
```typescript
// Query example
const leads = await storage.getLeads(user.organizationId)
// Enforces: WHERE organizationId = user.organizationId
```

---

## SUMMARY & RECOMMENDATIONS

### Strengths ✅
1. **Comprehensive API Integration**: Bolna, Exotel, OpenAI fully integrated
2. **Real-time Features**: WebSocket for live call status updates
3. **Multi-tenant Architecture**: Organization-based data isolation
4. **Flexible Authentication**: Supabase Auth + Basic Auth for testing
5. **Well-organized Codebase**: Clear separation of concerns
6. **Production-Ready**: Error handling, logging, env validation

### Action Items 🔧
1. **Set PUBLIC_WEBHOOK_URL** to actual domain for webhook callbacks
2. **(Optional) Configure OPENAI_API_KEY** for AI summarization features
3. **Implement Knowledge Base Upload** endpoint (currently 501)
4. **Complete Settings Page** UI/functionality
5. **Test webhook callbacks** after domain configuration

### Security Notes 🔒
- Credentials stored in `.env` (don't commit!)
- Multi-tenant isolation enforced in queries
- Session storage in PostgreSQL (persistent)
- Secure cookies in production (httpOnly, secure flag)
- Supabase RLS can be added for additional database-level security
