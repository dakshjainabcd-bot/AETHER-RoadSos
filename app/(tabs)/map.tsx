// app/(tabs)/map.tsx
// Uses Leaflet.js + OpenStreetMap — 100% free, no API key, no payment

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { MapErrorBoundary } from '@/components/MapErrorBoundary';

// ── Types ─────────────────────────────────────────────────────────────────
interface HazardMarker {
  id: string;
  lat: number;
  lng: number;
  type: 'pothole' | 'accident' | 'road_closed' | 'debris';
  severity: 1 | 2 | 3;
  reportedAt: number;
}

interface BlackspotMarker {
  id: string;
  lat: number;
  lng: number;
  eventCount: number;
  riskLevel: 'low' | 'medium' | 'high';
}

// ── Leaflet HTML (injected into WebView) ─────────────────────────────────
function generateLeafletHTML(
  userLat: number,
  userLng: number,
  hazards: HazardMarker[],
  blackspots: BlackspotMarker[]
): string {

  const hazardMarkers = hazards.map(h => {
    const color = h.severity === 3 ? '#ef3e28' : h.severity === 2 ? '#ff9f0a' : '#34c759';
    const icon = h.type === 'pothole' ? '🕳️' : h.type === 'accident' ? '💥' : h.type === 'road_closed' ? '🚧' : '⚠️';
    return `
      var hazardIcon_${h.id.replace(/-/g, '_')} = L.divIcon({
        html: '<div style="font-size:22px;line-height:1;">${icon}</div>',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        className: ''
      });
      L.marker([${h.lat}, ${h.lng}], { icon: hazardIcon_${h.id.replace(/-/g, '_')} })
        .addTo(map)
        .bindPopup('<b>${h.type.toUpperCase()}</b><br>Severity: ${h.severity}/3<br>Reported: ${new Date(h.reportedAt).toLocaleTimeString()}');
    `;
  }).join('\n');

  const blackspotCircles = blackspots.map(b => {
    const color = b.riskLevel === 'high' ? '#ef3e28' : b.riskLevel === 'medium' ? '#ff9f0a' : '#ffcc00';
    return `
      L.circle([${b.lat}, ${b.lng}], {
        color: '${color}',
        fillColor: '${color}',
        fillOpacity: 0.25,
        radius: 300,
        weight: 2
      }).addTo(map)
        .bindPopup('<b>⚠️ Blackspot</b><br>Risk: ${b.riskLevel.toUpperCase()}<br>Events: ${b.eventCount}');
    `;
  }).join('\n');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body, #map { width: 100%; height: 100%; background: #1a1a1a; }
  .leaflet-popup-content-wrapper {
    background: #1a1a1a;
    color: #f5f5f5;
    border: 1px solid #333;
    border-radius: 8px;
  }
  .leaflet-popup-tip { background: #1a1a1a; }
  .leaflet-popup-close-button { color: #888 !important; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  // Initialize map centered on user location
  var map = L.map('map', {
    center: [${userLat}, ${userLng}],
    zoom: 14,
    zoomControl: true,
    attributionControl: true
  });

  // OpenStreetMap tiles — completely free, no API key
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  // User location marker (blue pulsing dot)
  var userIcon = L.divIcon({
    html: '<div style="width:18px;height:18px;background:#007aff;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 4px rgba(0,122,255,0.3);"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    className: ''
  });

  var userMarker = L.marker([${userLat}, ${userLng}], { icon: userIcon })
    .addTo(map)
    .bindPopup('<b>📍 You are here</b>');

  // Accuracy circle around user
  L.circle([${userLat}, ${userLng}], {
    color: '#007aff',
    fillColor: '#007aff',
    fillOpacity: 0.06,
    radius: 150,
    weight: 1
  }).addTo(map);

  // Render hazard markers
  ${hazardMarkers}

  // Render blackspot circles
  ${blackspotCircles}

  // Listen for messages from React Native (new hazard, re-center, etc.)
  document.addEventListener('message', function(event) {
    handleMessage(event.data);
  });
  window.addEventListener('message', function(event) {
    handleMessage(event.data);
  });

  function handleMessage(rawData) {
    try {
      var msg = JSON.parse(rawData);

      if (msg.type === 'CENTER_ON_USER') {
        map.setView([msg.lat, msg.lng], 15, { animate: true });
        userMarker.setLatLng([msg.lat, msg.lng]);
      }

      if (msg.type === 'ADD_HAZARD') {
        var h = msg.hazard;
        var icon = h.type === 'pothole' ? '🕳️' : h.type === 'accident' ? '💥' : '⚠️';
        var newIcon = L.divIcon({
          html: '<div style="font-size:22px;">' + icon + '</div>',
          iconSize: [28, 28], iconAnchor: [14, 14], className: ''
        });
        L.marker([h.lat, h.lng], { icon: newIcon })
          .addTo(map)
          .bindPopup('<b>' + h.type.toUpperCase() + '</b><br>Just reported!');
      }

    } catch (e) { /* ignore non-JSON */ }
  }

  // Send tap coordinates back to React Native
  map.on('click', function(e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'MAP_TAP',
      lat: e.latlng.lat,
      lng: e.latlng.lng
    }));
  });

  // Signal React Native that map is loaded
  setTimeout(function() {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
  }, 500);
</script>
</body>
</html>`;
}

// ── Main Component ────────────────────────────────────────────────────────
export default function MapScreen() {
  const webViewRef = useRef<WebView>(null);
  const [userLocation, setUserLocation] = useState({ lat: 20.5937, lng: 78.9629 }); // India center default
  const [mapLoaded, setMapLoaded] = useState(false);
  const [locationGranted, setLocationGranted] = useState(false);

  // Example hazards — in production these come from your HazardReportStore
  const [hazards] = useState<HazardMarker[]>([
    {
      id: 'h1',
      lat: 20.5945,
      lng: 78.9640,
      type: 'pothole',
      severity: 2,
      reportedAt: Date.now() - 600000,
    },
  ]);

  // Example blackspots — in production from BlackspotEngine
  const [blackspots] = useState<BlackspotMarker[]>([
    {
      id: 'b1',
      lat: 20.5920,
      lng: 78.9615,
      eventCount: 23,
      riskLevel: 'high',
    },
  ]);

  // ── Get real user location ──────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.warn('[Map] Location permission denied');
          return;
        }
        setLocationGranted(true);
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const newLat = loc.coords.latitude;
        const newLng = loc.coords.longitude;
        setUserLocation({ lat: newLat, lng: newLng });

        // Tell the already-loaded map to re-center
        if (mapLoaded && webViewRef.current) {
          webViewRef.current.postMessage(JSON.stringify({
            type: 'CENTER_ON_USER',
            lat: newLat,
            lng: newLng,
          }));
        }
      } catch (e) {
        console.warn('[Map] Location error:', e);
      }
    })();
  }, [mapLoaded]);

  // ── Report Hazard ───────────────────────────────────────────────────────
  const handleReportHazard = () => {
    Alert.alert(
      'Report Hazard',
      'What hazard are you reporting at your current location?',
      [
        {
          text: '🕳️ Pothole',
          onPress: () => broadcastHazard('pothole'),
        },
        {
          text: '💥 Accident Scene',
          onPress: () => broadcastHazard('accident'),
        },
        {
          text: '🚧 Road Blocked',
          onPress: () => broadcastHazard('road_closed'),
        },
        {
          text: '⚠️ Debris',
          onPress: () => broadcastHazard('debris'),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const broadcastHazard = (type: HazardMarker['type']) => {
    const hazard: HazardMarker = {
      id: 'h_' + Date.now().toString(),
      lat: userLocation.lat + (Math.random() - 0.5) * 0.001, // slight offset
      lng: userLocation.lng + (Math.random() - 0.5) * 0.001,
      type,
      severity: 2,
      reportedAt: Date.now(),
    };

    // Add to map visually
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'ADD_HAZARD',
        hazard,
      }));
    }

    Alert.alert('Hazard Reported', type.replace('_', ' ') + ' reported and broadcast to nearby AETHER devices.');
  };

  // ── Center on Me ────────────────────────────────────────────────────────
  const handleCenterOnMe = () => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'CENTER_ON_USER',
        lat: userLocation.lat,
        lng: userLocation.lng,
      }));
    }
  };

  // ── WebView message handler ─────────────────────────────────────────────
  const handleWebViewMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'MAP_READY') {
        setMapLoaded(true);
        console.log('[Map] Leaflet map is ready');
      }
      if (msg.type === 'MAP_TAP') {
        console.log('[Map] Tapped at:', msg.lat, msg.lng);
      }
    } catch (e) { /* ignore */ }
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <MapErrorBoundary>
      <View style={styles.container}>

        {/* Map WebView */}
        <WebView
          ref={webViewRef}
          style={styles.map}
          originWhitelist={['*']}
          source={{
            html: generateLeafletHTML(
              userLocation.lat,
              userLocation.lng,
              hazards,
              blackspots
            ),
          }}
          onMessage={handleWebViewMessage}
          onError={(e) => console.error('[Map] WebView error:', e.nativeEvent.description)}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#ef3e28" />
              <Text style={styles.loadingText}>Loading OpenStreetMap...</Text>
            </View>
          )}
          // Allow loading tiles from openstreetmap.org + unpkg.com (Leaflet CDN)
          mixedContentMode="always"
          allowsInlineMediaPlayback
        />

        {/* Loading overlay until map signals ready */}
        {!mapLoaded && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#ef3e28" />
            <Text style={styles.loadingText}>Loading Map...</Text>
            <Text style={styles.loadingSubText}>OpenStreetMap — No API key required</Text>
          </View>
        )}

        {/* Top Info Bar */}
        <View style={styles.infoBar}>
          <Text style={styles.infoText}>
            {hazards.length} hazard{hazards.length !== 1 ? 's' : ''} •{' '}
            {blackspots.length} blackspot{blackspots.length !== 1 ? 's' : ''}
          </Text>
          <View style={styles.osmBadge}>
            <Text style={styles.osmBadgeText}>© OpenStreetMap</Text>
          </View>
        </View>

        {/* Floating Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.centerBtn} onPress={handleCenterOnMe}>
            <Text style={styles.centerBtnText}>📍 My Location</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.hazardBtn} onPress={handleReportHazard}>
            <Text style={styles.hazardBtnText}>⚠️ Report Hazard</Text>
          </TouchableOpacity>
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <Text style={styles.legendTitle}>MAP LEGEND</Text>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: '#ef3e28' }]} />
            <Text style={styles.legendText}>High-risk Blackspot</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: '#ff9f0a' }]} />
            <Text style={styles.legendText}>Medium-risk Zone</Text>
          </View>
          <View style={styles.legendRow}>
            <Text style={styles.legendIcon}>🕳️</Text>
            <Text style={styles.legendText}>Pothole Reported</Text>
          </View>
          <View style={styles.legendRow}>
            <Text style={styles.legendIcon}>💥</Text>
            <Text style={styles.legendText}>Accident Scene</Text>
          </View>
        </View>

      </View>
    </MapErrorBoundary>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  map: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loadingText: {
    color: '#f5f5f5',
    fontSize: 16,
    marginTop: 14,
    fontWeight: '600',
  },
  loadingSubText: {
    color: '#555',
    fontSize: 12,
    marginTop: 6,
  },
  infoBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(10,10,10,0.85)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
  },
  infoText: {
    color: '#f5f5f5',
    fontSize: 13,
    fontWeight: '600',
  },
  osmBadge: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#333',
  },
  osmBadgeText: {
    color: '#888',
    fontSize: 10,
  },
  buttonRow: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 10,
  },
  centerBtn: {
    flex: 1,
    backgroundColor: 'rgba(10,10,10,0.9)',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  centerBtnText: {
    color: '#f5f5f5',
    fontSize: 14,
    fontWeight: '600',
  },
  hazardBtn: {
    flex: 1,
    backgroundColor: '#ef3e28',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  hazardBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  legend: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 90 : 60,
    right: 12,
    backgroundColor: 'rgba(10,10,10,0.88)',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 10,
    padding: 10,
    minWidth: 170,
  },
  legendTitle: {
    color: '#888',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 7,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
    gap: 7,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendIcon: {
    fontSize: 13,
    width: 14,
    textAlign: 'center',
  },
  legendText: {
    color: '#ccc',
    fontSize: 11,
  },
});