// app/(tabs)/rakshak.tsx
/**
 * Rakshak Tab — Full Prototype Design
 * Hero landing page with stats grid, trust badge, and benefit rows.
 * Redirects to dashboard if already logged in.
 */
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView, Animated,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Layout, Shadows } from '../../theme';
import { rakshakService } from '../../services/Rakshak/RakshakService';

// ── Static showcase stats ─────────────────────────────────────────────────────

const STATS = [
  { value: '4,200+', label: 'Volunteers', color: Colors.brand.primary },
  { value: '₹1.2Cr', label: 'Rewards Paid', color: Colors.status.success },
  { value: '18 min', label: 'Avg Response', color: Colors.status.info },
  { value: '96%', label: 'Success Rate', color: Colors.status.warning },
];

const BENEFITS = [
  {
    icon: 'notifications',
    title: 'Real-time Crash Alerts',
    sub: 'Get notified within seconds when a crash is detected within 2km of your location',
    color: Colors.brand.primary,
    bg: Colors.soft.red,
    border: Colors.soft.redBorder,
  },
  {
    icon: 'navigate',
    title: 'Navigate to Scene',
    sub: 'One-tap turn-by-turn navigation to the exact crash location using OpenStreetMap',
    color: Colors.status.info,
    bg: Colors.soft.blue,
    border: Colors.soft.blueBorder,
  },
  {
    icon: 'shield-checkmark',
    title: 'Good Samaritan Protection',
    sub: 'Fully protected under Indian Motor Vehicles Act Section 134A — act without fear',
    color: Colors.status.success,
    bg: Colors.soft.green,
    border: Colors.soft.greenBorder,
  },
  {
    icon: 'cash',
    title: '₹25,000 Reward per Rescue',
    sub: 'Generate a legally valid PDF claim form with one tap after helping the victim',
    color: Colors.status.warning,
    bg: Colors.soft.amber,
    border: Colors.soft.amberBorder,
  },
];

const CERT_TYPES = ['First Aid', 'CPR/AED', 'ATLS', 'EMT', 'Nurse / Doctor', 'Paramedic'];

// ── Component ─────────────────────────────────────────────────────────────────

export default function RakshakTab() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    const unsub = rakshakService.onAuthStateChange((user) => {
      setIsLoggedIn(!!user);
      setCheckingAuth(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!checkingAuth && !isLoggedIn) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    }
  }, [checkingAuth, isLoggedIn]);

  if (checkingAuth) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.brand.primary} />
      </View>
    );
  }

  if (isLoggedIn) {
    router.push('/rakshak-dashboard');
    return null;
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.shieldBadge}>
              <Ionicons name="shield-checkmark" size={18} color={Colors.brand.primary} />
            </View>
            <View>
              <Text style={styles.headerTitle}>Rakshak</Text>
              <Text style={styles.headerSub}>First Responder Network</Text>
            </View>
          </View>
          <View style={styles.trustBadge}>
            <Ionicons name="star" size={10} color={Colors.status.warning} />
            <Text style={styles.trustBadgeText}>GOVT. RECOGNISED</Text>
          </View>
        </View>

        {/* ── Hero block ──────────────────────────────────────────── */}
        <View style={styles.heroBlock}>
          <View style={styles.heroPill}>
            <View style={styles.heroPillDot} />
            <Text style={styles.heroPillText}>4,200+ active volunteers across India</Text>
          </View>
          <Text style={styles.heroTitle}>
            Save Lives.{'\n'}Earn Recognition.
          </Text>
          <Text style={styles.heroSub}>
            Join India's largest certified first-aid volunteer network. Get instant crash alerts, navigate to the scene, and claim ₹25,000 per successful rescue.
          </Text>
        </View>

        {/* ── Stats grid ──────────────────────────────────────────── */}
        <View style={styles.statsGrid}>
          {STATS.map((s) => (
            <View key={s.label} style={styles.statCard}>
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Benefits ────────────────────────────────────────────── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>WHY JOIN</Text>
          <View style={styles.sectionLine} />
        </View>

        <View style={styles.benefitsCol}>
          {BENEFITS.map((b) => (
            <View key={b.title} style={[styles.benefitCard, { backgroundColor: b.bg, borderColor: b.border }]}>
              <View style={[styles.benefitIconWrap, { borderColor: b.border }]}>
                <Ionicons name={b.icon as any} size={18} color={b.color} />
              </View>
              <View style={styles.benefitText}>
                <Text style={styles.benefitTitle}>{b.title}</Text>
                <Text style={styles.benefitSub}>{b.sub}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Cert types accepted ─────────────────────────────────── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>ACCEPTED CERTIFICATES</Text>
          <View style={styles.sectionLine} />
        </View>

        <View style={styles.certGrid}>
          {CERT_TYPES.map((c) => (
            <View key={c} style={styles.certChip}>
              <Ionicons name="medal-outline" size={12} color={Colors.status.warning} />
              <Text style={styles.certChipText}>{c}</Text>
            </View>
          ))}
        </View>

        {/* ── CTA ─────────────────────────────────────────────────── */}
        <View style={styles.ctaSection}>
          <TouchableOpacity
            style={styles.registerBtn}
            onPress={() => router.push('/rakshak-register')}
            activeOpacity={0.85}
          >
            <Ionicons name="shield-checkmark" size={18} color="#fff" />
            <Text style={styles.registerBtnText}>Join Rakshak Network</Text>
            <Ionicons name="arrow-forward" size={16} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => router.push('/rakshak-login')}
            activeOpacity={0.7}
          >
            <Text style={styles.loginLinkText}>
              Already registered?{' '}
              <Text style={{ color: Colors.brand.primary, fontWeight: '700' }}>Login</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Footer note ─────────────────────────────────────────── */}
        <View style={styles.footerNote}>
          <Ionicons name="lock-closed-outline" size={12} color={Colors.label.muted} />
          <Text style={styles.footerNoteText}>
            Your data is encrypted and never shared with third parties
          </Text>
        </View>

      </Animated.View>
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background.primary,
  },
  scroll: { flex: 1, backgroundColor: Colors.background.primary },
  content: {
    paddingTop: Layout.STATUS_BAR_HEIGHT + 8,
    paddingHorizontal: Layout.HORIZONTAL_PADDING,
    paddingBottom: Layout.CONTENT_BOTTOM_PADDING,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  shieldBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: Colors.soft.red,
    borderWidth: 1,
    borderColor: Colors.soft.redBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.label.primary,
    letterSpacing: -0.5,
  },
  headerSub: { fontSize: 11, color: Colors.label.secondary, marginTop: 1 },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.soft.amber,
    borderWidth: 1,
    borderColor: Colors.soft.amberBorder,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  trustBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: Colors.status.warning,
    letterSpacing: 1.5,
  },

  // Hero
  heroBlock: { marginBottom: 22 },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    backgroundColor: Colors.soft.green,
    borderWidth: 1,
    borderColor: Colors.soft.greenBorder,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 14,
  },
  heroPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.status.success,
  },
  heroPillText: { fontSize: 11, fontWeight: '600', color: Colors.status.success },
  heroTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: Colors.label.primary,
    letterSpacing: -1.5,
    lineHeight: 40,
    marginBottom: 12,
  },
  heroSub: {
    fontSize: 14,
    color: Colors.label.secondary,
    lineHeight: 22,
    letterSpacing: -0.2,
  },

  // Stats
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.background.elevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    padding: 12,
    alignItems: 'center',
    ...Shadows.xs,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginBottom: 3,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.label.tertiary,
    letterSpacing: 0.8,
    textAlign: 'center',
  },

  // Section header
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    color: Colors.label.tertiary,
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: Colors.border.medium },

  // Benefits
  benefitsCol: { gap: 10, marginBottom: 24 },
  benefitCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  benefitIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  benefitText: { flex: 1 },
  benefitTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.label.primary,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  benefitSub: {
    fontSize: 12,
    color: Colors.label.secondary,
    lineHeight: 18,
  },

  // Certs
  certGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 28,
  },
  certChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.soft.amber,
    borderWidth: 1,
    borderColor: Colors.soft.amberBorder,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  certChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.status.warning,
  },

  // CTA
  ctaSection: { gap: 0, marginBottom: 16 },
  registerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.brand.primary,
    borderRadius: 18,
    paddingVertical: 18,
    ...Shadows.emergency,
  },
  registerBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  loginLink: { alignItems: 'center', paddingVertical: 16 },
  loginLinkText: { fontSize: 14, color: Colors.label.secondary },

  // Footer
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  footerNoteText: {
    fontSize: 11,
    color: Colors.label.muted,
    textAlign: 'center',
  },
});