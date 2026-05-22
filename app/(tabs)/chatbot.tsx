/**
 * Chatbot Tab Screen — Phase 11
 *
 * A dedicated full-screen AI first-aid chatbot.
 * Accessible from the Settings screen and from the BystAI flow.
 *
 * This screen wraps PocketRAGChat in a proper screen layout
 * with a header, back button, and connection status indicator.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNetworkStatus } from '../../services/NetworkMonitor';
import { PocketRAGChat } from '../../components/PocketRAGChat';
import { Colors, Layout, BorderRadius, Shadows } from '../../theme';

export default function ChatbotScreen() {
  const { isConnected } = useNetworkStatus();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.brand.primary} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.logoWrap}>
            <Ionicons name="medical" size={14} color={Colors.brand.primary} />
          </View>
          <View>
            <Text style={styles.headerTitle}>AI First-Aid Assistant</Text>
            <Text style={styles.headerSubtitle}>Pocket RAG · Phase 11</Text>
          </View>
        </View>

        {/* Online/Offline indicator */}
        <View style={[
          styles.connBadge,
          { backgroundColor: isConnected ? `${Colors.status.success}15` : `${Colors.label.tertiary}15` }
        ]}>
          <View style={[
            styles.connDot,
            { backgroundColor: isConnected ? Colors.status.success : Colors.label.tertiary }
          ]} />
          <Text style={[
            styles.connText,
            { color: isConnected ? Colors.status.success : Colors.label.tertiary }
          ]}>
            {isConnected ? 'AI+' : 'Offline'}
          </Text>
        </View>
      </View>

      {/* Info banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="shield-checkmark-outline" size={13} color={Colors.status.info} />
        <Text style={styles.infoText}>
          {isConnected
            ? 'Using Gemini AI with verified knowledge base for accurate answers'
            : 'Offline mode — answering from bundled first-aid knowledge base'}
        </Text>
      </View>

      {/* Chat component */}
      <PocketRAGChat />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    paddingTop: Layout.STATUS_BAR_HEIGHT,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.background.elevated,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border.subtle,
    gap: 8,
    ...Shadows.xs,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: Colors.soft.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.label.primary,
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 10,
    color: Colors.label.tertiary,
    letterSpacing: 0.3,
  },
  connBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  connDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  connText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Info banner
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: `${Colors.status.info}08`,
    borderBottomWidth: 0.5,
    borderBottomColor: `${Colors.status.info}20`,
  },
  infoText: {
    flex: 1,
    fontSize: 11,
    color: Colors.status.info,
    lineHeight: 16,
  },
});