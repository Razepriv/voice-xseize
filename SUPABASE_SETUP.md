# Supabase Database & Auth Setup Guide

This guide will help you set up the entire database in Supabase and configure authentication for local development.

## Prerequisites

1. A Supabase account (sign up at https://supabase.com)
2. A Supabase project created
3. Node.js and npm installed

## Step 1: Get Your Supabase Credentials

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Copy the following values:
   - **Project URL** (SUPABASE_URL)
   - **anon/public key** (SUPABASE_ANON_KEY)
   - **service_role key** (SUPABASE_SERVICE_ROLE_KEY) - Keep this secret!

4. Navigate to **Settings** → **Database**
5. Copy the **Connection string** under "Connection string" → "URI"
   - This is your DATABASE_URL
   - Format: `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`

## Step 2: Configure Environment Variables

1. Copy `env.template` to `.env` if you haven't already:
   ```bash
   npm run env:init
   ```

2. Update your `.env` file with your Supabase credentials:
   ```env
   SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   SUPABASE_ANON_KEY=your-anon-key
   DATABASE_URL=postgresql://postgres:your-password@db.your-project-ref.supabase.co:5432/postgres
   ```

## Step 3: Push Database Schema to Supabase

You have two options to set up the database:

### Option A: Using Drizzle (Recommended if connection works)

Run the following command to create all tables in your Supabase database:

```bash
npm run db:push
```

This will:
- Generate migrations from your schema
- Create all tables (organizations, users, ai_agents, calls, leads, etc.)
- Set up indexes and foreign keys
- Create the sessions table for authentication

### Option B: Manual SQL Migration (If db:push fails)

1. Open your Supabase dashboard
2. Go to **SQL Editor** → **New Query**
3. Copy and paste the contents of `supabase_migration.sql`
4. Click **Run** to execute the migration

This will create all tables, indexes, triggers, and constraints manually.

## Step 4: Configure Supabase Authentication

### Enable Email Authentication

1. Go to **Authentication** → **Providers** in your Supabase dashboard
2. Ensure **Email** provider is enabled
3. Configure email settings:
   - **Enable email confirmations**: Optional (disable for local dev)
   - **Secure email change**: Optional

### Configure Auth Settings

1. Go to **Authentication** → **URL Configuration**
2. Add your local development URL:
   - **Site URL**: `http://localhost:5000`
   - **Redirect URLs**: `http://localhost:5000/**`

### (Optional) Disable Email Confirmation for Development

1. Go to **Authentication** → **Providers** → **Email**
2. Toggle off **"Confirm email"** for faster local development

### Enable Additional Auth Providers (Optional)

You can enable other providers like Google, GitHub, etc.:
1. Go to **Authentication** → **Providers**
2. Enable desired providers
3. Configure OAuth credentials as needed

**Note:** The current implementation uses email/password authentication. Additional providers would require code changes.

## Step 5: Verify the Setup

Before testing, verify your configuration:

```bash
npm run db:verify
```

This will check:
- Environment variables are set
- Supabase client connection
- Database connection
- Required tables exist

## Step 6: Test the Setup

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:5000/api/signup`
3. Create a test account with:
   - Full name
   - Email address
   - Password

4. After signup, you'll be redirected to login
5. Sign in with your credentials

## Step 7: Verify Database Tables

You can verify all tables were created by:

1. Going to **Table Editor** in Supabase dashboard
2. You should see these tables:
   - `sessions` - For session storage
   - `organizations` - Multi-tenant organizations
   - `users` - User accounts
   - `ai_agents` - AI agent configurations
   - `phone_numbers` - Phone number management
   - `leads` - Lead management
   - `calls` - Call records
   - `campaigns` - Campaign management
   - `channel_partners` - Channel partner data
   - `visits` - Site visit records
   - `knowledge_base` - Knowledge base items
   - `usage_tracking` - Usage analytics

## Troubleshooting

### Database Connection Issues

- Verify your DATABASE_URL is correct
- Check that your Supabase project is active
- Ensure your IP is allowed (Supabase allows all by default)

### Authentication Issues

- Verify SUPABASE_URL and keys are correct
- Check that email provider is enabled
- Ensure redirect URLs are configured correctly
- Check browser console for errors

### Migration Issues

- If `db:push` fails, check the error message
- Ensure you have the correct database permissions
- Try running the command again (Drizzle handles idempotency)

## Security Notes

- **Never commit your `.env` file** - it contains sensitive keys
- The `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security - keep it secret!
- Use environment variables in production
- Consider enabling Row Level Security (RLS) policies for production

## Next Steps

- Set up Row Level Security policies if needed
- Configure email templates in Supabase
- Set up additional auth providers (Google, GitHub, etc.) if needed
- Configure webhooks for real-time updates

