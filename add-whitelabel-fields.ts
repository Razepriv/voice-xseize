import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function addWhitelabelFields() {
  try {
    console.log("Adding whitelabel fields to organizations table...");

    // Add company_name column
    await db.execute(sql`
      ALTER TABLE organizations 
      ADD COLUMN IF NOT EXISTS company_name TEXT
    `);

    // Add logo_url column
    await db.execute(sql`
      ALTER TABLE organizations 
      ADD COLUMN IF NOT EXISTS logo_url TEXT
    `);

    // Add primary_color column
    await db.execute(sql`
      ALTER TABLE organizations 
      ADD COLUMN IF NOT EXISTS primary_color VARCHAR(7)
    `);

    console.log("✅ Successfully added whitelabel fields to organizations table");
  } catch (error) {
    console.error("❌ Error adding whitelabel fields:", error);
    throw error;
  }
}

addWhitelabelFields()
  .then(() => {
    console.log("Migration completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
