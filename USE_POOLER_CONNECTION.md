# Use Session Pooler Connection (Required for IPv4 Networks)

## Problem
Your direct connection is failing because your network is IPv4-only, but Supabase's direct connection requires IPv6.

## Solution: Use Session Pooler

### Step 1: Get Pooler Connection String

1. Go to your Supabase Dashboard
2. Click **Settings** → **Database**
3. Click the **"Pooler settings"** button (or switch to **"Session mode"** tab)
4. You'll see a connection string like:
   ```
   postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```

### Step 2: Update the Connection String

Replace `[YOUR-PASSWORD]` with your URL-encoded password:

- Your password: `Megna@voice123`
- URL-encoded: `Megna%40voice123` (the `@` becomes `%40`)

**Example result:**
```
postgresql://postgres.sdtycpnutctbgbvpbeor:Megna%40voice123@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

### Step 3: Update Your .env File

Open your `.env` file and update the `DATABASE_URL`:

```env
DATABASE_URL=postgresql://postgres.sdtycpnutctbgbvpbeor:Megna%40voice123@aws-0-[YOUR-REGION].pooler.supabase.com:6543/postgres
```

**Important:** Replace `[YOUR-REGION]` with the actual region from your Supabase dashboard!

### Step 4: Test the Connection

```bash
npm run db:verify
```

## Key Differences: Direct vs Pooler

| Feature | Direct Connection | Session Pooler |
|---------|------------------|----------------|
| Port | 5432 | 6543 |
| Username | `postgres` | `postgres.[PROJECT-REF]` |
| Host | `db.[PROJECT-REF].supabase.co` | `aws-0-[REGION].pooler.supabase.com` |
| IPv4 Support | ❌ No | ✅ Yes |
| IPv6 Required | ✅ Yes | ❌ No |

## Quick Checklist

- [ ] Got pooler connection string from Supabase dashboard
- [ ] Replaced `[YOUR-PASSWORD]` with `Megna%40voice123`
- [ ] Updated `.env` file with pooler URL
- [ ] Ran `npm run db:verify` successfully
- [ ] Connection works!

## Still Having Issues?

1. **Double-check the region** - Make sure you're using the correct region from your dashboard
2. **Verify password encoding** - `@` must be `%40`
3. **Check project status** - Ensure your Supabase project is active (not paused)
4. **Try Transaction mode** - If Session mode doesn't work, try Transaction mode pooler


