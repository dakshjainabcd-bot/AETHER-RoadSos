// app/(tabs)/map.tsx
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
import * as Location from 'expo-location';
import { MapErrorBoundary } from '../../components/MapErrorBoundary';
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

// ── Category definitions ──────────────────────────────────────────────────────

const CATEGORIES = [
  { type: POI_TYPES.HOSPITAL,   label: 'Hospital',   color: '#ef3e28', bg: '#FEF1EE', border: '#F4C5BE' },
  { type: POI_TYPES.POLICE,     label: 'Police',     color: '#1648D0', bg: '#EBF0FC', border: '#A8BEE8' },
  { type: POI_TYPES.TOWING,     label: 'Towing',     color: '#C05C0A', bg: '#FEF4E6', border: '#E8C088' },
  { type: POI_TYPES.PETROL,     label: 'Petrol',     color: '#6B35CC', bg: '#F4EFFE', border: '#C8A8EE' },
  { type: POI_TYPES.PUNCTURE,   label: 'Tyre',       color: '#0E8C56', bg: '#E8F6EF', border: '#96D4B4' },
  { type: POI_TYPES.BLOOD_BANK, label: 'Blood Bank', color: '#ef3e28', bg: '#FEF1EE', border: '#F4C5BE' },
] as const;

// ── Leaflet HTML ──────────────────────────────────────────────────────────────
// KEY FIX: baseUrl is set to https://tile.openstreetmap.org so tile requests are allowed

const LEAFLET_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
html,body,#map{width:100%;height:100%;background:#e8e0d4;}
.leaflet-popup-content-wrapper{background:#fff;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.18);border:none;padding:0;}
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

function makeUserIcon(){
  return L.divIcon({
    html:'<div style="width:16px;height:16px;background:#007aff;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 4px rgba(0,122,255,0.25);"></div>',
    iconSize:[16,16],iconAnchor:[8,8],className:''
  });
}

function timeSince(ts){
  var m=Math.round((Date.now()-ts)/60000);
  if(m<1)return'Just now';
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
    var tags=(poi.capabilities||[]).slice(0,4).map(function(c){return'<span class="tag">'+c.replace(/_/g,' ')+'</span>';}).join('');
    var phone=poi.phone||'';
    var popup='<div class="pp">'+
      '<h3>'+poi.name+'</h3>'+
      '<div class="dist">'+(poi.distanceText||'')+'</div>'+
      (tags?'<div class="tags">'+tags+'</div>':'')+
      '<div class="acts">'+
      (phone?'<button class="btn bc" onclick="rn({type:\'CALL\',phone:\''+phone+'\'})">&#128222; '+phone+'</button>':'')+
      '<button class="btn bn" onclick="rn({type:\'NAVIGATE\',lat:'+poi.lat+',lng:'+poi.lng+',name:\''+poi.name.replace(/'/g,'')+'\'})">&#129517; Navigate</button>'+
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
      html:'<div style="position:relative;width:36px;height:36px;background:#fff;border-radius:50%;border:2.5px solid '+ringColor+';display:flex;align-items:center;justify-content:center;font-size:19px;box-shadow:0 2px 8px rgba(0,0,0,0.2);">'+emoji+badge+'</div>',
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
      .bindPopup('<b>&#9888; '+b.severity.toUpperCase()+' RISK ZONE</b><br>'+b.event_count+' driving events')
      .addTo(bsLayer);
  });
}

function setUser(lat,lng){
  if(userMarker){userMarker.setLatLng([lat,lng]);}
  else{userMarker=L.marker([lat,lng],{icon:makeUserIcon(),zIndexOffset:1000}).addTo(map);}
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

// Signal ready after map and tiles start loading
map.whenReady(function(){
  setTimeout(function(){rn({type:'MAP_READY'});},300);
});
</script>
</body>
</html>`;

// ── Main Component ────────────────────────────────────────────────────────────

export default function MapScreen() {
  const webViewRef = useRef<WebView>(null);
  const { isConnected } = useNetworkStatus();
  const mapReadyRef = useRef(false);

  const [selectedCategory, setSelectedCategory] = useState<POIType>(POI_TYPES.HOSPITAL);
  const [loading, setLoading] = useState(false);
  const [foundCount, setFoundCount] = useState(0);
  const [dataSource, setDataSource] = useState<DataSource>('offline');
  const [userLat, setUserLat] = useState(20.5937);
  const [userLng, setUserLng] = useState(78.9629);
  const [hasLocation, setHasLocation] = useState(false);
  const [reporting, setReporting] = useState(false);

  // ── Send to map ─────────────────────────────────────────────────────────────

  const sendToMap = useCallback((data: object) => {
    try {
      if (webViewRef.current) {
        webViewRef.current.postMessage(JSON.stringify(data));
      }
    } catch (e) {}
  }, []);

  // ── Get location — tries cached first, then requests fresh ─────────────────

  const getLocation = useCallback(async (): Promise<{ lat: number; lng: number } | null> => {
    try {
      // Step 1: request permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('[Map] Location permission denied');
        return null;
      }

      // Step 2: try last known first (fast)
      const last = await Location.getLastKnownPositionAsync();
      if (last && last.coords.accuracy && last.coords.accuracy < 500) {
        return { lat: last.coords.latitude, lng: last.coords.longitude };
      }

      // Step 3: request current position (may take a few seconds)
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000,
      });
      return { lat: current.coords.latitude, lng: current.coords.longitude };

    } catch (e) {
      console.warn('[Map] getLocation error:', e);
      return null;
    }
  }, []);

  // ── Load POIs ───────────────────────────────────────────────────────────────

  const loadPOIs = useCallback(async (category: POIType, lat: number, lng: number) => {
    setLoading(true);
    try {
      let results: POI[] = [];

      if (isConnected) {
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
          // fall to offline
        }
      }

      if (results.length === 0) {
        results = await searchPOI(lat, lng, category);
        setDataSource('offline');
      }

      setFoundCount(results.length);
      sendToMap({ type: 'LOAD_POIS', pois: results });
    } catch (e) {
      console.warn('[Map] loadPOIs error:', e);
    } finally {
      setLoading(false);
    }
  }, [isConnected, sendToMap]);

  // ── Load hazards ────────────────────────────────────────────────────────────

  const loadHazards = useCallback(async () => {
    try {
      await hazardReportStore.initialize();
      const clusters = hazardReportStore.getClusters();
      sendToMap({ type: 'LOAD_HAZARDS', hazards: clusters });
    } catch (e) {}
  }, [sendToMap]);

  // ── Load blackspots ─────────────────────────────────────────────────────────

  const loadBlackspots = useCallback(async () => {
    try {
      const spots = await loadCachedBlackspots();
      if (spots.length > 0) {
        sendToMap({ type: 'LOAD_BLACKSPOTS', blackspots: spots });
      }
    } catch (e) {}
  }, [sendToMap]);

  // ── On map ready ────────────────────────────────────────────────────────────

  const onMapReady = useCallback(async () => {
    if (mapReadyRef.current) return; // prevent double-fire
    mapReadyRef.current = true;

    // Get location
    const loc = await getLocation();
    if (loc) {
      setUserLat(loc.lat);
      setUserLng(loc.lng);
      setHasLocation(true);
      sendToMap({ type: 'SET_USER', lat: loc.lat, lng: loc.lng });
      await loadPOIs(selectedCategory, loc.lat, loc.lng);
    } else {
      // No location — still load with default coords
      await loadPOIs(selectedCategory, userLat, userLng);
    }

    await loadBlackspots();
    await loadHazards();
  }, [getLocation, sendToMap, loadPOIs, loadBlackspots, loadHazards, selectedCategory, userLat, userLng]);

  // ── WebView message handler ─────────────────────────────────────────────────

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
        Linking.openURL('tel:' + msg.phone).catch(() => {
          Alert.alert('Cannot Call', 'No number available.');
        });
        return;
      }
      if (msg.type === 'NAVIGATE') {
        const url = 'geo:' + msg.lat + ',' + msg.lng + '?q=' + msg.lat + ',' + msg.lng + '(' + encodeURIComponent(msg.name) + ')';
        Linking.openURL(url).catch(() => {
          Linking.openURL('https://maps.google.com/?q=' + msg.lat + ',' + msg.lng);
        });
        return;
      }
    } catch (e) {}
  }, [onMapReady]);

  // ── Category change ─────────────────────────────────────────────────────────

  const handleCategoryChange = useCallback(async (cat: POIType) => {
    setSelectedCategory(cat);
    if (hasLocation) {
      await loadPOIs(cat, userLat, userLng);
    }
  }, [loadPOIs, userLat, userLng, hasLocation]);

  // ── Center on me ────────────────────────────────────────────────────────────

  const handleCenterOnMe = useCallback(async () => {
    const loc = await getLocation();
    if (loc) {
      setUserLat(loc.lat);
      setUserLng(loc.lng);
      setHasLocation(true);
      sendToMap({ type: 'SET_USER', lat: loc.lat, lng: loc.lng });
      sendToMap({ type: 'CENTER', lat: loc.lat, lng: loc.lng });
      await loadPOIs(selectedCategory, loc.lat, loc.lng);
    } else {
      Alert.alert('Location Unavailable', 'Could not get your current location. Please check GPS settings.');
    }
  }, [getLocation, sendToMap, loadPOIs, selectedCategory]);

  // ── Report Hazard ───────────────────────────────────────────────────────────

  const handleReportHazard = useCallback(async () => {
    // Get fresh location even if hasLocation is false
    const loc = await getLocation();
    if (!loc) {
      Alert.alert(
        'Location Needed',
        'AETHER could not read your GPS. Please make sure location is enabled in your phone settings, then tap Report Hazard again.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Update our stored coords
    setUserLat(loc.lat);
    setUserLng(loc.lng);
    setHasLocation(true);

    Alert.alert(
      'Report Road Hazard',
      'What hazard are you reporting at your current location?',
      [
        { text: 'Pothole',       onPress: () => submitHazard('pothole') },
        { text: 'Accident Scene', onPress: () => submitHazard('accident') },
        { text: 'Road Blocked',  onPress: () => submitHazard('road_closed') },
        { text: 'Debris on Road', onPress: () => submitHazard('debris') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, [getLocation]);

  const submitHazard = useCallback(async (type: 'pothole' | 'accident' | 'road_closed' | 'debris') => {
    setReporting(true);
    try {
      const result = await hazardBroadcaster.reportHazard(type, 2);
      if (result.success) {
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

  // ── Refresh hazards when tab is focused ────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      if (mapReadyRef.current) {
        loadHazards();
      }
    }, [loadHazards])
  );

  // ── Source badge ────────────────────────────────────────────────────────────

  const sourceBadge = {
    live:    { label: 'LIVE',    color: '#0E8C56', bg: '#E8F6EF', icon: 'wifi' },
    cached:  { label: 'CACHED',  color: '#1648D0', bg: '#EBF0FC', icon: 'checkmark-circle' },
    offline: { label: 'OFFLINE', color: '#888',    bg: '#F0EDE6', icon: 'cloud-offline-outline' },
  }[dataSource] as { label: string; color: string; bg: string; icon: string };

  const selectedCat = CATEGORIES.find(c => c.type === selectedCategory) ?? CATEGORIES[0];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <MapErrorBoundary>
      <View style={styles.container}>

        {/* ── WebView: KEY FIX — baseUrl allows tile requests ── */}
        <WebView
          ref={webViewRef}
          style={styles.map}
          originWhitelist={['*']}
          source={{
            html: LEAFLET_HTML,
            baseUrl: 'https://tile.openstreetmap.org',  // ← THIS FIXES THE BLANK MAP
          }}
          onMessage={handleWebViewMessage}
          onError={(e) => {
            console.error('[Map] WebView error:', e.nativeEvent.description);
          }}
          onHttpError={(e) => {
            console.warn('[Map] HTTP error:', e.nativeEvent.statusCode);
          }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mixedContentMode="always"
          allowFileAccessFromFileURLs={true}
          allowUniversalAccessFromFileURLs={true}
          allowsInlineMediaPlayback={true}
          geolocationEnabled={true}
          mediaPlaybackRequiresUserAction={false}
          startInLoadingState={false}
          cacheEnabled={true}
          cacheMode="LOAD_DEFAULT"
        />

        {/* ── Category filter tabs + source badge ── */}
        <View style={styles.topBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catStrip}
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
                    styles.catText,
                    { color: active ? cat.color : '#706D65' },
                  ]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={[styles.sourceBadge, { backgroundColor: sourceBadge.bg }]}>
            <Ionicons name={sourceBadge.icon as any} size={10} color={sourceBadge.color} />
            <Text style={[styles.sourceBadgeText, { color: sourceBadge.color }]}>
              {sourceBadge.label}
            </Text>
          </View>
        </View>

        {/* ── Report Hazard button ── */}
        <TouchableOpacity
          style={[styles.reportBtn, reporting && { opacity: 0.5 }]}
          onPress={handleReportHazard}
          disabled={reporting}
          activeOpacity={0.85}
        >
          <Ionicons name="warning" size={13} color="#C05C0A" />
          <Text style={styles.reportBtnText}>
            {reporting ? 'Reporting...' : 'Report Hazard'}
          </Text>
        </TouchableOpacity>

        {/* ── Loading spinner ── */}
        {loading && (
          <View style={styles.loadingChip}>
            <ActivityIndicator size="small" color={selectedCat.color} />
            <Text style={[styles.loadingText, { color: selectedCat.color }]}>
              Loading {selectedCat.label}s...
            </Text>
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
          ].map(item => (
            <View key={item.label} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text style={styles.legendText}>{item.label}</Text>
            </View>
          ))}
          <View style={styles.legendRow}>
            <Text style={styles.legendEmoji}>⚠️</Text>
            <Text style={styles.legendText}>User Reports</Text>
          </View>
        </View>

        {/* ── Locate me button ── */}
        <TouchableOpacity
          style={styles.locateBtn}
          onPress={handleCenterOnMe}
          activeOpacity={0.8}
        >
          <Ionicons name="locate" size={20} color="#1648D0" />
        </TouchableOpacity>

        {/* ── Found count bar ── */}
        <View style={styles.foundBar}>
          <Ionicons name="location-outline" size={13} color="#706D65" />
          <Text style={styles.foundText}>
            {foundCount > 0
              ? foundCount + ' found · tap a pin for options'
              : loading
                ? 'Searching...'
                : 'No ' + selectedCat.label + 's found nearby'}
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
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingTop: Platform.OS === 'ios' ? 54 : 30,
    paddingHorizontal: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  catStrip: {
    gap: 7,
    paddingRight: 6,
  },
  catPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  catText: {
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
  reportBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 108 : 88,
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
  reportBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C05C0A',
  },
  loadingChip: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 108 : 88,
    left: 12,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255,255,255,0.95)',
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
    fontWeight: '500',
  },
  legend: {
    position: 'absolute',
    bottom: 70,
    left: 12,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
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
  foundBar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.97)',
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