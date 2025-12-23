import 'dotenv/config';
import { db } from './server/db';
import { phoneNumbers, organizations } from './shared/schema';
import { eq } from 'drizzle-orm';

async function addPlivoNumber() {
  console.log('\n📞 Adding Plivo number to database...\n');

  const plivoNumber = '+918035735937';
  
  try {
    const orgs = await db.select().from(organizations);
    if (orgs.length === 0) {
      console.error('No organizations found!');
      process.exit(1);
    }
    const orgId = orgs[0].id;
    console.log(`Using organization: ${orgs[0].name} (${orgId})\n`);

    const existing = await db
      .select()
      .from(phoneNumbers)
      .where(eq(phoneNumbers.phoneNumber, plivoNumber));

    if (existing.length > 0) {
      console.log(`✓ Number ${plivoNumber} already exists`);
      console.log(`  ID: ${existing[0].id}`);
    } else {
      const result = await db.insert(phoneNumbers).values({
        organizationId: orgId,
        phoneNumber: plivoNumber,
        displayName: 'Bolna Plivo Number',
        provider: 'plivo',
        status: 'active'
      }).returning();

      console.log(`✓ Created: ${plivoNumber} - ${result[0].displayName}`);
      console.log(`  ID: ${result[0].id}`);
    }

    const allNumbers = await db.select().from(phoneNumbers);
    console.log('\n📋 All phone numbers:');
    allNumbers.forEach(num => {
      console.log(`  - ${num.phoneNumber} (${num.displayName || 'No name'}) [${num.provider}]`);
    });

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  process.exit(0);
}

addPlivoNumber();
