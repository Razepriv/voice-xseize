# Get Your Session Pooler Connection String

## ✅ Confirmed: You Need Session Pooler

Based on your Supabase dashboard:
- Direct connections require IPv6 (or $4/month add-on)
- **Session Pooler supports IPv4** - This is what you need!
- No additional cost required

## Step-by-Step: Get Pooler Connection String

### Step 1: Navigate to Database Settings
1. In Supabase Dashboard, go to **Settings** → **Database**
2. Scroll down to the **Connection string** section

### Step 2: Switch to Pooler Mode
1. Look for tabs or buttons: **"URI"**, **"Session mode"**, or **"Pooler settings"**
2. Click on **"Session mode"** (or **"Pooler settings"**)
3. You should see a connection string that looks like:
   ```
   postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```

### Step 3: Copy the Connection String
- Click the copy button next to the connection string
- Or manually copy the entire string

### Step 4: Update with Your Password
Replace `[YOUR-PASSWORD]` with your URL-encoded password:
- Your password: `Megna@voice123`
- URL-encoded: `Megna%40voice123`

**Example:**
```
postgresql://postgres.sdtycpnutctbgbvpbeor:Megna%40voice123@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

### Step 5: Update Your .env File
Open `.env` and set:
```env
DATABASE_URL=postgresql://postgres.sdtycpnutctbgbvpbeor:Megna%40voice123@aws-0-[YOUR-REGION].pooler.supabase.com:6543/postgres
```

**Important:** Replace `[YOUR-REGION]` with the actual region from your pooler connection string!

### Step 6: Test Connection
```bash
npm run db:verify
```

## Key Differences: Pooler vs Direct

| Feature | Direct (Not Working) | Session Pooler (Use This) |
|---------|---------------------|---------------------------|
| Port | 5432 | **6543** |
| Username | `postgres` | **`postgres.sdtycpnutctbgbvpbeor`** |
| Host | `db.sdtycpnutctbgbvpbeor.supabase.co` | **`aws-0-[REGION].pooler.supabase.com`** |
| IPv4 Support | ❌ No | ✅ **Yes** |
| Cost | Free (but needs IPv6) | **Free** |

## What to Look For

The pooler connection string will have:
- ✅ Port **6543** (not 5432)
- ✅ Username format: `postgres.[PROJECT-REF]`
- ✅ Host: `aws-0-[REGION].pooler.supabase.com`
- ✅ Works with IPv4 networks

## Quick Test

After updating your `.env` file, run:
```bash
npm run db:verify
```

You should see:
```
✅ Database connection successful
✅ All required tables exist
```

Then you can proceed with:
```bash
npm run db:push  # Create database tables
npm run dev      # Start the application
```


