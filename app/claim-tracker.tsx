/**
 * claim-tracker.tsx — Track ₹25,000 Good Samaritan Reward Claims
 *
 * Shows all submitted claims with status timeline.
 * Users can manually update status when they hear from the authority.
 *
 * Navigation: router.push('/claim-tracker')
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  badgeService,
  ClaimRecord,
  ClaimStatus,
} from '../services/Trust/BadgeService';
import { Colors, BorderRadius, Shadows, Layout } from '../theme';

// Status display config: color, icon, label for each status
const STATUS_CONFIG: Record<
  ClaimStatus,
  { color: string; icon: string; label: string; description: string }
> = {
  submitted: {
    color: Colors.brand.accent,
    icon: 'send',
    label: 'Submitted',
    description: 'Claim PDF has been generated. Submit it to your district collector or MORTH.',
  },
  acknowledged: {
    color: Colors.brand.gold,
    icon: 'mail-open',
    label: 'Acknowledged',
    description: 'The authority has confirmed receipt of your claim.',
  },
  in_progress: {
    color: Colors.brand.purple,
    icon: 'hourglass',
    label: 'In Progress',
    description: 'Your claim is being processed. Typical time: 30–60 days.',
  },
  completed: {
    color: Colors.status.success,
    icon: 'checkmark-circle',
    label: 'Completed',
    description: 'Congratulations! Your ₹25,000 reward has been approved.',
  },
  rejected: {
    color: Colors.brand.primary,
    icon: 'close-circle',
    label: 'Rejected',
    description: 'Your claim was not approved. Consider re-filing with more evidence.',
  },
};

// The ordered steps for the status timeline
const STATUS_STEPS: ClaimStatus[] = [
  'submitted',
  'acknowledged',
  'in_progress',
  'completed',
];

export default function ClaimTrackerScreen() {
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null); // incidentId being updated

  const loadClaims = useCallback(async () => {
    try {
      const records = await badgeService.getClaimRecords();
      // Sort newest first
      setClaims(records.sort((a, b) => b.submittedAt - a.submittedAt));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClaims();
  }, [loadClaims]);

  const handleUpdateStatus = (claim: ClaimRecord) => {
    // Show a dialog letting user manually update the status
    Alert.alert(
      'Update Claim Status',
      'Has the authority responded to your claim?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Acknowledged',
          onPress: () => updateStatus(claim.incidentId, 'acknowledged'),
        },
        {
          text: 'In Progress',
          onPress: () => updateStatus(claim.incidentId, 'in_progress'),
        },
        {
          text: 'Completed ✓',
          onPress: () => updateStatus(claim.incidentId, 'completed'),
        },
        {
          text: 'Rejected ✗',
          style: 'destructive',
          onPress: () => updateStatus(claim.incidentId, 'rejected'),
        },
      ]
    );
  };

  const updateStatus = async (incidentId: string, status: ClaimStatus) => {
    setUpdating(incidentId);
    try {
      await badgeService.updateClaimStatus(incidentId, status);
      await loadClaims(); // Refresh
    } finally {
      setUpdating(null);
    }
  };

  const handleEscalate = () => {
    // Open MORTH grievance portal
    Alert.alert(
      'Escalate Claim',
      'You can file a grievance on the MORTH portal if your claim has not been acknowledged within 30 days.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open MORTH Portal',
          onPress: () =>
            Linking.openURL('https://cgrs.nhai.gov.in/').catch(() =>
              Alert.alert('Could not open browser.')
            ),
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={Colors.brand.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.label.primary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Claim Tracker</Text>
          <Text style={styles.subtitle}>₹25,000 Good Samaritan Reward Claims</Text>
        </View>
      </View>

      {/* Info box */}
      <View style={styles.infoBox}>
        <Ionicons name="information-circle-outline" size={16} color={Colors.brand.accent} />
        <Text style={styles.infoText}>
          Under Motor Vehicles Act Section 134A, Good Samaritans are eligible
          for a ₹25,000 reward. Generate a claim PDF from the Rakshak Dashboard,
          then submit it to your district authority.
        </Text>
      </View>

      {/* No claims yet */}
      {claims.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={48} color={Colors.label.tertiary} />
          <Text style={styles.emptyTitle}>No Claims Yet</Text>
          <Text style={styles.emptyDesc}>
            Generate a reward claim PDF from the Rakshak Dashboard after helping
            a crash victim.
          </Text>
          <TouchableOpacity
            style={styles.goToRakshakBtn}
            onPress={() => router.push('/rakshak-dashboard')}
          >
            <Text style={styles.goToRakshakText}>Open Rakshak Dashboard →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Claims list */}
      {claims.map((claim) => {
        const statusConfig = STATUS_CONFIG[claim.status];
        const currentStepIndex = STATUS_STEPS.indexOf(
          claim.status === 'rejected' ? 'submitted' : claim.status
        );
        const daysSinceSubmission = Math.floor(
          (Date.now() - claim.submittedAt) / (1000 * 60 * 60 * 24)
        );

        return (
          <View key={claim.incidentId} style={styles.claimCard}>
            {/* Claim Header */}
            <View style={styles.claimHeader}>
              <View>
                <Text style={styles.claimId}>
                  Incident: {claim.incidentId.substring(0, 12).toUpperCase()}...
                </Text>
                <Text style={styles.claimDate}>
                  Submitted:{' '}
                  {new Date(claim.submittedAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                  {' · '}{daysSinceSubmission} days ago
                </Text>
              </View>
              <View style={styles.claimAmount}>
                <Text style={styles.amountText}>₹{claim.claimAmount.toLocaleString('en-IN')}</Text>
              </View>
            </View>

            {/* Status Timeline (horizontal steps) */}
            {claim.status !== 'rejected' ? (
              <View style={styles.timeline}>
                {STATUS_STEPS.map((step, index) => {
                  const stepConfig = STATUS_CONFIG[step];
                  const isCompleted = index <= currentStepIndex;
                  const isCurrent = index === currentStepIndex;
                  return (
                    <React.Fragment key={step}>
                      <View style={styles.timelineStep}>
                        <View
                          style={[
                            styles.timelineDot,
                            {
                              backgroundColor: isCompleted
                                ? stepConfig.color
                                : Colors.fill.tertiary,
                              borderColor: isCurrent
                                ? stepConfig.color
                                : 'transparent',
                            },
                          ]}
                        >
                          {isCompleted && (
                            <Ionicons name="checkmark" size={10} color="#FFF" />
                          )}
                        </View>
                        <Text
                          style={[
                            styles.timelineLabel,
                            { color: isCompleted ? stepConfig.color : Colors.label.tertiary },
                          ]}
                        >
                          {stepConfig.label}
                        </Text>
                      </View>
                      {index < STATUS_STEPS.length - 1 && (
                        <View
                          style={[
                            styles.timelineLine,
                            {
                              backgroundColor:
                                index < currentStepIndex
                                  ? Colors.status.success
                                  : Colors.fill.tertiary,
                            },
                          ]}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </View>
            ) : (
              <View style={[styles.rejectedBanner]}>
                <Ionicons name="close-circle" size={16} color={Colors.brand.primary} />
                <Text style={styles.rejectedText}>
                  Claim rejected. Consider re-filing with more evidence or
                  appealing to a higher authority.
                </Text>
              </View>
            )}

            {/* Status Description */}
            <Text style={styles.statusDesc}>{statusConfig.description}</Text>

            {/* Actions */}
            <View style={styles.claimActions}>
              {/* Update Status */}
              {claim.status !== 'completed' && claim.status !== 'rejected' && (
                <TouchableOpacity
                  style={styles.updateBtn}
                  onPress={() => handleUpdateStatus(claim)}
                  disabled={updating === claim.incidentId}
                >
                  {updating === claim.incidentId ? (
                    <ActivityIndicator size="small" color={Colors.brand.accent} />
                  ) : (
                    <>
                      <Ionicons
                        name="refresh"
                        size={13}
                        color={Colors.brand.accent}
                      />
                      <Text style={styles.updateBtnText}>Update Status</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {/* Escalate if no reply in 30+ days */}
              {daysSinceSubmission >= 30 &&
                claim.status === 'submitted' && (
                  <TouchableOpacity
                    style={styles.escalateBtn}
                    onPress={handleEscalate}
                  >
                    <Ionicons
                      name="alert-circle-outline"
                      size={13}
                      color={Colors.brand.gold}
                    />
                    <Text style={styles.escalateBtnText}>Escalate</Text>
                  </TouchableOpacity>
                )}
            </View>
          </View>
        );
      })}

      <View style={{ height: Layout.CONTENT_BOTTOM_PADDING }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background.grouped },
  content: {
    paddingTop: Layout.STATUS_BAR_HEIGHT + 8,
    paddingHorizontal: 20,
    gap: 14,
    paddingBottom: Layout.CONTENT_BOTTOM_PADDING,
  },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.fill.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.label.primary,
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 12, color: Colors.label.secondary },

  infoBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: `${Colors.brand.accent}10`,
    borderRadius: BorderRadius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: `${Colors.brand.accent}25`,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: Colors.label.secondary,
    lineHeight: 18,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.label.primary,
  },
  emptyDesc: {
    fontSize: 13,
    color: Colors.label.secondary,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 280,
  },
  goToRakshakBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.brand.primary,
    borderRadius: BorderRadius.xl,
  },
  goToRakshakText: { fontSize: 14, fontWeight: '700', color: '#FFF' },

  // Claim Card
  claimCard: {
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.xl,
    padding: 16,
    gap: 12,
    ...Shadows.sm,
  },
  claimHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  claimId: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.label.primary,
    fontFamily: 'Courier',
  },
  claimDate: { fontSize: 11, color: Colors.label.tertiary, marginTop: 2 },
  claimAmount: {
    backgroundColor: `${Colors.status.success}15`,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  amountText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.status.success,
  },

  // Timeline
  timeline: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  timelineStep: { alignItems: 'center', gap: 4, flex: 0 },
  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  timelineLabel: {
    fontSize: 8,
    fontWeight: '600',
    textAlign: 'center',
    width: 56,
    letterSpacing: 0.3,
  },
  timelineLine: {
    flex: 1,
    height: 2,
    marginBottom: 14,
    marginHorizontal: 2,
  },

  // Rejected
  rejectedBanner: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: `${Colors.brand.primary}10`,
    borderRadius: BorderRadius.md,
    padding: 10,
    alignItems: 'flex-start',
  },
  rejectedText: {
    flex: 1,
    fontSize: 12,
    color: Colors.brand.primary,
    lineHeight: 17,
  },

  statusDesc: { fontSize: 12, color: Colors.label.secondary, lineHeight: 17 },

  claimActions: { flexDirection: 'row', gap: 10 },
  updateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: `${Colors.brand.accent}10`,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: `${Colors.brand.accent}25`,
  },
  updateBtnText: { fontSize: 12, fontWeight: '600', color: Colors.brand.accent },
  escalateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: `${Colors.brand.gold}10`,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: `${Colors.brand.gold}25`,
  },
  escalateBtnText: { fontSize: 12, fontWeight: '600', color: Colors.brand.gold },
});