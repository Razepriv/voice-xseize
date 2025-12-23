# AI Voice Agent Platform

## Overview

This is a multi-tenant SaaS platform for AI-powered voice and chat automation. The system enables organizations to manage AI voice agents, make automated calls, track leads, manage campaigns, and analyze performance through role-based dashboards. The platform integrates with third-party services like Bolna (AI voice agents), Exotel (telephony), and OpenAI (GPT-5 for AI summaries and analysis).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React 18 with TypeScript
- Vite as the build tool and dev server
- Wouter for client-side routing (lightweight alternative to React Router)
- TanStack Query v5 for server state management and data fetching
- Shadcn UI component library with Radix UI primitives
- Tailwind CSS for styling with a strict minimal black & white theme

**Design System:**
- Strict monochrome aesthetic (pure black, white, and grayscale only)
- Light mode: white backgrounds (#FFFFFF) with black primary actions (#000000)
- Dark mode: true black backgrounds (#000000) with white primary actions (#FFFFFF)
- Inter font family for all typography
- No decorative colors - hierarchy created through typography and whitespace
- Fully responsive with mobile-first approach

**State Management:**
- TanStack Query for all server data with aggressive caching (staleTime: Infinity)
- React Context for theme management (light/dark mode toggle)
- WebSocket context for real-time updates via Socket.IO
- Custom hooks pattern for auth (`useAuth`), mobile detection (`useIsMobile`), and toast notifications

**Key Architectural Decisions:**
- Single-page application with client-side routing to avoid full page reloads
- Optimistic UI updates with mutation callbacks to invalidate queries
- Role-based page access controlled through user.role from auth context
- Virtual scrolling (TanStack Virtual) for large datasets like channel partners (60,000+ records)
- Real-time updates via WebSocket for live call status and metrics
- Dashboard Quick Actions with query parameter-based dialog auto-opening and clean URL handling

### Backend Architecture

**Technology Stack:**
- Node.js with Express.js server
- TypeScript throughout for type safety
- Drizzle ORM for database operations
- Neon serverless PostgreSQL database
- OpenID Connect (OIDC) with Replit Auth for authentication
- Socket.IO for WebSocket communication

**Authentication & Multi-tenancy:**
- Replit Auth (OpenID Connect) for SSO - auto-provisions users on first login
- Session-based auth with PostgreSQL session store (connect-pg-simple)
- Organization-based tenant isolation - all queries filtered by organizationId
- Middleware ensures authenticated routes require valid session
- User roles: admin, agent_manager, analyst, developer

**API Design:**
- RESTful API structure with `/api/*` routes
- Request/response pattern: JSON bodies with credentials included
- Error handling: 401 redirects to login, other errors return JSON with message
- File upload support via multer for CSV/Excel lead and partner imports
- Query invalidation pattern: mutations trigger queryClient.invalidateQueries

**Database Schema (Drizzle ORM):**
- Multi-tenant isolation via `organizationId` foreign key on all tables
- Core tables: users, organizations, aiAgents, phoneNumbers, leads, calls, knowledgeBase, usageTracking
- Relations defined using Drizzle relations API for type-safe joins
- Timestamps (createdAt, updatedAt) on all tables with automatic defaults
- Session storage table required for Replit Auth integration

**Type Safety:**
- Shared schema types between client and server in `/shared/schema.ts`
- Zod schemas for runtime validation (createAiAgentSchema, etc.)
- Drizzle insert/select types auto-generated from schema
- Path aliases: `@/` for client, `@shared/` for shared code

### External Dependencies

**Third-Party Services:**

1. **Bolna AI (Voice Agents):**
   - API integration for creating and managing AI voice agents
   - Agent configuration: model, provider, voice settings, tasks
   - Outbound call initiation with agent_id and recipient phone number
   - Requires BOLNA_API_KEY environment variable

2. **Exotel (Telephony Provider):**
   - Call initiation and management API
   - Recording and transcript retrieval
   - Webhook callbacks for call status updates
   - Requires EXOTEL_API_KEY, EXOTEL_API_SECRET, EXOTEL_SID environment variables

3. **OpenAI GPT-5:**
   - AI-powered conversation summaries
   - Lead qualification analysis
   - Meeting summary generation
   - Uses latest gpt-5 model (released August 7, 2025)
   - Requires OPENAI_API_KEY environment variable

4. **Neon Serverless PostgreSQL:**
   - Managed PostgreSQL database with serverless architecture
   - WebSocket support via ws library for connection pooling
   - Requires DATABASE_URL environment variable
   - Connection via @neondatabase/serverless package

**Development Tools:**
- Replit-specific plugins: vite-plugin-runtime-error-modal, vite-plugin-cartographer, vite-plugin-dev-banner (dev only)
- Drizzle Kit for database migrations and schema push
- ESBuild for production server bundling
- TSX for development server hot-reload

**File Processing:**
- Papa Parse for CSV parsing (lead and partner uploads)
- Multer for multipart/form-data file uploads
- Support for CSV, XLSX, and XLS file formats

**Real-time Communication:**
- Socket.IO for WebSocket connections
- Organization-scoped rooms for multi-tenant message isolation
- Event types: call_status_update, new_lead, agent_update

**Session Management:**
- Express session with PostgreSQL storage
- Cookie-based sessions with httpOnly flag
- 7-day session TTL with automatic cleanup
- Secure cookies in production (secure: true when NODE_ENV=production)

## Features

### Dashboard Quick Actions (Nov 18, 2025)
**Implementation:**
- Dashboard provides one-click shortcuts to create common resources
- Quick Actions: Create Agent, Make Call, Add Knowledge
- Uses query parameter navigation (e.g., `/agents?action=create`)
- Auto-opens creation dialogs on destination pages
- Robust URL cleanup preserves pathname and other query params using window.history.replaceState
- Prevents back-button navigation loops
- Supports sub-path deployments

**Technical Details:**
- Dashboard Quick Action buttons use wouter Link components with query parameters
- Destination pages (AIAgents, CallHistory, KnowledgeBase) detect action parameter in useEffect
- URL cleanup removes only the action parameter while preserving base path
- Empty dependency array ensures effect runs once on mount
- Architect-approved as production-ready

### Comprehensive Agent Creation System (Nov 18, 2025)
**Implementation:**
- 5-tab agent creation dialog providing full access to Bolna and Exotel features
- Dynamic API integration fetches real-time configuration options from external services
- All optional fields handled gracefully with empty string/array defaults
- Production-ready with complete schema validation and error handling

**Tab 1 - Basic Configuration:**
- Agent name and description
- Language selection (multi-language support)
- Status toggle (active/inactive)

**Tab 2 - AI Model Configuration:**
- Dynamic model selection from Bolna API (GPT-4, GPT-3.5, Claude, etc.)
- Provider selection (OpenAI, Anthropic, etc.)
- Temperature control (0.0-1.0 slider for response randomness)
- Max duration (call length limit in seconds)
- Max tokens (response length limit)
- Agent type (conversational, transactional, etc.)

**Tab 3 - Voice Configuration:**
- Dynamic voice selection from Bolna's complete voice library
- Voice provider selection (ElevenLabs, Azure, Google, etc.)
- Voice type categorization (male, female, neutral)
- Real-time voice metadata (name, ID)

**Tab 4 - Prompts & Knowledge Base:**
- System prompt (AI behavioral instructions)
- User prompt (additional context and guidelines)
- First message (initial greeting to callers)
- Knowledge base multi-select (checkbox-based selection)
- Knowledge base IDs stored as array in database

**Tab 5 - Integration (Exotel Telephony):**
- Dynamic phone number selection from Exotel API
- Phone number assignment (optional - agents can exist without phone numbers)
- Call forwarding toggle and configuration
- Forwarding number specification for customer-initiated transfers

**Form Validation & Schema:**
- Uses react-hook-form with Zod validation via zodResolver
- Required fields: name, model, language, status
- Optional fields properly handled: empty strings for varchar, empty arrays for array fields
- Numeric fields with guaranteed defaults (temperature: 0.7, maxDuration: 600, maxTokens: 150)
- Knowledge base selection managed through form state (not separate React state)
- Mutation payload explicitly maps all fields with proper type coercion

**API Endpoints:**
- `GET /api/bolna/models` - Fetch available AI models from Bolna
- `GET /api/bolna/voices` - Fetch voice library from Bolna
- `GET /api/exotel/phone-numbers` - Fetch phone numbers from Exotel
- `GET /api/knowledge-base` - Fetch organization knowledge base entries
- `POST /api/ai-agents` - Create agent with comprehensive configuration

**Database Schema Updates:**
- Added `userPrompt` (text) - Additional prompt instructions
- Added `firstMessage` (text) - Initial greeting message
- Added `knowledgeBaseIds` (text[]) - Array of knowledge base entry IDs
- Added `assignedPhoneNumberId` (varchar) - Exotel phone number assignment (nullable)
- Added `callForwardingEnabled` (boolean) - Call transfer capability toggle
- Added `callForwardingNumber` (varchar, 20) - Destination for forwarded calls (nullable)

**Technical Implementation:**
- All tabs use consistent form state via react-hook-form
- Dynamic dropdowns populate from live API calls with loading states
- Form submission constructs payload with explicit field mapping
- Empty optional fields send appropriate defaults (not null/undefined)
- Query invalidation triggers list refresh after successful creation
- E2E tested and architect-approved as production-ready

### Enhanced Call History with Audio Playback (Nov 18, 2025)
**Implementation:**
- Embedded HTML5 audio player for call recordings
- Download button for offline access to recordings
- Open-in-new-tab option for direct recording URL access
- Recording URLs automatically captured via Bolna webhook integration

**Technical Details:**
- Audio element with full controls (play, pause, seek, volume)
- Download button uses native browser download functionality
- Recording URL persisted in database via POST /api/calls/webhook endpoint
- Graceful fallback when recording URL unavailable
- Responsive design with proper spacing and alignment

### Create Agent Dialog Cleanup & Bug Fixes (Nov 18, 2025)
**Bug Fixes:**
- Fixed critical SelectItem empty value bug causing Vite runtime error overlay
- Changed Voice tab placeholder from `value=""` to `value="none"` (Radix UI requirement)
- Voice tab now loads without blocking errors

**Form Cleanup:**
- Removed duplicate fields from Basic tab
- Basic tab now contains ONLY 4 fields: name, description, language, status
- All other configuration fields organized in their dedicated tabs
- Improved voice selection UX with auto-population of voice name and provider

### Comprehensive Exotel API Integration (Nov 18, 2025)
**Expanded API Coverage:**
The Exotel client now provides complete access to all Exotel features across two API domains:

**Standard API (api.exotel.com):**
- **SMS**: send single SMS, bulk SMS, retrieve message history
- **Phone Numbers**: list available numbers, provision new numbers, update settings, release numbers
- **Customer Whitelist**: add numbers, remove numbers, list whitelist entries
- **Calls**: initiate calls, get call details, list call history

**CCM API (ccm-api.exotel.com):**
- **Users Management**: create users, update users, delete users, list users
- **Calls Management**: initiate CCM calls, list call history with filters

**Technical Implementation:**
- Separate request handlers for standard API (form-data) and CCM API (JSON)
- Consistent authentication using Basic Auth across both APIs
- Proper error handling with detailed error messages
- Type-safe interfaces for all request/response payloads
- Graceful handling when Exotel credentials not configured

**Available Methods:**
```typescript
// SMS
sendSMS(), sendBulkSMS(), getSMSMessages()

// Phone Numbers
getPhoneNumbers(), getAvailablePhoneNumbers(), provisionPhoneNumber(), 
updatePhoneNumber(), releasePhoneNumber()

// Customer Whitelist
getCustomerWhitelist(), addToCustomerWhitelist(), removeFromCustomerWhitelist()

// CCM Users
listCCMUsers(), createCCMUser(), updateCCMUser(), deleteCCMUser()

// CCM Calls
listCCMCalls(), makeCCMCall()
```