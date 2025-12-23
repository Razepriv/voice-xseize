# Update Your .env File

## ✅ Your Working Connection String

Your pooler connection string is working! Update your `.env` file with:

```env
DATABASE_URL="postgresql://postgres.sdtycpnutctbgbvpbeor:Megnavoice123@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"
```

## Steps to Update

1. **Open your `.env` file** in the project root
2. **Find the line** that starts with `DATABASE_URL=`
3. **Replace it** with the connection string above
4. **Save the file**

## After Updating

Run these commands in order:

```bash
# 1. Verify the connection
npm run db:verify

# 2. Create all database tables
npm run db:push

# 3. Start the development server
npm run dev
```

## What to Expect

After `npm run db:verify`, you should see:
```
✅ All environment variables are set
✅ Supabase client created successfully
✅ Database connection successful
✅ All required tables exist
```

After `npm run db:push`, all 12 tables will be created in your Supabase database.

Then you can start the app and test sign-in at: `http://localhost:5000/api/signup`


