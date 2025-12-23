# Enable Supabase Authentication

This guide will help you configure your application to use **Supabase Auth** instead of basic testing authentication.

## Current Status

Your application supports two authentication modes:
1. **Basic Auth** (Testing) - Simple email-based auth for development
2. **Supabase Auth** (Production) - Full-featured authentication with Supabase

## Enable Supabase Auth

### Step 1: Update Your .env File

Open your `.env` file and set these values:

```env
# Disable basic auth (enable Supabase Auth)
BASIC_AUTH_ENABLED=false

# Use real database storage (not mock)
MOCK_STORAGE=false
```

### Step 2: Verify Supabase Configuration

Make sure these are set correctly in your `.env`:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres.your-project-ref:password@aws-0-region.pooler.supabase.com:6543/postgres
```

### Step 3: Configure Supabase Auth Settings

1. **Go to Supabase Dashboard** → **Authentication** → **Providers**
2. **Enable Email Provider:**
   - Toggle "Email" to ON
   - (Optional) Disable "Confirm email" for faster local development
3. **Set URL Configuration:**
   - Go to **Authentication** → **URL Configuration**
   - **Site URL**: `http://localhost:5000`
   - **Redirect URLs**: Add `http://localhost:5000/**`

### Step 4: Restart Your Server

After updating `.env`, restart your development server:

```bash
npm run dev
```

## What Changes?

### Before (Basic Auth)
- Simple email-based login (any email works)
- No password required
- Mock storage (in-memory data)
- Testing/demo mode

### After (Supabase Auth)
- ✅ Real user accounts with passwords
- ✅ Email verification (optional)
- ✅ Secure session management
- ✅ Real database storage
- ✅ User management via Supabase
- ✅ Password reset functionality
- ✅ Multi-factor authentication support (if enabled)

## Testing Supabase Auth

1. **Start the server:**
   ```bash
   npm run dev
   ```

2. **Visit signup page:**
   ```
   http://localhost:5000/api/signup
   ```

3. **Create an account:**
   - Enter your full name
   - Enter your email
   - Enter a password
   - Click "Create account"

4. **Sign in:**
   - You'll be redirected to the login page
   - Enter your email and password
   - Click "Sign in"

5. **Verify in Supabase:**
   - Go to **Authentication** → **Users** in Supabase dashboard
   - You should see your newly created user

## Troubleshooting

### "Invalid credentials" error
- Verify your Supabase keys are correct
- Check that Email provider is enabled
- Ensure password is correct

### "Email not confirmed" error
- Go to Supabase Dashboard → Authentication → Providers → Email
- Disable "Confirm email" for local development
- Or check your email for confirmation link

### Redirect issues
- Verify redirect URLs in Supabase: `http://localhost:5000/**`
- Check Site URL is set to `http://localhost:5000`

### Users not appearing in database
- Run `npm run db:push` to ensure tables are created
- Check that `MOCK_STORAGE=false` in `.env`
- Verify database connection with `npm run db:verify`

## Security Notes

- **Never commit `.env` file** - it contains sensitive keys
- **Change SESSION_SECRET** - use a strong random string in production
- **Enable email confirmation** in production
- **Use HTTPS** in production
- **Set secure cookies** in production (already configured)

## Reverting to Basic Auth

If you need to switch back to basic auth for testing:

```env
BASIC_AUTH_ENABLED=true
MOCK_STORAGE=true
```

Then restart your server.


