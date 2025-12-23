import { io } from "socket.io-client";

const NUM_USERS = 10000; // Simulate 10,000 concurrent users (Note: This may hit OS limits)
const ORGANIZATION_ID = "test-org-123"; // Dummy org ID
// Default port is 5000 based on package.json, but in Replit it might be different. 
// However, since I am in a Windows environment, I'll assume 5000 or try to read .env if I could.
// For now, I'll default to localhost:5000.
const SERVER_URL = "http://localhost:5000";

console.log(`Starting load test with ${NUM_USERS} concurrent users connecting to ${SERVER_URL}...`);

const sockets = [];
let connectedCount = 0;
let errors = 0;

for (let i = 0; i < NUM_USERS; i++) {
    // Stagger connections slightly to be realistic? No, let's hammer it.
    const socket = io(SERVER_URL, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        reconnection: true,
        // Add some random delay to autoConnect if we wanted, but io() connects immediately
    });

    socket.on('connect', () => {
        connectedCount++;
        socket.emit('join:organization', ORGANIZATION_ID);

        if (connectedCount % 10 === 0) {
            console.log(`${connectedCount} users connected...`);
        }

        if (connectedCount === NUM_USERS) {
            console.log(`✅ SUCCESS: All ${NUM_USERS} users connected successfully!`);
            console.log("Maintaining connections for 5 seconds to test stability...");
            setTimeout(() => {
                console.log("Disconnecting all users...");
                sockets.forEach(s => s.disconnect());
                console.log("Load test completed.");
                process.exit(0);
            }, 5000);
        }
    });

    socket.on('connect_error', (err) => {
        // console.error(`User ${i + 1} connection error:`, err.message);
        // Don't spam console, just count
        errors++;
    });

    sockets.push(socket);
}

// Timeout
setTimeout(() => {
    if (connectedCount < NUM_USERS) {
        console.error(`❌ FAILURE: Timeout. Only ${connectedCount}/${NUM_USERS} users connected.`);
        console.error(`Errors encountered: ${errors}`);
        console.log("Ensure the server is running on port 5000 found in package.json dev script.");
        process.exit(1);
    }
}, 15000);
