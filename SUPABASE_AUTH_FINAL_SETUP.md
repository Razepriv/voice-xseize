# Final Supabase Auth Setup Steps

## ✅ Current Status

Your application is already configured to use Supabase Auth:
- ✅ `BASIC_AUTH_ENABLED=false` (Supabase Auth enabled)
- ✅ `MOCK_STORAGE=false` (Real database storage)
- ✅ Supabase credentials configured
- ✅ Database connection working

## 🔧 Complete These Steps in Supabase Dashboard

### Step 1: Enable Email Authentication Provider

1. Go to **Supabase Dashboard** → **Authentication** → **Providers**
2. Find **Email** in the list
3. Toggle it **ON** (enabled)
4. (Optional) For local development, you can disable **"Confirm email"** to skip email verification

### Step 2: Configure URL Settings

1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL**: 
   - For development: `http://localhost:5000`
   - For production: `https://platform.automitra.ai`
3. Under **Redirect URLs**, add:
   - For development: `http://localhost:5000/**`
   - For production: `https://platform.automitra.ai/**`
   - **Important**: Also add the callback endpoint: `https://platform.automitra.ai/api/auth/callback`
   - Click **Save**

**Note**: The application is configured to use `https://platform.automitra.ai` for email verification links by default. You can override this by setting `AUTH_REDIRECT_URL` in your `.env` file.

### Step 3: Verify Database Tables

Make sure your database tables are created:

```bash
npm run db:push
```

This will create all required tables including the `users` table.

### Step 4: Test Authentication

1. **Start your server:**
   ```bash
   npm run dev
   ```

2. **Visit the signup page:**
   ```
   http://localhost:5000/api/signup
   ```

3. **Create a test account:**
   - Full name: Your Name
   - Email: your-email@example.com
   - Password: (choose a secure password)
   - Click "Create account"

4. **Sign in:**
   - You'll be redirected to login
   - Enter your email and password
   - Click "Sign in"

5. **Verify in Supabase:**
   - Go to **Authentication** → **Users** in Supabase dashboard
   - You should see your newly created user

## 🎯 What's Different Now?

### Before (Basic Auth - Testing Mode)
- ❌ Any email works (no password)
- ❌ No real user accounts
- ❌ Mock in-memory storage
- ❌ No security

### After (Supabase Auth - Production Ready)
- ✅ Real user accounts with passwords
- ✅ Secure authentication
- ✅ Real database storage
- ✅ User management in Supabase dashboard
- ✅ Password reset support
- ✅ Email verification (optional)
- ✅ Session management

## 🔍 Verify Everything Works

Run this command to verify your setup:

```bash
npm run auth:setup
```

You should see:
- ✅ Supabase credentials found
- ✅ BASIC_AUTH_ENABLED is disabled (using Supabase Auth)
- ✅ MOCK_STORAGE is disabled (using real database)
- ✅ Supabase client created successfully

## 🚀 Next Steps After Setup

1. **Create your first user account** via `/api/signup`
2. **Check Supabase Dashboard** → **Authentication** → **Users** to see your user
3. **Check your database** → **Table Editor** → **users** table to see the user record
4. **Test sign in/out** functionality

## 🆘 Troubleshooting

### "Email provider is not enabled"
- Go to Supabase Dashboard → Authentication → Providers
- Enable the Email provider

### "Invalid redirect URL"
- Go to Authentication → URL Configuration
- Add `http://localhost:5000/**` to Redirect URLs

### "User not created in database"
- Run `npm run db:push` to create tables
- Check that `MOCK_STORAGE=false` in `.env`
- Verify database connection with `npm run db:verify`

### "Password authentication failed"
- Verify you're using the correct password
- Check Supabase Dashboard → Authentication → Users to see if user exists
- Try resetting password if needed

## 📚 Additional Resources

- See `ENABLE_SUPABASE_AUTH.md` for detailed configuration
- See `SUPABASE_SETUP.md` for complete database setup
- Supabase Auth Docs: https://supabase.com/docs/guides/auth


