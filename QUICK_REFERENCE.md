# MEGNA VOICE - QUICK REFERENCE GUIDE

## Key Files at a Glance

### Backend Entry Points
- **`server/index.ts`** - Main application entry point
- **`server/routes.ts`** - All API endpoint definitions
- **`server/db.ts`** - Database connection & Drizzle ORM setup

### Critical Configuration
- **`.env`** - Environment variables (credentials, API keys)
- **`package.json`** - Dependencies & npm scripts
- **`vite.config.ts`** - Frontend build configuration

### Database & ORM
- **`shared/schema.ts`** - Database schema & types (Drizzle)
- **`server/storage.ts`** - Database access layer
- **`drizzle.config.ts`** - ORM configuration

### API Integrations
- **`server/bolna.ts`** - Bolna AI voice agent API client
- **`server/exotel.ts`** - Exotel telephony API client
- **`server/openai.ts`** - OpenAI LLM functions

### Authentication & Authorization
- **`server/supabaseAuth.ts`** - Auth routes & session management
- **`server/supabaseClient.ts`** - Supabase clients setup

### Frontend
- **`client/src/App.tsx`** - Main React app & routing
- **`client/src/hooks/useAuth.ts`** - Authentication hook
- **`client/src/lib/queryClient.ts`** - React Query setup
- **`client/src/pages/`** - 24+ page components

---

## Essential Commands

### Development
```bash
npm run dev          # Start development server (port 5000)
npm run check        # Run TypeScript type checking
npm run build        # Build for production
npm run start        # Start production server
```

### Database
```bash
npm run db:push      # Apply schema changes to database
npm run db:verify    # Check database connection & tables
npm run auth:setup   # Setup Supabase authentication
```

### Environment Setup
```bash
npm run env:init     # Copy env.template to .env
```

---

## Critical Environment Variables

### Must Configure
```env
DATABASE_URL=postgresql://...                    # PostgreSQL connection
SUPABASE_URL=https://xxx.supabase.co            # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...            # Service role JWT
SUPABASE_ANON_KEY=eyJhbGc...                    # Anonymous JWT key
SESSION_SECRET=your-secret-key                   # Session encryption key
PORT=5000                                        # Server port
```

### Integrations (Optional but Recommended)
```env
BOLNA_API_KEY=bn-xxxxx                          # Voice agent orchestration
EXOTEL_API_KEY=xxxxx                            # Telephony
EXOTEL_API_SECRET=xxxxx
EXOTEL_SID=your-account-sid
OPENAI_API_KEY=sk-xxxxx                         # AI/LLM features
PUBLIC_WEBHOOK_URL=https://your-domain.com      # Webhook callbacks
```

### Testing/Development
```env
BASIC_AUTH_ENABLED=true                         # Use basic auth instead of Supabase
DEV_LOGIN_EMAIL=test@example.com                # Dev login credentials
DEV_LOGIN_PASSWORD=password123
```

---

## API Categories & Count

| Category | Count | Examples |
|----------|-------|----------|
| Authentication | 5 | login, signup, logout, auth/user |
| AI Agents | 5 | create, read, update, delete agents |
| Bolna Integration | 9 | voices, models, KB management, calls |
| Exotel Integration | 15 | phone numbers, calls, SMS, whitelist |
| Call Management | 6 | initiate, track, list calls |
| Leads | 4 | CRUD + bulk upload |
| Campaigns | 5 | CRUD operations |
| Knowledge Base | 5 | CRUD operations |
| Contacts/Partners | 4 | CRUD + bulk upload |
| Webhooks | 2 | Bolna & Exotel callbacks |
| Analytics/Dashboard | 5 | Metrics, performance, billing |
| **Total** | **70+** | Fully RESTful API |

---

## Real-time Features

**WebSocket Events (Socket.io):**
- `join:organization` - Subscribe to org updates
- `call:created` - New call initiated
- `call:updated` - Call status changed
- `agent:updated` - Agent modified
- `metrics:updated` - Dashboard metrics updated

---

## Database Multi-Tenancy

All data is isolated by `organizationId`:
```typescript
// Users automatically belong to one organization
// All queries enforce organization boundaries
// Security: Even if someone guesses IDs, they can't access other org data
```

Tables: users, organizations, ai_agents, calls, leads, campaigns, phone_numbers, knowledge_base, visits, channel_partners, sessions

---

## Startup Sequence

1. Load `.env` → Environment variables
2. Connect to PostgreSQL → Drizzle ORM
3. Initialize Bolna client (warns if key missing)
4. Initialize Exotel client (warns if credentials missing)
5. Create Express app → Middleware setup
6. Establish session store → PostgreSQL
7. Setup authentication → Supabase or basic auth
8. Register all routes → 70+ endpoints
9. Setup WebSocket (Socket.io)
10. Listen on PORT (default 5000)

---

## Feature Status

### Fully Implemented ✅
- Outbound call initiation (Bolna + Exotel)
- Agent CRUD with Bolna sync
- Phone number provisioning & management
- SMS (single & bulk) via Exotel
- Lead management with AI analysis
- Real-time call status updates (WebSocket)
- Multi-tenant data isolation
- Dashboard & analytics
- Authentication (Supabase & basic auth)

### Partially Implemented ⚠️
- Knowledge base management (no file upload endpoint)
- Inbound call routing (API ready, no UI)
- OpenAI features (need API key configuration)

### Stub/Incomplete 🔧
- Settings page (exists but minimal content)
- Pipelines page (basic functionality)
- Knowledge base upload (returns 501 Not Implemented)

---

## Quick Debugging

### Check Database Connection
```bash
npm run db:verify
```

### Test with Basic Auth (No Supabase Needed)
```env
BASIC_AUTH_ENABLED=true
```
Then visit: `http://localhost:5000/api/login`

### Verify API Integrations
1. **Bolna**: Create agent → will fail if key invalid
2. **Exotel**: Provision phone → will fail if credentials invalid
3. **OpenAI**: Create lead with notes → returns fallback if key missing

### WebSocket Test
Check browser console after login for Socket.io connection and events

---

## File Structure Summary

```
Megna-Voice/
├── server/                    (Express backend - 10 files)
│   ├── index.ts              (Entry point)
│   ├── routes.ts             (All endpoints)
│   ├── db.ts                 (Database setup)
│   ├── storage.ts            (DB access layer)
│   ├── bolna.ts              (Bolna API client)
│   ├── exotel.ts             (Exotel API client)
│   ├── openai.ts             (OpenAI functions)
│   ├── supabaseAuth.ts       (Authentication)
│   ├── supabaseClient.ts     (Supabase setup)
│   └── vite.ts               (Vite config)
│
├── client/                    (React frontend - 84 files)
│   ├── src/
│   │   ├── App.tsx           (Main router)
│   │   ├── pages/            (24 page components)
│   │   ├── components/       (Reusable UI)
│   │   ├── hooks/            (Custom React hooks)
│   │   ├── contexts/         (React contexts)
│   │   └── lib/              (Utilities)
│   └── ...
│
├── shared/                    (Shared types)
│   └── schema.ts             (Drizzle schema & types)
│
├── scripts/                   (Utility scripts)
│   ├── verify-setup.js
│   ├── setup-supabase-auth.js
│   └── test-*.js
│
├── migrations/                (Drizzle migrations)
├── .env                       (Configuration)
├── package.json              (Dependencies)
├── tsconfig.json             (TypeScript config)
├── vite.config.ts            (Frontend build)
├── drizzle.config.ts         (ORM config)
└── .replit                   (Deployment config)
```

---

## Next Steps

1. **Verify Setup**: `npm run db:verify`
2. **Set PUBLIC_WEBHOOK_URL** for webhook callbacks
3. **(Optional) Add OPENAI_API_KEY** for AI features
4. **Implement KB Upload** endpoint if needed
5. **Configure Inbound Routing** UI
6. **Deploy**: Using replit.nix configuration or Docker

---

## Support Resources

- **API Docs**: See `/BOLNA_EXOTEL_API_INTEGRATION.md`
- **Setup Guides**: See `/QUICK_START.md`, `/SUPABASE_SETUP.md`
- **TypeScript Schemas**: See `/shared/schema.ts`
- **Database Design**: See `/shared/schema.ts` comments

---

Generated: 2025-11-20
Branch: claude/configure-api-endpoints-01XZQrk5VxXYz8DREc5BoogM
