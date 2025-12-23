## Hostinger Deployment

To deploy on Hostinger Node.js hosting:

1. **Build the Project**
  ```bash
  npm install
  npm run build
  ```

2. **Set Entry File in Hostinger**
  - In Hostinger's Node.js app settings, set the entry file to:
    ```
    dist/index.js
    ```

3. **Serve Frontend from Express**
  - Ensure your Express server (in dist/index.js) includes:
    ```js
    import express from 'express';
    import path from 'path';
    const app = express();

    app.use(express.static(path.join(__dirname, 'public')));
    app.get('*', (req, res) => {
     res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
     console.log(`Server running on port ${PORT}`);
    });
    ```

4. **Set Environment Variables**
  - Add your environment variables in Hostinger's panel or upload a `.env` file.

5. **Deploy/Restart**
  - Deploy or restart your app from the Hostinger panel.

# Megna Voice - AI Voice Agent Platform

> A comprehensive AI-powered voice agent platform for automated calling, lead management, and intelligent customer interactions.

## Features

- **AI Voice Agents**: Create and deploy intelligent voice agents powered by Bolna AI
- **Multi-Provider Voice Support**: ElevenLabs, Google TTS, Amazon Polly, and more
- **Telephony Integration**: Full Exotel integration for calls and SMS
- **Lead Management**: Import, qualify, and manage leads with AI assistance
- **Campaign Management**: Run targeted voice campaigns at scale
- **Real-time Analytics**: Track agent performance, call metrics, and conversion rates
- **Knowledge Base**: Upload documents to train your AI agents
- **Multi-tenant**: Complete organization isolation with secure authentication
- **Real-time Updates**: WebSocket integration for live call status updates

## Tech Stack

### Backend
- **Runtime**: Node.js with Express.js
- **Database**: PostgreSQL via Supabase
- **ORM**: Drizzle ORM
- **Authentication**: Supabase Auth
- **Real-time**: Socket.io

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **UI Components**: Radix UI + TailwindCSS
- **State Management**: TanStack Query
- **Routing**: Wouter
- **Charts**: Recharts

### APIs
- **Voice AI**: Bolna AI
- **Telephony**: Exotel
- **AI Enhancements**: OpenAI GPT-4 (optional)

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (via Supabase)
- Bolna AI account and API key
- Exotel account and credentials
- (Optional) OpenAI API key for AI summaries

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Megna-Voice
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

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

See [API_CONFIGURATION.md](./API_CONFIGURATION.md) for detailed setup instructions.

### 4. Setup Database

```bash
npm run db:push
```

### 5. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5000`

## Detailed Setup

### API Configuration

This application requires several external API integrations. Follow the comprehensive guide:

📖 **[API Configuration Guide](./API_CONFIGURATION.md)**

This guide covers:
- Supabase setup (Authentication & Database)
- Bolna AI configuration (Voice Agents)
- Exotel setup (Telephony & SMS)
- OpenAI configuration (Optional AI features)
- Webhook configuration for local development and production
- Testing your setup
- Troubleshooting common issues

### Local Development with Webhooks

For local development, use ngrok to expose your local server:

```bash
# Install ngrok
brew install ngrok  # macOS
# or download from https://ngrok.com

# Start your app
npm run dev

# In another terminal, start ngrok
ngrok http 5000

# Copy the HTTPS URL to PUBLIC_WEBHOOK_URL in .env
# Example: https://abc123.ngrok.io
```

## Available Scripts

```bash
# Development
npm run dev           # Start development server with hot reload

# Building
npm run build         # Build for production
npm start            # Start production server

# Database
npm run db:push      # Push schema changes to database
npm run db:verify    # Verify database setup

# Type Checking
npm run check        # Run TypeScript type checking
```

## Project Structure

```
Megna-Voice/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utility functions
│   │   └── App.tsx        # Main app component
│   └── index.html
├── server/                # Express backend
│   ├── index.ts          # Server entry point
│   ├── routes.ts         # API routes (70+ endpoints)
│   ├── db.ts             # Database connection
│   ├── storage.ts        # Data access layer
│   ├── bolna.ts          # Bolna AI client
│   ├── exotel.ts         # Exotel client
│   ├── openai.ts         # OpenAI client
│   └── supabaseAuth.ts   # Authentication
├── shared/               # Shared types and schemas
│   └── schema.ts         # Drizzle ORM schema & Zod validation
├── .env                  # Environment variables (not in git)
├── .env.example          # Environment template
└── API_CONFIGURATION.md  # Detailed API setup guide
```

## Core Features

### 1. AI Voice Agents

Create intelligent voice agents with:
- Custom system prompts and personality
- Multiple voice providers (ElevenLabs, Polly, Google TTS)
- Configurable AI models (GPT-4, Claude, etc.)
- Knowledge base integration
- Call duration and behavior controls

**Example:**
```typescript
POST /api/ai-agents
{
  "name": "Sales Assistant",
  "systemPrompt": "You are a friendly sales assistant...",
  "provider": "openai",
  "model": "gpt-4-turbo",
  "voiceProvider": "elevenlabs",
  "voiceId": "voice-id-here",
  "language": "en-US"
}
```

### 2. Campaign Management

Run automated calling campaigns:
- Upload leads via CSV
- Assign AI agents to campaigns
- Schedule calls
- Track campaign performance
- Real-time progress monitoring

### 3. Call Management

Full call lifecycle management:
- Initiate outbound calls
- Handle inbound calls
- Real-time call status updates via WebSocket
- Call recording and transcription
- AI-powered call summaries

### 4. Analytics Dashboard

Comprehensive analytics:
- Total calls, minutes, conversion rates
- Agent performance metrics
- Call success rates
- Cost tracking
- Time-series charts
- Lead qualification analysis

### 5. Knowledge Base

Train your AI agents:
- Upload PDF, TXT, DOC files
- Automatic chunking and vectorization
- RAG (Retrieval Augmented Generation)
- Per-agent knowledge base assignment

## API Endpoints

### Authentication
- `GET /api/auth/user` - Get current user

### AI Agents
- `GET /api/ai-agents` - List agents
- `POST /api/ai-agents` - Create agent
- `GET /api/ai-agents/:id` - Get agent
- `PATCH /api/ai-agents/:id` - Update agent
- `DELETE /api/ai-agents/:id` - Delete agent

### Calls
- `GET /api/calls` - List calls
- `POST /api/calls/initiate` - Initiate call
- `GET /api/calls/:id` - Get call details
- `PATCH /api/calls/:id` - Update call

### Campaigns
- `GET /api/campaigns` - List campaigns
- `POST /api/campaigns` - Create campaign
- `PATCH /api/campaigns/:id` - Update campaign
- `DELETE /api/campaigns/:id` - Delete campaign

### Leads
- `GET /api/leads` - List leads
- `POST /api/leads` - Create lead
- `POST /api/leads/upload` - Bulk upload (CSV)
- `PATCH /api/leads/:id` - Update lead

### Phone Numbers
- `GET /api/phone-numbers` - List numbers
- `GET /api/phone-numbers/sync` - Sync from Exotel

### Bolna Integration
- `GET /api/bolna/voices` - Get available voices
- `GET /api/bolna/models` - Get available models
- `GET /api/bolna/knowledge-bases` - List knowledge bases
- `POST /api/bolna/knowledge-bases` - Upload knowledge base

### Exotel Integration
- `POST /api/exotel/sms` - Send SMS
- `POST /api/exotel/sms/bulk` - Send bulk SMS
- `GET /api/exotel/calls` - List calls
- `GET /api/exotel/phone-numbers` - List phone numbers

### Analytics
- `GET /api/dashboard/metrics` - Dashboard metrics
- `GET /api/analytics/metrics` - Analytics data
- `GET /api/analytics/calls` - Call metrics
- `GET /api/analytics/agents` - Agent performance

### Webhooks
- `POST /api/webhooks/bolna/call-status` - Bolna webhooks
- `POST /api/webhooks/exotel/call-status` - Exotel webhooks

## Database Schema

The application uses a multi-tenant architecture with organization-based isolation:

### Core Tables
- `users` - User accounts
- `organizations` - Organization/tenant data
- `ai_agents` - AI voice agent configurations
- `phone_numbers` - Virtual phone numbers
- `campaigns` - Marketing campaigns
- `leads` - Lead/contact information
- `calls` - Call records and history
- `visits` - Field visit tracking
- `channel_partners` - Partner management
- `knowledge_base` - Training documents for AI

All tables include `organizationId` for tenant isolation.

## Security

### Multi-tenancy
- Every query is automatically filtered by organization ID
- Row-level security prevents cross-tenant data access
- Users can only access data from their organization

### Authentication
- Supabase Auth with JWT tokens
- Session management with secure cookies
- API key rotation support

### Best Practices
- Environment variables for sensitive data
- HTTPS required for webhooks
- API rate limiting (configured in Supabase)
- Input validation with Zod schemas

## Deployment

### Production Checklist

1. Set up production database on Supabase
2. Configure all environment variables
3. Set `PUBLIC_WEBHOOK_URL` to your production domain
4. Run database migrations: `npm run db:push`
5. Build the application: `npm run build`
6. Start with: `npm start`

### Recommended Hosting

- **Frontend + Backend**: Railway, Render, Fly.io
- **Database**: Supabase (managed PostgreSQL)
- **Domain**: Configure with your DNS provider
- **SSL**: Automatic with most hosting providers

### Environment Variables for Production

```bash
NODE_ENV=production
PUBLIC_WEBHOOK_URL=https://api.yourdomain.com
# ... all other variables from .env.example
```

## Monitoring & Observability

### Logs
- Server logs via console (stdout)
- Structured error logging
- Request/response logging

### Metrics
- Call volume and duration
- API response times
- Error rates
- Cost tracking

### Health Checks
- Database connectivity
- API integration status
- WebSocket connection status

## Troubleshooting

### Common Issues

**Issue: Cannot connect to database**
```bash
# Verify DATABASE_URL format
# Check Supabase project status
# Ensure IP is whitelisted
```

**Issue: Webhooks not received**
```bash
# Verify PUBLIC_WEBHOOK_URL is accessible
# Test with: curl -X POST https://your-url/api/webhooks/bolna/call-status
# Check ngrok is running (for local dev)
```

**Issue: API integration errors**
```bash
# Check all API keys are set correctly
# Verify keys are valid in respective dashboards
# Restart the application after changes
```

See [API_CONFIGURATION.md](./API_CONFIGURATION.md) for detailed troubleshooting.

## Development

### Adding New Features

1. Update database schema in `shared/schema.ts`
2. Run `npm run db:push` to apply changes
3. Add API routes in `server/routes.ts`
4. Create frontend components in `client/src/`
5. Update types and validation schemas

### Code Style

- TypeScript for type safety
- ESM modules (`type: "module"`)
- Zod for runtime validation
- React hooks for state management
- TailwindCSS for styling

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -am 'Add new feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Submit a pull request

## Support

For issues, questions, or feature requests:
- Open an issue on GitHub
- Check [API_CONFIGURATION.md](./API_CONFIGURATION.md) for setup help
- Review the [troubleshooting section](#troubleshooting)

## License

MIT License - see LICENSE file for details

## Acknowledgments

- [Bolna AI](https://bolna.ai) - Voice agent platform
- [Exotel](https://exotel.com) - Telephony services
- [Supabase](https://supabase.com) - Database and authentication
- [OpenAI](https://openai.com) - AI capabilities
- [Radix UI](https://radix-ui.com) - UI components
- [TailwindCSS](https://tailwindcss.com) - Styling

---

#   v o i c e - x s e i z e  
 