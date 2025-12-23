import 'dotenv/config';
import { db } from './server/db';
import { phoneNumbers, organizations } from './shared/schema';
import { eq } from 'drizzle-orm';

async function addWorkingNumber() {
  console.log('\n📞 Adding working Exotel number to database...\n');

  const workingNumber = '+918047113155';
  
  try {
    // Get the first organization ID
    const orgs = await db.select().from(organizations);
    if (orgs.length === 0) {
      console.error('No organizations found! Please create an organization first.');
      process.exit(1);
    }
    const orgId = orgs[0].id;
    console.log(`Using organization: ${orgs[0].name} (${orgId})\n`);

    // Check if it already exists
    const existing = await db
      .select()
      .from(phoneNumbers)
      .where(eq(phoneNumbers.phoneNumber, workingNumber));

    if (existing.length > 0) {
      console.log(`✓ Number ${workingNumber} already exists in database`);
      console.log(`  ID: ${existing[0].id}`);
      console.log(`  Display Name: ${existing[0].displayName}`);
    } else {
      // Add the number
      const result = await db.insert(phoneNumbers).values({
        organizationId: orgId,
        phoneNumber: workingNumber,
        displayName: 'Exotel Working Number',
        provider: 'exotel',
        status: 'active'
      }).returning();

      console.log(`✓ Created: ${workingNumber} - ${result[0].displayName}`);
      console.log(`  ID: ${result[0].id}`);
    }

    // List all phone numbers
    const allNumbers = await db.select().from(phoneNumbers);
    console.log('\n📋 All phone numbers in database:');
    allNumbers.forEach(num => {
      console.log(`  - ${num.phoneNumber} (${num.displayName || 'No name'})`);
    });

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  process.exit(0);
}

addWorkingNumber();
