# Quick Start Guide - Supabase Setup

## 🚀 Fast Setup (5 minutes)

### 1. Get Supabase Credentials

1. Create/Login to Supabase: https://supabase.com
2. Create a new project (or use existing)
3. Go to **Settings** → **API** and copy:
   - Project URL → `SUPABASE_URL`
   - anon/public key → `SUPABASE_ANON_KEY`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY`
4. Go to **Settings** → **Database** and copy:
   - Connection string (URI) → `DATABASE_URL`

### 2. Configure Environment

```bash
# Copy template
npm run env:init

# Edit .env file with your Supabase credentials
# Windows: notepad .env
# Mac/Linux: nano .env
```

Update these values in `.env`:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
```

### 3. Set Up Database

**Option A - Automatic (if connection works):**
```bash
npm run db:push
```

**Option B - Manual (if automatic fails):**
1. Open Supabase Dashboard → **SQL Editor** → **New Query**
2. Copy contents of `supabase_migration.sql`
3. Paste and click **Run**

### 4. Configure Auth

1. Supabase Dashboard → **Authentication** → **Providers**
2. Ensure **Email** is enabled
3. (Optional) Disable "Confirm email" for faster local dev
4. **Authentication** → **URL Configuration**:
   - Site URL: `http://localhost:5000`
   - Redirect URLs: `http://localhost:5000/**`

### 5. Verify Setup

```bash
npm run db:verify
```

### 6. Start & Test

```bash
npm run dev
```

Visit: http://localhost:5000/api/signup

Create an account and sign in!

## ✅ Verification Checklist

- [ ] `.env` file created with correct credentials
- [ ] Database tables created (check with `npm run db:verify`)
- [ ] Email auth provider enabled in Supabase
- [ ] Redirect URLs configured
- [ ] Server starts without errors
- [ ] Can sign up at `/api/signup`
- [ ] Can sign in at `/api/login`

## 🆘 Troubleshooting

**Database connection fails:**
- Verify `DATABASE_URL` format is correct
- Check Supabase project is active
- Try manual SQL migration instead

**Auth not working:**
- Verify all Supabase keys are correct
- Check email provider is enabled
- Ensure redirect URLs include `http://localhost:5000/**`

**Tables missing:**
- Run `npm run db:verify` to check
- Use manual SQL migration if needed
- Check Supabase SQL Editor for errors

## 📚 More Details

See `SUPABASE_SETUP.md` for comprehensive documentation.


