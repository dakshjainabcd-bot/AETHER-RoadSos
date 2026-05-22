/**
 * badge-certificate.tsx — Badge Detail & Share Screen
 *
 * Reached by tapping an earned badge in BadgeGallery.
 * Shows the badge in full detail with sharing options.
 *
 * Navigation: router.push({ pathname: '/badge-certificate', params: { badgeId: '...' } })
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { getBadgeById, BadgeId } from '../services/Trust/BadgeTypes';
import { badgeService, EarnedBadge } from '../services/Trust/BadgeService';
import { Colors, BorderRadius, Shadows, Layout } from '../theme';

export default function BadgeCertificateScreen() {
  const params = useLocalSearchParams<{ badgeId: string }>();
  const [earnedBadge, setEarnedBadge] = useState<EarnedBadge | null>(null);
  const [sharing, setSharing] = useState(false);

  const badgeId = params.badgeId as BadgeId;
  const badgeDef = getBadgeById(badgeId);

  useEffect(() => {
    if (!badgeId) return;
    badgeService.getEarnedBadge(badgeId).then(setEarnedBadge);
  }, [badgeId]);

  if (!badgeDef) {
    return (
      <View style={styles.errorWrap}>
        <Text style={styles.errorText}>Badge not found.</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: Colors.brand.accent }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const earnedDate = earnedBadge
    ? new Date(earnedBadge.earnedAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : 'Not yet earned';

  const handleShare = async () => {
    if (!earnedBadge) return;
    setSharing(true);
    try {
      // Generate a simple HTML badge certificate and convert to PDF
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: 'Georgia', serif; margin: 0; padding: 40px; background: #FFF8E1; }
            .border { border: 6px double #FFD700; padding: 30px; border-radius: 12px; text-align: center; }
            .title { font-size: 14px; letter-spacing: 3px; color: #888; text-transform: uppercase; }
            .main { font-size: 28px; font-weight: bold; color: #333; margin: 10px 0; }
            .badge-name { font-size: 22px; color: #FFD700; margin: 8px 0; }
            .desc { font-size: 14px; color: #555; line-height: 1.6; max-width: 400px; margin: 10px auto; }
            .date { font-size: 13px; color: #888; margin-top: 20px; }
            .aether { font-size: 11px; color: #AAA; margin-top: 30px; letter-spacing: 2px; }
          </style>
        </head>
        <body>
          <div class="border">
            <p class="title">AETHER Emergency Response Network</p>
            <p class="main">Certificate of Achievement</p>
            <p style="font-size: 40px; margin: 10px 0;">${
              badgeDef.id === 'first_responder'
                ? '⚡'
                : badgeDef.id === 'cpr_hero'
                ? '❤️'
                : badgeDef.id === 'relay_node'
                ? '📡'
                : badgeDef.id === 'blackspot_reporter'
                ? '⚠️'
                : badgeDef.id === 'multilingual_helper'
                ? '🌐'
                : badgeDef.id === 'evidence_witness'
                ? '🛡️'
                : badgeDef.id === 'safe_driver'
                ? '🚗'
                : '🏅'
            }</p>
            <p class="badge-name">${badgeDef.name}</p>
            <p class="desc">${badgeDef.description}</p>
            <p class="date">Earned on ${earnedDate}</p>
            <p class="aether">AETHER — Accident Emergency & Trauma Hyper-Response</p>
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();

      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Share ${badgeDef.name} Badge`,
        });
      } else {
        // Fallback to native Share sheet (text only)
        await Share.share({
          message: `I earned the "${badgeDef.name}" badge on AETHER!\n${badgeDef.description}\nEarned: ${earnedDate}`,
          title: `AETHER Badge: ${badgeDef.name}`,
        });
      }
    } catch (err) {
      Alert.alert('Share Error', 'Could not share the badge. Please try again.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {/* Back Button */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={20} color={Colors.label.primary} />
        <Text style={styles.backText}>Badges</Text>
      </TouchableOpacity>

      {/* Badge Hero Section */}
      <View style={[styles.heroCard, { borderColor: `${badgeDef.color}50` }]}>
        {/* Icon */}
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: `${badgeDef.color}20` },
          ]}
        >
          <Ionicons name={badgeDef.icon as any} size={48} color={badgeDef.color} />
        </View>

        {/* Gold star */}
        <View style={[styles.goldStar, { backgroundColor: badgeDef.color }]}>
          <Ionicons name="star" size={14} color="#FFF" />
        </View>

        {/* Badge name */}
        <Text style={[styles.badgeName, { color: badgeDef.color }]}>
          {badgeDef.name}
        </Text>

        {/* Earned date */}
        <Text style={styles.earnedOn}>EARNED</Text>
        <Text style={styles.earnedDate}>{earnedDate}</Text>
      </View>

      {/* Description */}
      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>WHAT THIS MEANS</Text>
        <Text style={styles.infoText}>{badgeDef.description}</Text>
      </View>

      {/* How to earn (for reference) */}
      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>HOW IT WAS EARNED</Text>
        <Text style={styles.infoText}>{badgeDef.howToEarn}</Text>
      </View>

      {/* Legal note for Lifesaver / CPR Hero */}
      {(badgeId === 'lifesaver' || badgeId === 'first_responder') && (
        <View style={styles.legalNote}>
          <Ionicons name="shield-checkmark" size={14} color={Colors.brand.gold} />
          <Text style={styles.legalText}>
            This badge can support your ₹25,000 Good Samaritan reward claim
            under Motor Vehicles Act, Section 134A (2015).
          </Text>
        </View>
      )}

      {/* Share Button */}
      <TouchableOpacity
        style={[styles.shareBtn, { backgroundColor: badgeDef.color }]}
        onPress={handleShare}
        disabled={sharing}
      >
        {sharing ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <>
            <Ionicons name="share-social" size={18} color="#FFF" />
            <Text style={styles.shareBtnText}>Share Badge Certificate</Text>
          </>
        )}
      </TouchableOpacity>

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
  },

  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 16, color: Colors.label.secondary },

  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  backText: { fontSize: 15, color: Colors.label.primary, fontWeight: '500' },

  // Hero card
  heroCard: {
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    padding: 28,
    alignItems: 'center',
    gap: 8,
    ...Shadows.sm,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  goldStar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: Colors.background.elevated,
  },
  badgeName: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginTop: 4,
  },
  earnedOn: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.label.tertiary,
    letterSpacing: 1.5,
    marginTop: 8,
  },
  earnedDate: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.label.primary,
  },

  // Info cards
  infoCard: {
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.xl,
    padding: 16,
    gap: 8,
    ...Shadows.xs,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.label.tertiary,
    letterSpacing: 1,
  },
  infoText: {
    fontSize: 14,
    color: Colors.label.primary,
    lineHeight: 21,
  },

  // Legal note
  legalNote: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: `${Colors.brand.gold}10`,
    borderRadius: BorderRadius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: `${Colors.brand.gold}30`,
    alignItems: 'flex-start',
  },
  legalText: {
    flex: 1,
    fontSize: 12,
    color: Colors.label.secondary,
    lineHeight: 18,
  },

  // Share button
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: BorderRadius.xl,
    paddingVertical: 16,
    ...Shadows.sm,
    marginTop: 8,
  },
  shareBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
});