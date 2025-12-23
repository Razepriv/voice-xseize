# Supabase Database & Auth Setup - Complete Guide

This project uses Supabase for both database storage and authentication. Follow the guides below to get everything set up.

## 📚 Documentation Files

- **`QUICK_START.md`** - Fast 5-minute setup guide (start here!)
- **`SUPABASE_SETUP.md`** - Comprehensive setup documentation
- **`supabase_migration.sql`** - SQL file to manually create all database tables

## 🎯 Quick Overview

### What Gets Set Up

1. **Database Tables** (12 tables):
   - `sessions` - Session storage for authentication
   - `organizations` - Multi-tenant organization management
   - `users` - User accounts linked to organizations
   - `ai_agents` - AI voice agent configurations
   - `phone_numbers` - Phone number management
   - `campaigns` - Marketing campaign management
   - `channel_partners` - Channel partner data
   - `visits` - Site visit records
   - `leads` - Lead management
   - `calls` - Call records and transcripts
   - `knowledge_base` - Knowledge base items
   - `usage_tracking` - Usage analytics

2. **Authentication**:
   - Email/password authentication via Supabase Auth
   - Session-based authentication
   - Multi-tenant user management
   - Role-based access control (admin, agent_manager, analyst, developer)

3. **Database Features**:
   - Foreign key constraints
   - Indexes for performance
   - Automatic `updated_at` timestamps via triggers
   - UUID primary keys

## 🚀 Getting Started

### Step 1: Get Supabase Credentials

1. Sign up/Login at https://supabase.com
2. Create a new project
3. Get your credentials from Settings → API and Settings → Database

### Step 2: Configure Environment

```bash
npm run env:init  # Creates .env from template
# Edit .env with your Supabase credentials
```

### Step 3: Set Up Database

**Automatic:**
```bash
npm run db:push
```

**Manual (if automatic fails):**
1. Open Supabase SQL Editor
2. Copy/paste `supabase_migration.sql`
3. Run the query

### Step 4: Configure Auth

1. Enable Email provider in Supabase Dashboard
2. Set redirect URLs to `http://localhost:5000/**`

### Step 5: Verify & Test

```bash
npm run db:verify  # Verify setup
npm run dev        # Start server
```

Visit: http://localhost:5000/api/signup

## 🛠️ Available Commands

- `npm run env:init` - Create .env file from template
- `npm run db:push` - Push schema to database (automatic migration)
- `npm run db:verify` - Verify Supabase connection and setup
- `npm run dev` - Start development server

## 📋 Setup Checklist

- [ ] Supabase project created
- [ ] Environment variables configured in `.env`
- [ ] Database tables created (verify with `npm run db:verify`)
- [ ] Email auth provider enabled
- [ ] Redirect URLs configured
- [ ] Can sign up at `/api/signup`
- [ ] Can sign in at `/api/login`

## 🔧 Troubleshooting

### Database Connection Issues

**Problem:** `npm run db:push` fails with connection error

**Solution:**
1. Verify `DATABASE_URL` format in `.env`
2. Check Supabase project is active
3. Use manual SQL migration instead (`supabase_migration.sql`)

### Authentication Issues

**Problem:** Can't sign up or sign in

**Solution:**
1. Verify all Supabase keys in `.env` are correct
2. Check Email provider is enabled in Supabase
3. Ensure redirect URLs include `http://localhost:5000/**`
4. Check browser console for errors

### Tables Missing

**Problem:** `npm run db:verify` shows missing tables

**Solution:**
1. Run `npm run db:push` again
2. Or use manual SQL migration in Supabase SQL Editor
3. Check for errors in Supabase dashboard

## 🔐 Security Notes

- **Never commit `.env` file** - it contains sensitive keys
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS - keep it secret!
- Use environment variables in production
- Consider enabling Row Level Security (RLS) for production

## 📖 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Express Session Documentation](https://github.com/expressjs/session)

## 🆘 Need Help?

1. Check `QUICK_START.md` for fast setup
2. See `SUPABASE_SETUP.md` for detailed instructions
3. Run `npm run db:verify` to diagnose issues
4. Check Supabase dashboard for errors


