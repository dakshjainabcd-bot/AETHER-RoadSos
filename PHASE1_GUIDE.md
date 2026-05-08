# AETHER Phase 1 — Complete Setup Guide & Final Checklist

## 📁 Final File Structure

```
AETHER/
├── app/
│   ├── _layout.tsx              ✅ Root layout + AppContext (emergency numbers, language, GPS)
│   └── (tabs)/
│       ├── _layout.tsx          ✅ Bottom tab bar (5 tabs)
│       ├── index.tsx            ✅ Home screen (emergency numbers + nearest services)
│       ├── sos.tsx              ✅ SOS screen (manual trigger, Phase 3 will add auto-detection)
│       ├── services.tsx         ✅ Services screen (adaptive radius POI search)
│       ├── map.tsx              ✅ Map screen (POI pins on real map)
│       └── settings.tsx         ✅ Settings (language + country picker + debug panel)
│
├── assets/
│   └── data/
│       └── mcc_emergency.json   ✅ 40+ countries → emergency numbers (works offline)
│
├── services/
│   ├── MCCService.ts            ✅ SIM card detection → emergency numbers
│   ├── GPSService.ts            ✅ Background GPS tracking, stores every 10s
│   └── POIDatabase.ts           ✅ SQLite search with adaptive radius (10→20→50km)
│
├── utils/
│   ├── haversine.ts             ✅ GPS distance math
│   └── constants.ts             ✅ App-wide constants
│
├── theme/
│   └── index.ts                 ✅ Colors, typography, spacing
│
├── scripts/
│   └── build_poi_db.py          ✅ Python script: OSM → SQLite database
│
├── app.json                     ✅ Expo config + permissions
├── package.json                 ✅ Dependencies
├── tsconfig.json                ✅ TypeScript config
└── babel.config.js              ✅ Babel config
```

---

## 🚀 Step-by-Step Setup (Run These Commands in VS Code Terminal)

### STEP 1: Create the project
```bash
# Run in C:\Users\YourName\Documents
npx create-expo-app@latest AETHER --template blank-typescript
cd AETHER
```

### STEP 2: Replace ALL files with the ones from this guide
Copy every file from this guide into the exact paths shown above.

### STEP 3: Install all dependencies
```bash
npx expo install expo-router react-native-safe-area-context react-native-screens expo-constants expo-linking expo-status-bar
npx expo install expo-location
npx expo install expo-sqlite
npx expo install @react-native-async-storage/async-storage
npx expo install react-native-maps
npx expo install @react-native-community/netinfo
npm install react-native-sim-info
npm install @expo/vector-icons
pip install requests
```

### STEP 4: Create required folders
```bash
mkdir assets\data
mkdir services
mkdir utils
mkdir theme
mkdir scripts
mkdir components
```

### STEP 5: Start the app
```bash
npx expo start
```
- Press `a` for Android (if Android Studio installed) OR
- Scan the QR code with Expo Go app on your phone

---

## 🗃️ Build the Real POI Database (Optional for Phase 1, Required for Production)

```bash
# Run the Python script to download real hospital data from OpenStreetMap
# Start with a small city area first (faster):
python scripts/build_poi_db.py --bbox "12.8,77.4,13.1,77.8" --output assets/data --verbose

# For full India (takes 5-10 minutes):
python scripts/build_poi_db.py --country IN --output assets/data
```

After running, the file `assets/data/aether_poi.db` will contain real hospitals, police stations, etc.

---

## ✅ Phase 1 Exit Checklist

Verify each item below. All must be ✅ before starting Phase 2.

### Checkpoint 1: App Builds on iOS and Android
- [ ] Run `npx expo start` — no errors in terminal
- [ ] App opens on phone via Expo Go (scan QR code)
- [ ] All 5 tabs appear at the bottom (Home, SOS, Services, Map, Settings)
- [ ] No red error screen

### Checkpoint 2: POI Search Works Fully Offline
- [ ] Turn on Airplane Mode on your phone
- [ ] Open Services tab → tap "Hospitals"
- [ ] Results appear (sample data from seeding, OR real data if you ran the Python script)
- [ ] Results show distance (e.g., "5.2 km")
- [ ] Call button appears for POIs that have phone numbers

### Checkpoint 3: Adaptive Radius Works
- [ ] Go to Settings → tap "Show Debug Info"
- [ ] Check that GPS coordinates appear (meaning GPS is working)
- [ ] In Services screen, the result count line shows "X found within Ykm"
- [ ] If you test in a rural area with few POIs, verify radius expands (check terminal logs)

### Checkpoint 4: Emergency Numbers Correct by Country
- [ ] Home screen shows emergency numbers
- [ ] On Indian SIM: Ambulance shows 108, Police shows 100
- [ ] Go to Settings → Country Override → select "United Kingdom"
- [ ] Home screen NOW shows Ambulance: 999, Police: 999
- [ ] Switch back to India — numbers return to 108/100

### Checkpoint 5: GPS Background Tracking Active
- [ ] Open app → grant location permission when asked
- [ ] Go to Settings → Show Debug Info
- [ ] GPS coordinates appear with accuracy in meters
- [ ] Background symbol (location arrow) appears in phone's status bar

### Checkpoint 6: Language Selector Functional
- [ ] Settings → App Language → select "हिन्दी" (Hindi)
- [ ] App language is saved (verified by closing and reopening the app)
- [ ] Select "English" → switches back
- [ ] Verify using Settings → Show Debug Info — shows "Language: hi" then "Language: en"

### Checkpoint 7: CI/CD Pipeline (Optional for Phase 1)
- [ ] If you set up GitHub, push code and verify GitHub Actions runs (we'll set this up in Phase 10)
- [ ] For now: verify `npx expo start` runs without TypeScript errors

---

## 🔍 Common Errors and Fixes

### Error: "Cannot find module 'react-native-sim-info'"
```bash
npm install react-native-sim-info
```
If still fails, the module uses native code — it only works on real device, not Expo Go simulator.
The MCCService.ts handles this gracefully — it falls back to stored/default values.

### Error: "expo-sqlite module not found"
```bash
npx expo install expo-sqlite
```

### Error: "Maps not showing"
react-native-maps needs Google Maps API key for Android in production.
For development with Expo Go, maps work without a key.
If you see a grey map, it's still working — POI markers will appear.

### Error: "Location permission denied"
On Android: Settings → Apps → AETHER → Permissions → Location → Allow all the time
On iOS: Settings → Privacy → Location Services → AETHER → Always

### Error: "Cannot read properties of null (reading 'lat')"
This means GPS hasn't fixed yet. Wait 10-15 seconds and try again.
The app handles this gracefully — it shows "Fetching location..."

### Error: Babel/TypeScript compilation errors
```bash
npx expo install --fix
```
This reinstalls all packages at versions compatible with your Expo SDK.

---

## 📊 What Each File Does (Quick Reference)

| File | Purpose |
|------|---------|
| `app/_layout.tsx` | Starts app, initializes GPS + DB + MCC, provides AppContext |
| `app/(tabs)/_layout.tsx` | Defines the 5 bottom tabs |
| `app/(tabs)/index.tsx` | Home screen with emergency numbers |
| `app/(tabs)/sos.tsx` | SOS button (Phase 3 adds auto-detection here) |
| `app/(tabs)/services.tsx` | POI search with adaptive radius |
| `app/(tabs)/map.tsx` | Map with POI markers |
| `app/(tabs)/settings.tsx` | Language + country + debug |
| `services/GPSService.ts` | All GPS logic: permissions, tracking, storage |
| `services/MCCService.ts` | SIM detection → emergency numbers |
| `services/POIDatabase.ts` | SQLite: open, search, upsert POIs |
| `utils/haversine.ts` | Distance calculation between GPS points |
| `utils/constants.ts` | All magic numbers and strings |
| `theme/index.ts` | Colors, fonts, spacing |
| `assets/data/mcc_emergency.json` | Emergency numbers for 40+ countries |
| `scripts/build_poi_db.py` | Downloads OSM data → builds SQLite DB |

---

## 🔗 What Phase 2 Will Use From Phase 1

Phase 2 (Mesh Relay Network) will use:
- `GPSService.getLastKnownLocation()` — to encode GPS in the SOS packet
- `services/POIDatabase` — to check if crash is within 500m of bystander
- `AppContext.emergencyNumbers` — to call correct number after mesh relay reaches cloud
- The SQLite DB instance — same database file

**Do not move or rename these files after Phase 1 is complete.**

---

## 💡 Understanding the Architecture (Summary)

```
User Opens App
     │
     ▼
_layout.tsx (Root)
  ├── initializeDatabase()    → Creates/opens SQLite file
  ├── initializeMCCService()  → Reads SIM → sets emergency numbers
  └── startBackgroundTracking() → GPS updates every 10s to AsyncStorage
     │
     ▼
AppContext (available to ALL screens via useAppContext())
  ├── emergencyNumbers  → Police/Ambulance/Fire numbers
  ├── language          → Current language code
  └── gpsPermissionGranted → Whether GPS works

Services Screen → searchPOI()
  ├── getLastKnownLocation() from GPSService
  ├── Query SQLite with bounding box (fast)
  ├── Filter with Haversine (accurate)
  └── Expand radius 10km → 20km → 50km if needed
```
