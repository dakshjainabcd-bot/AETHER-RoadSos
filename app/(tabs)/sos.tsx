/**
 * SOS Screen — Prototype UI
 *
 * Hold-to-send button with progress ring, sensor bars,
 * injury type grid after activation, PostSOSVoice integration.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Linking,
  Vibration,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../app/_layout';
import { Colors, Spacing, BorderRadius, Layout, Shadows } from '../../theme';
import { crashDetectionEngine } from '../../services/CrashDetection/CrashDetectionEngine';
import type { CrashDetectionState, FusionScore } from '../../services/CrashDetection/types';


// Phase 6 components
import { HospitalMatchCard } from '../../components/HospitalMatchCard';
import type { InjuryType } from '../../services/TraumaMatch';
import { DTNStatusBadge } from '../../components/DTNStatusBadge';
import { SOSNotificationBanner } from '../../components/SOSNotificationBanner';

const INJURY_TYPES: {
  type: InjuryType; label: string; sub: string;
  icon: string; color: string; bg: string; border: string;
}[] = [
  { type: 'head_trauma', label: 'Head / Brain', sub: 'Head injury, unconscious', icon: 'fitness', color: Colors.brand.primary, bg: Colors.soft.red, border: Colors.soft.redBorder },
  { type: 'cardiac', label: 'Heart / Cardiac', sub: 'Chest pain, cardiac arrest', icon: 'heart', color: '#C0124A', bg: Colors.soft.heart, border: Colors.soft.heartBorder },
  { type: 'burns', label: 'Burns', sub: 'Fire, chemical, electrical', icon: 'flame', color: Colors.status.warning, bg: Colors.soft.amber, border: Colors.soft.amberBorder },
  { type: 'spinal', label: 'Spine / Neck', sub: 'Back/neck pain, paralysis', icon: 'body', color: Colors.brand.purple, bg: Colors.soft.purple, border: Colors.soft.purpleBorder },
  { type: 'paediatric', label: 'Child < 12', sub: 'Paediatric emergency', icon: 'people', color: Colors.status.info, bg: Colors.soft.blue, border: Colors.soft.blueBorder },
  { type: 'general', label: 'General', sub: 'Bleeding, fracture, other', icon: 'bandage', color: Colors.status.success, bg: Colors.soft.green, border: Colors.soft.greenBorder },
];

export default function SOSScreen() {
  const {
    emergencyNumbers,
    crashState,
    crashConfidence,
    injuryType,
    setInjuryType,
    preAlertState,
    clearPreAlert,
    language,
    activeIncidentId,
  } = useAppContext();

  // ── Manual SOS button state ───────────────────────────────────────────────
  const [holdSeconds, setHoldSeconds] = useState(0);
  const [isHolding, setIsHolding]    = useState(false);
  const HOLD_DURATION = 5; // seconds

  // ── Sensor score display ──────────────────────────────────────────────────
  const [liveScore, setLiveScore] = useState<FusionScore>({
    accelScore: 0, gyroScore: 0, acousticScore: 0, confidence: 0, gForce: 0,
  });


  // ── Refs ──────────────────────────────────────────────────────────────────
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const buttonScale = useRef(new Animated.Value(1)).current;

  const sosActive = crashState === 'active_sos' || crashState === 'countdown' || crashState === 'dispatching';



  // ── Subscribe to sensor scores ────────────────────────────────────────────
  useEffect(() => {
    const unsub = crashDetectionEngine.on('SCORE_UPDATED', (event) => {
      if (event.score) setLiveScore(event.score);
    });
    return () => unsub();
  }, []);


  // ── Hold-to-activate (5 second countdown) ─────────────────────────────────
  function onPressIn() {
    if (sosActive) return;
    setIsHolding(true);
    Vibration.vibrate(40);
    Animated.spring(buttonScale, { toValue: 0.95, useNativeDriver: true }).start();

    let elapsed = 0;
    const TICK = 100; // ms
    holdTimer.current = setInterval(() => {
      elapsed += TICK;
      const secs = elapsed / 1000;
      setHoldSeconds(secs);
      if (secs >= HOLD_DURATION) {
        clearInterval(holdTimer.current!);
        setHoldSeconds(HOLD_DURATION);
        crashDetectionEngine.triggerManualSOS();
        Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true }).start();
        setIsHolding(false);
        return;
      }
    }, TICK);
  }

  function onPressOut() {
    if (sosActive) return;
    setIsHolding(false);
    setHoldSeconds(0);
    if (holdTimer.current) clearInterval(holdTimer.current);
    Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true }).start();
  }

  // ── Dismiss SOS ───────────────────────────────────────────────────────────
  function handleDismissSOS() {

    clearPreAlert();
    crashDetectionEngine.resetToIdle();
  }

  const showHospitalCard = preAlertState.status !== 'idle';
  const showManualSelector = sosActive && !injuryType && !showHospitalCard;

  // ───────────────────────────────────────────────────────────────────────────
  // ACTIVE SOS → Injury type grid
  // ───────────────────────────────────────────────────────────────────────────
  if (sosActive) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Active badge */}
        <View style={styles.activeBadge}>
          <View style={styles.activeDot} />
          <Text style={styles.activeBadgeText}>SOS ACTIVE — HELP ALERTED</Text>
        </View>

        {/* Mini sensor row */}
        <View style={styles.miniSensorRow}>
          {[
            { l: 'Accel', v: liveScore.accelScore, c: Colors.brand.primary },
            { l: 'Gyro', v: liveScore.gyroScore, c: Colors.status.info },
            { l: 'Audio', v: liveScore.acousticScore, c: Colors.status.warning },
          ].map(m => (
            <View key={m.l} style={styles.miniSensorItem}>
              <Text style={styles.miniSensorLabel}>{m.l}</Text>
              <View style={styles.miniSensorTrack}>
                <View style={[styles.miniSensorFill, { width: `${Math.round(m.v * 100)}%` as any, backgroundColor: m.c }]} />
              </View>
              <Text style={styles.miniSensorValue}>{Math.round(m.v * 100)}%</Text>
            </View>
          ))}
          <Text style={styles.miniGforce}>{liveScore.gForce.toFixed(1)}g</Text>
        </View>

        {/* Emergency contact notification status */}
        <SOSNotificationBanner
          isActive={sosActive}
          incidentId={activeIncidentId}
        />

        <Text style={styles.injuryTitle}>What type of injury?</Text>
        <Text style={styles.injurySub}>This helps us find the right hospital — tap the best match</Text>


        {/* Injury type grid */}
        {showManualSelector && (
          <View style={styles.injuryGrid}>
            {INJURY_TYPES.map((x) => (
              <TouchableOpacity
                key={x.type}
                style={[styles.injuryCard, { backgroundColor: x.bg, borderColor: x.border }]}
                activeOpacity={0.7}
                onPress={() => setInjuryType(x.type)}
              >
                <View style={[styles.injuryIconWrap, { borderColor: x.border }]}>
                  <Ionicons name={x.icon as any} size={16} color={x.color} />
                </View>
                <Text style={styles.injuryCardLabel}>{x.label}</Text>
                <Text style={styles.injuryCardSub}>{x.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {showManualSelector && (
          <TouchableOpacity style={styles.unclearBtn}>
            <Text style={styles.unclearBtnText}>Injury type unclear</Text>
          </TouchableOpacity>
        )}

        {/* Hospital match card */}
        {showHospitalCard && (
          <View style={{ marginTop: 16 }}>
            {injuryType && (
              <View style={styles.confirmedRow}>
                <Ionicons name="checkmark-circle" size={14} color={Colors.status.success} />
                <Text style={styles.confirmedText}>
                  Injury type confirmed via manual selection
                </Text>
              </View>
            )}
            <HospitalMatchCard
              alertState={preAlertState}
              isSpecialistMatch
              requiredCapabilities={
                injuryType
                  ? require('../../services/TraumaMatch').getRequiredCapabilities(injuryType)
                  : []
              }
            />
          </View>
        )}

        {/* Dismiss */}
        <TouchableOpacity style={styles.dismissBtn} onPress={handleDismissSOS} activeOpacity={0.7}>
          <Ionicons name="close" size={16} color={Colors.status.success} />
          <Text style={styles.dismissText}>I'M OK — CANCEL SOS</Text>
        </TouchableOpacity>

        <View style={{ height: Layout.CONTENT_BOTTOM_PADDING }} />
      </ScrollView>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // IDLE → Hold-to-send button
  // ───────────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.idleContainer}>
      {/* Header */}
      <View style={styles.idleHeader}>
        <View>
          <Text style={styles.idleTitle}>Emergency SOS</Text>
          <Text style={styles.idleSub}>Hold for 5 seconds to activate</Text>
        </View>
        <View style={styles.monitoringBadge}>
          <View style={[styles.crashDot, { backgroundColor: Colors.status.success }]} />
          <Text style={styles.monitoringText}>MONITORING</Text>
        </View>
      </View>

      {/* Phase 14: DTN Status Badge — shows "DTN: 2 queued" when carrying */}
      <DTNStatusBadge />

      {/* Central hold button */}
      <View style={styles.buttonArea}>
        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
          <TouchableOpacity
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            activeOpacity={1}
            style={styles.sosCircle}
          >
            <Text style={styles.sosLabel}>SOS</Text>
            <Text style={styles.sosSubLabel}>
              {holdSeconds === 0
                ? 'HOLD TO SEND'
                : holdSeconds >= HOLD_DURATION
                ? 'SENDING…'
                : `${Math.ceil(HOLD_DURATION - holdSeconds)}s`}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Sensor bars */}
      <View style={styles.sensorBars}>
        {[
          { l: 'Accel', v: liveScore.accelScore, c: Colors.brand.primary },
          { l: 'Gyro',  v: liveScore.gyroScore,  c: Colors.status.info },
          { l: 'Audio', v: liveScore.acousticScore, c: Colors.status.warning },
        ].map(m => (
          <View key={m.l} style={styles.sensorRow}>
            <Text style={styles.sensorLabel}>{m.l}</Text>
            <View style={styles.sensorTrack}>
              <View style={[styles.sensorFill, { width: `${Math.round(m.v * 100)}%` as any, backgroundColor: m.c }]} />
            </View>
            <Text style={styles.sensorValue}>{Math.round(m.v * 100)}%</Text>
          </View>
        ))}
        <Text style={styles.gforceText}>{liveScore.gForce.toFixed(1)}g peak g-force</Text>
      </View>

      {/* Quick dial */}
      <View style={styles.quickDialSection}>
        <Text style={styles.quickDialLabel}>QUICK DIAL</Text>
        <View style={styles.dialRow}>
          <QuickDial number={emergencyNumbers.ambulance} label="Ambulance" color={Colors.brand.primary} bg={Colors.soft.red} border={Colors.soft.redBorder} />
          <QuickDial number={emergencyNumbers.police} label="Police" color={Colors.status.info} bg={Colors.soft.blue} border={Colors.soft.blueBorder} />
          <QuickDial number={emergencyNumbers.fire} label="Fire" color={Colors.status.warning} bg={Colors.soft.amber} border={Colors.soft.amberBorder} />
        </View>
      </View>
    </View>
  );
}



// ── Quick Dial ──────────────────────────────────────────────────────────────

function QuickDial({ number, label, color, bg, border }: {
  number: string; label: string; color: string; bg: string; border: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.dialChip, { backgroundColor: bg, borderColor: border }]}
      onPress={() => Linking.openURL(`tel:${number}`)}
      activeOpacity={0.7}
    >
      <Text style={[styles.dialNumber, { color }]}>{number}</Text>
      <Text style={styles.dialLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background.primary },
  content: {
    paddingTop: Layout.STATUS_BAR_HEIGHT,
    paddingHorizontal: Layout.HORIZONTAL_PADDING,
    paddingBottom: 20,
  },

  // Active state
  activeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: Colors.soft.red, borderWidth: 1, borderColor: Colors.soft.redBorder,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5,
    alignSelf: 'flex-start', marginBottom: 14,
  },
  activeDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.brand.primary },
  activeBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.brand.primary, letterSpacing: 1.5 },

  miniSensorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.separator.nonOpaque,
    marginBottom: 14,
  },
  miniSensorItem: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  miniSensorLabel: { fontSize: 9, color: Colors.label.tertiary, letterSpacing: 0.8 },
  miniSensorTrack: { flex: 1, height: 2, backgroundColor: Colors.border.medium, borderRadius: 2, overflow: 'hidden' },
  miniSensorFill: { height: '100%', borderRadius: 2 },
  miniSensorValue: { fontSize: 9, color: Colors.label.secondary },
  miniGforce: { fontSize: 10, fontWeight: '600', color: Colors.label.secondary },

  injuryTitle: { fontSize: 20, fontWeight: '800', color: Colors.label.primary, letterSpacing: -0.5, marginBottom: 4 },
  injurySub: { fontSize: 12, color: Colors.label.secondary, marginBottom: 16, letterSpacing: -0.2 },

  injuryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 14 },
  injuryCard: {
    width: '48%' as any, borderRadius: 18, borderWidth: 1,
    padding: 14, paddingBottom: 13,
  },
  injuryIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  injuryCardLabel: { fontSize: 13, fontWeight: '700', color: Colors.label.primary, letterSpacing: -0.3, marginBottom: 3 },
  injuryCardSub: { fontSize: 10, color: Colors.label.secondary, lineHeight: 14 },

  unclearBtn: {
    width: '100%', paddingVertical: 12,
    backgroundColor: Colors.background.elevated, borderWidth: 1, borderColor: Colors.border.medium,
    borderRadius: 12, alignItems: 'center',
  },
  unclearBtnText: { fontSize: 12, fontWeight: '600', color: Colors.label.secondary },

  confirmedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  confirmedText: { fontSize: 12, color: Colors.status.success, fontWeight: '500' },

  dismissBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    width: '100%', paddingVertical: 18,
    borderWidth: 1.5, borderColor: Colors.status.success,
    borderRadius: 14, marginTop: 20,
  },
  dismissText: { fontSize: 14, fontWeight: '700', color: Colors.status.success, letterSpacing: 0.8 },

  // Idle state
  idleContainer: { flex: 1, backgroundColor: Colors.background.primary, paddingTop: Layout.STATUS_BAR_HEIGHT },
  idleHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    paddingHorizontal: Layout.HORIZONTAL_PADDING, marginBottom: 20,
  },
  idleTitle: { fontSize: 24, fontWeight: '800', color: Colors.label.primary, letterSpacing: -0.5 },
  idleSub: { fontSize: 12, color: Colors.label.secondary, marginTop: 4 },
  monitoringBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.soft.green, borderWidth: 1, borderColor: Colors.soft.greenBorder,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  crashDot: { width: 6, height: 6, borderRadius: 3 },
  monitoringText: { fontSize: 10, fontWeight: '700', color: Colors.status.success, letterSpacing: 1 },

  buttonArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sosCircle: {
    width: 184, height: 184, borderRadius: 92,
    backgroundColor: Colors.brand.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: 'rgba(239, 62, 40, 0.35)', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1, shadowRadius: 16, elevation: 8,
  },
  sosLabel: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', letterSpacing: 3 },
  sosSubLabel: { fontSize: 9.5, color: 'rgba(255,255,255,0.65)', marginTop: 9, letterSpacing: 1.5 },

  // Sensor bars
  sensorBars: { paddingHorizontal: 30, marginBottom: 20 },
  sensorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  sensorLabel: { width: 38, fontSize: 10, color: Colors.label.tertiary, letterSpacing: 0.8 },
  sensorTrack: { flex: 1, height: 2.5, backgroundColor: Colors.separator.nonOpaque, borderRadius: 2, overflow: 'hidden' },
  sensorFill: { height: '100%', borderRadius: 2 },
  sensorValue: { width: 30, fontSize: 10, color: Colors.label.secondary, textAlign: 'right' },
  gforceText: { textAlign: 'center', fontSize: 10, color: Colors.label.tertiary, marginTop: 2, letterSpacing: 1 },

  // Quick dial
  quickDialSection: { paddingHorizontal: Layout.HORIZONTAL_PADDING, paddingBottom: Layout.CONTENT_BOTTOM_PADDING },
  quickDialLabel: { fontSize: 10, fontWeight: '700', color: Colors.label.tertiary, letterSpacing: 2, marginBottom: 12 },
  dialRow: { flexDirection: 'row', gap: 9 },
  dialChip: {
    flex: 1, borderRadius: 18, borderWidth: 1,
    paddingVertical: 13, paddingHorizontal: 14,
  },
  dialNumber: { fontSize: 32, fontWeight: '900', lineHeight: 34, marginBottom: 4, letterSpacing: -0.5 },
  dialLabel: { fontSize: 10, color: Colors.label.secondary, fontWeight: '500' },

  // Voice panel
  voicePanel: {
    backgroundColor: Colors.background.elevated, borderRadius: BorderRadius.xl,
    padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.soft.blueBorder,
  },
  voiceHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  voiceTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: Colors.label.primary },
  langBadge: { backgroundColor: Colors.soft.blue, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  langBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.status.info },

  voiceListening: { alignItems: 'center', gap: 10 },
  micCircle: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.status.info,
    alignItems: 'center', justifyContent: 'center',
    ...Shadows.md,
  },
  voiceInstruction: { fontSize: 14, fontWeight: '600', color: Colors.label.primary, textAlign: 'center' },
  voiceStopBtn: {
    marginTop: 4, paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: Colors.fill.secondary, borderRadius: BorderRadius.full,
  },
  voiceStopBtnText: { fontSize: 13, color: Colors.label.secondary, fontWeight: '500' },

  voiceTranscribing: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center' },
  voiceTranscribingText: { fontSize: 13, color: Colors.label.secondary },

  voiceResult: { gap: 8 },
  voiceResultLabel: { fontSize: 11, fontWeight: '600', color: Colors.label.tertiary, letterSpacing: 1 },
  voiceResultText: { fontSize: 15, color: Colors.label.primary, fontStyle: 'italic', lineHeight: 22 },
  voiceBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: BorderRadius.md, padding: 10 },
  voiceBannerText: { flex: 1, fontSize: 12 },
});