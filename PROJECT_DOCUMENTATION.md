# Megna Voice - Complete Project Documentation

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Features](#features)
5. [Database Schema](#database-schema)
6. [API Documentation](#api-documentation)
7. [Setup & Installation](#setup--installation)
8. [Configuration](#configuration)
9. [Deployment](#deployment)
10. [Development Guide](#development-guide)
11. [Security](#security)
12. [Testing](#testing)
13. [Troubleshooting](#troubleshooting)

---

## Project Overview

**Megna Voice** is a comprehensive, enterprise-grade AI-powered voice agent platform designed for automated calling, lead management, and intelligent customer interactions. The platform enables organizations to create, deploy, and manage AI voice agents that can handle inbound/outbound calls, qualify leads, run campaigns, and provide real-time analytics.

### Key Capabilities

- **AI Voice Agents**: Create intelligent voice agents with customizable personalities and behaviors
- **Multi-Provider Voice Support**: Integrate with ElevenLabs, Google TTS, Amazon Polly, and more
- **Telephony Integration**: Full Exotel integration for calls and SMS
- **Lead Management**: Import, qualify, and manage leads with AI assistance
- **Campaign Orchestration**: Run targeted voice campaigns at scale
- **Real-time Analytics**: Track agent performance, call metrics, and conversion rates
- **Knowledge Base**: Upload documents to train AI agents
- **Multi-tenant Architecture**: Complete organization isolation with secure authentication
- **Real-time Updates**: WebSocket integration for live call status updates

### Use Cases

- **Sales Automation**: Automated lead qualification and follow-up calls
- **Customer Support**: AI-powered customer service agents
- **Appointment Scheduling**: Automated booking and reminder calls
- **Survey Collection**: Voice-based survey and feedback collection
- **Lead Nurturing**: Multi-touch campaign orchestration
- **Channel Partner Management**: Distribute and track partner leads

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client (React SPA)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Dashboard │  │ Agents   │  │Campaigns │  │Analytics │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/WebSocket
┌────────────────────────┴────────────────────────────────────┐
│                   Express.js Server                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Auth    │  │  Routes  │  │  Socket  │  │ Storage  │   │
│  │Middleware│  │ (70+ API)│  │   .io    │  │  Layer   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└───┬──────────────┬──────────────┬──────────────┬───────────┘
    │              │              │              │
┌───┴───┐    ┌────┴─────┐   ┌───┴────┐    ┌───┴─────┐
│Supabase│    │ Bolna AI │   │ Exotel │    │ OpenAI  │
│Auth/DB │    │  Voice   │   │Telephony│   │   AI    │
└────────┘    └──────────┘   └────────┘    └─────────┘
```

### Multi-Tenant Architecture

The platform implements strict multi-tenant isolation:

```
Organization A              Organization B
     │                           │
     ├── Users                   ├── Users
     ├── AI Agents               ├── AI Agents
     ├── Campaigns               ├── Campaigns
     ├── Leads                   ├── Leads
     ├── Calls                   ├── Calls
     └── Phone Numbers           └── Phone Numbers
```

Every database table includes an `organizationId` field, and all queries are automatically filtered to ensure data isolation.

### Request Flow

```
1. Client Request → Express Router
2. Authentication Middleware → Verify Supabase JWT
3. Organization Context Middleware → Extract organizationId
4. Route Handler → Business Logic
5. Storage Layer → Drizzle ORM Queries (filtered by orgId)
6. PostgreSQL Database → Data Retrieval
7. Response → JSON/WebSocket
```

---

## Technology Stack

### Backend

| Technology | Purpose | Version |
|------------|---------|---------|
| **Node.js** | Runtime environment | 18+ |
| **Express.js** | Web framework | 4.21.2 |
| **TypeScript** | Type safety | Latest |
| **Drizzle ORM** | Database ORM | 0.39.1 |
| **PostgreSQL** | Database | Latest |
| **Supabase** | Auth & Database hosting | Latest |
| **Socket.io** | Real-time communication | 4.8.1 |
| **Zod** | Schema validation | 3.24.2 |

### Frontend

| Technology | Purpose | Version |
|------------|---------|---------|
| **React** | UI framework | 18.3.1 |
| **Vite** | Build tool | Latest |
| **TypeScript** | Type safety | Latest |
| **TailwindCSS** | Styling | Latest |
| **Radix UI** | UI components | Latest |
| **TanStack Query** | Data fetching | 5.60.5 |
| **Wouter** | Routing | 3.3.5 |
| **Recharts** | Data visualization | 2.15.2 |
| **Framer Motion** | Animations | 11.13.1 |

### External APIs

| Service | Purpose | Documentation |
|---------|---------|---------------|
| **Bolna AI** | Voice agent orchestration | [docs.bolna.ai](https://docs.bolna.ai) |
| **Exotel** | Telephony (calls/SMS) | [developer.exotel.com](https://developer.exotel.com) |
| **OpenAI** | AI enhancements (optional) | [platform.openai.com](https://platform.openai.com) |
| **ElevenLabs** | Voice synthesis | Via Bolna |
| **Google TTS** | Voice synthesis | Via Bolna |
| **Amazon Polly** | Voice synthesis | Via Bolna |

---

## Features

### 1. AI Voice Agent Management

**Create & Configure Agents**
- Custom system prompts and personality
- Multiple AI models (GPT-4, Claude, Gemini, etc.)
- Voice provider selection (ElevenLabs, Polly, Google)
- Language and accent configuration
- Knowledge base integration
- Call duration and token limits
- Temperature and creativity controls

**Agent Capabilities**
- Natural conversation flow
- Context retention across calls
- Lead qualification
- Appointment scheduling
- FAQ handling
- Sentiment analysis
- Call transfer/forwarding

### 2. Campaign Management

**Campaign Types**
- **Outbound Campaigns**: Automated calling sequences
- **Drip Campaigns**: Multi-touch follow-ups
- **Event-based Campaigns**: Triggered by lead actions
- **A/B Testing**: Compare agent performance

**Features**
- CSV lead upload
- Agent assignment
- Schedule configuration
- Priority management
- Real-time progress tracking
- Performance analytics

### 3. Lead Management

**Lead Sources**
- Manual entry
- CSV bulk upload
- API integration
- Web form capture
- Channel partner referrals

**Lead Operations**
- AI-powered qualification
- Custom field mapping
- Tag management
- Status tracking
- Call history
- Note taking
- Task assignment

### 4. Call Management

**Call Types**
- Outbound calls (initiated by campaigns or manual)
- Inbound calls (routed to AI agents)
- Transfer calls (agent to human handoff)

**Call Features**
- Real-time status updates (WebSocket)
- Call recording
- Automatic transcription
- AI-generated summaries
- Sentiment analysis
- Duration tracking
- Cost calculation

### 5. Analytics & Reporting

**Dashboard Metrics**
- Total calls (today, week, month)
- Call duration statistics
- Conversion rates
- Cost per call
- Agent performance scores
- Lead qualification rates

**Reports**
- Call history reports
- Campaign performance
- Agent comparison
- Lead funnel analysis
- Revenue tracking
- Time-series charts

### 6. Knowledge Base

**Document Upload**
- Supported formats: PDF, TXT, DOC/DOCX
- Automatic text extraction
- Chunking and vectorization
- RAG (Retrieval Augmented Generation)

**Knowledge Base Features**
- Per-agent assignment
- Multi-document support
- Automatic indexing
- Version control
- Search and preview

### 7. Phone Number Management

**Features**
- Sync from Exotel
- Agent assignment
- Call forwarding rules
- SMS capabilities
- Usage tracking
- Number pooling

### 8. Multi-tenant Features

**Organization Management**
- Whitelabel branding
- Custom domain
- Logo and color customization
- Credit/wallet system
- User role management

**User Roles**
- **Admin**: Full system access
- **Agent Manager**: Create/manage agents and campaigns
- **Analyst**: View-only analytics access
- **Developer**: API access

---

## Database Schema

### Core Tables

#### `organizations`
```typescript
{
  id: string (PK)
  name: string
  domain: string (unique)
  companyName: string
  logoUrl: string
  primaryColor: string
  credits: number
  createdAt: timestamp
  updatedAt: timestamp
}
```

#### `users`
```typescript
{
  id: string (PK)
  organizationId: string (FK)
  email: string (unique)
  firstName: string
  lastName: string
  profileImageUrl: string
  role: 'admin' | 'agent_manager' | 'analyst' | 'developer'
  createdAt: timestamp
  updatedAt: timestamp
}
```

#### `ai_agents`
```typescript
{
  id: string (PK)
  organizationId: string (FK)
  name: string
  description: string
  voiceId: string
  voiceName: string
  language: string
  model: string (e.g., 'gpt-4')
  provider: string (e.g., 'openai')
  systemPrompt: text
  userPrompt: text
  firstMessage: text
  temperature: number
  maxDuration: number
  maxTokens: number
  voiceProvider: string
  knowledgeBaseIds: string[]
  assignedPhoneNumberId: string (FK)
  callForwardingEnabled: boolean
  callForwardingNumber: string
  bolnaAgentId: string
  bolnaConfig: json
  status: string
  totalCalls: number
  totalMessages: number
  avgRating: number
  lastUsedAt: timestamp
  createdBy: string (FK)
  createdAt: timestamp
  updatedAt: timestamp
}
```

#### `campaigns`
```typescript
{
  id: string (PK)
  organizationId: string (FK)
  name: string
  description: string
  type: 'outbound' | 'inbound' | 'mixed'
  status: 'draft' | 'active' | 'paused' | 'completed'
  agentId: string (FK)
  phoneNumberId: string (FK)
  startDate: timestamp
  endDate: timestamp
  maxCallsPerDay: number
  totalLeads: number
  completedCalls: number
  successfulCalls: number
  failedCalls: number
  avgCallDuration: number
  conversionRate: number
  createdBy: string (FK)
  createdAt: timestamp
  updatedAt: timestamp
}
```

#### `leads`
```typescript
{
  id: string (PK)
  organizationId: string (FK)
  campaignId: string (FK)
  firstName: string
  lastName: string
  email: string
  phone: string
  company: string
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'
  score: number
  tags: string[]
  customFields: json
  source: string
  assignedTo: string (FK)
  lastContactedAt: timestamp
  createdAt: timestamp
  updatedAt: timestamp
}
```

#### `calls`
```typescript
{
  id: string (PK)
  organizationId: string (FK)
  agentId: string (FK)
  campaignId: string (FK)
  leadId: string (FK)
  callSid: string (unique)
  direction: 'inbound' | 'outbound'
  status: 'queued' | 'ringing' | 'in-progress' | 'completed' | 'failed'
  fromNumber: string
  toNumber: string
  duration: number
  recordingUrl: string
  transcription: text
  summary: text
  sentiment: string
  cost: number
  startedAt: timestamp
  endedAt: timestamp
  bolnaCallId: string
  exotelCallSid: string
  metadata: json
  createdAt: timestamp
  updatedAt: timestamp
}
```

#### `phone_numbers`
```typescript
{
  id: string (PK)
  organizationId: string (FK)
  phoneNumber: string (unique)
  friendlyName: string
  country: string
  provider: 'exotel' | 'plivo' | 'twilio'
  exotelSid: string
  capabilities: json
  assignedAgentId: string (FK)
  status: 'active' | 'inactive'
  createdAt: timestamp
  updatedAt: timestamp
}
```

#### `knowledge_base`
```typescript
{
  id: string (PK)
  organizationId: string (FK)
  agentId: string (FK)
  name: string
  description: string
  type: 'pdf' | 'txt' | 'doc' | 'url'
  fileUrl: string
  fileSize: number
  chunks: number
  bolnaKbId: string
  status: 'processing' | 'ready' | 'failed'
  createdBy: string (FK)
  createdAt: timestamp
  updatedAt: timestamp
}
```

### Indexes

All tables include indexes on:
- `organizationId` (for tenant isolation)
- `createdAt` (for time-based queries)
- Foreign key relationships
- Frequently queried fields (status, phone numbers, etc.)

---

## API Documentation

### Authentication

All API requests require authentication via Supabase JWT token.

**Headers:**
```
Authorization: Bearer <supabase_jwt_token>
```

### Base URL

```
Development: http://localhost:5000/api
Production: https://your-domain.com/api
```

### API Endpoints

#### Authentication

```http
GET /api/auth/user
Response: { user: User, organization: Organization }

POST /api/auth/signup
Body: { email, password, firstName, lastName, organizationName }
Response: { user: User, session: Session }

POST /api/auth/signin
Body: { email, password }
Response: { user: User, session: Session }

POST /api/auth/signout
Response: { success: true }
```

#### AI Agents

```http
GET /api/ai-agents
Query: ?status=active&search=name
Response: { agents: AiAgent[] }

POST /api/ai-agents
Body: CreateAiAgentInput
Response: { agent: AiAgent }

GET /api/ai-agents/:id
Response: { agent: AiAgent }

PATCH /api/ai-agents/:id
Body: UpdateAiAgentInput
Response: { agent: AiAgent }

DELETE /api/ai-agents/:id
Response: { success: true }

GET /api/ai-agents/:id/calls
Response: { calls: Call[] }

GET /api/ai-agents/:id/metrics
Response: { totalCalls, avgDuration, conversionRate, ... }
```

#### Campaigns

```http
GET /api/campaigns
Query: ?status=active&agentId=xxx
Response: { campaigns: Campaign[] }

POST /api/campaigns
Body: CreateCampaignInput
Response: { campaign: Campaign }

GET /api/campaigns/:id
Response: { campaign: Campaign, stats: CampaignStats }

PATCH /api/campaigns/:id
Body: UpdateCampaignInput
Response: { campaign: Campaign }

DELETE /api/campaigns/:id
Response: { success: true }

POST /api/campaigns/:id/start
Response: { campaign: Campaign }

POST /api/campaigns/:id/pause
Response: { campaign: Campaign }

POST /api/campaigns/:id/resume
Response: { campaign: Campaign }

GET /api/campaigns/:id/leads
Response: { leads: Lead[] }
```

#### Leads

```http
GET /api/leads
Query: ?status=new&campaignId=xxx&search=name
Response: { leads: Lead[], total: number }

POST /api/leads
Body: CreateLeadInput
Response: { lead: Lead }

POST /api/leads/upload
Body: FormData (CSV file)
Response: { imported: number, failed: number, errors: [] }

GET /api/leads/:id
Response: { lead: Lead, calls: Call[], notes: Note[] }

PATCH /api/leads/:id
Body: UpdateLeadInput
Response: { lead: Lead }

DELETE /api/leads/:id
Response: { success: true }

POST /api/leads/:id/qualify
Response: { lead: Lead, qualification: AIQualification }
```

#### Calls

```http
GET /api/calls
Query: ?status=completed&agentId=xxx&startDate=xxx&endDate=xxx
Response: { calls: Call[], total: number }

POST /api/calls/initiate
Body: { leadId, agentId, phoneNumberId }
Response: { call: Call }

GET /api/calls/:id
Response: { call: Call, transcript: Transcript }

PATCH /api/calls/:id
Body: { status, metadata }
Response: { call: Call }

GET /api/calls/:id/recording
Response: { recordingUrl: string }

GET /api/calls/:id/transcript
Response: { transcript: Transcript[] }

POST /api/calls/:id/summarize
Response: { summary: string, sentiment: string }
```

#### Phone Numbers

```http
GET /api/phone-numbers
Response: { phoneNumbers: PhoneNumber[] }

GET /api/phone-numbers/sync
Response: { synced: number, phoneNumbers: PhoneNumber[] }

POST /api/phone-numbers
Body: { phoneNumber, provider, capabilities }
Response: { phoneNumber: PhoneNumber }

PATCH /api/phone-numbers/:id
Body: { assignedAgentId, status }
Response: { phoneNumber: PhoneNumber }

DELETE /api/phone-numbers/:id
Response: { success: true }
```

#### Knowledge Base

```http
GET /api/knowledge-bases
Query: ?agentId=xxx
Response: { knowledgeBases: KnowledgeBase[] }

POST /api/knowledge-bases
Body: FormData (file, name, description, agentId)
Response: { knowledgeBase: KnowledgeBase }

GET /api/knowledge-bases/:id
Response: { knowledgeBase: KnowledgeBase }

DELETE /api/knowledge-bases/:id
Response: { success: true }
```

#### Bolna Integration

```http
GET /api/bolna/voices
Response: { voices: Voice[] }

GET /api/bolna/models
Response: { models: Model[] }

GET /api/bolna/knowledge-bases
Response: { knowledgeBases: BolnaKB[] }

POST /api/bolna/knowledge-bases
Body: FormData (file)
Response: { knowledgeBase: BolnaKB }
```

#### Exotel Integration

```http
POST /api/exotel/sms
Body: { to, from, body }
Response: { smsSid: string }

POST /api/exotel/sms/bulk
Body: { contacts: [], message }
Response: { sent: number, failed: number }

GET /api/exotel/calls
Query: ?startDate=xxx&endDate=xxx
Response: { calls: ExotelCall[] }

GET /api/exotel/phone-numbers
Response: { phoneNumbers: ExotelNumber[] }
```

#### Analytics

```http
GET /api/dashboard/metrics
Response: {
  totalCalls, totalMinutes, avgDuration,
  conversionRate, totalLeads, qualifiedLeads,
  activeAgents, activeCampaigns, ...
}

GET /api/analytics/calls
Query: ?startDate=xxx&endDate=xxx&groupBy=day
Response: { data: TimeSeriesData[] }

GET /api/analytics/agents
Response: { agents: AgentPerformance[] }

GET /api/analytics/campaigns
Response: { campaigns: CampaignPerformance[] }
```

#### Webhooks

```http
POST /api/webhooks/bolna/call-status
Body: BolnaWebhookPayload
Response: { received: true }

POST /api/webhooks/exotel/call-status
Body: ExotelWebhookPayload
Response: { received: true }
```

### Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

**HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Validation Error
- `500` - Internal Server Error

---

## Setup & Installation

### Prerequisites

- **Node.js** 18+ and npm
- **PostgreSQL** database (via Supabase)
- **Bolna AI** account and API key
- **Exotel** account and credentials
- (Optional) **OpenAI** API key

### Step 1: Clone Repository

```bash
git clone <repository-url>
cd Megna-Voice
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Environment Configuration

```bash
# Copy environment template
cp env.template .env
```

Edit `.env` file with your credentials:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
DATABASE_URL="postgresql://postgres..."

# Security
SESSION_SECRET=$(openssl rand -base64 32)

# Bolna AI
BOLNA_API_KEY=bn-your-key

# Exotel
EXOTEL_API_KEY=your-key
EXOTEL_API_SECRET=your-secret
EXOTEL_SID=your-sid

# Application
PUBLIC_WEBHOOK_URL=https://your-domain.com
PORT=5000

# Optional
OPENAI_API_KEY=sk-your-key
BASIC_AUTH_ENABLED=false
MOCK_STORAGE=false
AUTH_REDIRECT_URL=https://your-domain.com
```

### Step 4: Database Setup

```bash
# Push database schema
npm run db:push

# Verify setup
npm run db:verify
```

### Step 5: Start Development Server

```bash
npm run dev
```

Application will be available at `http://localhost:5000`

### Local Development with Webhooks

Use ngrok to expose your local server:

```bash
# Start application
npm run dev

# In another terminal
ngrok http 5000

# Copy the HTTPS URL to .env
PUBLIC_WEBHOOK_URL=https://abc123.ngrok-free.app
```

---

## Configuration

### Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `SUPABASE_URL` | Yes | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Yes | Supabase public API key | `eyJhbGc...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key | `eyJhbGc...` |
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://...` |
| `SESSION_SECRET` | Yes | Session encryption secret | Random 32-char string |
| `BOLNA_API_KEY` | Yes | Bolna AI API key | `bn-xxx` |
| `EXOTEL_API_KEY` | Yes | Exotel API key | `xxx` |
| `EXOTEL_API_SECRET` | Yes | Exotel API secret | `xxx` |
| `EXOTEL_SID` | Yes | Exotel account SID | `xxx` |
| `PUBLIC_WEBHOOK_URL` | Yes | Public webhook URL | `https://domain.com` |
| `PORT` | No | Server port (default: 5000) | `5000` |
| `OPENAI_API_KEY` | No | OpenAI API key (optional) | `sk-xxx` |
| `BASIC_AUTH_ENABLED` | No | Use basic auth (dev only) | `false` |
| `MOCK_STORAGE` | No | Use mock storage (testing) | `false` |
| `AUTH_REDIRECT_URL` | No | Auth redirect URL | `https://domain.com` |

### NPM Scripts

```json
{
  "dev": "Start development server",
  "build": "Build for production",
  "start": "Start production server",
  "check": "TypeScript type checking",
  "db:push": "Push database schema",
  "db:verify": "Verify database setup",
  "auth:setup": "Setup Supabase auth",
  "env:init": "Copy env.template to .env",
  "test": "Run Jest tests"
}
```

---

## Deployment

### Production Checklist

- [ ] Set up production Supabase project
- [ ] Configure all environment variables
- [ ] Set `NODE_ENV=production`
- [ ] Configure `PUBLIC_WEBHOOK_URL` with production domain
- [ ] Run database migrations: `npm run db:push`
- [ ] Build application: `npm run build`
- [ ] Set up SSL certificate
- [ ] Configure monitoring and logging
- [ ] Test webhooks

### Deployment Platforms

#### Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create new project
railway init

# Add environment variables
railway variables set SUPABASE_URL=xxx

# Deploy
railway up
```

#### Render

1. Create new Web Service
2. Connect GitHub repository
3. Set build command: `npm run build`
4. Set start command: `npm start`
5. Add environment variables
6. Deploy

#### Fly.io

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Launch app
fly launch

# Set environment variables
fly secrets set SUPABASE_URL=xxx

# Deploy
fly deploy
```

### Environment Variables for Production

```bash
NODE_ENV=production
SUPABASE_URL=https://your-prod-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-prod-key
SUPABASE_ANON_KEY=your-prod-anon-key
DATABASE_URL="postgresql://prod-connection-string"
SESSION_SECRET=your-random-secret
BOLNA_API_KEY=bn-your-prod-key
EXOTEL_API_KEY=your-prod-key
EXOTEL_API_SECRET=your-prod-secret
EXOTEL_SID=your-prod-sid
PUBLIC_WEBHOOK_URL=https://api.yourdomain.com
PORT=5000
BASIC_AUTH_ENABLED=false
MOCK_STORAGE=false
```

### Post-Deployment

1. **Test Webhooks**: Verify Bolna and Exotel webhooks are working
2. **Monitor Logs**: Check for errors in production logs
3. **Load Testing**: Test with expected traffic volume
4. **Backup Strategy**: Set up automated database backups
5. **Monitoring**: Set up error tracking (Sentry, Rollbar, etc.)

---

## Development Guide

### Project Structure

```
Megna-Voice/
├── client/                    # React frontend
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   │   ├── ui/          # Base UI components (Radix)
│   │   │   ├── forms/       # Form components
│   │   │   ├── layout/      # Layout components
│   │   │   └── charts/      # Chart components
│   │   ├── pages/           # Page components (24+)
│   │   │   ├── Dashboard.tsx
│   │   │   ├── AIAgents.tsx
│   │   │   ├── Campaigns.tsx
│   │   │   └── ...
│   │   ├── hooks/           # Custom React hooks
│   │   │   ├── useAuth.ts
│   │   │   ├── useToast.ts
│   │   │   └── ...
│   │   ├── contexts/        # React contexts
│   │   ├── lib/             # Utilities and helpers
│   │   ├── App.tsx          # Main app component
│   │   └── main.tsx         # Entry point
│   ├── public/              # Static assets
│   └── index.html
│
├── server/                   # Express backend
│   ├── index.ts             # Server entry point
│   ├── routes.ts            # API routes (70+ endpoints)
│   ├── db.ts                # Database connection
│   ├── storage.ts           # Data access layer
│   ├── bolna.ts             # Bolna AI client
│   ├── exotel.ts            # Exotel client
│   ├── openai.ts            # OpenAI client
│   ├── supabaseAuth.ts      # Authentication
│   ├── supabaseClient.ts    # Supabase clients
│   ├── isolationMiddleware.ts # Multi-tenant middleware
│   ├── phoneNumberSync.ts   # Phone number sync
│   ├── callPoller.ts        # Call status polling
│   ├── agentTemplates.ts    # Agent templates
│   ├── plivo.ts             # Plivo integration
│   ├── vite.ts              # Vite dev server
│   └── utils/               # Server utilities
│
├── shared/                   # Shared code
│   └── schema.ts            # Drizzle ORM schema & Zod validation
│
├── migrations/               # Database migrations
│   ├── 0000_*.sql
│   └── meta/
│
├── scripts/                  # Utility scripts
│   ├── verify-setup.js
│   ├── setup-supabase-auth.js
│   ├── bulk-update-calls.ts
│   └── ...
│
├── .env                      # Environment variables (gitignored)
├── .env.template             # Environment template
├── package.json              # Dependencies & scripts
├── tsconfig.json             # TypeScript config
├── vite.config.ts            # Vite config
├── tailwind.config.ts        # Tailwind config
├── drizzle.config.ts         # Drizzle config
└── jest.config.cjs           # Jest config
```

### Adding New Features

#### 1. Database Changes

Update `shared/schema.ts`:

```typescript
export const newTable = pgTable("new_table", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_new_table_org").on(table.organizationId),
]);

export const insertNewTableSchema = createInsertSchema(newTable);
export type NewTable = typeof newTable.$inferSelect;
```

Push to database:

```bash
npm run db:push
```

#### 2. Storage Layer

Update `server/storage.ts`:

```typescript
async getNewTableItems(organizationId: string) {
  return await this.db
    .select()
    .from(newTable)
    .where(eq(newTable.organizationId, organizationId));
}

async createNewTableItem(data: InsertNewTable) {
  const [item] = await this.db
    .insert(newTable)
    .values(data)
    .returning();
  return item;
}
```

#### 3. API Routes

Update `server/routes.ts`:

```typescript
app.get("/api/new-table", async (req, res) => {
  const items = await storage.getNewTableItems(req.organizationId!);
  res.json({ items });
});

app.post("/api/new-table", async (req, res) => {
  const validatedData = insertNewTableSchema.parse({
    ...req.body,
    organizationId: req.organizationId,
  });
  
  const item = await storage.createNewTableItem(validatedData);
  res.status(201).json({ item });
});
```

#### 4. Frontend Components

Create `client/src/pages/NewFeature.tsx`:

```typescript
import { useQuery, useMutation } from '@tanstack/react-query';

export default function NewFeature() {
  const { data, isLoading } = useQuery({
    queryKey: ['/api/new-table'],
  });

  const mutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch('/api/new-table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.json();
    },
  });

  // Component JSX...
}
```

Add route in `client/src/App.tsx`:

```typescript
<Route path="/new-feature" component={NewFeature} />
```

### Code Style & Conventions

**TypeScript**
- Strict mode enabled
- Explicit return types for functions
- Use `interface` for object shapes, `type` for unions/intersections
- Prefer `const` over `let`

**React**
- Functional components with hooks
- Use TypeScript for props
- Avoid inline styles, use Tailwind classes
- Keep components under 300 lines

**API**
- RESTful endpoints
- Consistent error handling
- Validate all inputs with Zod
- Return consistent JSON structure

**Database**
- Always filter by `organizationId`
- Use transactions for multi-table operations
- Index frequently queried fields
- Use prepared statements (Drizzle handles this)

---

## Security

### Multi-Tenant Isolation

**Automatic Filtering**
Every database query includes organization context via middleware:

```typescript
// Middleware extracts organizationId from authenticated user
app.use(async (req, res, next) => {
  const user = await getAuthenticatedUser(req);
  req.organizationId = user.organizationId;
  next();
});

// All queries automatically filtered
const agents = await db
  .select()
  .from(aiAgents)
  .where(eq(aiAgents.organizationId, req.organizationId));
```

**Input Validation**
Client cannot specify `organizationId`:

```typescript
export const createAiAgentSchema = insertAiAgentSchema
  .omit({ organizationId: true })
  .strict(); // Rejects unknown fields
```

### Authentication

**Supabase JWT**
- All API requests require valid JWT token
- Token contains user ID and email
- Automatically validated by middleware

**Session Management**
- Express session with PostgreSQL storage
- HTTP-only cookies
- CSRF protection

### Data Protection

**Sensitive Data**
- API keys encrypted in database
- Never log credentials
- Redact sensitive data in responses

**Access Control**
- Role-based access (admin, agent_manager, analyst, developer)
- Resource-level permissions
- Organization-scoped queries

### Best Practices

1. **Always validate input** using Zod schemas
2. **Never trust client data** for organizationId
3. **Use prepared statements** (Drizzle ORM)
4. **Sanitize user uploads** (file type validation)
5. **Rate limit API endpoints** (Supabase handles this)
6. **Log security events** (failed auth, permission denied)
7. **Keep dependencies updated** (`npm audit`)

---

## Testing

### Test Structure

```
__tests__/
├── server/
│   ├── routes.test.ts
│   ├── storage.test.ts
│   ├── bolna.test.ts
│   └── auth.test.ts
├── client/
│   └── components/
└── integration/
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test routes.test.ts

# Watch mode
npm test -- --watch
```

### Writing Tests

**API Tests**

```typescript
describe('AI Agents API', () => {
  it('should create agent', async () => {
    const response = await request(app)
      .post('/api/ai-agents')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Agent',
        model: 'gpt-4',
        voiceProvider: 'elevenlabs',
      });

    expect(response.status).toBe(201);
    expect(response.body.agent).toHaveProperty('id');
  });

  it('should not allow cross-tenant access', async () => {
    const response = await request(app)
      .get(`/api/ai-agents/${otherOrgAgentId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
  });
});
```

**Component Tests**

```typescript
import { render, screen } from '@testing-library/react';
import { Dashboard } from '../pages/Dashboard';

describe('Dashboard', () => {
  it('renders metrics', () => {
    render(<Dashboard />);
    expect(screen.getByText('Total Calls')).toBeInTheDocument();
  });
});
```

### Test Coverage Goals

- **Unit Tests**: 80%+ coverage
- **Integration Tests**: Critical user flows
- **E2E Tests**: Main user journeys

---

## Troubleshooting

### Database Connection Issues

**Error: Cannot connect to database**

```bash
# Check DATABASE_URL format
echo $DATABASE_URL

# Test connection
npm run db:verify

# Common issues:
# - Wrong password
# - IP not whitelisted in Supabase
# - Using direct connection instead of pooler
# - Network/firewall blocking port 6543
```

**Solution:**
1. Verify credentials in Supabase dashboard
2. Use pooler connection string (port 6543, not 5432)
3. Whitelist your IP in Supabase settings

### Webhook Issues

**Error: Webhooks not received**

```bash
# Test webhook URL is accessible
curl -X POST https://your-url/api/webhooks/bolna/call-status

# For local development, ensure ngrok is running
ngrok http 5000

# Update .env with ngrok URL
PUBLIC_WEBHOOK_URL=https://abc123.ngrok-free.app
```

**Solution:**
1. Verify `PUBLIC_WEBHOOK_URL` is set correctly
2. Ensure URL is publicly accessible (test with curl)
3. Check Bolna/Exotel dashboard for webhook configuration
4. Review server logs for webhook POST requests

### API Integration Errors

**Error: Bolna API authentication failed**

```bash
# Check API key
echo $BOLNA_API_KEY

# Test key manually
curl -H "Authorization: Bearer $BOLNA_API_KEY" \
  https://api.bolna.ai/v2/agents
```

**Solution:**
1. Verify API key in Bolna dashboard
2. Check key hasn't expired
3. Ensure key has correct permissions

**Error: Exotel calls failing**

```bash
# Verify credentials
echo $EXOTEL_API_KEY
echo $EXOTEL_API_SECRET
echo $EXOTEL_SID
```

**Solution:**
1. Check credentials in Exotel dashboard
2. Ensure account has sufficient credits
3. Verify phone numbers are verified
4. Check rate limits

### Build Errors

**Error: TypeScript compilation failed**

```bash
# Check for type errors
npm run check

# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build
```

### Performance Issues

**Slow queries**

```sql
-- Check for missing indexes
SELECT schemaname, tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public';

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM calls WHERE organization_id = '...';
```

**Solution:**
1. Add indexes on frequently queried columns
2. Use connection pooling (already configured)
3. Optimize N+1 query patterns
4. Consider caching for read-heavy endpoints

### Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `Invalid JWT token` | Expired or malformed token | Re-authenticate |
| `Organization not found` | User not assigned to org | Check user record |
| `Resource not found` | Cross-tenant access attempt | Verify ownership |
| `Validation error` | Invalid input data | Check Zod schema |
| `Database connection timeout` | Network/config issue | Check DATABASE_URL |
| `Webhook timeout` | Public URL not accessible | Verify PUBLIC_WEBHOOK_URL |

---

## Additional Resources

### Documentation Files

- [README.md](./README.md) - Quick start guide
- [API_CONFIGURATION.md](./API_CONFIGURATION.md) - Detailed API setup
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - Quick reference guide
- [QUICK_START.md](./QUICK_START.md) - Quick start tutorial
- [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) - Supabase configuration
- [WEBHOOK_TROUBLESHOOTING.md](./WEBHOOK_TROUBLESHOOTING.md) - Webhook debugging

### External Documentation

- [Bolna AI Docs](https://docs.bolna.ai)
- [Exotel API Docs](https://developer.exotel.com)
- [Supabase Docs](https://supabase.com/docs)
- [Drizzle ORM Docs](https://orm.drizzle.team)
- [React Query Docs](https://tanstack.com/query)

### Support

For questions or issues:
1. Check existing documentation
2. Search issues on GitHub
3. Open new issue with:
   - Environment details
   - Error messages
   - Steps to reproduce
   - Expected vs actual behavior

---

## Changelog

### Version 1.0.0 (Current)

**Features:**
- AI voice agent creation and management
- Campaign orchestration
- Lead management with CSV upload
- Real-time call tracking via WebSocket
- Knowledge base integration
- Multi-tenant architecture
- Analytics dashboard
- Exotel telephony integration
- Bolna AI integration
- Supabase authentication

**Tech Stack:**
- React 18 + Vite
- Express.js + TypeScript
- Drizzle ORM + PostgreSQL
- Socket.io for real-time updates
- TailwindCSS + Radix UI

**Integrations:**
- Bolna AI (voice agents)
- Exotel (calls/SMS)
- Supabase (auth/database)
- OpenAI (optional AI enhancements)

---

## License

MIT License - See [LICENSE](./LICENSE) file for details

---

**Last Updated:** January 14, 2026  
**Project Version:** 1.0.0  
**Maintainer:** Megna Voice Development Team

## Changelog

**[v1.1.3] - 2026-01-27**
- **Feature:** Added automatic Caller ID fallback. If an agent has no assigned number, the system now automatically uses the organization's first active phone number.

**[v1.1.2] - 2026-01-27**
- **Debugging:** Persist call initiation errors to `call.metadata` for easier troubleshooting via UI.
- **Reliability:** Enhanced error handling in auto-initiation logic.

**[v1.1.1] - 2026-01-27**
- **Knowledge Base:** Switched to `axios` for robust multipart uploads, fixing 500 errors during sync.
- **Reliability:** Fixed variable scope in call initiation to prevent server crashes.
- **Debugging:** Added comprehensive logging for external API calls (Bolna).

**[v1.1.0] - 2026-01-27**
- **Call Initiation:** Fixed POST /api/calls to correctly trigger Bolna API via POST /call.
- **Agent Updates:** Fixed updateAgentPartial logic to correctly map system prompts.
- **Knowledge Base:**
  - Fixed 500 error by adding missing metadata column to database.
  - Improved pdfkit dynamic import robustness.
