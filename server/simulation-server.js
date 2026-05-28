// /**
//  * AETHER Mesh Relay Simulation Server — Phase 14 Updated
//  * ========================================================
//  * Simulates Bluetooth Low Energy mesh relay over WiFi (for Expo Go demos).
//  *
//  * PHASE 14 CHANGES:
//  * - Broadcasts PEER_COUNT_UPDATE to all existing phones when a new phone
//  *   joins OR when a phone disconnects.
//  * - This allows the DTN system on each phone to know when new peers
//  *   are available for forwarding buffered SOS packets.
//  *
//  * HOW TO RUN:
//  *   cd server
//  *   npm install
//  *   node simulation-server.js
//  *
//  * HOW TO FIND YOUR IP ADDRESS (Windows):
//  *   Open a NEW terminal and run: ipconfig
//  *   Look for "IPv4 Address" under your WiFi adapter
//  *   Example: 192.168.1.105
//  *
//  * Then update SIMULATION_SERVER_URL in utils/constants.ts:
//  *   ws://192.168.1.105:3001
//  */

// const WebSocket = require('ws');

// const PORT = 3001;
// const wss = new WebSocket.Server({ port: PORT });

// // Map: deviceId → { ws, connectedAt, shortId }
// const connectedPhones = new Map();
// let totalPacketsRelayed = 0;

// // ── Helper: separator line ───────────────────────────────────────────────
// function line(char = '─') {
//     return char.repeat(55);
// }

// // ── Helper: broadcast peer count update to a set of phones ───────────────
// // This tells all currently connected phones how many total phones
// // are now online, so they can trigger DTN forwarding if needed.
// function broadcastPeerCount(excludeDeviceId = null) {
//     const count = connectedPhones.size;
//     connectedPhones.forEach((phoneData, phoneId) => {
//         if (phoneId !== excludeDeviceId && phoneData.ws.readyState === WebSocket.OPEN) {
//             phoneData.ws.send(JSON.stringify({
//                 type: 'PEER_COUNT_UPDATE',
//                 connectedDevices: count,
//             }));
//         }
//     });
// }

// // ── Handle new connections ────────────────────────────────────────────────
// wss.on('connection', (ws) => {
//     let deviceId = null;

//     ws.on('message', (rawData) => {
//         let message;
//         try {
//             message = JSON.parse(rawData.toString());
//         } catch (err) {
//             console.error('❌ Failed to parse message:', err.message);
//             return;
//         }

//         switch (message.type) {

//             // ── REGISTER: Phone announces itself ──────────────────────────
//             case 'REGISTER': {
//                 deviceId = message.deviceId || 'unknown_' + Date.now();
//                 const shortId = deviceId.substring(0, 8) + '...';

//                 // ── Phase 14: Notify EXISTING phones BEFORE registering ───
//                 //
//                 // WHY THE ORDER MATTERS:
//                 // We notify existing phones BEFORE adding the new phone to
//                 // connectedPhones. This way, the notification count is
//                 // "current + 1" (accurate after the new phone joins).
//                 //
//                 // If we did it AFTER adding, the new phone would also
//                 // be in the forEach loop and get a PEER_COUNT_UPDATE for
//                 // itself joining — confusing and unnecessary.
//                 //
//                 // Example with 2 existing phones (A, B) and new phone C:
//                 //   BEFORE this line: connectedPhones.size = 2
//                 //   Notify A and B with connectedDevices: 3
//                 //   THEN add C: connectedPhones.size = 3
//                 //   Send REGISTERED to C with connectedDevices: 3
//                 const newTotalCount = connectedPhones.size + 1;
//                 connectedPhones.forEach((phoneData, existingId) => {
//                     if (phoneData.ws.readyState === WebSocket.OPEN) {
//                         phoneData.ws.send(JSON.stringify({
//                             type: 'PEER_COUNT_UPDATE',
//                             connectedDevices: newTotalCount,
//                         }));
//                     }
//                 });
//                 // ──────────────────────────────────────────────────────────

//                 // Now register the new phone
//                 connectedPhones.set(deviceId, {
//                     ws,
//                     connectedAt: Date.now(),
//                     shortId,
//                 });

//                 console.log(`\n📱 PHONE CONNECTED`);
//                 console.log(`   ID:     ${shortId}`);
//                 console.log(`   Online: ${connectedPhones.size} phone(s)`);
//                 if (connectedPhones.size > 1) {
//                     console.log(`   ✅ DTN: Existing phones notified of new peer`);
//                 }

//                 // Tell the new phone it's registered with the final count
//                 ws.send(JSON.stringify({
//                     type: 'REGISTERED',
//                     deviceId,
//                     connectedDevices: connectedPhones.size,
//                 }));
//                 break;
//             }

//             // ── SOS_PACKET: Phone is broadcasting an SOS ──────────────────
//             case 'SOS_PACKET': {
//                 const packet = message.packet;
//                 if (!packet) {
//                     console.warn('⚠️  SOS_PACKET received but missing packet data');
//                     break;
//                 }

//                 const senderShortId = (deviceId || 'unknown').substring(0, 8) + '...';
//                 const severityStars = '⭐'.repeat(packet.severity || 1);
//                 const hopBar = '→'.repeat(Math.min((packet.hopCount || 0) + 1, 8));
//                 totalPacketsRelayed++;

//                 console.log(`\n${line()}`);
//                 console.log(`🚨 SOS PACKET #${totalPacketsRelayed}`);
//                 console.log(`   From:      ${senderShortId}`);
//                 console.log(`   Incident:  ${packet.incidentId}`);
//                 console.log(`   Location:  ${(packet.lat || 0).toFixed(4)}°N, ${(packet.lng || 0).toFixed(4)}°E`);
//                 console.log(`   Severity:  ${severityStars} (${packet.severity}/5)`);
//                 console.log(`   Hop:       ${packet.hopCount} ${hopBar}`);
//                 console.log(`   Time:      ${new Date(packet.timestamp).toLocaleTimeString()}`);

//                 // Broadcast to all OTHER connected phones
//                 let relayCount = 0;
//                 connectedPhones.forEach((phoneData, phoneId) => {
//                     if (phoneId !== deviceId && phoneData.ws.readyState === WebSocket.OPEN) {
//                         phoneData.ws.send(JSON.stringify({
//                             type: 'SOS_RECEIVED',
//                             packet: {
//                                 ...packet,
//                                 hopCount: (packet.hopCount || 0) + 1,
//                             },
//                             relayedBy: deviceId,
//                         }));
//                         console.log(`   → Relayed to: ${phoneData.shortId}`);
//                         relayCount++;
//                     }
//                 });

//                 if (relayCount === 0) {
//                     console.log(`   📦 No other phones online — SOS will be buffered in DTN`);
//                     console.log(`   Tip: Open the app on another phone to test DTN forwarding`);
//                 } else {
//                     console.log(`   ✅ Relayed to ${relayCount} phone(s)`);
//                 }
//                 console.log(line());
//                 break;
//             }

//             // ── HAZARD_PACKET: Phone is broadcasting a road hazard ─────────
//             case 'HAZARD_PACKET': {
//                 const packet = message.packet;
//                 if (!packet) {
//                     console.warn('⚠️  HAZARD_PACKET received but missing packet data');
//                     break;
//                 }

//                 const senderShortId = (deviceId || 'unknown').substring(0, 8) + '...';
//                 const hazardEmojis = {
//                     pothole: '🕳️',
//                     accident: '💥',
//                     road_closed: '🚧',
//                     debris: '🪨',
//                 };
//                 const emoji = hazardEmojis[packet.hazardType] || '⚠️';

//                 console.log(`\n${line()}`);
//                 console.log(`${emoji}  HAZARD PACKET`);
//                 console.log(`   From:     ${senderShortId}`);
//                 console.log(`   Type:     ${packet.hazardType}`);
//                 console.log(`   Location: ${(packet.lat || 0).toFixed(4)}°N, ${(packet.lng || 0).toFixed(4)}°E`);
//                 console.log(`   Severity: ${packet.severity}/3`);
//                 console.log(`   Hop:      ${packet.hopCount}`);

//                 let relayCount = 0;
//                 connectedPhones.forEach((phoneData, phoneId) => {
//                     if (phoneId !== deviceId && phoneData.ws.readyState === WebSocket.OPEN) {
//                         phoneData.ws.send(JSON.stringify({
//                             type: 'HAZARD_RECEIVED',
//                             packet: {
//                                 ...packet,
//                                 hopCount: (packet.hopCount || 0) + 1,
//                             },
//                             relayedBy: deviceId,
//                         }));
//                         relayCount++;
//                     }
//                 });

//                 if (relayCount === 0) {
//                     console.log(`   📦 No other phones online — hazard will be buffered in DTN`);
//                 } else {
//                     console.log(`   ✅ Hazard relayed to ${relayCount} phone(s)`);
//                 }
//                 console.log(line());
//                 break;
//             }

//             default:
//                 // Unknown message type — ignore silently
//                 break;
//         }
//     });

//     ws.on('close', () => {
//         if (deviceId && connectedPhones.has(deviceId)) {
//             const phone = connectedPhones.get(deviceId);
//             connectedPhones.delete(deviceId);

//             console.log(`\n📴 PHONE DISCONNECTED`);
//             console.log(`   ID:     ${phone.shortId}`);
//             console.log(`   Online: ${connectedPhones.size} phone(s) remaining`);

//             // ── Phase 14: Notify remaining phones of reduced peer count ────
//             //
//             // WHY: If Phone A was carrying DTN packets hoping to relay to
//             // Phone B, and Phone B disconnects, Phone A should know that
//             // it no longer has a relay target.
//             //
//             // This also handles the opposite: if Phone A disconnects while
//             // Phone B still has buffered packets, Phone B gets updated count.
//             if (connectedPhones.size > 0) {
//                 broadcastPeerCount(); // Notify all remaining phones
//                 console.log(`   📡 Remaining phones notified of disconnect`);
//             }
//             // ─────────────────────────────────────────────────────────────
//         }
//     });

//     ws.on('error', (err) => {
//         console.error(`WebSocket error: ${err.message}`);
//     });
// });

// // ── Startup banner ────────────────────────────────────────────────────────
// console.log(`\n${line('═')}`);
// console.log(`🛰️  AETHER Mesh Relay Simulation Server — Phase 14`);
// console.log(line('═'));
// console.log(`\n✅ Server running on port ${PORT}`);
// console.log(`\n📌 PHASE 14 FEATURES:`);
// console.log(`   • PEER_COUNT_UPDATE: Phones notified on join/disconnect`);
// console.log(`   • DTN Store-and-Forward: Packets buffered when no peers`);
// console.log(`\n📌 SUPPORTED PACKET TYPES:`);
// console.log(`   🚨 SOS_PACKET     → relayed as SOS_RECEIVED`);
// console.log(`   ⚠️  HAZARD_PACKET → relayed as HAZARD_RECEIVED`);
// console.log(`\n⏳ Waiting for phones to connect...\n`);


// server/simulation-server.js
// AETHER Production Simulation Server
// Handles: WebSocket mesh relay + REST API endpoints + Live Dashboard

const { WebSocketServer } = require('ws');
const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 3001;

// ── In-memory storage ─────────────────────────────────────────────────────
// Map of deviceId → WebSocket connection
const clients = new Map();

// Store last 100 incidents for dashboard display
const incidents = [];

// Store hospital pre-alerts
const preAlerts = [];

// ── HTTP Server (handles REST + WebSocket upgrade) ────────────────────────
const server = http.createServer((req, res) => {

  // CORS headers — required for React Native fetch calls
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 
    'Content-Type, X-AETHER-Client, X-AETHER-Incident, X-AETHER-PreAlert, X-AETHER-DataType');

  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);

  // ── Health Check / Status endpoint ──────────────────────────────────────
  if (parsedUrl.pathname === '/' || parsedUrl.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'AETHER Server Running',
      version: '2.0.0',
      phase: 'Phase 15 — Production',
      connectedDevices: clients.size,
      totalIncidents: incidents.length,
      totalPreAlerts: preAlerts.length,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }));
    return;
  }

  // ── SOS Packet Cloud Upload (CloudEgress.ts) ─────────────────────────────
  // Called when a phone gets internet and uploads buffered SOS packets
  if (parsedUrl.pathname === '/api/v1/sos' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const packet = JSON.parse(body);

        // Store with received timestamp
        const stored = {
          ...packet,
          receivedAt: Date.now(),
          receivedAtISO: new Date().toISOString(),
        };
        incidents.push(stored);

        // Keep only last 100 incidents to avoid memory issues
        if (incidents.length > 100) incidents.shift();

        console.log(`[CLOUD] SOS Received: ${packet.incidentId} | Severity: ${packet.severity} | Phase: ${packet.phase || 'unknown'}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'received',
          incidentId: packet.incidentId,
          message: 'SOS packet stored successfully',
        }));
      } catch (e) {
        console.error('[CLOUD] Invalid SOS JSON:', e.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      }
    });
    return;
  }

  // ── Hospital Pre-Alert (HospitalPreAlert.ts) ──────────────────────────────
  // Called when injury type is selected and hospital needs to be alerted
  if (parsedUrl.pathname === '/api/v1/hospital_prealert' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const alert = JSON.parse(body);

        const stored = {
          ...alert,
          receivedAt: Date.now(),
          receivedAtISO: new Date().toISOString(),
          serverStatus: 'ALERT_SENT',
        };
        preAlerts.push(stored);

        if (preAlerts.length > 50) preAlerts.shift();

        console.log(`[HOSPITAL] Pre-Alert: ${alert.hospital_name} | Injury: ${alert.injury_type} | Incident: ${alert.incident_id}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'alert_sent',
          hospital: alert.hospital_name,
          incident_id: alert.incident_id,
          message: 'Hospital notified successfully',
        }));
      } catch (e) {
        console.error('[HOSPITAL] Invalid pre-alert JSON:', e.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      }
    });
    return;
  }

  // ── Road DNA Driving Events Upload (BlackspotUploader.ts) ────────────────
  if (parsedUrl.pathname === '/api/v1/driving_events' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        console.log(`[ROAD DNA] Received ${data.event_count || 0} driving events`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'received', count: data.event_count || 0 }));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // ── API: Get all incidents (for dashboard polling) ───────────────────────
  if (parsedUrl.pathname === '/api/incidents' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      incidents: [...incidents].reverse(),
      preAlerts: [...preAlerts].reverse(),
      clients: clients.size,
      serverTime: new Date().toISOString(),
    }));
    return;
  }

  // ── Live Dashboard HTML ───────────────────────────────────────────────────
  if (parsedUrl.pathname === '/dashboard') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(generateDashboard());
    return;
  }

  // ── Map HTML endpoint ─────────────────────────────────────────────────────
  if (parsedUrl.pathname === '/map') {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    });
    res.end(generateMapHTML());
    return;
  }

  // 404 for everything else
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found', availableRoutes: ['/', '/health', '/dashboard', '/api/incidents', '/api/v1/sos', '/api/v1/hospital_prealert'] }));
});

// ── WebSocket Server ──────────────────────────────────────────────────────
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log(`[WS] New connection from ${clientIP}. Connected devices: ${clients.size + 1}`);

  ws.deviceId = null;
  ws.isAlive = true;

  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (rawData) => {
    try {
      const message = JSON.parse(rawData.toString());

      switch (message.type) {

        // ── Device registers itself with the server ──────────────────────
        case 'REGISTER': {
          const { deviceId } = message;
          if (!deviceId) {
            console.warn('[WS] REGISTER received without deviceId — ignoring');
            break;
          }

          ws.deviceId = deviceId;
          clients.set(deviceId, ws);

          console.log(`[WS] REGISTERED: ${deviceId.substring(0, 8)}... | Total devices: ${clients.size}`);

          // Send REGISTERED confirmation back to this device
          safeSend(ws, {
            type: 'REGISTERED',
            deviceId,
            connectedDevices: clients.size,
          });

          // Broadcast updated peer count to ALL devices (including new one)
          broadcastToAll({
            type: 'PEER_COUNT_UPDATE',
            connectedDevices: clients.size,
          });
          break;
        }

        // ── SOS Packet received — relay to all other devices ─────────────
        case 'SOS_PACKET': {
          const { packet } = message;
          if (!packet) break;

          console.log(`[WS] SOS_PACKET: ${packet.incidentId} | Severity: ${packet.severity} | Hop: ${packet.hopCount}`);

          // Relay to ALL other connected devices
          broadcastExcept(ws, {
            type: 'SOS_RECEIVED',
            packet,
            relayedBy: ws.deviceId || 'unknown',
          });
          break;
        }

        // ── Hazard Packet received — relay to all other devices ──────────
        case 'HAZARD_PACKET': {
          const { packet } = message;
          if (!packet) break;

          console.log(`[WS] HAZARD_PACKET: ${packet.hazardType} at (${packet.lat?.toFixed(4)}, ${packet.lng?.toFixed(4)})`);

          broadcastExcept(ws, {
            type: 'HAZARD_RECEIVED',
            packet,
          });
          break;
        }

        default:
          // Unknown message — log and ignore
          console.log(`[WS] Unknown message type: ${message.type}`);
      }

    } catch (e) {
      console.error('[WS] Failed to parse message:', e.message);
    }
  });

  ws.on('close', (code, reason) => {
    if (ws.deviceId) {
      clients.delete(ws.deviceId);
      console.log(`[WS] DISCONNECTED: ${ws.deviceId.substring(0, 8)}... | Remaining: ${clients.size}`);

      // Notify all remaining devices of updated count
      broadcastToAll({
        type: 'PEER_COUNT_UPDATE',
        connectedDevices: clients.size,
      });
    } else {
      console.log(`[WS] Unregistered client disconnected. Code: ${code}`);
    }
  });

  ws.on('error', (err) => {
    console.error(`[WS] Connection error for ${ws.deviceId || 'unknown'}:`, err.message);
  });
});

// ── Keep-alive ping every 30 seconds ─────────────────────────────────────
const pingInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      console.log(`[WS] Terminating unresponsive client: ${ws.deviceId || 'unknown'}`);
      ws.terminate();
      return;
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => { clearInterval(pingInterval); });

// ── Helper: safely send JSON to a single client ───────────────────────────
function safeSend(ws, data) {
  if (ws && ws.readyState === 1) { // 1 = OPEN
    try {
      ws.send(JSON.stringify(data));
    } catch (e) {
      console.error('[WS] safeSend error:', e.message);
    }
  }
}

// ── Helper: broadcast to ALL connected clients ────────────────────────────
function broadcastToAll(data) {
  const msg = JSON.stringify(data);
  clients.forEach((client) => {
    if (client.readyState === 1) {
      try { client.send(msg); } catch (e) { /* ignore */ }
    }
  });
}

// ── Helper: broadcast to all clients EXCEPT the sender ───────────────────
function broadcastExcept(sender, data) {
  const msg = JSON.stringify(data);
  clients.forEach((client) => {
    if (client !== sender && client.readyState === 1) {
      try { client.send(msg); } catch (e) { /* ignore */ }
    }
  });
}

// ── Dashboard HTML Generator ──────────────────────────────────────────────
function generateDashboard() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AETHER Emergency Dashboard</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #0a0a0a; color: #f5f5f5; padding: 20px; }
  h1 { color: #ef3e28; font-size: 1.8em; margin-bottom: 5px; }
  .subtitle { color: #666; font-size: 0.85em; margin-bottom: 20px; }
  .stats { display: flex; gap: 15px; flex-wrap: wrap; margin-bottom: 25px; }
  .stat-card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 10px; padding: 15px 22px; min-width: 140px; }
  .stat-num { font-size: 2em; font-weight: 800; color: #ef3e28; line-height: 1; }
  .stat-label { font-size: 0.75em; color: #888; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  .status-dot { display: inline-block; width: 8px; height: 8px; background: #34c759; border-radius: 50%; margin-right: 6px; animation: pulse 2s infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  .section-title { font-size: 0.8em; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 1px; margin: 20px 0 10px; }
  .incident-card { background: #1a1a1a; border: 1px solid #ef3e2830; border-left: 3px solid #ef3e28; border-radius: 8px; padding: 14px; margin-bottom: 10px; }
  .alert-card { background: #1a1a1a; border: 1px solid #30b0c730; border-left: 3px solid #30b0c7; border-radius: 8px; padding: 14px; margin-bottom: 10px; }
  .badge { display: inline-block; background: #ef3e28; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 700; margin-right: 5px; }
  .badge-blue { background: #30b0c7; }
  .badge-green { background: #34c759; }
  .meta { color: #666; font-size: 0.78em; margin-top: 6px; line-height: 1.6; }
  .empty { color: #555; font-style: italic; padding: 20px 0; }
  .refresh-btn { background: #ef3e28; color: white; border: none; padding: 9px 18px; border-radius: 6px; cursor: pointer; font-size: 0.85em; font-weight: 600; margin-right: 8px; }
  .refresh-btn:hover { background: #c82f1c; }
  .last-updated { color: #555; font-size: 0.75em; margin-top: 6px; }
</style>
</head>
<body>
<h1>🚨 AETHER Emergency Dashboard</h1>
<p class="subtitle">Phase 15 — Live Server | BIMSTEC Road Safety Hackathon 2026</p>

<div class="stats">
  <div class="stat-card">
    <div id="clientCount" class="stat-num">0</div>
    <div class="stat-label">Connected Devices</div>
  </div>
  <div class="stat-card">
    <div id="incidentCount" class="stat-num">0</div>
    <div class="stat-label">SOS Incidents</div>
  </div>
  <div class="stat-card">
    <div id="alertCount" class="stat-num">0</div>
    <div class="stat-label">Hospital Alerts</div>
  </div>
  <div class="stat-card">
    <div><span class="status-dot"></span>LIVE</div>
    <div class="stat-label" style="margin-top:8px">Server Status</div>
  </div>
</div>

<button class="refresh-btn" onclick="refresh()">↻ Refresh Now</button>
<span id="lastUpdate" class="last-updated"></span>

<div class="section-title">Live SOS Incidents</div>
<div id="incidents"><p class="empty">No incidents yet. Trigger an SOS from the AETHER app!</p></div>

<div class="section-title">Hospital Pre-Alerts</div>
<div id="alerts"><p class="empty">No hospital pre-alerts yet. Select an injury type after SOS fires.</p></div>

<script>
function refresh() {
  fetch('/api/incidents')
    .then(r => r.json())
    .then(data => {
      document.getElementById('clientCount').textContent = data.clients;
      document.getElementById('incidentCount').textContent = data.incidents.length;
      document.getElementById('alertCount').textContent = data.preAlerts.length;
      document.getElementById('lastUpdate').textContent = 'Last updated: ' + new Date().toLocaleTimeString();

      const inc = document.getElementById('incidents');
      if (!data.incidents || data.incidents.length === 0) {
        inc.innerHTML = '<p class="empty">No incidents yet. Trigger an SOS from the AETHER app!</p>';
      } else {
        inc.innerHTML = data.incidents.slice(0, 20).map(i => \`
          <div class="incident-card">
            <strong>🚨 Incident: \${(i.incidentId || 'N/A').substring(0, 16).toUpperCase()}...</strong>
            <span class="badge">Severity \${i.severity || '?'}/5</span>
            <span class="badge">Hop \${i.hopCount || 0}</span>
            <span class="badge badge-green">RECEIVED</span>
            <div class="meta">
              📍 GPS: \${i.lat?.toFixed(5) || 'N/A'}, \${i.lng?.toFixed(5) || 'N/A'}<br>
              🕐 Received: \${i.receivedAtISO || 'Unknown'}<br>
              📱 Device: \${(i.deviceHash || 'unknown').substring(0, 12)}... | Phase: \${i.phase || 'N/A'}
            </div>
          </div>
        \`).join('');
      }

      const alt = document.getElementById('alerts');
      if (!data.preAlerts || data.preAlerts.length === 0) {
        alt.innerHTML = '<p class="empty">No hospital pre-alerts yet. Select an injury type after SOS fires.</p>';
      } else {
        alt.innerHTML = data.preAlerts.slice(0, 10).map(a => \`
          <div class="alert-card">
            <strong>🏥 \${a.hospital_name || 'Unknown Hospital'}</strong>
            <span class="badge badge-blue">\${a.injury_type || 'Unknown'}</span>
            <span class="badge badge-green">ALERTED</span>
            <div class="meta">
              📏 Distance: \${a.distance_km ? a.distance_km.toFixed(1) + ' km' : 'N/A'} | ETA: \${a.eta_minutes || '?'} min<br>
              🩺 Severity: \${a.severity || '?'}/5 | Incident: \${(a.incident_id || 'N/A').substring(0, 12)}...<br>
              🕐 Sent: \${a.receivedAtISO || 'Unknown'}
            </div>
          </div>
        \`).join('');
      }
    })
    .catch(e => { document.getElementById('lastUpdate').textContent = 'Error: ' + e.message; });
}

// Auto-refresh every 5 seconds
setInterval(refresh, 5000);
refresh();
</script>
</body>
</html>`;
}

// ── Map HTML Generator ────────────────────────────────────────────────────
function generateMapHTML() {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
html,body,#map{width:100%;height:100%;background:#e8e0d4;}
.leaflet-popup-content-wrapper{background:#fff;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.15);border:none;padding:0;}
.leaflet-popup-content{margin:0;padding:0;}
.leaflet-popup-tip-container{display:none;}
.pp{padding:14px;min-width:200px;font-family:-apple-system,sans-serif;}
.pp h3{font-size:14px;font-weight:700;color:#141210;margin-bottom:3px;line-height:1.3;}
.pp .dist{font-size:11px;color:#888;margin-bottom:8px;}
.pp .tags{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;}
.pp .tag{background:#f0ede6;border-radius:4px;padding:2px 7px;font-size:9px;color:#666;font-weight:600;text-transform:capitalize;}
.pp .acts{display:flex;gap:8px;}
.pp .btn{flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:9px 6px;border-radius:8px;border:none;cursor:pointer;font-size:11px;font-weight:700;font-family:-apple-system,sans-serif;}
.bc{background:#e8f6ef;color:#0E8C56;}
.bn{background:#ebf0fc;color:#1648D0;}
.hp{padding:12px;min-width:160px;font-family:-apple-system,sans-serif;}
.hp h3{font-size:13px;font-weight:700;color:#141210;margin-bottom:4px;}
.hp .cr{font-size:11px;margin-bottom:3px;}
.hp .tm{font-size:10px;color:#888;}
.cr-low{color:#8E8E93;}.cr-medium{color:#C05C0A;}.cr-high{color:#ef3e28;}
</style>
</head>
<body>
<div id="map"></div>
<script>
var map=L.map('map',{center:[20.5937,78.9629],zoom:13,zoomControl:false});

// CartoDB Voyager — free, no key, permissive CORS (works from HTTPS origin)
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{
  attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains:'abcd',
  maxZoom:20
}).addTo(map);

L.control.zoom({position:'bottomright'}).addTo(map);

var poiLayer=L.layerGroup().addTo(map);
var hazardLayer=L.layerGroup().addTo(map);
var bsLayer=L.layerGroup().addTo(map);
var userMarker=null;
var userCircle=null;

var POI_COLORS={hospital:'#ef3e28',police:'#1648D0',towing:'#C05C0A',petrol:'#6B35CC',puncture:'#0E8C56',blood_bank:'#ef3e28'};

function makePinIcon(color){
  var svg='<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">'+
    '<path d="M14 0C6.27 0 0 6.27 0 14c0 9.33 14 22 14 22S28 23.33 28 14C28 6.27 21.73 0 14 0z" fill="'+color+'"/>'+
    '<circle cx="14" cy="14" r="6" fill="rgba(255,255,255,0.4)"/></svg>';
  return L.divIcon({html:svg,iconSize:[28,36],iconAnchor:[14,36],popupAnchor:[0,-38],className:''});
}

function timeSince(ts){
  var m=Math.round((Date.now()-ts)/60000);
  if(m<1)return 'Just now';
  if(m<60)return m+' min ago';
  return Math.round(m/60)+' hr ago';
}

function rn(data){
  try{window.ReactNativeWebView.postMessage(JSON.stringify(data));}catch(e){}
}

function loadPOIs(pois){
  poiLayer.clearLayers();
  pois.forEach(function(poi){
    var color=POI_COLORS[poi.type]||'#888';
    var icon=makePinIcon(color);
    var tags=(poi.capabilities||[]).slice(0,4).map(function(c){
      return '<span class="tag">'+c.replace(/_/g,' ')+'</span>';
    }).join('');
    var phone=(poi.phone||'').toString();
    var dist=(poi.distanceText||'');
    var popup='<div class="pp">'+
      '<h3>'+poi.name+'</h3>'+
      '<div class="dist">'+dist+'</div>'+
      (tags?'<div class="tags">'+tags+'</div>':'')+
      '<div class="acts">'+
      (phone?'<button class="btn bc" onclick="rn({type:\\'CALL\\',phone:\\''+phone+'\\'})">Call '+phone+'</button>':'')+
      '<button class="btn bn" onclick="rn({type:\\'NAV\\',lat:'+poi.lat+',lng:'+poi.lng+'})">Navigate</button>'+
      '</div></div>';
    L.marker([poi.lat,poi.lng],{icon:icon}).bindPopup(popup,{maxWidth:280}).addTo(poiLayer);
  });
  rn({type:'POI_COUNT',count:pois.length});
}

function loadHazards(clusters){
  hazardLayer.clearLayers();
  clusters.forEach(function(c){
    var emoji=c.hazardType==='pothole'?'&#128371;':c.hazardType==='accident'?'&#128165;':c.hazardType==='road_closed'?'&#128679;':'&#129618;';
    var ringColor=c.credibilityLevel==='high'?'#ef3e28':c.credibilityLevel==='medium'?'#C05C0A':'#8E8E93';
    var credLabel=c.credibilityLevel==='high'?'Confirmed':c.credibilityLevel==='medium'?'Likely Real':'Unverified';
    var credClass='cr-'+c.credibilityLevel;
    L.circle([c.lat,c.lng],{color:ringColor,fillColor:ringColor,fillOpacity:0.14,radius:80,weight:2}).addTo(hazardLayer);
    var badge=c.reportCount>1?'<div style="position:absolute;top:-6px;right:-8px;background:'+ringColor+';color:#fff;border-radius:10px;min-width:18px;height:18px;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;padding:0 4px;border:2px solid #fff;">'+c.reportCount+'</div>':'';
    var icon=L.divIcon({
      html:'<div style="position:relative;width:36px;height:36px;background:#fff;border-radius:50%;border:2.5px solid '+ringColor+';display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,0.2);">'+emoji+badge+'</div>',
      iconSize:[36,36],iconAnchor:[18,18],className:''
    });
    var popup='<div class="hp"><h3>'+c.hazardType.replace('_',' ').toUpperCase()+'</h3>'+
      '<div class="cr '+credClass+'">'+credLabel+' ('+c.reportCount+' report'+(c.reportCount>1?'s':'')+')</div>'+
      '<div class="tm">'+timeSince(c.lastReportedAt)+'</div></div>';
    L.marker([c.lat,c.lng],{icon:icon}).bindPopup(popup).addTo(hazardLayer);
  });
}

function loadBlackspots(bs){
  bsLayer.clearLayers();
  bs.forEach(function(b){
    var color=b.severity==='high'?'#ef3e28':b.severity==='medium'?'#ff9500':'#ffcc00';
    L.circle([b.lat,b.lng],{color:color,fillColor:color,fillOpacity:0.18,radius:b.radius_m||50,weight:2})
      .bindPopup('<b>&#9888; '+b.severity.toUpperCase()+' RISK ZONE</b><br>'+b.event_count+' events')
      .addTo(bsLayer);
  });
}

function setUser(lat,lng){
  if(userMarker){userMarker.setLatLng([lat,lng]);}
  else{
    var uIcon=L.divIcon({
      html:'<div style="width:16px;height:16px;background:#007aff;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 4px rgba(0,122,255,0.25);"></div>',
      iconSize:[16,16],iconAnchor:[8,8],className:''
    });
    userMarker=L.marker([lat,lng],{icon:uIcon,zIndexOffset:1000}).addTo(map);
  }
  if(userCircle){map.removeLayer(userCircle);}
  userCircle=L.circle([lat,lng],{color:'#007aff',fillColor:'#007aff',fillOpacity:0.07,radius:120,weight:1}).addTo(map);
}

function handleMsg(raw){
  try{
    var msg=JSON.parse(raw);
    if(msg.type==='LOAD_POIS'){loadPOIs(msg.pois);}
    else if(msg.type==='LOAD_HAZARDS'){loadHazards(msg.hazards);}
    else if(msg.type==='LOAD_BLACKSPOTS'){loadBlackspots(msg.blackspots);}
    else if(msg.type==='SET_USER'){
      setUser(msg.lat,msg.lng);
      map.setView([msg.lat,msg.lng],14,{animate:true});
    }
    else if(msg.type==='CENTER'){map.setView([msg.lat,msg.lng],15,{animate:true});}
    else if(msg.type==='REFRESH_HAZARDS'){loadHazards(msg.hazards);}
  }catch(e){}
}

document.addEventListener('message',function(e){handleMsg(e.data);});
window.addEventListener('message',function(e){handleMsg(e.data);});

// Signal ready — use setTimeout as Leaflet on CDN may need a moment
setTimeout(function(){rn({type:'MAP_READY'});},800);
</script>
</body>
</html>`;
}

// ── Start the server ──────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  console.log('═══════════════════════════════════════════════════');
  console.log('  AETHER Production Server — Phase 15');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Port      : ${PORT}`);
  console.log(`  Dashboard : http://localhost:${PORT}/dashboard`);
  console.log(`  Health    : http://localhost:${PORT}/health`);
  console.log(`  WebSocket : ws://localhost:${PORT}`);
  console.log('═══════════════════════════════════════════════════');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received — shutting down gracefully');
  server.close(() => { console.log('[Server] HTTP server closed'); });
  wss.close(() => { console.log('[Server] WebSocket server closed'); });
});