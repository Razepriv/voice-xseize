import { storage } from './server/storage';

async function addPhoneNumbers() {
  try {
    // Get organization (assuming first one)
    const orgId = 'cc25b90c-3e98-4d27-a07f-04308a7cdbce'; // Your org ID from logs
    
    const numbers = [
      {
        organizationId: orgId,
        phoneNumber: '+919513886363',
        provider: 'exotel' as const,
        exotelSid: '1115811',
        friendlyName: 'Bolna Voice Agent',
        capabilities: { voice: true, sms: true },
        status: 'active' as const,
      },
      {
        organizationId: orgId,
        phoneNumber: '+912246180828',
        provider: 'exotel' as const,
        exotelSid: '1101447',
        friendlyName: 'Landing Flow',
        capabilities: { voice: true, sms: true },
        status: 'active' as const,
      }
    ];

    console.log('Adding phone numbers...');
    
    for (const num of numbers) {
      try {
        const existing = await storage.getPhoneNumbers(orgId);
        const found = existing.find(n => n.phoneNumber === num.phoneNumber);
        
        if (!found) {
          const created = await storage.createPhoneNumber(num);
          console.log('✓ Created:', created.phoneNumber, '-', created.friendlyName);
        } else {
          console.log('- Already exists:', found.phoneNumber, '-', found.friendlyName);
        }
      } catch (err) {
        console.error('✗ Error with', num.phoneNumber, ':', err);
      }
    }
    
    console.log('\nAll phone numbers:');
    const all = await storage.getPhoneNumbers(orgId);
    all.forEach(n => console.log(`  - ${n.phoneNumber} (${n.friendlyName})`));
    
  } catch (error) {
    console.error('Failed:', error);
  }
  
  process.exit(0);
}

addPhoneNumbers();
