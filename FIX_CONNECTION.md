# Fix Your Database Connection

## Issue 1: Password URL Encoding

Your password `Magna@voice123` contains `@` which must be URL-encoded as `%40`.

**Correct format:**
```
postgresql://postgres:Magna%40voice123@db.sdtycpnutctbgbvpbeor.supabase.co:5432/postgres
```

## Issue 2: IPv4 Compatibility (IMPORTANT!)

Your Supabase dashboard shows "Not IPv4 compatible" for the direct connection. If your local network is IPv4-only, you need to use the **Session Pooler** instead.

### Solution: Use Session Pooler Connection

1. In your Supabase dashboard, click **"Pooler settings"** button
2. Or go to **Settings** → **Database** → **Connection string** → **Session mode**
3. Copy the Session Pooler connection string (it uses port **6543** instead of 5432)

The Session Pooler URL will look like:
```
postgresql://postgres.sdtycpnutctbgbvpbeor:Magna%40voice123@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

### Update Your .env File

**Option A: Direct Connection (if you have IPv6)**
```env
DATABASE_URL=postgresql://postgres:Magna%40voice123@db.sdtycpnutctbgbvpbeor.supabase.co:5432/postgres
```

**Option B: Session Pooler (Recommended for IPv4 networks)**
```env
DATABASE_URL=postgresql://postgres.sdtycpnutctbgbvpbeor:Magna%40voice123@aws-0-[REGION].pooler.supabase.com:6543/postgres
```
(Replace `[REGION]` with your actual region from the pooler URL)

## Quick Fix Steps

1. **Get the Session Pooler URL:**
   - Supabase Dashboard → Settings → Database
   - Click "Pooler settings" or switch to "Session mode" tab
   - Copy the connection string

2. **URL-encode the password:**
   - Replace `@` with `%40` in the password
   - Example: `Magna@voice123` → `Magna%40voice123`

3. **Update .env file:**
   ```env
   DATABASE_URL=postgresql://postgres.sdtycpnutctbgbvpbeor:Magna%40voice123@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```

4. **Test the connection:**
   ```bash
   npm run db:verify
   ```

## Why Session Pooler?

- ✅ Works with IPv4 networks (most home/office networks)
- ✅ Better for serverless/server applications
- ✅ Handles connection pooling automatically
- ✅ More reliable for local development


