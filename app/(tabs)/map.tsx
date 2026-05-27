// app/(tabs)/map.tsx
// Full-featured map — Leaflet.js + OpenStreetMap
// Restores: POI search, category filters, hazard markers, blackspot circles,
//           credibility counts, Report Hazard, CACHED/LIVE badge, found count

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
  Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MapErrorBoundary } from '../../components/MapErrorBoundary';
import { getLastKnownLocation } from '../../services/GPSService';
import { searchPOI, type POI } from '../../services/POIDatabase';
import {
  onlinePOIService,
  SERVICES_FETCH_RADIUS_M,
  type DataSource,
} from '../../services/OnlinePOIService';
import { loadCachedBlackspots } from '../../services/RoadDNA/BlackspotEngine';
import { hazardReportStore } from '../../services/DriverIntelligence/HazardReportStore';
import { hazardBroadcaster } from '../../services/DriverIntelligence/HazardBroadcaster';
import { useNetworkStatus } from '../../services/NetworkMonitor';
import { POI_TYPES, type POIType } from '../../utils/constants';
import { Colors, BorderRadius, Layout } from '../../theme';
import type { Blackspot } from '../../services/RoadDNA/types';
import type { HazardCluster } from '../../services/DriverIntelligence/types';

// ── Category definitions ──────────────────────────────────────────────────────

const CATEGORIES = [
  { type: POI_TYPES.HOSPITAL,   label: 'Hospital',   color: '#ef3e28', bg: '#FEF1EE', border: '#F4C5BE' },
  { type: POI_TYPES.POLICE,     label: 'Police',     color: '#1648D0', bg: '#EBF0FC', border: '#A8BEE8' },
  { type: POI_TYPES.TOWING,     label: 'Towing',     color: '#C05C0A', bg: '#FEF4E6', border: '#E8C088' },
  { type: POI_TYPES.PETROL,     label: 'Petrol',     color: '#6B35CC', bg: '#F4EFFE', border: '#C8A8EE' },
  { type: POI_TYPES.PUNCTURE,   label: 'Tyre',       color: '#0E8C56', bg: '#E8F6EF', border: '#96D4B4' },
  { type: POI_TYPES.BLOOD_BANK, label: 'Blood Bank', color: '#ef3e28', bg: '#FEF1EE', border: '#F4C5BE' },
] as const;

// ── Leaflet HTML (loads once, receives data via postMessage) ──────────────────

const LEAFLET_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body, #map { width:100%; height:100%; background:#e8e0d4; }
  .leaflet-popup-content-wrapper { background:#fff; border-radius:10px; box-shadow:0 4px 20px rgba(0,0,0,0.15); border:none; }
  .leaflet-popup-tip-container { display:none; }
  .poi-popup { min-width:200px; }
  .poi-popup h3 { font-size:14px; font-weight:700; color:#141210; margin-bottom:4px; line-height:1.3; }
  .poi-popup .dist { font-size:11px; color:#888; margin-bottom:8px; }
  .poi-popup .tags { display:flex; flex-wrap:wrap; gap:4px; margin-bottom:10px; }
  .poi-popup .tag { background:#f0f0f0; border-radius:4px; padding:2px 7px; font-size:9px; color:#666; font-weight:600; }
  .poi-popup .actions { display:flex; gap:8px; }
  .poi-popup .btn { flex:1; display:flex; align-items:center; justify-content:center; gap:5px; padding:9px; border-radius:8px; border:none; cursor:pointer; font-size:12px; font-weight:700; }
  .btn-call { background:#e8f6ef; color:#0E8C56; }
  .btn-nav { background:#ebf0fc; color:#1648D0; }
  .hazard-popup { min-width:160px; }
  .hazard-popup h3 { font-size:13px; font-weight:700; color:#141210; margin-bottom:4px; }
  .hazard-popup .cred { font-size:11px; margin-bottom:4px; }
  .hazard-popup .time { font-size:10px; color:#888; }
  .cred-low { color:#8E8E93; }
  .cred-medium { color:#C05C0A; }
  .cred-high { color:#ef3e28; }
  .user-dot { width:16px; height:16px; background:#007aff; border:3px solid #fff; border-radius:50%; box-shadow:0 0 0 4px rgba(0,122,255,0.25); }
</style>
</head>
<body>
<div id="map"></div>
<script>
var map = L.map('map', { center:[20.5937,78.9629], zoom:13, zoomControl:false });
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom:19,
  attribution:'© OpenStreetMap'
}).addTo(map);
L.control.zoom({ position:'bottomright' }).addTo(map);

// Layer groups
var poiLayer = L.layerGroup().addTo(map);
var hazardLayer = L.layerGroup().addTo(map);
var blackspotLayer = L.layerGroup().addTo(map);

// User location
var userIcon = L.divIcon({ html:'<div class="user-dot"></div>', iconSize:[16,16], iconAnchor:[8,8], className:'' });
var userMarker = null;

function updateUser(lat, lng) {
  if (userMarker) { userMarker.setLatLng([lat, lng]); }
  else { userMarker = L.marker([lat,lng],{icon:userIcon}).addTo(map); }
  L.circle([lat,lng],{color:'#007aff',fillColor:'#007aff',fillOpacity:0.06,radius:120,weight:1}).addTo(map);
}

// POI colors by type
var poiColors = {
  hospital:'#ef3e28', police:'#1648D0', towing:'#C05C0A',
  petrol:'#6B35CC', puncture:'#0E8C56', blood_bank:'#ef3e28'
};

function makePOIIcon(type) {
  var color = poiColors[type] || '#888';
  var svg = '<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M14 0C6.27 0 0 6.27 0 14c0 9.33 14 22 14 22S28 23.33 28 14C28 6.27 21.73 0 14 0z" fill="' + color + '"/>' +
    '<circle cx="14" cy="14" r="7" fill="rgba(255,255,255,0.35)"/>' +
    '</svg>';
  return L.divIcon({
    html: svg,
    iconSize: [28,36], iconAnchor: [14,36], popupAnchor: [0,-36],
    className: ''
  });
}

function timeSince(ts) {
  var m = Math.round((Date.now() - ts) / 60000);
  if (m < 60) return m + ' min ago';
  return Math.round(m/60) + ' hr ago';
}

// Load POIs
function loadPOIs(pois) {
  poiLayer.clearLayers();
  pois.forEach(function(poi) {
    var marker = L.marker([poi.lat, poi.lng], { icon: makePOIIcon(poi.type) });
    var tags = (poi.capabilities || []).slice(0,4).map(function(c){ return '<span class="tag">' + c.replace(/_/g,' ') + '</span>'; }).join('');
    var phone = poi.phone || '';
    var popup = '<div class="poi-popup">' +
      '<h3>' + poi.name + '</h3>' +
      '<div class="dist">' + (poi.distanceText || '') + ' away</div>' +
      (tags ? '<div class="tags">' + tags + '</div>' : '') +
      '<div class="actions">' +
      (phone ? '<button class="btn btn-call" onclick="callPOI(\'' + phone + '\')">📞 ' + phone + '</button>' : '') +
      '<button class="btn btn-nav" onclick="navPOI(' + poi.lat + ',' + poi.lng + ',\'' + poi.name + '\')">🧭 Navigate</button>' +
      '</div></div>';
    marker.bindPopup(popup, { maxWidth:280 });
    poiLayer.addLayer(marker);
  });
  sendToRN({ type:'POI_COUNT', count:pois.length });
}

function callPOI(phone) {
  sendToRN({ type:'CALL', phone:phone });
}
function navPOI(lat, lng, name) {
  sendToRN({ type:'NAVIGATE', lat:lat, lng:lng, name:name });
}

// Load hazard clusters
function loadHazards(clusters) {
  hazardLayer.clearLayers();
  clusters.forEach(function(c) {
    var emoji = c.hazardType === 'pothole' ? '🕳️' :
                c.hazardType === 'accident' ? '💥' :
                c.hazardType === 'road_closed' ? '🚧' : '🪨';
    var credClass = 'cred-' + c.credibilityLevel;
    var credLabel = c.credibilityLevel === 'high' ? 'Confirmed ✓' :
                    c.credibilityLevel === 'medium' ? 'Likely Real' : 'Unverified';
    var ringColor = c.credibilityLevel === 'high' ? '#ef3e28' :
                    c.credibilityLevel === 'medium' ? '#C05C0A' : '#8E8E93';

    // Danger zone circle
    L.circle([c.lat,c.lng],{
      color:ringColor, fillColor:ringColor, fillOpacity:0.12, radius:80, weight:2
    }).addTo(hazardLayer);

    // Count badge HTML
    var badge = c.reportCount > 1 ? '<div style="position:absolute;top:-6px;right:-8px;background:' + ringColor + ';color:#fff;border-radius:10px;min-width:18px;height:18px;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;padding:0 4px;border:2px solid #fff;">' + c.reportCount + '</div>' : '';

    var icon = L.divIcon({
      html: '<div style="position:relative;width:36px;height:36px;background:#fff;border-radius:50%;border:2.5px solid ' + ringColor + ';display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 2px 8px rgba(0,0,0,0.2);">' + emoji + badge + '</div>',
      iconSize:[36,36], iconAnchor:[18,18], className:''
    });

    var timeStr = timeSince(c.lastReportedAt);
    var popup = '<div class="hazard-popup">' +
      '<h3>' + emoji + ' ' + c.hazardType.replace('_',' ').toUpperCase() + '</h3>' +
      '<div class="cred ' + credClass + '">' + credLabel + ' (' + c.reportCount + ' report' + (c.reportCount > 1 ? 's' : '') + ')</div>' +
      '<div class="time">Last reported: ' + timeStr + '</div>' +
      '</div>';

    L.marker([c.lat,c.lng],{icon:icon}).bindPopup(popup).addTo(hazardLayer);
  });
}

// Load blackspot circles
function loadBlackspots(blackspots) {
  blackspotLayer.clearLayers();
  blackspots.forEach(function(b) {
    var color = b.severity === 'high' ? '#ef3e28' : b.severity === 'medium' ? '#ff9500' : '#ffcc00';
    L.circle([b.lat,b.lng],{
      color:color, fillColor:color, fillOpacity:0.18, radius:b.radius_m||50, weight:2
    }).bindPopup('<b>⚠ ' + b.severity.toUpperCase() + ' RISK ZONE</b><br>' + b.event_count + ' driving events recorded').addTo(blackspotLayer);
  });
}

// Add a single new hazard (after reporting)
function addNewHazard(hazard) {
  loadHazards(hazard);
}

// Message handler from React Native
function handleRNMessage(rawData) {
  try {
    var msg = JSON.parse(rawData);
    if (msg.type === 'LOAD_POIS') loadPOIs(msg.pois);
    else if (msg.type === 'LOAD_HAZARDS') loadHazards(msg.hazards);
    else if (msg.type === 'LOAD_BLACKSPOTS') loadBlackspots(msg.blackspots);
    else if (msg.type === 'UPDATE_USER') {
      updateUser(msg.lat, msg.lng);
      map.setView([msg.lat, msg.lng], 14, { animate:true });
    }
    else if (msg.type === 'CENTER_MAP') {
      map.setView([msg.lat, msg.lng], 15, { animate:true });
    }
    else if (msg.type === 'REFRESH_HAZARDS') loadHazards(msg.hazards);
  } catch(e) {}
}

document.addEventListener('message', function(e){ handleRNMessage(e.data); });
window.addEventListener('message', function(e){ handleRNMessage(e.data); });

function sendToRN(data) {
  try { window.ReactNativeWebView.postMessage(JSON.stringify(data)); } catch(e){}
}

// Signal ready
setTimeout(function(){
  sendToRN({ type:'MAP_READY' });
}, 600);
</script>
</body>
</html>`;

// ── Main Component ────────────────────────────────────────────────────────────

export default function MapScreen() {
  const webViewRef = useRef<WebView>(null);
  const { isConnected } = useNetworkStatus();

  const [selectedCategory, setSelectedCategory] = useState<POIType>(POI_TYPES.HOSPITAL);
  const [pois, setPois] = useState<POI[]>([]);
  const [loading, setLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [foundCount, setFoundCount] = useState(0);
  const [dataSource, setDataSource] = useState<DataSource>('offline');
  const [userLat, setUserLat] = useState(20.5937);
  const [userLng, setUserLng] = useState(78.9629);
  const [hasLocation, setHasLocation] = useState(false);
  const [reporting, setReporting] = useState(false);

  const mapReadyRef = useRef(false);

  // ── Send message to WebView ────────────────────────────────────────────────

  const sendToMap = useCallback((data: object) => {
    if (webViewRef.current && mapReadyRef.current) {
      webViewRef.current.postMessage(JSON.stringify(data));
    }
  }, []);

  // ── Load user location ────────────────────────────────────────────────────

  const loadUserLocation = useCallback(async () => {
    try {
      const loc = await getLastKnownLocation();
      if (loc) {
        setUserLat(loc.lat);
        setUserLng(loc.lng);
        setHasLocation(true);
        sendToMap({ type: 'UPDATE_USER', lat: loc.lat, lng: loc.lng });
        return loc;
      }
    } catch (e) {
      console.warn('[Map] Location error:', e);
    }
    return null;
  }, [sendToMap]);

  // ── Load blackspots ───────────────────────────────────────────────────────

  const loadBlackspots = useCallback(async () => {
    try {
      const spots = await loadCachedBlackspots();
      if (spots.length > 0) {
        sendToMap({ type: 'LOAD_BLACKSPOTS', blackspots: spots });
      }
    } catch (e) {
      console.warn('[Map] Blackspot load error:', e);
    }
  }, [sendToMap]);

  // ── Load hazard clusters ──────────────────────────────────────────────────

  const loadHazards = useCallback(() => {
    try {
      const clusters = hazardReportStore.getClusters();
      sendToMap({ type: 'LOAD_HAZARDS', hazards: clusters });
    } catch (e) {
      console.warn('[Map] Hazard load error:', e);
    }
  }, [sendToMap]);

  // ── Load POIs for selected category ──────────────────────────────────────

  const loadPOIs = useCallback(async (category: POIType, lat: number, lng: number) => {
    setLoading(true);
    try {
      let results: POI[] = [];

      if (isConnected) {
        // Try online first
        try {
          await onlinePOIService.initialize();
          const valid = await onlinePOIService.isCacheValid(lat, lng);
          if (!valid) {
            onlinePOIService.fetchAndCache(lat, lng, SERVICES_FETCH_RADIUS_M).catch(() => {});
          }
          results = await onlinePOIService.getCachedPOIs(lat, lng, category, SERVICES_FETCH_RADIUS_M / 1000);
          if (results.length > 0) {
            setDataSource(valid ? 'cached' : 'live');
          }
        } catch (e) {
          // fall through to offline
        }
      }

      // Offline fallback
      if (results.length === 0) {
        results = await searchPOI(lat, lng, category);
        setDataSource('offline');
      }

      setPois(results);
      setFoundCount(results.length);
      sendToMap({ type: 'LOAD_POIS', pois: results });
    } catch (e) {
      console.warn('[Map] POI load error:', e);
    } finally {
      setLoading(false);
    }
  }, [isConnected, sendToMap]);

  // ── On map ready — send all data ──────────────────────────────────────────

  const onMapReady = useCallback(async () => {
    mapReadyRef.current = true;
    setMapReady(true);

    // Load location first
    const loc = await loadUserLocation();
    const lat = loc?.lat ?? userLat;
    const lng = loc?.lng ?? userLng;

    // Send all data to map
    await loadPOIs(selectedCategory, lat, lng);
    await loadBlackspots();
    loadHazards();
  }, [loadUserLocation, loadPOIs, loadBlackspots, loadHazards, selectedCategory, userLat, userLng]);

  // ── Handle category change ────────────────────────────────────────────────

  const handleCategoryChange = useCallback(async (category: POIType) => {
    setSelectedCategory(category);
    await loadPOIs(category, userLat, userLng);
  }, [loadPOIs, userLat, userLng]);

  // ── Handle WebView messages ───────────────────────────────────────────────

  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);

      if (msg.type === 'MAP_READY') {
        onMapReady();
        return;
      }

      if (msg.type === 'POI_COUNT') {
        setFoundCount(msg.count);
        return;
      }

      if (msg.type === 'CALL') {
        if (msg.phone) {
          Linking.openURL('tel:' + msg.phone).catch(() => {
            Alert.alert('Cannot Call', 'No phone number available.');
          });
        }
        return;
      }

      if (msg.type === 'NAVIGATE') {
        const geoUrl = 'geo:' + msg.lat + ',' + msg.lng + '?q=' + msg.lat + ',' + msg.lng + '(' + encodeURIComponent(msg.name) + ')';
        Linking.openURL(geoUrl).catch(() => {
          Linking.openURL('https://maps.google.com/?q=' + msg.lat + ',' + msg.lng);
        });
        return;
      }

    } catch (e) { /* ignore */ }
  }, [onMapReady]);

  // ── Report Hazard ─────────────────────────────────────────────────────────

  const handleReportHazard = useCallback(() => {
    if (!hasLocation) {
      Alert.alert('Location Needed', 'Enable location to report a hazard at your position.');
      return;
    }

    Alert.alert(
      'Report Road Hazard',
      'What hazard are you reporting at your current location?',
      [
        {
          text: 'Pothole',
          onPress: () => submitHazard('pothole'),
        },
        {
          text: 'Accident Scene',
          onPress: () => submitHazard('accident'),
        },
        {
          text: 'Road Blocked',
          onPress: () => submitHazard('road_closed'),
        },
        {
          text: 'Debris on Road',
          onPress: () => submitHazard('debris'),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, [hasLocation]);

  const submitHazard = useCallback(async (type: 'pothole' | 'accident' | 'road_closed' | 'debris') => {
    setReporting(true);
    try {
      const result = await hazardBroadcaster.reportHazard(type, 2);
      if (result.success) {
        // Reload hazards to show the new one
        const clusters = hazardReportStore.getClusters();
        sendToMap({ type: 'LOAD_HAZARDS', hazards: clusters });
        Alert.alert(
          'Hazard Reported',
          type.replace('_', ' ') + ' broadcast to nearby AETHER devices.'
        );
      } else {
        Alert.alert('Could Not Report', result.reason || 'Please try again.');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to report hazard. Please try again.');
    } finally {
      setReporting(false);
    }
  }, [sendToMap]);

  // ── Center on user ────────────────────────────────────────────────────────

  const handleCenterOnMe = useCallback(async () => {
    const loc = await loadUserLocation();
    if (loc) {
      sendToMap({ type: 'CENTER_MAP', lat: loc.lat, lng: loc.lng });
      await loadPOIs(selectedCategory, loc.lat, loc.lng);
    }
  }, [loadUserLocation, sendToMap, loadPOIs, selectedCategory]);

  // ── Reload when tab is focused ────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      if (mapReadyRef.current) {
        loadHazards();
        loadBlackspots();
      }
    }, [loadHazards, loadBlackspots])
  );

  // ── Source badge config ───────────────────────────────────────────────────

  const sourceBadge = {
    live:    { label: 'LIVE',    color: '#0E8C56', bg: '#E8F6EF', icon: 'wifi' },
    cached:  { label: 'CACHED',  color: '#1648D0', bg: '#EBF0FC', icon: 'checkmark-circle' },
    offline: { label: 'OFFLINE', color: '#ADAAA2', bg: '#F0EDE6', icon: 'cloud-offline-outline' },
  }[dataSource] as { label: string; color: string; bg: string; icon: string };

  const selectedCat = CATEGORIES.find(c => c.type === selectedCategory) ?? CATEGORIES[0];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <MapErrorBoundary>
      <View style={styles.container}>

        {/* ── WebView Map ── */}
        <WebView
          ref={webViewRef}
          style={styles.map}
          originWhitelist={['*']}
          source={{ html: LEAFLET_HTML }}
          onMessage={handleWebViewMessage}
          onError={(e) => console.error('[Map] WebView error:', e.nativeEvent.description)}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          allowsInlineMediaPlayback
          startInLoadingState={false}
        />

        {/* ── Top bar: category filters ── */}
        <View style={styles.topBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryStrip}
          >
            {CATEGORIES.map((cat) => {
              const active = selectedCategory === cat.type;
              return (
                <TouchableOpacity
                  key={cat.type}
                  style={[
                    styles.catPill,
                    active
                      ? { backgroundColor: cat.bg, borderColor: cat.color }
                      : { backgroundColor: '#FFFFFF', borderColor: '#E5E2D9' },
                  ]}
                  onPress={() => handleCategoryChange(cat.type)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.catPillText,
                    { color: active ? cat.color : '#706D65' },
                  ]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Source badge */}
          <View style={[styles.sourceBadge, { backgroundColor: sourceBadge.bg }]}>
            <Ionicons name={sourceBadge.icon as any} size={10} color={sourceBadge.color} />
            <Text style={[styles.sourceBadgeText, { color: sourceBadge.color }]}>
              {sourceBadge.label}
            </Text>
          </View>
        </View>

        {/* ── Report Hazard button (top right) ── */}
        <TouchableOpacity
          style={[styles.reportBtn, reporting && styles.reportBtnDisabled]}
          onPress={handleReportHazard}
          disabled={reporting}
          activeOpacity={0.85}
        >
          <Ionicons name="warning" size={13} color="#C05C0A" />
          <Text style={styles.reportBtnText}>
            {reporting ? 'Reporting...' : 'Report Hazard'}
          </Text>
        </TouchableOpacity>

        {/* ── Loading overlay ── */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color={selectedCat.color} />
            <Text style={styles.loadingText}>Loading {selectedCat.label}s...</Text>
          </View>
        )}

        {/* ── Legend ── */}
        <View style={styles.legend}>
          {[
            { color: '#ef3e28', label: 'Hospital' },
            { color: '#1648D0', label: 'Police' },
            { color: '#C05C0A', label: 'Towing' },
            { color: '#6B35CC', label: 'Petrol' },
            { color: '#0E8C56', label: 'Tyre' },
            { color: '#C05C0A', label: 'User Reports', isHazard: true },
          ].map((item) => (
            <View key={item.label} style={styles.legendRow}>
              {item.isHazard ? (
                <Text style={styles.legendEmoji}>⚠️</Text>
              ) : (
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              )}
              <Text style={styles.legendText}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Center on Me button ── */}
        <TouchableOpacity style={styles.locateBtn} onPress={handleCenterOnMe} activeOpacity={0.8}>
          <Ionicons name="locate" size={20} color="#1648D0" />
        </TouchableOpacity>

        {/* ── Found count bar (bottom) ── */}
        <View style={styles.foundBar}>
          <Ionicons name="location-outline" size={13} color="#706D65" />
          <Text style={styles.foundText}>
            {foundCount > 0
              ? foundCount + ' found · tap a pin for options'
              : hasLocation
                ? 'No ' + selectedCat.label + 's found nearby'
                : 'Enable location to search nearby'}
          </Text>
        </View>

      </View>
    </MapErrorBoundary>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e8e0d4',
  },
  map: {
    flex: 1,
  },

  // Top bar
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: Platform.OS === 'ios' ? 54 : 32,
    paddingHorizontal: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  categoryStrip: {
    gap: 7,
    paddingRight: 8,
  },
  catPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  catPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    flexShrink: 0,
  },
  sourceBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  // Report Hazard button
  reportBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 88,
    right: 12,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF4E6',
    borderWidth: 1.5,
    borderColor: '#E8C088',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  reportBtnDisabled: {
    opacity: 0.5,
  },
  reportBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C05C0A',
  },

  // Loading
  loadingOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 88,
    left: 12,
    zIndex: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingText: {
    fontSize: 12,
    color: '#706D65',
    fontWeight: '500',
  },

  // Legend
  legend: {
    position: 'absolute',
    bottom: 70,
    left: 12,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
    minWidth: 140,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendEmoji: {
    fontSize: 11,
    width: 12,
    textAlign: 'center',
  },
  legendText: {
    fontSize: 11,
    color: '#706D65',
    fontWeight: '500',
  },

  // Locate button
  locateBtn: {
    position: 'absolute',
    bottom: 70,
    right: 12,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },

  // Found count bar
  foundBar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 6,
  },
  foundText: {
    fontSize: 13,
    color: '#706D65',
    fontWeight: '500',
    flex: 1,
  },
});