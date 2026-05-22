// app/rakshak-dashboard.tsx
/**
 * Rakshak Dashboard — Main screen after login
 * Shows: profile status, active incident (if any), alert toggle, generate PDF
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Switch, Alert, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Layout, Shadows } from '../theme';
import { rakshakService } from '../services/Rakshak/RakshakService';
import { notificationService } from '../services/Rakshak/NotificationService';
import { pdfGenerator } from '../services/Rakshak/PDFGenerator';
import { RakshakProfile, RewardClaimData } from '../services/Rakshak/types';
import { BadgeGallery } from '../components/Rakshak/BadgeGallery';
import { badgeService } from '../services/Trust/BadgeService';
import { trustScoreService } from '../services/Trust/TrustScoreService';
import { BADGE_DEFINITIONS } from '../services/Trust/BadgeTypes';

export default function RakshakDashboardScreen() {
  const [profile, setProfile] = useState<RakshakProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [testingAlert, setTestingAlert] = useState(false);

  useEffect(() => {
    loadProfile();
    // Set up notification listeners
    const unsubReceived = notificationService.onNotificationReceived((notification) => {
      console.log('[Dashboard] Notification received:', notification.request.content.title);
    });
    return () => unsubReceived();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const user = rakshakService.getCurrentUser();
      if (!user) {
        router.replace('/rakshak-login');
        return;
      }
      const p = await rakshakService.fetchProfile(user.uid);
      if (!p) {
        router.replace('/rakshak-login');
        return;
      }
      setProfile(p);
    } catch (error) {
      console.error('[Dashboard] Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (value: boolean) => {
    if (!profile) return;
    await rakshakService.setActiveStatus(profile.uid, value);
    setProfile({ ...profile, isActive: value });
  };

  const handleTestAlert = async () => {
    setTestingAlert(true);
    try {
      await notificationService.sendLocalRakshakAlert(
        'demo_incident_001',
        1.2,
        'Head Trauma',
        4
      );
      Alert.alert('Test Sent', 'A test alert has been sent to this device. Check your notifications!');
    } catch (error) {
      Alert.alert('Error', 'Could not send test alert. Check notification permissions.');
    } finally {
      setTestingAlert(false);
    }
  };

  const handleTrackClaims = () => {
    router.push('/claim-tracker');
  };

  const handleGenerateDemoPDF = async () => {
    setGeneratingPDF(true);
    try {
      // Fetch earned badges for the PDF
      const earnedBadgesForPDF = await badgeService.getEarnedBadges();

      const demoData: RewardClaimData = {
        rakshakName: profile?.name || 'Demo Rakshak',
        rakshakPhone: profile?.phone || '+91 99999 99999',
        certificateType: profile?.certificateType?.replace(/_/g, ' ').toUpperCase() || 'FIRST AID CERTIFICATE',
        certificateNumber: 'CERT-2024-DEMO-001',
        incidentId: 'AETHER-1704067200000-abc123',
        incidentGPS: '12.9716°N, 77.5946°E',
        incidentDate: new Date().toLocaleDateString('en-IN'),
        arrivalTime: new Date(Date.now() - 15 * 60000).toLocaleTimeString('en-IN'),
        handoverTime: new Date().toLocaleTimeString('en-IN'),
        interventions: ['CPR performed', 'Bleeding controlled', 'Called ambulance'],
        ambulanceDetails: 'GVK-EMRI Ambulance KA-01-AB-1234',
        earnedBadges: earnedBadgesForPDF,  // Phase 13: include badges in PDF
      };

      const pdfUri = await pdfGenerator.generateRewardClaim(demoData);
      if (pdfUri) {
        await pdfGenerator.sharePDF(pdfUri);
      } else {
        Alert.alert('Error', 'Could not generate PDF. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'PDF generation failed: ' + String(error));
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await rakshakService.logout();
          router.replace('/rakshak-login');
        }
      }
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.brand.primary} />
        <Text style={styles.loadingText}>Loading your profile...</Text>
      </View>
    );
  }

  const verificationColor = {
    verified: Colors.status.success,
    pending: Colors.status.warning,
    rejected: Colors.status.danger,
  }[profile?.verificationStatus || 'pending'];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome,</Text>
          <Text style={styles.name}>{profile?.name}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={22} color={Colors.label.secondary} />
        </TouchableOpacity>
      </View>

      {/* Verification Status Card */}
      <View style={[styles.statusCard, { borderColor: `${verificationColor}40` }]}>
        <View style={[styles.statusDot, { backgroundColor: verificationColor }]} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.statusTitle, { color: verificationColor }]}>
            {profile?.verificationStatus === 'verified' ? '✓ Verified Rakshak' :
             profile?.verificationStatus === 'pending' ? '⏳ Verification Pending' : '✗ Verification Rejected'}
          </Text>
          <Text style={styles.statusSub}>
            {profile?.verificationStatus === 'verified'
              ? 'You are receiving emergency alerts'
              : profile?.verificationStatus === 'pending'
              ? 'Your certificate is being reviewed. Usually 24-48 hours.'
              : 'Please contact support to re-submit your certificate.'}
          </Text>
        </View>
        <Ionicons name="ribbon" size={28} color={verificationColor} />
      </View>

      {/* Active Alert Toggle */}
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Receive Alerts</Text>
            <Text style={styles.cardSubtitle}>
              {profile?.isActive
                ? 'You will receive crash alerts within 2km'
                : 'Alerts are paused — toggle to resume'}
            </Text>
          </View>
          <Switch
            value={profile?.isActive ?? true}
            onValueChange={handleToggleActive}
            trackColor={{ false: Colors.background.secondary, true: `${Colors.status.success}60` }}
            thumbColor={profile?.isActive ? Colors.status.success : Colors.label.tertiary}
          />
        </View>
      </View>

      {/* Certificate Info */}
      <View style={styles.card}>
        <Text style={styles.cardSectionTitle}>YOUR CERTIFICATE</Text>
        <View style={styles.certRow}>
          <Ionicons name="medal-outline" size={20} color={Colors.brand.gold} />
          <Text style={styles.certText}>
            {profile?.certificateType?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </Text>
        </View>
      </View>

      {/* Actions */}
      <Text style={styles.sectionHeader}>ACTIONS</Text>

      {/* Test Push Notification */}
      <TouchableOpacity
        style={styles.actionCard}
        onPress={handleTestAlert}
        disabled={testingAlert}
      >
        <View style={[styles.actionIcon, { backgroundColor: `${Colors.brand.primary}15` }]}>
          <Ionicons name="notifications" size={22} color={Colors.brand.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>Test Alert Notification</Text>
          <Text style={styles.actionSub}>Simulate receiving a crash alert</Text>
        </View>
        {testingAlert
          ? <ActivityIndicator size="small" color={Colors.brand.primary} />
          : <Ionicons name="chevron-forward" size={16} color={Colors.label.tertiary} />
        }
      </TouchableOpacity>

      {/* Generate PDF */}
      <TouchableOpacity
        style={styles.actionCard}
        onPress={handleGenerateDemoPDF}
        disabled={generatingPDF}
      >
        <View style={[styles.actionIcon, { backgroundColor: `${Colors.brand.gold}15` }]}>
          <Ionicons name="document-text" size={22} color={Colors.brand.gold} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>Generate Reward Claim PDF</Text>
          <Text style={styles.actionSub}>₹25,000 Good Samaritan claim document</Text>
        </View>
        {generatingPDF
          ? <ActivityIndicator size="small" color={Colors.brand.gold} />
          : <Ionicons name="chevron-forward" size={16} color={Colors.label.tertiary} />
        }
      </TouchableOpacity>

      {/* ── Phase 13: Badge Gallery ──────────────────────────────────── */}
      <Text style={styles.sectionHeader}>BADGES & TRUST</Text>
      <BadgeGallery />

      {/* ── Phase 13: Track My Claim ────────────────────────────────── */}
      <TouchableOpacity
        style={styles.actionCard}
        onPress={handleTrackClaims}
      >
        <View style={[styles.actionIcon, { backgroundColor: `${Colors.status.success}15` }]}>
          <Ionicons name="analytics" size={22} color={Colors.status.success} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>Track My Claim</Text>
          <Text style={styles.actionSub}>Monitor your ₹25,000 reward claim status</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.label.tertiary} />
      </TouchableOpacity>

      {/* How it works info */}
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>How Rakshak Alerts Work</Text>
        <Text style={styles.infoText}>
          1. A crash is detected near your location{'\n'}
          2. You receive a push notification with distance and injury type{'\n'}
          3. Tap to navigate to the scene{'\n'}
          4. Help the victim and log interventions{'\n'}
          5. Generate PDF and claim ₹25,000 reward
        </Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background.primary, gap: 12 },
  loadingText: { fontSize: 14, color: Colors.label.secondary },
  container: { flex: 1, backgroundColor: Colors.background.primary },
  content: { paddingTop: Layout.STATUS_BAR_HEIGHT + 8, paddingHorizontal: 20, paddingBottom: Layout.CONTENT_BOTTOM_PADDING },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  greeting: { fontSize: 14, color: Colors.label.secondary, letterSpacing: -0.2 },
  name: { fontSize: 32, fontWeight: '800', color: Colors.label.primary, letterSpacing: -1 },
  logoutBtn: { padding: 8 },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.xl,
    padding: 16,
    borderWidth: 1.5,
    marginBottom: 14,
    ...Shadows.sm,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusTitle: { fontSize: 15, fontWeight: '700', marginBottom: 3 },
  statusSub: { fontSize: 12, color: Colors.label.secondary, lineHeight: 17 },
  card: {
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.xl,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    ...Shadows.xs,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.label.primary, letterSpacing: -0.2 },
  cardSubtitle: { fontSize: 13, color: Colors.label.secondary, marginTop: 4 },
  cardSectionTitle: { fontSize: 10, fontWeight: '700', color: Colors.label.tertiary, letterSpacing: 1.5, marginBottom: 12 },
  certRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  certText: { fontSize: 16, color: Colors.label.primary, fontWeight: '600' },
  sectionHeader: { fontSize: 10, fontWeight: '700', color: Colors.label.secondary, letterSpacing: 1.5, marginBottom: 12, marginTop: 8 },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.xl,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    ...Shadows.xs,
  },
  actionIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontSize: 15, fontWeight: '700', color: Colors.label.primary, letterSpacing: -0.2 },
  actionSub: { fontSize: 13, color: Colors.label.secondary, marginTop: 3 },
  infoBox: {
    backgroundColor: `${Colors.brand.accent}08`,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: `${Colors.brand.accent}20`,
    padding: 16,
    marginTop: 8,
  },
  infoTitle: { fontSize: 13, fontWeight: '700', color: Colors.brand.accent, marginBottom: 8 },
  infoText: { fontSize: 13, color: Colors.label.secondary, lineHeight: 22 },
});