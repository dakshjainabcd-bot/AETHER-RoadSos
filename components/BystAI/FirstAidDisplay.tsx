/**
 * FirstAidDisplay — Step-by-Step First Aid Instructions
 *
 * Shows the protocol for the identified injury type.
 * Cards are color-coded: red for warnings/do-not, normal for actions.
 * "Do Not" section appears at the bottom in a danger-colored block.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Shadows } from '../../theme';
import { FirstAidProtocol } from '../../services/BystAI';

interface FirstAidDisplayProps {
  protocol: FirstAidProtocol;
  onStartCPR: () => void;
  onBack: () => void;
}

export function FirstAidDisplay({ protocol, onStartCPR, onBack }: FirstAidDisplayProps) {
  return (
    <View style={styles.container}>
      {/* Injury header */}
      <View style={[styles.header, { borderColor: `${protocol.iconColor}30` }]}>
        <View
          style={[
            styles.headerIcon,
            { backgroundColor: `${protocol.iconColor}20` },
          ]}
        >
          <Ionicons name={protocol.icon as any} size={28} color={protocol.iconColor} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.headerName, { color: protocol.iconColor }]}>
            {protocol.name}
          </Text>
          <Text style={styles.headerSubtitle}>{protocol.subtitle}</Text>
        </View>
        <View style={[styles.severityBadge, { backgroundColor: `${protocol.iconColor}20` }]}>
          <Text style={[styles.severityText, { color: protocol.iconColor }]}>
            SEV {protocol.severity}/5
          </Text>
        </View>
      </View>

      {/* Call ambulance banner */}
      {protocol.callAmbulance && (
        <View style={styles.callBanner}>
          <Ionicons name="call" size={16} color="#fff" />
          <Text style={styles.callBannerText}>Call 108 — Ambulance Required</Text>
        </View>
      )}

      {/* Steps */}
      <Text style={styles.sectionTitle}>FIRST AID STEPS</Text>
      <View style={styles.stepsContainer}>
        {protocol.steps.map((step, index) => (
          <View
            key={step.id}
            style={[
              styles.stepCard,
              step.warning && styles.stepCardWarning,
            ]}
          >
            <View
              style={[
                styles.stepNumber,
                step.warning
                  ? styles.stepNumberWarning
                  : styles.stepNumberNormal,
              ]}
            >
              {step.warning ? (
                <Ionicons name="warning" size={14} color="#fff" />
              ) : (
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              )}
            </View>
            <View style={styles.stepContent}>
              <Text
                style={[
                  styles.stepTitle,
                  step.warning && styles.stepTitleWarning,
                ]}
              >
                {step.title}
              </Text>
              <Text style={styles.stepDescription}>{step.description}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Do NOT section */}
      <Text style={styles.sectionTitle}>DO NOT</Text>
      <View style={styles.doNotCard}>
        {protocol.doNot.map((item, index) => (
          <View key={index} style={styles.doNotRow}>
            <Ionicons name="close-circle" size={16} color={Colors.brand.primary} />
            <Text style={styles.doNotText}>{item}</Text>
          </View>
        ))}
      </View>

      {/* CPR button for cardiac arrest */}
      {protocol.cprRequired && (
        <TouchableOpacity style={styles.cprBtn} onPress={onStartCPR}>
          <Ionicons name="fitness" size={20} color="#fff" />
          <Text style={styles.cprBtnText}>Open CPR Coach — Live Guidance</Text>
        </TouchableOpacity>
      )}

      {/* Back to assessment */}
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Ionicons name="arrow-back" size={14} color={Colors.label.secondary} />
        <Text style={styles.backBtnText}>Re-assess injury type</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.xl,
    padding: 16,
    borderWidth: 1,
    gap: 12,
    ...Shadows.sm,
  },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerName: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.label.secondary,
    marginTop: 2,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  severityText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Call ambulance banner
  callBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.brand.primary,
    borderRadius: BorderRadius.lg,
    padding: 12,
  },
  callBannerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },

  // Section title
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.label.secondary,
    letterSpacing: 1,
    marginTop: 4,
  },

  // Steps
  stepsContainer: {
    gap: 10,
  },
  stepCard: {
    flexDirection: 'row',
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.lg,
    padding: 14,
    gap: 12,
    alignItems: 'flex-start',
    ...Shadows.xs,
  },
  stepCardWarning: {
    backgroundColor: `${Colors.brand.primary}08`,
    borderWidth: 1,
    borderColor: `${Colors.brand.primary}25`,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNumberNormal: {
    backgroundColor: Colors.brand.accent,
  },
  stepNumberWarning: {
    backgroundColor: Colors.brand.primary,
  },
  stepNumberText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.label.primary,
    marginBottom: 4,
    letterSpacing: -0.1,
  },
  stepTitleWarning: {
    color: Colors.brand.primary,
  },
  stepDescription: {
    fontSize: 13,
    color: Colors.label.secondary,
    lineHeight: 19,
  },

  // Do Not section
  doNotCard: {
    backgroundColor: `${Colors.brand.primary}08`,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: `${Colors.brand.primary}20`,
    padding: 14,
    gap: 10,
  },
  doNotRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  doNotText: {
    flex: 1,
    fontSize: 13,
    color: Colors.label.primary,
    lineHeight: 18,
  },

  // CPR button
  cprBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.brand.primary,
    borderRadius: BorderRadius.xl,
    paddingVertical: 16,
    ...Shadows.sm,
  },
  cprBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },

  // Back button
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginBottom: 8,
  },
  backBtnText: {
    fontSize: 13,
    color: Colors.label.secondary,
  },
});