<div align="center">
<img width="1200" height="140" alt="AETHER Banner" src="https://capsule-render.vercel.app/api?type=waving&color=DC2626&height=140&section=header&text=AETHER&fontSize=64&fontColor=ffffff&fontAlignY=65&animation=fadeIn&desc=Accident%20Emergency%20%26%20Trauma%20Hyper-Response&descSize=20&descAlignY=85"/>

# AETHER — Every Second of the Golden Hour, Saved

**A cross-platform mobile application and cloud backend that saves lives during road accidents by orchestrating every step of the golden hour — even with no internet, no common language, and no trained person nearby.**

[![BIMSTEC 2026](https://img.shields.io/badge/BIMSTEC-Road_Safety_Hackathon_2026-DC2626?style=for-the-badge&logo=google-maps&logoColor=white)](/)
[![Version](https://img.shields.io/badge/Version-2.0-orange?style=for-the-badge)](/)
[![Offline First](https://img.shields.io/badge/Offline-First_Architecture-22C55E?style=for-the-badge&logo=wifi&logoColor=white)](/)
[![React Native](https://img.shields.io/badge/React_Native-Expo_SDK_54-61DAFB?style=for-the-badge&logo=react&logoColor=black)](/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python_Backend-009688?style=for-the-badge&logo=fastapi&logoColor=white)](/)
[![TFLite](https://img.shields.io/badge/TFLite-On_Device_AI-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white)](/)
[![Gemini API](https://img.shields.io/badge/Gemini_API-AI_Chatbot-4285F4?style=for-the-badge&logo=google&logoColor=white)](/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](/)

<br/>

> *"168,000 Indians die in road accidents every year. 50,000 of those deaths are preventable — if help arrives within 60 minutes. Only 20.6% of victims reach a hospital in time. Not because ambulances don't exist. Because the systems that should connect victims to help collapse the moment there's no signal, no shared language, or no trained bystander nearby. AETHER fixes all three — simultaneously, automatically, and offline."*

<br/>

**[Live Demo](#14-hackathon-demo--apk-download) · [APK Download](#14-hackathon-demo--apk-download) · [Architecture](#6-system-architecture) · [Full Incident Flow](#5-full-incident-flow--crash-to-road-repair) · [Video Demo](#14-hackathon-demo--apk-download)**

</div>

---

## Table of Contents

1. [The Problem — Understanding the Crisis](#1-the-problem--understanding-the-crisis)
2. [Why Existing Solutions Fail](#2-why-existing-solutions-fail)
3. [What Is AETHER?](#3-what-is-aether)
4. [The Seven Pillars of AETHER v2.0](#4-the-seven-pillars-of-aether-v20)
5. [Full Incident Flow — Crash to Road Repair](#5-full-incident-flow--crash-to-road-repair)
6. [System Architecture](#6-system-architecture)
7. [Feature Deep-Dives](#7-feature-deep-dives)
   - [7.1 Dual-Mode Crash Detection](#71-dual-mode-crash-detection)
   - [7.2 Offline Mesh Relay Network (OMRN)](#72-offline-mesh-relay-network-omrn)
   - [7.3 Bystander Empathy Coach (BystAI)](#73-bystander-empathy-coach-bystai)
   - [7.4 Multilingual Communication Bridge](#74-multilingual-communication-bridge)
   - [7.5 Hospital Pre-Alert System (HPP)](#75-hospital-pre-alert-system-hpp)
   - [7.6 Rakshak Responder Network](#76-rakshak-responder-network)
   - [7.7 Evidence & Road Repair System](#77-evidence--road-repair-system)
   - [7.8 Road DNA Blackspot Map](#78-road-dna-blackspot-map)
   - [7.9 Driver Intelligence Suite](#79-driver-intelligence-suite)
   - [7.10 Pocket RAG First-Aid Chatbot](#710-pocket-rag-first-aid-chatbot)
   - [7.11 Psychological First Aid Module](#711-psychological-first-aid-module)
   - [7.12 DTN Store-and-Forward Mesh](#712-dtn-store-and-forward-mesh)
   - [7.13 Trust & Gamification System](#713-trust--gamification-system)
8. [Novel AI/ML Features (v2.0)](#8-novel-aiml-features-v20)
9. [Security & Privacy Architecture](#9-security--privacy-architecture)
10. [Complete Technology Stack](#10-complete-technology-stack)
11. [Firebase & Database Schema](#11-firebase--database-schema)
12. [Setup & Installation](#12-setup--installation)
13. [Hackathon Demo & APK Download](#13-hackathon-demo--apk-download)
14. [Impact Assessment](#14-impact-assessment)
15. [Project Structure](#15-project-structure)
16. [Team](#16-team)

---

## 1. The Problem — Understanding the Crisis

Road traffic accidents are one of the leading causes of preventable death in India and across the BIMSTEC region. The scale is not just large — it is catastrophic, and it is getting worse.

| Metric | Number | What This Means |
|---|---|---|
| **Annual road deaths (India)** | **168,000+** | One death every 3.4 minutes, around the clock |
| **Preventable deaths** | **~50,000/year** | 30% could be saved if medical care arrived within 60 minutes |
| **Golden hour reach** | **Only 20.6%** | Less than 1 in 5 victims reaches a hospital within the critical window |
| **Highway coverage gap** | **>50% of highways** | No cellular coverage — every existing SOS app becomes useless at the worst possible moment |
| **Bystander inaction rate** | **5%+ of potential helpers** | Refuse to assist due to fear of legal consequences, police harassment, or simply not knowing what to do |

> **What is the Golden Hour?**
> The "Golden Hour" refers to the first 60 minutes after a traumatic injury. Research in trauma medicine consistently shows that receiving care — stabilisation, haemorrhage control, airway management — within this window dramatically increases the probability of survival. After 60 minutes, survival rates drop sharply for many injury types. Right now in India, only 1 in 5 victims ever makes it.

### The Five Root Causes

These five failures do not happen in isolation. They compound one another, and together they create a systemic collapse of emergency response at exactly the moments it is needed most.

| # | Root Cause | What It Means in Practice | Real-World Example |
|---|---|---|---|
| 1 | **No Signal = No Help** | Over 50% of Indian national highways have zero cellular coverage. Every existing SOS app — including Apple's and Google's crash detection — silently fails. The crash happens, and the phone has no way to summon help. | A car hits a truck on NH-44 at 2 AM in a no-coverage zone. The victim's phone shows no bars. There is no way to dial 108. No ambulance is called. |
| 2 | **Bystander Freeze** | People genuinely want to help, but fear stops them: fear of causing more harm by moving a victim incorrectly, fear of police detention, fear of being charged for hospital bills. Without guidance and legal reassurance, well-meaning people do nothing. | A lorry driver stops at the scene. He stands two metres away, phone in hand, unsure whether to approach. "What if I move him and hurt him more?" Twenty minutes pass. |
| 3 | **Language Barriers** | India has 22 official languages and hundreds of dialects. A Tamil-speaking bystander and a Hindi-speaking ambulance dispatcher cannot exchange critical injury information. Translation apps need internet. Nobody present speaks both languages. | A tourist from Tamil Nadu crashes in Himachal Pradesh. The nearest bystander speaks only Pahari. The 108 dispatcher speaks Hindi. The injury description never gets communicated accurately. |
| 4 | **Wrong Hospital** | Standard ambulance dispatch sends the victim to the *nearest* hospital regardless of capability. A head trauma victim taken to a clinic with no neurosurgeon and no CT scanner will be transferred — losing the entire golden hour in the process. | A victim with a subdural haematoma is taken to the nearest government clinic 8km away. It has no CT scanner. The victim is stabilised and transferred. The nearest neurosurgical facility is 60km further. He arrives 95 minutes after the crash. |
| 5 | **No Road Repair** | Even when a dangerous pothole directly causes a fatal accident, there is no streamlined mechanism to compel the responsible road authority to fix it. No complaint is filed. No accountability exists. The same location kills again the following month. | Blackspot data shows 47 hard-brake events and 3 fatal crashes at a single 50m stretch of NH-7 over 18 months. No repair has ever been filed. The pothole that caused the latest death is still there. |

---

## 2. Why Existing Solutions Fail

Multiple tools exist today. Each addresses one corner of the problem. None of them work together, none work offline, and critically — none of them close the loop back to preventing the *next* crash at the same location.

| Solution | What It Does | Critical Gap |
|---|---|---|
| **1033 / 108 Helplines** | Human-dispatched ambulance on telephone call | No signal → no call. No automatic location sharing. No first-aid guidance to the person at the scene. Relies entirely on victim or bystander being conscious and coherent. |
| **Apple / Google Crash Detection** | Automatically calls emergency services on iPhone 14+ and Pixel 8+ after detecting a crash | Requires cellular signal, works on a single isolated device, provides no guidance to bystanders, captures no evidence, is locked to premium hardware, and does nothing about the road condition. |
| **OSM-based Navigation Apps** | Show nearest hospital on a map | Require active internet connection, provide no dispatch capability, offer no first-aid guidance, and cannot communicate with the hospital that the victim is incoming. |
| **Good Samaritan Law** | Provides legal protection and ₹25,000 reward to helpers | Does not tell a bystander *how* to help medically. Is not integrated with any emergency system. Most people at accident scenes are unaware it exists. Provides no mechanism to claim the reward easily. |
| **Dashcams** | Record video of road incidents | Single fixed viewpoint, no retroactive capture of the moments before a crash, no automatic sharing, no emergency dispatch, no court-ready chain of custody. |

> **The critical insight AETHER is built on:** None of these solutions communicate with each other. None function in zero-signal environments. None guide the untrained person who is actually present. None automatically file for road repair after the crash. **AETHER is the first solution designed to address all five root causes simultaneously, in a single integrated system.**

---

## 3. What Is AETHER?

**AETHER (Accident Emergency & Trauma Hyper-Response)** is a cross-platform mobile application and cloud backend system that orchestrates every step of the golden hour automatically — crash detection, mesh relay, bystander guidance, hospital pre-alerting, evidence capture, and road repair filing — all from a smartphone, even with no cellular signal, no shared language, and no trained first responder nearby.

### One-Sentence Core Innovation

> AETHER turns every smartphone into a life-saving node — detecting crashes with self-supervised AI, relaying alerts offline via an encrypted adaptive mesh, guiding untrained bystanders with psychological and medical first aid in their own language, pre-alerting the right hospital, capturing tamper-proof evidence, rewarding Good Samaritans with digital badges, coaching safer driving, and forcing road repairs — **all automatically**.

### What Makes AETHER Fundamentally Different

| What Happens At The Scene | What Every Existing Tool Does | What AETHER Does |
|---|---|---|
| Crash on highway with no cellular signal | Every SOS app silently fails | BLE mesh relay hops SOS phone-to-phone until a device with signal is found, up to 30 hops and ~3km |
| Untrained bystander arrives and freezes | Nothing — no guidance exists | BystAI walks them through triage, CPR, and legal reassurance step-by-step, with voice and vision, offline |
| Bystander and victim speak different languages | Communication fails entirely | On-device NLLB-200 translates all instructions across 200 languages in real time, with no internet |
| Ambulance dispatched to nearest hospital | Victim arrives at wrong facility, is transferred | Trauma-to-capability matching pre-alerts only the hospital that actually has the required surgical capability |
| A pothole causes a crash | No complaint is ever filed | ART auto-generates a legally cited notice to the correct road authority and tracks the repair case |
| Bystanders fear legal consequences | They walk away | Good Samaritan Law reassurance displayed prominently + ₹25,000 reward claim PDF auto-generated |

### Version History

| Version | Key Additions |
|---|---|
| **v1.0** | 5 pillars: Crash Detection, Mesh Relay, BystAI, Hospital Pre-Alert, Evidence & Road Repair. 10-phase roadmap. |
| **v2.0 (current)** | +2 pillars (Driver Intelligence Suite, Trust & Gamification). AES-128-GCM encrypted mesh. Pocket RAG chatbot (Gemma-2B). Psychological First Aid. Enhanced CV wound assessment. DTN store-and-forward. Decentralised trust scores. 8-badge Good Samaritan system. Self-supervised crash anomaly model. 15-phase roadmap. Security hardening (STRIDE + DPDP compliance). Standalone APK build for judges. |

---

## 4. The Seven Pillars of AETHER v2.0

Each pillar is independently valuable. Together, they form an interlocking system where the output of each feeds the next — creating a response chain that no single-point-of-failure can break.

| # | Pillar | What It Does | Works Offline? |
|---|---|---|---|
| 1 | **Dual-Mode Crash Detection** | Sensor fusion via Kalman filter (accelerometer + gyroscope + barometer) combined with YAMNet acoustic AI (glass break, metal crumple, tyre screech). A self-supervised autoencoder learns each user's personal driving baseline to minimise false positives on bumpy roads. | **YES — fully offline** |
| 2 | **Decentralised Mesh Relay (OMRN)** | AES-128-GCM encrypted SOS packets hop phone-to-phone via BLE and WiFi Direct without any internet. Store-and-forward DTN ensures delivery even when devices are sparse. HAZARD packets warn oncoming drivers of road conditions up to 3km ahead. | **YES — fully offline** |
| 3 | **Bystander Empathy Coach (BystAI)** | Computer vision wound analysis (Claude Vision online / MobileNetV2 offline), real-time CPR voice coaching with microphone feedback, Psychological First Aid victim communication scripts, and legal reassurance — all in 22+ languages via on-device NLLB-200. | **YES — fully offline** |
| 4 | **Intelligent Hospital Pre-Alert (HPP)** | Matches the victim's injury type to the specific hospital capabilities required (neurosurgery, ICU, burn unit, cath lab). Pre-alerts via Twilio WhatsApp, waits for READY/UNABLE reply, and auto-escalates to the next matched hospital if no response within 90 seconds. | Via mesh egress |
| 5 | **Evidence & Road Repair (AWP + WCC + ART)** | 90-second RSA-signed sensor data donated by nearby phones (AWP). Multi-witness tamper-proof evidence package assembled with chain of custody (WCC). Auto-generated legally cited repair notice emailed to the correct road authority with 30-day follow-up (ART). | Partial |
| 6 | **Driver Intelligence Suite** | Per-trip safety scoring with personalised coaching tips, weekly trend analysis, time-of-day risk enhancement on blackspot alerts, and real-time HAZARD packet broadcasting so drivers become active safety nodes even when no crash has occurred. | **YES — fully offline** |
| 7 | **Trust & Incentive System** | Decentralised per-device trust scores that influence relay priority. Eight cryptographically verified digital badges for Good Samaritans. Auto-generated ₹25,000 reward claim PDFs. A *Track My Claim* screen that follows the reward from submission to payment. | **YES — fully offline** |

---

## 5. Full Incident Flow — Crash to Road Repair

**Scenario:** A car hits a pothole on NH-44 at 2 AM. No cellular signal for 40km in either direction. The driver is unconscious. A truck driver stops 100 metres away.

| Time | Actor | Action | Feature Used | Signal Required? |
|---|---|---|---|---|
| **0:00** | System | Crash detected: sudden deceleration >2g fused with glass-break audio via YAMNet. Self-supervised anomaly score exceeds threshold. AES-128-GCM encrypted SOS packet created with RSA device signature and HMAC-SHA256 integrity check. | Dual Crash Detection + Phase 10 Security | **NO** |
| **0:02** | Victim Phone | Encrypted SOS packet broadcast via BLE at hop=0. Simultaneously, a HAZARD packet fires — vehicles approaching from either direction will receive a warning up to 3km before the scene. | OMRN Mesh + Hazard Broadcast | **NO** |
| **0:05** | Nearby Phone A | Receives packet. Evaluates sender trust score (>40 required to forward). Forwards with hop count incremented. | OMRN + Trust Engine | **NO** |
| **0:08** | Phone B (no relay candidate) | No devices in range. Enters `CARRYING_SOS` DTN state. Buffers the packet and scans for new BLE neighbours every 30 seconds. | DTN Store-and-Forward | **NO** |
| **0:10** | Truck Driver's Phone | Receives BLE packet. Crash GPS is within 500m. Alert fires: *"Accident nearby — stop safely to help."* Truck driver pulls over. | OMRN Proximity Notification | **NO** |
| **0:12** | Truck Driver | Opens BystAI. Takes photo of the victim. Offline MobileNetV2 classifier detects head trauma. App: *"Head trauma detected. Severity 4/5. Do NOT move the neck. Apply gentle pressure to the head wound with a clean cloth. Keep victim warm and still."* Legal reassurance banner appears immediately. | BystAI + Enhanced CV Wound Assessment | **NO** (offline path) |
| **0:14** | Truck Driver | Types into Pocket RAG chatbot: *"His spine might be hurt. Can I move him?"* Gemma-2B retrieves relevant WHO spinal injury guidelines from the FAISS index and responds in under 4 seconds: *"Do not move him unless there is immediate danger (fire, flood). Keep head and neck still. If movement is essential, use log-roll technique with 3 people..."* | Pocket RAG (Gemma-2B + FAISS) | **NO** |
| **0:15** | Truck Driver | Victim is not breathing. CPR coach activates. Visual metronome pulses at 110 BPM. Microphone detects compression rhythm. App says: *"Press faster — aim for 2 per second."* PsychAid prompts play via TTS for the victim's benefit. | CPR Voice Coach + PsychAid | **NO** |
| **0:20** | Relay Chain | SOS hops across 4 intermediate phones. One phone 3.1km away has 1 bar of EDGE signal. Cloud upload fires. Trust scores updated for all successful relay nodes (+2 each). | Mesh Egress + Trust Score Engine | Via relay |
| **0:22** | Cloud Backend | PostGIS queries hospital registry. Nearest hospital with neurosurgery is NIMHANS, 47km away. Twilio WhatsApp pre-alert sent: *"TRAUMA INCOMING. Head trauma. Severity 4. ETA ~38 min. Reply READY or UNABLE."* Hospital replies READY within 12 seconds. Truck driver's app shows: *"NIMHANS ready — 38 minutes away."* | HPP + Trauma-to-Capability Match | YES |
| **0:25** | Rakshak | FCM push notification reaches a certified Rakshak 1.4km away: *"Accident 1.4km away — head trauma, severity 4. Tap to navigate."* She opens the app and begins driving to the scene. Badge progress updates. | Rakshak Network | YES |
| **5:00** | Ambulance | Arrives. Victim stabilised and transferred to pre-alerted NIMHANS, where the neurosurgical team is scrubbed and ready. Truck driver earns *First Responder* and *CPR Hero* badges. Rakshak earns *First Responder* badge. | All Previous | N/A |
| **30:00** | System | Nearby phones receive a consent request to donate their last 90 seconds of sensor data. Three phones consent. Each signs their buffer with their device RSA key. Incident phone assembles the multi-witness evidence package and uploads to S3. | AWP + WCC | Optional |
| **35:00** | System | Road classified as National Highway via GeoJSON lookup. Legal notice auto-generated citing National Highways Act Section 27. Filed to NHAI grievance portal. Case ID `NHAI-2026-04817` stored and displayed in-app. | ART | YES |
| **Ongoing** | System | Pothole GPS coordinates added to blackspot database. Blackspot severity updated. Future drivers will receive a warning 300 metres before this location. If no repair status update appears within 30 days, an escalation email fires automatically. | Blackspot Map + ART Follow-up | NO |

> **Critical design principle:** No step in this flow requires internet on the *victim's* phone. The mesh relay chain works entirely without signal until egress. The golden hour is preserved regardless of coverage.

---

## 6. System Architecture

### Layer Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        AETHER SYSTEM ARCHITECTURE v2.0                       │
├──────────────────┬─────────────────────┬────────────────────┬────────────────┤
│  LAYER 1         │  LAYER 2            │  LAYER 3           │  LAYER 4       │
│  USER DEVICE     │  MESH RELAY         │  CLOUD BACKEND     │  EXTERNAL      │
│  (Mobile App)    │  (Phone-to-Phone)   │  (Railway.app)     │  SERVICES      │
├──────────────────┼─────────────────────┼────────────────────┼────────────────┤
│ React Native     │ BLE Advertisement   │ FastAPI + Python   │ Twilio WA/SMS  │
│ Expo SDK 54      │ WiFi Direct         │ PostgreSQL+PostGIS │ Firebase FCM   │
│ TypeScript       │ AES-128-GCM Packets │ Redis + Celery     │ Claude Vision  │
│ SQLite (Offline) │ HAZARD Protocol     │ OSRM Routing       │ OpenAI Whisper │
│ TFLite Models    │ DTN State Machine   │ Firebase Auth      │ Gemini Vision  │
│ (YAMNet/Whisper/ │ Trust Score Engine  │ S3 Evidence Store  │ Govt. Portals  │
│ NLLB/Gemma-2B/   │ Deduplication Buffer│ WebSocket Server   │                │
│ MobileNetV2)     │ Store-and-Forward   │ Celery Beat Tasks  │                │
│ Kalman Crash AI  │                     │                    │                │
│ AES-128-GCM Enc  │                     │                    │                │
│ DTN Buffer Mgr   │                     │                    │                │
└──────────────────┴─────────────────────┴────────────────────┴────────────────┘
```

### Data Flow — End-to-End v2.0

```
[Sensors @ 100Hz]
 Accelerometer ──┐
 Gyroscope ──────┼──→ [Kalman Filter Fusion] ──→ [Crash Confidence > 0.75?]
 Barometer ──────┤                                        │
 Microphone ─────┘ YAMNet TFLite                          ↓ YES
                                                  [5-sec Cancel Window]
                                                          │ Not cancelled
                                                          ↓
                                              [AES-128-GCM SOS Packet]
                                              RSA Signed + HMAC-SHA256
                                                          │
                         ┌────────────────────────────────┤
                         ↓                                ↓
              [BLE Broadcast (hop=0)]          [HTTP POST if signal]
                         │                                │
              ┌──────────┴──────────┐                     ↓
              ↓                     ↓             [FastAPI Cloud]
    [Nearby Phone]         [DTN: CARRYING_SOS]    PostGIS hospital match
    Trust check > 40       30s scan cycle         Twilio WhatsApp pre-alert
    Re-broadcast           Buffer up to 5 pkts    FCM → Rakshak responders
    (hop + 1)              TTL: 30 min            WS → EMS Dashboard
              │                     │
              └──────── Relay ───────┘
                         until egress

[BystAI Camera] → Wound photo → Claude Vision (online) / MobileNetV2 (offline)
                → Injury type → First aid steps → PsychAid prompts
                → Pocket RAG chatbot (Gemma-2B + FAISS, fully offline)

[AWP Buffers] → 90-sec RSA-signed sensor data from nearby phones
              → WCC Evidence Package → S3 → ART Legal Notice → Govt. Portal
```

### Offline vs Online Capability Matrix

Understanding exactly what works without any connectivity is essential for assessing AETHER's real-world reliability in the environments where it is most needed.

| Feature | ✈️ Airplane Mode | 🟡 2G Signal | 🟢 WiFi / 4G |
|---|---|---|---|
| Crash detection | ✅ Full | ✅ Full | ✅ Full |
| BLE mesh relay | ✅ Full | ✅ Full | ✅ Full |
| DTN store-and-forward | ✅ Full | ✅ Full | ✅ Full |
| BystAI decision tree | ✅ Full | ✅ Full | ✅ Full |
| BystAI wound analysis | ✅ MobileNetV2 (8MB) | ✅ MobileNetV2 | ✅ Claude Vision API |
| Pocket RAG chatbot | ✅ Gemma-2B (50MB) | ✅ Gemma-2B | ✅ Claude API (richer) |
| Psychological First Aid scripts | ✅ Full | ✅ Full | ✅ Full |
| Multilingual pipeline (STT + translate + TTS) | ✅ Full on-device | ✅ Full on-device | ✅ Full on-device |
| POI search (hospitals, police, towing) | ✅ SQLite bundle | ✅ SQLite bundle | ✅ SQLite + live data |
| Blackspot map | ✅ Cached tiles | ✅ Cached tiles | ✅ Live updates |
| Hospital pre-alert (WhatsApp) | ❌ Queued for signal | ✅ SMS fallback | ✅ WhatsApp |
| Cloud evidence upload | ❌ Queued | ✅ On signal | ✅ Instant |
| Rakshak FCM dispatch | ❌ Queued | ✅ On signal | ✅ Instant |
| Driver safety score | ✅ Full | ✅ Full | ✅ Full |
| Hazard broadcast | ✅ BLE mesh only | ✅ BLE mesh only | ✅ BLE + cloud |
| Trust score sync | ❌ Local only | ✅ On signal | ✅ Instant |

---

## 7. Feature Deep-Dives

### 7.1 Dual-Mode Crash Detection

Automatic passive detection runs silently in the background at all times. It fuses data from multiple hardware sensors using a Kalman filter — the same class of signal fusion algorithm used in aircraft inertial navigation systems — to compute a real-time crash confidence score between 0 and 1.

**Automatic Detection (Passive) — How the Fusion Works:**

```
Accelerometer (100Hz) ──→ Sliding 200ms window RMS > 2g?
                                │ YES: candidate event
Gyroscope (100Hz) ──────→ Rollover or angular velocity spike?
                                │ adds weight to score
Barometer ──────────────→ Sudden pressure drop? (airbag deployment signature)
                                │ adds weight to score
Microphone ─────────────→ YAMNet TFLite (3.7MB INT8) sampled in 1-sec chunks
                          Scored classes: Glass, Crash, Skidding, Car alarm
                          Any class > 0.6 → acoustic_score = that value

Kalman Filter Fusion:
  confidence = (accel_score × 0.4) + (gyro_score × 0.3) + (acoustic_score × 0.3)

Trigger condition:
  confidence > 0.75 sustained for 2 consecutive seconds → SOS dispatch
```

The two-second sustain requirement is critical: it eliminates brief spikes from speed bumps, potholes, or a dropped phone — none of which maintain a high confidence score for multiple consecutive seconds.

**Manual Triggers (Backup for edge cases):**
- **Power button × 5** rapid presses — detected via Android KeyEvent in background service (iOS: volume button sequence)
- **Voice command** — *"AETHER help"* detected by Whisper tiny (15MB) running in always-listening mode on-device with confidence threshold 0.8
- **In-app SOS button** — prominent on the Home screen and accessible via a floating action button from every screen

**False-Positive Protection:**
A full-screen 5-second countdown with a large CANCEL button appears before any SOS is dispatched. The phone vibrates, an alert sound plays at maximum volume, and a push notification is sent to the user's own device in case the phone is not visible. If the user is conscious and the detection was erroneous, they cancel. If uncancelled after 5 seconds, dispatch begins. Every false positive is logged locally to improve the self-supervised crash model over time.

**Self-Supervised Anomaly Model (v2.0):**
A compact autoencoder running in TFLite learns each individual user's *normal* driving signature over their first few weeks of use — their typical deceleration patterns, how they take corners, their usual speed ranges. At inference time, a sudden high reconstruction error (input that looks nothing like normal driving) feeds additional weight into the crash confidence calculation. This approach requires no labelled crash data and naturally adapts to diverse road conditions across users.

---

### 7.2 Offline Mesh Relay Network (OMRN)

The OMRN is AETHER's most architecturally novel component and the direct answer to the single biggest reason victims die on Indian highways: no cellular signal.

**Core Principle:**
Every phone with AETHER installed operates simultaneously as a BLE peripheral (advertising) and a BLE central (scanning). There is no coordinator, no server, no central routing table. When a crash is detected, a compact encrypted SOS packet propagates outward like a ripple, jumping device to device until one device in the chain has signal and uploads to the cloud.

**What Each Relay Node Does When It Receives a Packet:**
1. Check deduplication ring buffer (5-minute window of seen incident IDs). If seen before → **silently discard**.
2. Check hop count. If hop ≥ 30 → **discard** (prevents infinite relay loops).
3. Check crash GPS distance. If within 500m → **trigger bystander notification** to screen.
4. Check HMAC integrity. If failed → **discard and log tampering event** (decrements sender's trust score by 5).
5. Increment hop count, apply 200ms random jitter, re-broadcast via BLE.
6. If any cellular signal detected → HTTP POST to cloud immediately, in parallel with mesh relay.

**SOS Packet Format (Binary, <200 bytes):**

```
[4B  incidentID  ]  Globally unique crash identifier (UUID v4 truncated)
[8B  lat         ]  Crash latitude, rounded to 3dp for mesh (~111m precision)
[8B  lng         ]  Crash longitude, rounded to 3dp for mesh
[1B  severity    ]  1–5, derived from peak g-force magnitude
[8B  timestamp   ]  Unix milliseconds — TTL, golden hour clock synchronisation
[1B  hopCount    ]  Incremented at every relay. Prevents infinite loops.
[20B deviceHash  ]  SHA-256(deviceID) — for trust score lookup by cloud
[4B  HMAC        ]  First 4 bytes of HMAC-SHA256 — lightweight relay integrity check
--- AES-128-GCM encrypted above fields ---
[16B IV          ]  Initialisation vector for AES-GCM
[16B AuthTag     ]  GCM authentication tag
```

Relay nodes forward ciphertext only. They cannot read the victim's coordinates or injury severity. Only authorised cloud-connected devices (hospitals, police dashboards) decrypt the payload.

**BLE Performance:**

| Environment | Effective Range | Latency per Hop |
|---|---|---|
| Open highway, no obstructions | ~100 metres | 0.4 seconds |
| Urban concrete walls | ~40 metres | 0.7 seconds |
| Moving vehicle, Doppler effect | ~20 metres | 0.6 seconds |

At typical highway vehicle density, a chain of 30 hops covers approximately 600–3,000 metres depending on environment — enough to reach a vehicle with signal at the edge of a dead zone.

**WiFi Direct (Android):** Where two AETHER devices can form a P2P WiFi Direct connection, the relay also transmits over this higher-bandwidth channel — useful for the larger evidence data transfers in Phase 8.

**SMS Fallback Egress:** If a device has cellular voice/SMS but no data connection, the egress module sends a structured SMS to a central parsing number with GPS coordinates embedded in plain text. This covers the scenario where a 2G SIM has SMS credits but no data plan.

---

### 7.3 Bystander Empathy Coach (BystAI)

An untrained bystander who has never administered first aid is statistically the most common first responder at Indian road accidents. The system is designed with this person specifically in mind — not paramedics, not doctors, not people who have read a first-aid manual.

**Vision-Based Injury Triage:**

```
Bystander opens camera → "Take a clear photo from 1 metre away"
        │
        ├── Online (internet available):
        │   Claude Vision API (claude-3-5-sonnet-20241022)
        │   Structured prompt returns JSON:
        │   {
        │     injury_type: "head_trauma",
        │     severity_1_to_5: 4,
        │     first_aid_steps: ["Do not move neck", "Apply pressure...", ...],
        │     do_not_do: ["Do not give water", "Do not remove helmet forcefully"],
        │     call_ambulance: true
        │   }
        │
        └── Offline (no internet):
            MobileNetV2 INT8 classifier (8MB, runs on-device)
            Five wound categories:
              laceration | burn | fracture-visible | bruising | spinal-risk
                    +
            Rule-based decision tree (5 yes/no questions):
              Is there visible bleeding? Is victim conscious?
              Is victim breathing? Is neck/spine at risk? Are burns visible?
            Answer pattern → injury category → bundled first-aid protocol
```

**CPR Voice Coach:**
When the injury type is `cardiac` or the victim is assessed as not breathing, the CPR coach activates:
- A pulsing red circle provides a visual metronome at exactly 110 BPM (flash interval: 545ms)
- The microphone uses amplitude spike detection to measure compression rhythm
- Rolling BPM is calculated from the last 6 detected compression intervals
- Voice feedback via TTS: `<100 BPM → "Press faster — two compressions per second"` | `>120 BPM → "Slow down slightly"` | `>4 sec silence → "Keep going — do not stop now"`
- Compression count and elapsed CPR time displayed on screen

**Personalised Bystander Addressing:**
Using MediaPipe face count detection from the live camera, BystAI identifies how many people are physically present and addresses them with specific roles: *"There are 3 people here. Person nearest to the victim: place both hands on the centre of the chest and push down firmly. Second person: call 108 right now. Third person: stay back and keep the road clear."*

This directly and deliberately counters the **bystander effect** (also called diffusion of responsibility) — a well-documented psychological phenomenon where the presence of multiple people reduces each individual's sense of personal obligation to act. By naming roles, BystAI eliminates this paralysis.

**Legal Reassurance:**
A persistent, high-contrast banner reads: *"Good Samaritan Law (Motor Vehicles Act, Section 134A) protects you completely. You cannot be detained by police. You cannot be held financially liable. You are eligible for ₹25,000 reward."*

This banner cannot be permanently dismissed. It reappears every 2 minutes. This design choice is intentional: the most common reason trained bystanders do nothing at Indian accident scenes is legal fear, not lack of knowledge.

**Golden Hour Clock:**
A large, prominent countdown timer runs from the SOS creation timestamp — not from when the bystander opened BystAI. This clock is synchronised across three views simultaneously: the bystander's phone, the ambulance crew's device, and the hospital's EMS web dashboard. Everyone involved sees the same clock.

---

### 7.4 Multilingual Communication Bridge

All language processing in AETHER runs entirely on-device. No audio, no speech data, no transcriptions, and no personal identifiers ever leave the phone for the purpose of translation. This is a hard, non-negotiable privacy-by-design requirement.

| Model | Provider | Quantised Size | Function |
|---|---|---|---|
| **Whisper tiny** | OpenAI (open weights) | 15 MB (INT8 TFLite) | Speech-to-text for 22+ languages, used for voice SOS trigger and bystander injury description input |
| **NLLB-200 distilled** | Meta (open weights) | 150 MB (INT8 TFLite) | Neural machine translation across 200 language pairs, including all 22 official Indian languages |
| **OS-native TTS** | Android / iOS | <5 MB per language | High-quality text-to-speech output; supports 22+ languages natively without additional downloads |
| **eSpeak NG** | Open source | <5 MB | Fallback TTS for languages not covered by the OS engine |

**End-to-End Multilingual Pipeline (No Internet, No Servers):**

```
Tamil bystander speaks injury description aloud
        ↓ Whisper tiny (on-device, offline)
Tamil text transcription
        ↓ NLLB-200 (on-device, offline)
English injury description
        ↓ BystAI decision tree / Claude Vision API
English first-aid protocol generated
        ↓ NLLB-200 (on-device, offline)
Tamil first-aid steps
        ↓ OS TTS (on-device, offline)
Spoken Tamil instructions played to bystander
```

The bystander never needs to type, never needs to read in a foreign language, and never needs an internet connection. The entire pipeline — speech recognition, translation, first-aid generation, and spoken output — runs entirely on the device in the bystander's own language.

**Translation Caching:**
Commonly used emergency phrases (*"Call 108 now"*, *"Apply pressure to the wound"*, *"Do not move the victim"*, *"Help is on the way"*) are pre-translated and cached at first launch in the user's configured language. These cache hits return at zero latency.

---

### 7.5 Hospital Pre-Alert System (HPP)

The standard emergency response model — send victim to the *nearest* hospital — is, for many injury types, the *wrong* response. A head trauma patient without neurosurgical care available at the receiving facility will simply be stabilised and transferred, consuming the golden hour in transit. HPP solves this with capability-aware matching and advance team notification.

**Trauma-to-Capability Mapping:**

```javascript
// BystAI injury type → required hospital capabilities
const requiredCapabilities = {
  head_trauma:     ["neurosurgery", "ct_scan"],
  cardiac_arrest:  ["cath_lab", "icu"],
  burns:           ["burn_unit"],
  spinal_injury:   ["neurosurgery", "icu"],
  paediatric:      ["paediatric_icu"],
  multi_trauma:    ["trauma_bay", "icu", "blood_bank"],
};

// PostGIS ST_Distance query: hospitals within 100km
// ordered by OSRM actual road driving distance (not straight-line haversine)
// that have ALL required capabilities for the detected injury type
// Fallback: nearest hospital with any ICU if no specialist within 100km
```

**The Pre-Alert Flow:**
1. Hospital matched → Twilio WhatsApp Business template sent to hospital duty number instantly
2. Message includes: Google Maps link to crash, injury type, AIS severity level, ETA in minutes
3. Hospital replies **READY** → bystander's phone immediately shows *"[Hospital Name] ready — [ETA] minutes away"*
4. Hospital replies **UNABLE** (capacity, relevant surgeon unavailable) → next-best match is alerted automatically
5. No reply within 90 seconds → escalate to next matched hospital. Maximum 3 attempts.
6. If WhatsApp delivery fails → Twilio SMS fallback fires with GPS coordinates in structured plain text

**Hospital Registry:**
The capability registry is stored in PostgreSQL with PostGIS spatial indexing. A daily JSON snapshot is bundled in the app for offline reference. Hospital staff can update their real-time capability status via an admin dashboard (e.g., *"Neurosurgery theatre currently occupied — ETA 45 min"*).

---

### 7.6 Rakshak Responder Network

Rakshak are first-aid certified volunteers who register in the AETHER app and opt into receiving proximity-based alerts for nearby incidents.

**Registration and Verification:**
Volunteers submit their name, phone number, physical address, and first-aid certificate type (Red Cross, St. John Ambulance, NSSS, Indian Red Cross Society, or equivalent). Certificate images are uploaded and reviewed. A *Verified Rakshak* badge appears on their profile, visible to other users and the EMS dashboard. FCM push token is stored in Firestore for dispatch.

**Dispatch Mechanics:**
When a crash is uploaded to cloud, a Celery task immediately queries Firestore for all active Rakshak within a 2km radius using GeoHash proximity queries. FCM push notifications fire within seconds: *"Accident 1.2km away — head trauma, severity 4 of 5. Tap to navigate to scene."*

Tapping the notification opens AETHER with turn-by-turn navigation via OSRM routing directly to the crash GPS.

**On-Scene Workflow:**
- Rakshak taps *Arrived* → arrival timestamp cryptographically logged to incident record
- Full BystAI assessment is shown — injury type, severity, first-aid steps already in progress
- Rakshak logs interventions via checkboxes (CPR, wound pressure, airway management, splinting) and free-text notes
- When the ambulance arrives: tap *Handover to Ambulance* → handover timestamp logged

**Government Reward Claim PDF:**
After handover, the app auto-generates a pre-filled PDF claim document. It includes the Rakshak's name, certificate number, incident ID, crash GPS, arrival timestamp, all logged interventions, and ambulance handover time. It cites Motor Vehicles Act Section 134A and the MORTH ₹25,000 Good Samaritan reward scheme (and Delhi's Rah-Veer programme where applicable). The Rakshak reviews the document, signs digitally, and emails it directly to the state health authority — all from within the app.

A **Track My Claim** screen shows live status: `Submitted → Acknowledged → Under Review → Approved → Reward Sent`, with dates for each transition.

---

### 7.7 Evidence & Road Repair System

AETHER's evidence system creates a multi-witness, cryptographically signed, tamper-proof evidentiary record of every crash — without any central authority — and automatically initiates the legal process to compel road repair.

**AWP — Ambient Witness Protocol:**

Every AETHER device silently maintains a 90-second rolling ring buffer in RAM at all times. The buffer contains timestamped accelerometer readings, gyroscope readings, GPS coordinates, and audio *amplitude envelope* values — a single number per 100ms representing volume level, with no speech or audio content captured. This is the minimum data required to establish a crash event timeline without any privacy violation.

When a crash is detected, this buffer is frozen to persistent storage in under 1 second. When nearby phones receive the mesh SOS packet, a consent dialog appears within 5 seconds: *"An accident has occurred nearby. Would you like to donate your last 90 seconds of sensor data to help this victim? No audio is shared. Your location is used only for this incident."*

**WCC — Witness Chain of Custody:**

```json
{
  "incident_id": "aether-2026-04817",
  "assembled_at": "2026-05-29T02:14:33Z",
  "witness_contributions": [
    {
      "device_id": "hash_of_device_a",
      "public_key_pem": "-----BEGIN PUBLIC KEY-----...",
      "data_hash": "SHA256(buffer_data_bytes)",
      "rsa_signature": "Base64(RSA_sign(data_hash, private_key))",
      "buffer_data": { "accel": [...], "gyro": [...], "gps": [...], "audio_envelope": [...] }
    }
  ]
}
```

Any third party — a court, an insurance investigator, a government auditor — can independently verify this package using only the public keys. Modifying even a single byte of buffer data causes signature verification to fail. No central AETHER server needs to be trusted. The evidence package is self-verifying.

**ART — Automated Repair Tender:**

AETHER classifies the road segment from the crash GPS against a GeoJSON road classification database, determining the correct authority:

| Road Type | Authority | Statute Cited |
|---|---|---|
| National Highway (NH) | NHAI | National Highways Act, Section 27 |
| State Highway (SH) | State PWD | Respective State Highways Act |
| Major District Road (MDR) | District Collector | Municipality Act |
| Other District Road (ODR) | Municipality | Municipality Act |

A formatted legal notice is generated using the correct statute, the crash GPS, date/time, evidence package S3 URL, injury severity, number of witnesses, and the historical blackspot event count for that location. This notice is emailed to the correct grievance portal. The government reply is parsed for a case ID, stored in PostgreSQL, and displayed in-app.

**30-Day Escalation:** If no case status update is received within 30 days, a Celery Beat scheduled task auto-fires an escalation email citing the original case ID. This continues on a 30-day cycle until a status change is recorded.

---

### 7.8 Road DNA Blackspot Map

Every hard brake, sharp swerve, and sudden heading change logged by AETHER devices creates an anonymous data point that feeds a spatial intelligence layer — the Road DNA. Over time, this layer reveals the most dangerous road segments in India with statistical precision, regardless of whether any formal accident report was ever filed.

**Event Logging (Completely Anonymised by Design):**

```
Condition: app is open and GPS speed > 20 km/h (likely driving)

Hard brake:       linear deceleration > 0.7g sustained >300ms  → logged
Lateral swerve:   lateral acceleration > 0.5g sustained >200ms → logged
Heading change:   GPS heading change > 45°/s                   → logged

Each event record: { event_type, lat, lng, timestamp, speed_kmh }
No user ID. No device ID. No phone number. No name. No session ID.
Data is opt-out (toggle in Settings).
Uploaded in batches when on WiFi only.
```

**PostGIS Statistical Blackspot Detection (Daily Celery Task):**
All events are stored in PostgreSQL with PostGIS geometry. The daily aggregation task:
1. Snaps all event coordinates to a 50m grid (`ST_SnapToGrid(location, 0.00045)`)
2. Counts events per grid cell
3. Calculates mean and standard deviation across all cells
4. Flags cells exceeding `mean + 2σ` as blackspots
5. Updates severity tier: 1–10 events = Low, 11–50 = Medium, 51+ = High
6. Updates `risk_by_hour` JSONB field with time-of-day breakdown

**In-App Warnings:**
When a driver enters within 300 metres of a blackspot (monitored via geofence hooks from Phase 1), AETHER triggers haptic feedback + audio alert + on-screen overlay: *"Hazardous road ahead — slow down."*

The warning is contextualised: *"This location has had 3× more incidents between 10 PM and 2 AM. Current time: 1:47 AM. Drive carefully."* This time-of-day context is unique to AETHER — the risk at a blackspot varies dramatically by time, weather, and visibility, and the warning reflects that.

**ART Integration:** The blackspot event count for a crash location is automatically cited in any ART legal notice filed for that location: *"This GPS location has recorded 47 hard-brake events and 3 reported crashes over the past 18 months, indicating a persistent road hazard known to the operating authority."*

---

### 7.9 Driver Intelligence Suite

Beyond emergency response, AETHER v2.0 actively works to prevent crashes before they happen — by coaching individual drivers and by turning the device mesh into a real-time hazard network.

**Per-Trip Safety Score:**

After each trip — detected by GPS speed dropping below 5 km/h and staying there for more than 3 minutes — AETHER computes a Trip Safety Score:

```
Base score: 100 points

Deductions (per event):
  Hard brake (>0.7g):            −5 points
  Lateral swerve (>0.5g):        −4 points
  Speeding segment (>OSM limit): −3 points

Bonuses:
  Night driving with zero events: +10 points
  Clean trip (zero events total): +15 points

Score is clamped to [0, 100].
```

A personalised coaching tip is shown after every trip based on the event locations: *"You braked hard 3 times in the 2km stretch before Hosur Junction. This is a known blackspot — consider reducing your approach speed there."* The tip is generated by correlating event GPS coordinates with the blackspot database.

**Weekly Trend:**
A rolling 7-day average score appears on the Home screen with a trend arrow (↑ improving / ↓ declining). Gamified streaks: 7-day, 30-day, and 90-day clean-driving badges stored in the Rakshak profile.

**Hazard Broadcasting via Mesh:**
When a driver manually taps *Report Hazard* on the Map screen (or when a blackspot detection fires), AETHER broadcasts a HAZARD packet over BLE:

```
HAZARD Packet fields:
  hazard_type: pothole | accident | road_closed | debris | flooding
  lat, lng:    crash GPS (rounded to 3dp)
  severity:    1–3
  reported_at: Unix timestamp
  hop_count:   max 15 hops (shorter TTL than SOS — hazards are more localised)
  TTL:         30 minutes (discarded after)
```

All AETHER devices within 3km that receive a HAZARD packet *and are currently driving* (GPS speed >20 km/h) receive an alert: *"Pothole reported 1.2km ahead — slow down."* This turns every AETHER user into an active node in a distributed road hazard network.

---

### 7.10 Pocket RAG First-Aid Chatbot

The Pocket RAG chatbot answers free-form, natural-language first-aid questions from bystanders at the scene — entirely offline, in under 4 seconds, using a curated medical knowledge base and an on-device language model.

**Why a chatbot instead of a decision tree?**
Decision trees work well for known injury patterns. But real accident scenes are chaotic and unpredictable. A bystander might face a situation the decision tree never anticipated: *"He has a piece of metal through his shoulder, should I pull it out?"* or *"She's 8 months pregnant and unconscious — what position should she be in?"* A free-form chatbot handles the long tail of unexpected scenarios.

**Architecture:**

```
User types: "His leg is bent at an angle. What do I do?"
        ↓
Text embedding (lightweight on-device embedding model)
        ↓
FAISS index lookup (curated local knowledge base):
  Sources: WHO First Aid Guidelines 2023
           AHA CPR & Emergency Cardiovascular Care 2025
           India-specific procedures (108 protocols, AIIMS guidelines)
  Index contains ~2,000 chunked passages at 200 words each
        ↓
Top-3 most relevant passages retrieved
        ↓
Gemma-2B INT4 (~50MB) receives: [system: be concise, actionable, medical]
                                 [context: 3 retrieved passages]
                                 [user: the bystander's question]
        ↓
Response: ≤150 words, numbered steps, plain language
Always ends with: "When in doubt, call 108."
Response time: <4 seconds on Android mid-range (Snapdragon 680+)
```

**Online Upgrade:**
When internet is available, the same query is routed to the Gemini API for a richer, more contextually aware response. The system automatically selects the best available path — Gemma-2B offline, Gemini online — without the bystander needing to do anything.

**Safety Guardrails:**
All responses are post-processed to remove any instructions that could cause harm (e.g., removing foreign objects, administering medications without professional training). The knowledge base excludes procedures that require professional equipment. Every response includes a reminder to call 108.

---

### 7.11 Psychological First Aid Module

What a bystander *says* to a trauma victim significantly affects the victim's physiological stress response. Uncontrolled panic, hyperventilation, and acute stress response can accelerate blood loss and worsen neurological outcomes. The PsychAid module coaches bystanders on exactly what to say, step by step.

**Scripted Communication Protocol (WHO PFA Framework):**

```
Step 1 — Connect (establish safety and presence):
  "I am here with you. You are safe now. Help is already on the way."

Step 2 — Assess needs (engage cognition, reduce dissociation):
  "Can you hear me? Can you tell me your name?
   Can you tell me where it hurts the most?"

Step 3 — Reassure (reduce panic, calibrate expectations):
  "The ambulance will be here in approximately [ETA from HPP] minutes.
   You are doing really well. Keep breathing slowly with me."

Step 4 — Breathing regulation (vagal tone, reduce hyperventilation):
  "Let's breathe together. Breathe in slowly through your nose...
   hold for two seconds... and breathe out slowly through your mouth."
```

**Unconscious Victim Mode:**
If the victim is assessed as unconscious, PsychAid switches to *bystander self-coaching* — supporting the psychological state of the person doing the work: *"Stay calm. You are doing everything right. You are helping this person. The ambulance is [ETA] minutes away. Keep going."*

**Delivery:**
All prompts are available in 22 languages via the NLLB translation pipeline. They auto-play via TTS so the bystander can keep their eyes on the victim at all times, hands free. The classifier output from the CV wound assessment feeds into PsychAid to personalise the script — a burn victim receives different communication prompts than a fracture victim.

---

### 7.12 DTN Store-and-Forward Mesh

A critical v2.0 upgrade from pure BLE flooding to intelligent **Delay-Tolerant Networking (DTN)**. Standard BLE flooding assumes continuous device density — each node passes the SOS to another node immediately. DTN handles the hardest scenario: a crash at 3 AM on a deserted highway where there are no other AETHER devices within range for several minutes.

**The Problem DTN Solves:**
In sparse-device scenarios, a simple flooding mesh would drop the SOS when no immediate relay is available. DTN instead buffers the packet in the first receiving device's memory and carries it forward until a relay opportunity appears — like a postal runner who carries the letter until they find someone travelling toward the destination.

**DTN State Machine:**

```
IDLE ──────────────────────────────────────────────────────────────────────────→ IDLE
 ↑                                                                               ↑
 │  Packet TTL expired (>30 min)                   Packet successfully forwarded │
 │  or buffer cleared                              or uploaded to cloud           │
 └─ CARRYING_SOS ──────────────────────────────────────────────────────────────→┘
        │
        │ Entry condition: SOS received with no immediate relay candidate
        │
        │ While CARRYING_SOS (every 30 seconds):
        │   - Scan for new BLE neighbours
        │   - New device found?
        │       → Evaluate routing heuristics (see below)
        │       → Forward buffered packet via BLE
        │       → Clear buffer → return to IDLE
        │   - WiFi/cellular signal detected?
        │       → Upload directly to cloud within 10 seconds
        │       → Clear buffer → return to IDLE
        │   - Packet age > 30 minutes?
        │       → Silently discard → return to IDLE
```

**Routing Heuristics (Evaluated Before Forwarding):**
A simple deterministic scoring function — no neural network, keeping it battery-efficient and auditable:

| Criterion | Scoring Rule | Rationale |
|---|---|---|
| Battery level | Prefer candidates with battery >20% | A device at 8% may power off before completing relay |
| GPS motion vector | Prefer devices moving toward populated areas | A device heading toward a city will find signal sooner |
| Trust score | Prefer trust score >40 | High-trust devices have a verified relay track record |

**Buffer Limits:**
Maximum 5 packets per device. If a 6th packet arrives, the oldest is dropped (FIFO). This prevents memory exhaustion on low-end Android devices with 2GB RAM. All packets older than 30 minutes are silently discarded regardless of buffer position.

**Real-World Impact:**
In a scenario where a crash happens on a completely deserted stretch at 3 AM, the SOS is not lost forever. The first vehicle that passes — even 10 minutes later — receives the buffered SOS from the crash device (if it survived), carries it, and forwards it to the next device it encounters. Time-to-cloud is extended, but *delivery is eventual and guaranteed* within the 30-minute TTL window.

---

### 7.13 Trust & Gamification System

The Trust & Gamification system creates meaningful, long-term incentives for AETHER participation while also improving the technical reliability of the mesh relay network.

**Decentralised Trust Scores:**

Each AETHER device maintains a local `trust_scores` SQLite table. Trust scores are not stored in a central database — they are computed locally from observed mesh behaviour.

| Event | Score Change | Rationale |
|---|---|---|
| Successful SOS relay (confirmed by cloud receipt) | +2 | Device reliably forwarded a real packet to the cloud |
| Verified on-scene assistance (Rakshak handover log) | +5 | Device was present and helped at a confirmed crash |
| False SOS triggered and cancelled by user | −10 | Potential noise source in the mesh |
| HMAC tampering detected on incoming packet | −5 | Device is sourcing malformed or manipulated packets |
| Unknown new device (no history) | Starts at 50 | Neutral — neither trusted nor distrusted |

When `MeshRelayManager` evaluates multiple candidate relay nodes, it selects the highest-trust option. This means the mesh self-organises around reliable devices over time.

Trust scores sync to cloud anonymously (as `{device_hash_sha256, trust_score}`) on WiFi for cross-device reputation awareness.

**Eight Digital Badges:**

| Badge | Icon | Trigger Condition | Verification Method |
|---|---|---|---|
| **First Responder** | 🚨 | Arrived at crash scene within 10 minutes of incident | Signed arrival timestamp from incident log |
| **CPR Hero** | 🫀 | CPR compressions logged for >2 continuous minutes | Compression event log duration |
| **Relay Node** | 📡 | Successfully relayed 10+ SOS packets (cloud-confirmed) | Cloud relay acknowledgement count |
| **Blackspot Reporter** | ⚠️ | Reported 5+ verified road hazards | Hazard packet cloud receipt confirmations |
| **Multilingual Helper** | 🌐 | Helped a victim in a language different from the app default | Language used in incident vs. app setting |
| **Evidence Witness** | 🎥 | Donated AWP sensor data to 3+ confirmed incidents | Cloud upload confirmations with consent log |
| **Safe Driver** | 🛡️ | 30-day streak with zero hard brakes, swerves, or incidents | Trip score event log, no deductions for 30 days |
| **Lifesaver** | 💚 | Associated with an incident where hospital confirmed READY and ambulance arrived | Hospital READY reply + Rakshak handover log |

All badge criteria are verified cryptographically: each badge award references a signed event log entry with a verifiable timestamp. Badge award events cannot be self-reported or manually triggered — they require corroborating events from independent parts of the system.

**Shareable Badge Certificates:**
Each badge generates a one-page PDF certificate with: the user's name, badge type, date earned, incident ID (if applicable), a QR code linking to the cloud-hosted evidence package, and citation of the relevant legal reward scheme. These certificates can be shared directly to WhatsApp, social media, or email — and are the input document for the ₹25,000 government reward claim.

---

## 8. Novel AI/ML Features (v2.0)

All ten of the following AI/ML capabilities were added or significantly enhanced in v2.0. Each represents a genuine innovation — either in the combination of technique and deployment context, or in the specific application to the road emergency domain.

| # | Feature | Technical Description | Feasibility |
|---|---|---|---|
| **N1** | **Pocket RAG Chatbot** | On-device Gemma-2B INT4 (~50MB) with FAISS vector index over WHO/AHA/India medical knowledge base. Offline retrieval-augmented generation for free-form first-aid Q&A. Online path routes to Gemini API for enhanced accuracy. | HIGH |
| **N2** | **Psychological First Aid** | WHO PFA framework scripted into a 4-step bystander coaching module. Auto-triggered after injury assessment. TTS delivery in 22 languages. Switches to bystander self-coaching for unconscious victims. Personalised by injury type from CV classifier output. | HIGH |
| **N3** | **Enhanced CV Wound Assessment** | Dual-path wound analysis: Claude Vision API (online, structured JSON output) + MobileNetV2 INT8 (offline, 8MB, 5-category wound classifier). Severity 1–5 scoring feeds PsychAid prompt personalisation. | HIGH |
| **N4** | **Driver Behaviour Coaching** | Passive trip event logging (hard brakes, swerves, speeding). Trip Safety Score algorithm with per-event weights. Personalised location-aware coaching tips post-trip. Weekly trend display with gamified streaks. | HIGH |
| **N5** | **Hazard Broadcasting via Mesh** | New HAZARD packet type extending the OMRN beyond SOS to include road condition alerts. 30-min TTL, 15-hop max, 3km effective radius, speed-gated alert delivery (>20 km/h only). Time-of-day risk context from blackspot JSONB. | HIGH |
| **N6** | **DTN Store-and-Forward** | Full Delay-Tolerant Networking state machine (IDLE/CARRYING_SOS). Battery-aware, GPS-vector-aware, trust-aware routing heuristics. 5-packet buffer with FIFO eviction, 30-min TTL. No neural network — deterministic and battery-efficient. | HIGH |
| **N7** | **AES-Encrypted SOS Packets** | AES-128-GCM encryption with ECDH session key exchange per incident. HMAC-SHA256 payload integrity. Relay nodes forward ciphertext only — GPS and severity are invisible to intermediate nodes. Pre-shared group key fallback for ECDH failure scenarios. | HIGH |
| **N8** | **Decentralised Trust & Reputation** | Local SQLite trust score engine with cloud-sync (anonymised). Four update triggers (relay success, on-scene verification, false SOS, HMAC failure). Scores influence relay preference weighting in `MeshRelayManager`. | MEDIUM |
| **N9** | **Good Samaritan Gamification** | Eight badge types with cryptographic verification (signed incident log references). Shareable PDF certificates auto-generated with QR codes to cloud evidence. Direct integration with government reward claim workflow. | HIGH |
| **N10** | **Self-Supervised Crash Anomaly Model** | Autoencoder trained on each user's personal driving signature (no labelled crash data required). High reconstruction error on incoming sensor window → elevated crash candidate weight in Kalman fusion score. Reduces false positives on rough roads for specific users over time. | MEDIUM |

---

## 9. Security & Privacy Architecture

Security and privacy are not afterthoughts in AETHER — they are structural requirements. AETHER handles some of the most sensitive personal data imaginable: precise real-time GPS of people in medical emergencies, photographs of injury victims, voice recordings, and driving behaviour patterns. Every design decision in this section was made with that sensitivity in mind.

### STRIDE Threat Model

AETHER's threat model was built using the STRIDE framework (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege). Every identified threat has a concrete mitigation with a named implementation location.

| Threat | Attack Scenario | AETHER Mitigation | Implementation |
|---|---|---|---|
| **Spoofing** | A malicious device broadcasts fake SOS packets to flood the mesh or mislead hospitals | RSA-signed packets. Cloud validates the RSA signature against the device's registered public key before acting. Unknown device hash is queued for verification, not acted upon immediately. | `PacketProtocol.ts` + FastAPI signature validation endpoint |
| **Tampering** | A relay node modifies the victim's GPS coordinates or severity level in transit | HMAC-SHA256 on the full payload *before* AES encryption. Every relay node verifies the HMAC before forwarding. A single changed bit causes HMAC failure → packet dropped → sender trust score −5. | New `HMACUtil.ts` + `createSOSPacket()` |
| **Information Disclosure** | An intermediate relay node reads the victim's precise GPS coordinates or injury type | Relay nodes receive only AES-128-GCM ciphertext. They can see the hop count and incident ID (required for deduplication) but nothing else. Precise GPS is only available to entities that can decrypt — cloud backend and authorised hospital apps. | AES-128-GCM in `MeshRelayManager.ts` |
| **Repudiation** | A Rakshak claims they arrived earlier than they did to fraudulently claim a reward | RSA-signed audit trail for every incident action with server-side timestamps. Immutable CloudEgress log. WCC chain of custody with independent witness verification. | Phase 8 WCC + cloud immutable audit table |
| **Denial of Service** | Attacker triggers thousands of fake SOS events to overwhelm the cloud or mesh | Rate limit: 1 SOS per device per 60 seconds (enforced in `MeshRelayManager.triggerSOS()`). Cloud API rate-limited to 100 requests/minute per IP via FastAPI middleware. | `MeshRelayManager` + FastAPI middleware |
| **Elevation of Privilege** | A bystander user accesses hospital-only admin features or admin dashboard controls | JWT tokens required for all cloud API endpoints. Hospital and admin roles enforced at the FastAPI dependency injection level — route handlers never execute without role validation. | FastAPI OAuth2 + role-based route dependencies |

### DPDP Act (India 2023) Compliance

India's Digital Personal Data Protection Act (DPDP, 2023) is the primary data privacy legislation governing AETHER. Every data collection decision was reviewed against DPDP requirements.

| DPDP Requirement | AETHER Implementation |
|---|---|
| **Consent before data collection** | Explicit one-time consent dialog on first launch before any background GPS tracking begins. Consent timestamp stored in AsyncStorage. Declining disables background location only — manual SOS still works. |
| **Data minimisation** | Driving event telemetry contains *only* GPS coordinates, event type, and timestamp. No user ID, no device ID, no session ID. The data cannot be linked to a person without additional information. |
| **Health data emergency exemption** | Crash location data processed under DPDP Section 17 (emergency services exemption), documented explicitly in the privacy policy. |
| **Right to erasure** | *"Delete All My Data"* in the Settings screen calls `DELETE /api/v1/user/{uid}`, wipes all Firestore documents, deletes all SQLite local data, and removes from cloud. Irrevocable and complete. |
| **Data retention limits** | Cloud crash records are anonymised after 90 days (user identifier replaced with null). Rakshak profiles deleted immediately on account deletion. |
| **Plain-language privacy notice** | Privacy notice shown on first launch, written at a sixth-grade reading level, without legal jargon. |

### Privacy-by-Design Guarantees

These are hard technical constraints embedded in the architecture — not policy statements that could be overridden by a configuration change.

- **No raw audio ever leaves the device, under any circumstances.** The CPR coaching microphone uses amplitude envelope values only (one number per 100ms). Speech is transcribed entirely on-device by Whisper tiny. The transcript is what may be shared — never the audio.
- **No raw photographs leave the device in offline mode.** MobileNetV2 wound classification runs entirely on-device. The online Gemini Vision API path uses HTTPS, and images are not stored beyond the API call lifecycle.
- **GPS coordinates in BLE mesh packets are coarse.** Rounded to 3 decimal places (~111m precision) for relay broadcast. Precise coordinates only appear in the HTTPS-encrypted payload to the cloud.
- **All cloud API traffic uses HTTPS/TLS 1.3.** There are no plain HTTP endpoints in the backend.
- **Driving event data is structurally anonymous.** The device identifier used for batch upload is a rotating hash refreshed monthly. It cannot be linked to a persistent identity even with access to the cloud database.

---

## 10. Complete Technology Stack

### Mobile Application

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Framework | React Native + Expo | SDK 54, TypeScript | Cross-platform iOS and Android with single codebase |
| Offline Database | SQLite (expo-sqlite) + FAISS index | SQLite 3 | POI storage (hospitals, police, towing) + RAG knowledge base retrieval |
| Mesh Networking | Android BLE API + iOS CoreBluetooth + WiFi Direct | API 21+ | Device-to-device SOS and HAZARD relay without internet |
| Encryption | AES-128-GCM (expo-crypto) + RSA-2048 (react-native-rsa-native) | — | Packet encryption, HMAC integrity, evidence signing |
| AI — Crash Detection | TFLite Kalman filter + YAMNet (3.7MB INT8) | TFLite 2.14 | Real-time sensor fusion + acoustic crash sound classification |
| AI — Language | Whisper tiny (15MB INT8) + NLLB-200 distilled (150MB INT8) | TFLite 2.14 | On-device speech-to-text + 200-language neural translation |
| AI — RAG Chatbot | Gemma-2B INT4 (~50MB) + FAISS local index | — | Offline first-aid question answering |
| AI — Vision (offline) | MobileNetV2 wound classifier (8MB INT8) | TFLite 2.14 | On-device wound category detection and severity estimation |
| AI — Vision (online) | Gemini Vision API | Google AI | Enhanced wound analysis and structured injury assessment when connected |
| Maps | react-native-maps (OpenStreetMap tiles) | — | POI display, blackspot heatmap, hazard overlay |
| Navigation | OSRM deep link + turn-by-turn | — | Rakshak routing to crash scene |
| Push Notifications | Firebase Cloud Messaging | SDK 21 | Rakshak dispatch alerts, badge notifications |

### Cloud Backend

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| API Server | FastAPI (Python) | FastAPI 0.110 | Async REST API, WebSocket real-time server |
| Spatial Database | PostgreSQL + PostGIS | PG 16, PostGIS 3.4 | Hospital registry, blackspot clustering, incident geospatial queries |
| Push Notifications | Firebase Cloud Messaging | SDK 21 | Rakshak dispatch alerts, badge notifications |

### External AI Services

| Service | Provider | When Used |
|---|---|---|
| Gemini Vision API | Google | Online wound analysis — structured injury assessment from bystander photos |
| Gemini API | Google | Online Pocket RAG path — richer first-aid responses when connected |
| Whisper API | OpenAI | Online speech-to-text for higher accuracy when bandwidth allows |

### CI/CD Pipeline

| Stage | Tool | Trigger |
|---|---|---|
| TypeScript type-check + lint | GitHub Actions | Every push to any branch |
| Unit test suite | GitHub Actions | Every push to `main` |

---

## 11. Firebase & Database Schema

### PostgreSQL Schema (Cloud Backend)

```sql
-- Core incident tracking
CREATE TABLE incidents (
  id                 SERIAL PRIMARY KEY,
  incident_uuid      UUID UNIQUE NOT NULL,
  location           GEOMETRY(Point, 4326) NOT NULL,  -- PostGIS spatial type
  severity           SMALLINT CHECK (severity BETWEEN 1 AND 5),
  injury_type        VARCHAR(50),
  timestamp          TIMESTAMPTZ NOT NULL,
  status             VARCHAR(20) DEFAULT 'active',    -- active | resolved | false_positive
  hospital_id        INTEGER REFERENCES hospitals(id),
  rakshak_uid        VARCHAR(128),                    -- Firebase UID
  evidence_s3_url    TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Anonymous driving event stream
CREATE TABLE driving_events (
  id           BIGSERIAL PRIMARY KEY,
  event_type   VARCHAR(20) NOT NULL,                  -- hard_brake | swerve | heading_change | reported_hazard
  location     GEOMETRY(Point, 4326) NOT NULL,
  timestamp    TIMESTAMPTZ NOT NULL,
  speed_kmh    SMALLINT
  -- No user_id, no device_id, no session_id by design
);

-- Computed blackspot registry (updated daily by Celery task)
CREATE TABLE blackspots (
  id            SERIAL PRIMARY KEY,
  location      GEOMETRY(Point, 4326) NOT NULL,
  event_count   INTEGER NOT NULL,
  severity_tier VARCHAR(10) CHECK (severity_tier IN ('low', 'medium', 'high')),
  risk_by_hour  JSONB,                                -- { "00": 12, "01": 8, ... "23": 3 }
  last_updated  TIMESTAMPTZ NOT NULL
);
CREATE INDEX ON blackspots USING GIST (location);    -- Spatial index for 300m geofence queries

-- Hospital capability registry
CREATE TABLE hospitals (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(200) NOT NULL,
  location      GEOMETRY(Point, 4326) NOT NULL,
  phone         VARCHAR(20),
  whatsapp      VARCHAR(20),
  capabilities  JSONB,                               -- ["neurosurgery", "icu", "ct_scan", ...]
  beds_icu      SMALLINT,
  cashless      BOOLEAN DEFAULT false,
  verified      BOOLEAN DEFAULT false
);
CREATE INDEX ON hospitals USING GIST (location);     -- Spatial index for capability matching

-- Road repair case tracking
CREATE TABLE repair_cases (
  incident_id       INTEGER REFERENCES incidents(id),
  authority         VARCHAR(50),                     -- NHAI | State PWD | District | Municipality
  case_id           VARCHAR(100),
  filed_at          TIMESTAMPTZ NOT NULL,
  status            VARCHAR(20) DEFAULT 'filed',
  last_escalation   TIMESTAMPTZ,
  next_escalation   TIMESTAMPTZ
);
```

### Firestore Schema (Firebase)

```
users/{uid}/
├── profile/
│   ├── name:           string
│   ├── phone:          string
│   ├── language_pref:  string  (ISO 639-1 language code)
│   └── fcm_token:      string  (updated on app launch)
│
├── rakshak_profile/
│   ├── is_verified:    boolean
│   ├── cert_type:      string  (Red Cross | St. John | NSSS | ...)
│   ├── cert_image_url: string  (Firebase Storage URL)
│   ├── badges:         array   (list of earned badge IDs)
│   ├── trust_score:    number  (synced from local SQLite)
│   └── location:       GeoPoint (updated while app is open)
│
└── claim_status/{incident_id}/
    ├── status:         string  (Submitted | Acknowledged | Approved | Reward Sent)
    ├── submitted_at:   timestamp
    └── last_updated:   timestamp

trust_scores/{device_hash_sha256}/
├── trust_score:         number
└── last_synced:         timestamp
```

### SQLite Schema (On-Device)

```sql
-- Bundled POI database (updated monthly via EAS OTA)
CREATE TABLE poi (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL,   -- hospital | police | ambulance | towing | puncture | blood_bank
  name          TEXT NOT NULL,
  lat           REAL NOT NULL,
  lng           REAL NOT NULL,
  phone         TEXT,
  hours         TEXT,
  capabilities  TEXT,            -- JSON string: ["neurosurgery", "icu"]
  country_code  TEXT NOT NULL,
  confidence    REAL DEFAULT 1.0
);

-- Anonymous driving events (upload queue, cleared after WiFi upload)
CREATE TABLE driving_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type    TEXT NOT NULL,
  lat           REAL NOT NULL,
  lng           REAL NOT NULL,
  timestamp     INTEGER NOT NULL,  -- Unix ms
  speed_kmh     INTEGER,
  uploaded      INTEGER DEFAULT 0  -- 0 = pending, 1 = uploaded
);

-- Blackspot cache (downloaded daily on WiFi, used for offline geofence alerts)
CREATE TABLE blackspots (
  id            INTEGER PRIMARY KEY,
  lat           REAL NOT NULL,
  lng           REAL NOT NULL,
  severity      TEXT NOT NULL,    -- low | medium | high
  event_count   INTEGER NOT NULL,
  risk_by_hour  TEXT              -- JSON string
);

-- Local trust score registry
CREATE TABLE trust_scores (
  device_hash       TEXT PRIMARY KEY,
  trust_score       INTEGER NOT NULL DEFAULT 50,
  successful_relays INTEGER DEFAULT 0,
  failed_relays     INTEGER DEFAULT 0,
  last_updated      INTEGER           -- Unix ms
);
```

---

## 12. Setup & Installation

### Prerequisites

- **Node.js** ≥ 18 (LTS recommended)
- **Expo Go** app installed on your phone ([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) / [iOS](https://apps.apple.com/app/expo-go/id982107779))

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/aether.git
cd aether
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Add Your API Keys

Create a `.env` file in the project root:

```env
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

- **Gemini API key** — used for the online Pocket RAG chatbot and wound vision analysis. Get one at [aistudio.google.com](https://aistudio.google.com).
- **OpenAI API key** — used for the online Whisper speech-to-text path. Get one at [platform.openai.com](https://platform.openai.com).

Both keys are optional for running offline — all AI features fall back to on-device models automatically.

### 4. Start the Simulation Server

```bash
cd server
npm start
```

Keep this terminal running. The simulation server handles mesh relay and incident broadcasting locally.

### 5. Start the App

Open a new terminal in the project root and run:

```bash
npx expo start
```

Scan the QR code with the **Expo Go** app on your phone. Make sure your phone and computer are on the **same WiFi network**.

> **Note:** The app uses OpenStreetMap tiles for all map views — no additional map API key is needed.

---

## 13. Hackathon Demo & APK Download

### 📱 Direct APK Download

> **AETHER.apk:** `(https://drive.google.com/file/d/1Z8krF2At1mvAFE85xC9D7rvxwsS9T5CC/view?usp=sharing)`

**Install in 3 steps:**
1. Download `AETHER.apk` from the link above
2. On your Android device: Settings → Security → Allow installation from unknown sources
3. Open the downloaded file and install. No setup, no QR code, no WiFi required.

The APK has the cloud backend URL hardcoded. All cloud features work immediately on any Android 9+ device.

### 🌐 Live EMS Dashboard

> **Dashboard:** `[LINK TO BE ADDED — Railway deployment in progress]`

Open in any browser. Trigger an SOS from the APK and watch it appear on the dashboard in real time, with incident details, hospital match status, and Rakshak dispatch timeline.

### 🎥 Demo Video

> **4-minute walkthrough:** `[LINK TO BE ADDED]`

The video demonstrates all 7 pillars in sequence: crash detection → mesh relay → BystAI triage → hospital pre-alert → Rakshak dispatch → evidence assembly → road repair filing.

### What Judges Can Test

A judge who installs the APK will be able to:

| Action | What They See |
|---|---|
| Open the app | AETHER home screen — nearest hospitals, police, towing shown instantly from SQLite. No setup. |
| Shake phone or tap SOS | 5-second countdown → SOS fires → connects to cloud → hospital match returned → EMS dashboard shows incident |
| Open BystAI and take a photo | Wound classification result with first-aid steps and severity score |
| Type into Pocket RAG | Gemma-2B returns an offline first-aid answer in <4 seconds in airplane mode |
| Enable airplane mode, shake phone | Crash detected, BLE mesh relay active between multiple judges' phones |
| Check the Map screen | Seeded blackspot heatmap visible, driver safety score on Home screen |
| View Rakshak profile | Demo badges pre-awarded, claim PDF generatable |

### Offline Demo Mode (No Connectivity Required)

The following features work completely in airplane mode — suitable for demonstrations in venues with poor connectivity or by judges who prefer not to connect to the internet.

| Feature | Airplane Mode Status |
|---|---|
| Crash detection (accelerometer + gyroscope + YAMNet) | ✅ Fully functional |
| BLE mesh relay between judges' phones | ✅ Works if 2+ phones with AETHER are within 100m |
| DTN store-and-forward | ✅ Demonstrated with phone going in and out of BLE range |
| BystAI decision tree (5-question injury assessment) | ✅ Fully functional |
| Pocket RAG chatbot (Gemma-2B) | ✅ Answers first-aid questions offline in <4 seconds |
| POI search (hospitals, police, towing) | ✅ SQLite bundled database, works in airplane mode |
| Blackspot heatmap | ✅ Cached map tiles, seeded demo blackspot data |
| Driver safety score | ✅ Computed entirely from local sensor data |
| Multilingual pipeline (Whisper + NLLB + TTS) | ✅ All models on-device |
| Psychological First Aid scripts | ✅ Bundled content, TTS on-device |

**Features that require internet** (degrade gracefully with clear offline indicators): Hospital WhatsApp pre-alert (Twilio), Rakshak FCM push notifications, cloud evidence upload, Pocket RAG Claude Sonnet path, EMS dashboard real-time sync. All display a clear *"Offline — queued for when signal returns"* indicator rather than erroring.

---

## 14. Impact Assessment

### Lives Saved — Projection Model

| Metric | Current State | With AETHER at 20% Adoption | Source |
|---|---|---|---|
| Annual preventable road deaths (India) | ~50,000 | Estimated −10,000 to −15,000 | NCRB Road Accident Data 2023 |
| Golden hour reach rate | 20.6% | Target: 50–60% | MoRTH Road Accident Report |
| Highway coverage addressed | 0% (existing apps fail at no-signal) | >50% of NH coverage gap addressable via mesh | TRAI Coverage Data 2023 |
| Countries AETHER can operate in | N/A | 195+ (OSM coverage + MCC table) | OSM global statistics |
| Languages supported (fully offline) | N/A | 200 (NLLB-200 language count) | Meta AI research |

### Why 20% Adoption Is Achievable

AETHER is designed to be useful to every driver regardless of whether they ever have an accident:
- The **blackspot map** makes every journey safer
- The **driver safety score** gamifies good driving behaviour
- The **mesh relay** means having AETHER installed makes every AETHER user around you safer too — network effects compound

### Scalability Across the BIMSTEC Region

AETHER's architecture is stateless at the mesh layer and horizontally scalable at the cloud layer. The same codebase handles:
- Bangladesh (Bengali + Sylheti, Bangla emergency numbers)
- Sri Lanka (Sinhala + Tamil, 119/110 numbers)
- Nepal (Nepali, 100/102/101 numbers)
- Myanmar (Burmese, 199 police)
- Thailand (Thai, 1669 EMS)
- Bhutan (Dzongkha, 113/112)

All country-specific configurations (emergency numbers via MCC, language defaults via device locale, road authority classification via GeoJSON) are data-driven. Adding a new country requires updating data files, not code.

---

## 15. Project Structure

```
aether/
│
├── app/                                    # React Native / Expo application
│   ├── screens/
│   │   ├── HomeScreen.tsx                  # Emergency numbers, nearest POIs, SOS button, weekly driver score
│   │   ├── SOSScreen.tsx                   # Manual SOS trigger + 5-second crash countdown
│   │   ├── FindServicesScreen.tsx          # Hospital / police / towing / puncture search
│   │   ├── MapScreen.tsx                   # Blackspot heatmap, hazard overlay, Report Hazard button
│   │   └── SettingsScreen.tsx              # Language, privacy, data opt-out, Delete My Data
│   │
│   ├── components/
│   │   ├── BystAIModal.tsx                 # Vision triage → first-aid cards → CPR coach → PsychAid → RAG chat
│   │   ├── CPRCoach.tsx                    # Visual metronome (110 BPM) + mic amplitude feedback
│   │   ├── PocketRAGChat.tsx               # Gemma-2B offline chatbot UI
│   │   ├── RakshakDashboard.tsx            # Badge gallery, claim tracker, Track My Claim screen
│   │   └── TriageDecisionTree.tsx          # Offline 5-question injury assessment with illustrated cards
│   │
│   ├── services/
│   │   ├── CrashDetector.ts               # Kalman filter + YAMNet fusion + self-supervised autoencoder
│   │   ├── MeshRelayManager.ts            # BLE advertising/scanning, relay logic, DTN state machine
│   │   ├── PacketProtocol.ts              # AES-128-GCM + HMAC-SHA256 packet construction/verification
│   │   ├── CloudEgress.ts                 # HTTP POST queue with exponential backoff retry
│   │   ├── TranslationModule.ts           # Whisper + NLLB-200 + TTS pipeline
│   │   ├── PocketRAG.ts                   # Gemma-2B + FAISS inference, online Claude fallback
│   │   ├── TrustScoreEngine.ts            # Local trust_scores table, update logic, cloud sync
│   │   ├── DTNBuffer.ts                   # Store-and-forward state machine, routing heuristics
│   │   ├── AWPBuffer.ts                   # 90-second circular ring buffer, freeze on crash
│   │   ├── WCCAssembler.ts                # RSA-signed multi-witness evidence package builder
│   │   └── DriverScoring.ts              # Per-trip safety score computation, weekly aggregate
│   │
│   ├── assets/
│   │   ├── models/                         # TFLite models
│   │   │   ├── yamnet.tflite              # 3.7MB INT8 — crash sound classification
│   │   │   ├── whisper_tiny.tflite        # 15MB INT8 — speech-to-text
│   │   │   ├── nllb200_distilled.tflite   # 150MB INT8 — 200-language translation
│   │   │   ├── gemma_2b_int4.tflite       # ~50MB INT4 — Pocket RAG language model
│   │   │   └── mobilenetv2_wounds.tflite  # 8MB INT8 — offline wound classifier
│   │   ├── knowledge_base/
│   │   │   └── faiss_index.bin            # FAISS vector index for WHO/AHA/India medical knowledge
│   │   └── pois.db                        # Bundled SQLite POI database (195+ countries, updated monthly)
│   │
│   └── constants.ts                       # Firebase config, cloud URLs, mesh parameters, badge definitions
│
├── server/                                 # FastAPI cloud backend
│   ├── main.py                             # FastAPI app + WebSocket real-time server
│   ├── routers/
│   │   ├── incidents.py                    # POST /incident, GET /incident/{id}, WebSocket /ws/incidents
│   │   ├── hospitals.py                    # GET /match (capability matching), POST /prealert (Twilio dispatch)
│   │   ├── repair.py                       # POST /repair (ART filing), GET /repair/{case_id}
│   │   └── users.py                        # DELETE /user/{uid} — DPDP right to erasure
│   ├── tasks/
│   │   ├── blackspot_aggregation.py        # Celery Beat: daily PostGIS ST_SnapToGrid clustering
│   │   ├── art_escalation.py               # Celery Beat: 30-day repair follow-up auto-email
│   │   └── hospital_prealert.py            # Celery: Twilio dispatch, READY/UNABLE reply parsing, retry
│   ├── models.py                           # SQLAlchemy ORM models + PostGIS geometry types
│   ├── docker-compose.yml                  # FastAPI + PostgreSQL/PostGIS + Redis + Celery + OSRM
│   └── alembic/                            # Database migration history
│
├── scripts/
│   ├── build_poi_db.py                     # OSM Overpass API → SQLite POI database builder
│   ├── build_faiss_index.py               # WHO/AHA knowledge source PDFs → FAISS vector index
│   └── seed_test_data.py                  # Demo mode: 5 seeded incidents, hospitals, blackspots
│
├── .github/
│   └── workflows/
│       └── build.yml                      # GitHub Actions: typecheck → lint → tests → EAS Build → APK
│
└── README.md                              # This file
```

---

## 16. Team

**Team AETHER** — Built at RVCE for the BIMSTEC Road Safety Hackathon 2026.

---

<div align="center">

**AETHER v2.0**

*15 Phases · 7 Pillars · 10 Novel AI Features · 200 Languages · Zero Signal Required*

*The only system that turns every smartphone into a life-saving node — even when there is no internet, no common language, and no trained person nearby.*

---

<img width="1200" height="60" alt="AETHER Footer" src="https://capsule-render.vercel.app/api?type=waving&color=DC2626&height=60&section=footer"/>

</div>
