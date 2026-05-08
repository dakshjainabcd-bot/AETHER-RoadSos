/**
 * AETHER Mesh Relay Simulation Server
 * =====================================
 * Simulates Bluetooth Low Energy mesh relay over WiFi (for Expo Go demos).
 *
 * HOW TO RUN:
 *   cd server
 *   npm install
 *   node simulation-server.js
 *
 * HOW TO FIND YOUR IP ADDRESS (Windows):
 *   Open a NEW terminal and run: ipconfig
 *   Look for "IPv4 Address" under your WiFi adapter
 *   Example: 192.168.1.105
 *
 * Then update SIMULATION_SERVER_URL in utils/constants.ts:
 *   ws://192.168.1.105:3001     ← use YOUR IP here
 *
 * WHAT THIS SERVER DOES:
 * - Accepts WebSocket connections from all phones on your WiFi
 * - When Phone A sends an SOS packet, server broadcasts to all other phones
 * - This is EXACTLY what BLE does — just over WiFi for the demo
 */

const WebSocket = require('ws');

const PORT = 3001;
const wss = new WebSocket.Server({ port: PORT });

// Map: deviceId → { ws, connectedAt, name }
const connectedPhones = new Map();
let totalPacketsRelayed = 0;

// ── Helper: print a clean separator line ──────────────────────
function line(char = '─') {
  return char.repeat(55);
}

// ── Handle new connections ─────────────────────────────────────
wss.on('connection', (ws) => {
  let deviceId = null;

  ws.on('message', (rawData) => {
    let message;
    try {
      message = JSON.parse(rawData.toString());
    } catch (err) {
      console.error('❌ Failed to parse message:', err.message);
      return;
    }

    switch (message.type) {

      // ── REGISTER: Phone announces itself ────────────────────
      case 'REGISTER': {
        deviceId = message.deviceId || 'unknown_' + Date.now();
        const shortId = deviceId.substring(0, 8) + '...';

        connectedPhones.set(deviceId, {
          ws,
          connectedAt: Date.now(),
          shortId,
        });

        console.log(`\n📱 PHONE CONNECTED`);
        console.log(`   ID:     ${shortId}`);
        console.log(`   Online: ${connectedPhones.size} phone(s)`);

        // Tell the phone it's registered and how many peers are online
        ws.send(JSON.stringify({
          type: 'REGISTERED',
          deviceId,
          connectedDevices: connectedPhones.size,
        }));
        break;
      }

      // ── SOS_PACKET: Phone is broadcasting an SOS ────────────
      case 'SOS_PACKET': {
        const packet = message.packet;
        if (!packet) {
          console.warn('⚠️  SOS_PACKET received but missing packet data');
          break;
        }

        const senderShortId = (deviceId || 'unknown').substring(0, 8) + '...';
        const severityStars = '⭐'.repeat(packet.severity || 1);
        const hopBar = '→'.repeat(Math.min((packet.hopCount || 0) + 1, 8));
        totalPacketsRelayed++;

        console.log(`\n${line()}`);
        console.log(`🚨 SOS PACKET #${totalPacketsRelayed}`);
        console.log(`   From:      ${senderShortId}`);
        console.log(`   Incident:  ${packet.incidentId}`);
        console.log(`   Location:  ${(packet.lat || 0).toFixed(4)}°N, ${(packet.lng || 0).toFixed(4)}°E`);
        console.log(`   Severity:  ${severityStars} (${packet.severity}/5)`);
        console.log(`   Hop:       ${packet.hopCount} ${hopBar}`);
        console.log(`   Time:      ${new Date(packet.timestamp).toLocaleTimeString()}`);

        // Broadcast to all other connected phones
        let relayCount = 0;
        connectedPhones.forEach((phoneData, phoneId) => {
          if (phoneId !== deviceId && phoneData.ws.readyState === WebSocket.OPEN) {
            // Send with hop count incremented
            phoneData.ws.send(JSON.stringify({
              type: 'SOS_RECEIVED',
              packet: {
                ...packet,
                hopCount: (packet.hopCount || 0) + 1,
              },
              relayedBy: deviceId,
            }));
            console.log(`   → Relayed to: ${phoneData.shortId}`);
            relayCount++;
          }
        });

        if (relayCount === 0) {
          console.log(`   ⚠️  No other phones online to relay to`);
          console.log(`   Tip: Open the app on more phones to test relay`);
        } else {
          console.log(`   ✅ Relayed to ${relayCount} phone(s)`);
        }
        console.log(line());
        break;
      }

      default:
        console.log(`Unknown message type: ${message.type}`);
    }
  });

  ws.on('close', () => {
    if (deviceId && connectedPhones.has(deviceId)) {
      const phone = connectedPhones.get(deviceId);
      connectedPhones.delete(deviceId);
      console.log(`\n📴 PHONE DISCONNECTED`);
      console.log(`   ID:     ${phone.shortId}`);
      console.log(`   Online: ${connectedPhones.size} phone(s) remaining`);
    }
  });

  ws.on('error', (err) => {
    console.error(`WebSocket error: ${err.message}`);
  });
});

// ── Startup banner ─────────────────────────────────────────────
console.log(`\n${line('═')}`);
console.log(`🛰️  AETHER Mesh Relay Simulation Server`);
console.log(line('═'));
console.log(`\n✅ Server running on port ${PORT}`);
console.log(`\n📌 SETUP STEPS:`);
console.log(`   1. Open a NEW terminal and run: ipconfig`);
console.log(`      Find "IPv4 Address" under your WiFi adapter`);
console.log(`      Example: 192.168.1.105`);
console.log(`\n   2. In the AETHER app, open: utils/constants.ts`);
console.log(`      Change SIMULATION_SERVER_URL to:`);
console.log(`      ws://YOUR_IP_HERE:${PORT}`);
console.log(`\n   3. Make sure ALL phones are on the SAME WiFi network`);
console.log(`\n   4. Open the app on all phones — they'll appear here as "PHONE CONNECTED"`);
console.log(`\n   5. Trigger SOS on one phone → watch others receive it!`);
console.log(`\n${line()}`);
console.log(`⏳ Waiting for phones to connect...\n`);