# How to Get Your Correct Supabase Database Connection String

## Step-by-Step Instructions

### 1. Go to Your Supabase Dashboard
- Visit: https://supabase.com/dashboard
- Sign in to your account

### 2. Select Your Project
- Click on your project (or create a new one if needed)
- **Important**: Make sure the project is **active** (not paused)

### 3. Get the Connection String
1. Click on **Settings** (gear icon) in the left sidebar
2. Click on **Database** in the settings menu
3. Scroll down to **Connection string** section
4. You'll see different connection options:
   - **URI** - Full connection string
   - **JDBC** - Java format
   - **Golang** - Go format
   - **Python** - Python format
   - **Node.js** - Node.js format

### 4. Copy the Connection String
- Click on the **URI** tab
- You'll see something like:
  ```
  postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
  ```
  OR
  ```
  postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
  ```

### 5. Important Notes

**If your password contains special characters** (like `@`, `:`, `/`, `#`, etc.):
- You MUST URL-encode them in the connection string
- Common encodings:
  - `@` → `%40`
  - `:` → `%3A`
  - `/` → `%2F`
  - `#` → `%23`
  - `%` → `%25`
  - ` ` (space) → `%20`

**Example:**
- Password: `Megna@voice123`
- Encoded: `Megna%40voice123`
- Full URL: `postgresql://postgres:Megna%40voice123@db.xxxxx.supabase.co:5432/postgres`

### 6. Update Your .env File

Open your `.env` file and update the `DATABASE_URL`:

```env
DATABASE_URL=postgresql://postgres:YOUR_ENCODED_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres
```

### 7. Test the Connection

After updating, run:
```bash
npm run db:verify
```

## Troubleshooting

### "getaddrinfo ENOTFOUND" Error
- **Check**: Is your Supabase project active? (Not paused)
- **Check**: Is the hostname correct? (Should match what's in Supabase dashboard)
- **Check**: Can you access the Supabase dashboard for this project?

### "password authentication failed" Error
- **Check**: Is the password correct?
- **Check**: Are special characters URL-encoded?

### "Connection refused" Error
- **Check**: Is the port correct? (5432 for direct, 6543 for pooler)
- **Check**: Are you using the correct connection type?

## Alternative: Use Connection Pooler

If direct connection doesn't work, try the **Connection Pooler** URL:
- Go to **Settings** → **Database** → **Connection string**
- Use the **Session mode** or **Transaction mode** connection string
- These use port **6543** instead of **5432**

Example:
```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

## Still Having Issues?

1. **Verify project exists**: Check Supabase dashboard
2. **Check project status**: Make sure it's not paused
3. **Try pooler URL**: Use the connection pooler instead
4. **Reset database password**: If needed, reset it in Supabase dashboard


