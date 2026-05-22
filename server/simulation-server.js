/**
 * AETHER Mesh Relay Simulation Server
 * =====================================
 * Phase 2: SOS packet relay
 * Phase 12: HAZARD packet relay (new)
 *
 * HOW TO RUN:
 *   cd server
 *   npm install
 *   node simulation-server.js
 */

const WebSocket = require('ws');

const PORT = 3001;
const wss = new WebSocket.Server({ port: PORT });

const connectedPhones = new Map();
let totalPacketsRelayed = 0;

function line(char = '─') {
  return char.repeat(55);
}

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

      // ── REGISTER: Phone announces itself ────────────────────────────────
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

        ws.send(JSON.stringify({
          type: 'REGISTERED',
          deviceId,
          connectedDevices: connectedPhones.size,
        }));
        break;
      }

      // ── SOS_PACKET: Phone is broadcasting an SOS ─────────────────────────
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

        let relayCount = 0;
        connectedPhones.forEach((phoneData, phoneId) => {
          if (phoneId !== deviceId && phoneData.ws.readyState === WebSocket.OPEN) {
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
        } else {
          console.log(`   ✅ Relayed to ${relayCount} phone(s)`);
        }
        console.log(line());
        break;
      }

      // ── HAZARD_PACKET: Phone is broadcasting a road hazard (Phase 12) ────
      case 'HAZARD_PACKET': {
        const packet = message.packet;
        if (!packet) {
          console.warn('⚠️  HAZARD_PACKET received but missing packet data');
          break;
        }

        const senderShortId = (deviceId || 'unknown').substring(0, 8) + '...';
        const hazardEmojis = {
          pothole: '🕳️',
          accident: '💥',
          road_closed: '🚧',
          debris: '🪨',
        };
        const emoji = hazardEmojis[packet.hazardType] || '⚠️';

        console.log(`\n${line()}`);
        console.log(`${emoji}  HAZARD PACKET`);
        console.log(`   From:     ${senderShortId}`);
        console.log(`   Type:     ${packet.hazardType}`);
        console.log(`   Location: ${(packet.lat || 0).toFixed(4)}°N, ${(packet.lng || 0).toFixed(4)}°E`);
        console.log(`   Severity: ${packet.severity}/3`);
        console.log(`   Hop:      ${packet.hopCount}`);

        let relayCount = 0;
        connectedPhones.forEach((phoneData, phoneId) => {
          if (phoneId !== deviceId && phoneData.ws.readyState === WebSocket.OPEN) {
            phoneData.ws.send(JSON.stringify({
              type: 'HAZARD_RECEIVED',
              packet: {
                ...packet,
                hopCount: (packet.hopCount || 0) + 1,
              },
              relayedBy: deviceId,
            }));
            relayCount++;
          }
        });

        if (relayCount === 0) {
          console.log(`   ⚠️  No other phones online to relay hazard to`);
        } else {
          console.log(`   ✅ Hazard relayed to ${relayCount} phone(s)`);
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

// ── Startup Banner ─────────────────────────────────────────────────────────
console.log(`\n${line('═')}`);
console.log(`🛰️  AETHER Mesh Relay Simulation Server`);
console.log(`   Phase 2: SOS Relay  |  Phase 12: Hazard Relay`);
console.log(line('═'));
console.log(`\n✅ Server running on port ${PORT}`);
console.log(`\n📌 SUPPORTED PACKET TYPES:`);
console.log(`   🚨 SOS_PACKET → relayed as SOS_RECEIVED`);
console.log(`   ⚠️  HAZARD_PACKET → relayed as HAZARD_RECEIVED`);
console.log(`\n⏳ Waiting for phones to connect...\n`);