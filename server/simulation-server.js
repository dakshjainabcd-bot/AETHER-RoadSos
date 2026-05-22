/**
 * AETHER Mesh Relay Simulation Server — Phase 14 Updated
 * ========================================================
 * Simulates Bluetooth Low Energy mesh relay over WiFi (for Expo Go demos).
 *
 * PHASE 14 CHANGES:
 * - Broadcasts PEER_COUNT_UPDATE to all existing phones when a new phone
 *   joins OR when a phone disconnects.
 * - This allows the DTN system on each phone to know when new peers
 *   are available for forwarding buffered SOS packets.
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
 *   ws://192.168.1.105:3001
 */

const WebSocket = require('ws');

const PORT = 3001;
const wss = new WebSocket.Server({ port: PORT });

// Map: deviceId → { ws, connectedAt, shortId }
const connectedPhones = new Map();
let totalPacketsRelayed = 0;

// ── Helper: separator line ───────────────────────────────────────────────
function line(char = '─') {
    return char.repeat(55);
}

// ── Helper: broadcast peer count update to a set of phones ───────────────
// This tells all currently connected phones how many total phones
// are now online, so they can trigger DTN forwarding if needed.
function broadcastPeerCount(excludeDeviceId = null) {
    const count = connectedPhones.size;
    connectedPhones.forEach((phoneData, phoneId) => {
        if (phoneId !== excludeDeviceId && phoneData.ws.readyState === WebSocket.OPEN) {
            phoneData.ws.send(JSON.stringify({
                type: 'PEER_COUNT_UPDATE',
                connectedDevices: count,
            }));
        }
    });
}

// ── Handle new connections ────────────────────────────────────────────────
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

            // ── REGISTER: Phone announces itself ──────────────────────────
            case 'REGISTER': {
                deviceId = message.deviceId || 'unknown_' + Date.now();
                const shortId = deviceId.substring(0, 8) + '...';

                // ── Phase 14: Notify EXISTING phones BEFORE registering ───
                //
                // WHY THE ORDER MATTERS:
                // We notify existing phones BEFORE adding the new phone to
                // connectedPhones. This way, the notification count is
                // "current + 1" (accurate after the new phone joins).
                //
                // If we did it AFTER adding, the new phone would also
                // be in the forEach loop and get a PEER_COUNT_UPDATE for
                // itself joining — confusing and unnecessary.
                //
                // Example with 2 existing phones (A, B) and new phone C:
                //   BEFORE this line: connectedPhones.size = 2
                //   Notify A and B with connectedDevices: 3
                //   THEN add C: connectedPhones.size = 3
                //   Send REGISTERED to C with connectedDevices: 3
                const newTotalCount = connectedPhones.size + 1;
                connectedPhones.forEach((phoneData, existingId) => {
                    if (phoneData.ws.readyState === WebSocket.OPEN) {
                        phoneData.ws.send(JSON.stringify({
                            type: 'PEER_COUNT_UPDATE',
                            connectedDevices: newTotalCount,
                        }));
                    }
                });
                // ──────────────────────────────────────────────────────────

                // Now register the new phone
                connectedPhones.set(deviceId, {
                    ws,
                    connectedAt: Date.now(),
                    shortId,
                });

                console.log(`\n📱 PHONE CONNECTED`);
                console.log(`   ID:     ${shortId}`);
                console.log(`   Online: ${connectedPhones.size} phone(s)`);
                if (connectedPhones.size > 1) {
                    console.log(`   ✅ DTN: Existing phones notified of new peer`);
                }

                // Tell the new phone it's registered with the final count
                ws.send(JSON.stringify({
                    type: 'REGISTERED',
                    deviceId,
                    connectedDevices: connectedPhones.size,
                }));
                break;
            }

            // ── SOS_PACKET: Phone is broadcasting an SOS ──────────────────
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

                // Broadcast to all OTHER connected phones
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
                    console.log(`   📦 No other phones online — SOS will be buffered in DTN`);
                    console.log(`   Tip: Open the app on another phone to test DTN forwarding`);
                } else {
                    console.log(`   ✅ Relayed to ${relayCount} phone(s)`);
                }
                console.log(line());
                break;
            }

            // ── HAZARD_PACKET: Phone is broadcasting a road hazard ─────────
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
                    console.log(`   📦 No other phones online — hazard will be buffered in DTN`);
                } else {
                    console.log(`   ✅ Hazard relayed to ${relayCount} phone(s)`);
                }
                console.log(line());
                break;
            }

            default:
                // Unknown message type — ignore silently
                break;
        }
    });

    ws.on('close', () => {
        if (deviceId && connectedPhones.has(deviceId)) {
            const phone = connectedPhones.get(deviceId);
            connectedPhones.delete(deviceId);

            console.log(`\n📴 PHONE DISCONNECTED`);
            console.log(`   ID:     ${phone.shortId}`);
            console.log(`   Online: ${connectedPhones.size} phone(s) remaining`);

            // ── Phase 14: Notify remaining phones of reduced peer count ────
            //
            // WHY: If Phone A was carrying DTN packets hoping to relay to
            // Phone B, and Phone B disconnects, Phone A should know that
            // it no longer has a relay target.
            //
            // This also handles the opposite: if Phone A disconnects while
            // Phone B still has buffered packets, Phone B gets updated count.
            if (connectedPhones.size > 0) {
                broadcastPeerCount(); // Notify all remaining phones
                console.log(`   📡 Remaining phones notified of disconnect`);
            }
            // ─────────────────────────────────────────────────────────────
        }
    });

    ws.on('error', (err) => {
        console.error(`WebSocket error: ${err.message}`);
    });
});

// ── Startup banner ────────────────────────────────────────────────────────
console.log(`\n${line('═')}`);
console.log(`🛰️  AETHER Mesh Relay Simulation Server — Phase 14`);
console.log(line('═'));
console.log(`\n✅ Server running on port ${PORT}`);
console.log(`\n📌 PHASE 14 FEATURES:`);
console.log(`   • PEER_COUNT_UPDATE: Phones notified on join/disconnect`);
console.log(`   • DTN Store-and-Forward: Packets buffered when no peers`);
console.log(`\n📌 SUPPORTED PACKET TYPES:`);
console.log(`   🚨 SOS_PACKET     → relayed as SOS_RECEIVED`);
console.log(`   ⚠️  HAZARD_PACKET → relayed as HAZARD_RECEIVED`);
console.log(`\n⏳ Waiting for phones to connect...\n`);