// Test phone sync to see what numbers we have
const numbers = [
  {
    phoneNumber: '+919513886363',
    appId: '1115811',
    friendlyName: 'Bolna Voice Agent'
  },
  {
    phoneNumber: '+912246180828',
    appId: '1101447',
    friendlyName: 'Landing Flow'
  }
];

console.log('Configured numbers:');
numbers.forEach(num => {
  console.log(`  - ${num.phoneNumber} (${num.friendlyName}) - App ID: ${num.appId}`);
});

// Make sync request
fetch('http://localhost:5000/api/phone-numbers/sync', {
  headers: {
    'Cookie': 'connect.sid=your_session_cookie_here'
  }
})
.then(res => res.json())
.then(data => {
  console.log('\nSync result:', JSON.stringify(data, null, 2));
})
.catch(err => {
  console.error('Sync failed:', err);
});
