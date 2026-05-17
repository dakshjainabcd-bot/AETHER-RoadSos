// app/(tabs)/rakshak.tsx
/**
 * Rakshak Tab — Entry point for the Rakshak Network
 * Checks if user is logged in, shows appropriate screen
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Layout, Shadows } from '../../theme';
import { rakshakService } from '../../services/Rakshak/RakshakService';

export default function RakshakTab() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const unsub = rakshakService.onAuthStateChange((user) => {
      setIsLoggedIn(!!user);
      setCheckingAuth(false);
    });
    return () => unsub();
  }, []);

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
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.heroEmoji}>🛡️</Text>
        <Text style={styles.heroTitle}>Rakshak Network</Text>
        <Text style={styles.heroSubtitle}>
          Join India's certified first-aid volunteer network. Get alerts when accidents happen near you. Save lives. Claim ₹25,000.
        </Text>
      </View>

      <View style={styles.benefits}>
        {[
          { icon: 'notifications', text: 'Get crash alerts within 2km' },
          { icon: 'navigate', text: 'Navigate directly to the scene' },
          { icon: 'shield-checkmark', text: 'Protected by Good Samaritan Law' },
          { icon: 'cash', text: '₹25,000 reward per successful rescue' },
        ].map((item, i) => (
          <View key={i} style={styles.benefitRow}>
            <Ionicons name={item.icon as any} size={18} color={Colors.brand.primary} />
            <Text style={styles.benefitText}>{item.text}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={styles.registerBtn}
        onPress={() => router.push('/rakshak-register')}
      >
        <Text style={styles.registerBtnText}>Join Rakshak Network →</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.loginLink}
        onPress={() => router.push('/rakshak-login')}
      >
        <Text style={styles.loginLinkText}>Already registered? <Text style={{ color: Colors.brand.primary }}>Login</Text></Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: Colors.background.grouped, paddingTop: Layout.STATUS_BAR_HEIGHT + 8, paddingHorizontal: 24 },
  hero: { alignItems: 'center', paddingVertical: 32 },
  heroEmoji: { fontSize: 64, marginBottom: 12 },
  heroTitle: { fontSize: 28, fontWeight: '700', color: Colors.label.primary, letterSpacing: -0.5, marginBottom: 12 },
  heroSubtitle: { fontSize: 15, color: Colors.label.secondary, textAlign: 'center', lineHeight: 22 },
  benefits: { backgroundColor: Colors.background.elevated, borderRadius: BorderRadius.xl, padding: 20, gap: 14, marginBottom: 24, ...Shadows.sm },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  benefitText: { fontSize: 14, color: Colors.label.primary },
  registerBtn: { backgroundColor: Colors.brand.primary, borderRadius: BorderRadius.xl, paddingVertical: 16, alignItems: 'center', ...Shadows.sm },
  registerBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  loginLink: { alignItems: 'center', paddingVertical: 16 },
  loginLinkText: { fontSize: 14, color: Colors.label.secondary },
});