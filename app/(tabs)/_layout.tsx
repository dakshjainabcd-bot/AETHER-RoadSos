// app/(tabs)/_layout.tsx — Prototype-style flat bottom nav
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../theme';
import { useEffect, useRef } from 'react';

// ── Animated SOS Button ───────────────────────────────────────────────────────

function SOSButton({ onPress }: { onPress?: (e: any) => void }) {
  const ringScale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ringScale, {
            toValue: 1.55,
            duration: 2400,
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0,
            duration: 2400,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(ringScale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0.7, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.sosTouchable}
      activeOpacity={0.85}
    >
      {/* Ripple ring */}
      <Animated.View
        style={[
          styles.rippleRing,
          { transform: [{ scale: ringScale }], opacity: ringOpacity },
        ]}
      />

      {/* Main SOS button */}
      <View style={styles.sosButtonOuter}>
        <Text style={styles.sosText}>SOS</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Tab Icon ──────────────────────────────────────────────────────────────────

function TabIcon({
  name,
  focused,
  color,
}: {
  name: string;
  focused: boolean;
  color: string;
}) {
  return (
    <View style={styles.tabIcon}>
      <Ionicons name={name as any} size={22} color={color} />
    </View>
  );
}

// ── Main Layout ───────────────────────────────────────────────────────────────

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 82,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: Colors.border.medium,
          paddingBottom: 14,
          paddingHorizontal: 0,
          ...Shadows.nav,
        },
        tabBarItemStyle: {
          height: 68,
          paddingVertical: 0,
        },
        tabBarActiveTintColor: Colors.brand.primary,
        tabBarInactiveTintColor: Colors.label.muted,
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '700',
          letterSpacing: 1,
          textTransform: 'uppercase',
          marginTop: -2,
        },
        tabBarShowLabel: true,
      }}
    >
      {/* ── Tab 1: Home ─────────────────────────────── */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'home' : 'home-outline'}
              focused={focused}
              color={color}
            />
          ),
        }}
      />

      {/* ── Tab 2: Services ─────────────────────────── */}
      <Tabs.Screen
        name="services"
        options={{
          title: 'Services',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'grid' : 'grid-outline'}
              focused={focused}
              color={color}
            />
          ),
        }}
      />

      {/* ── Tab 3: SOS (Center) ─────────────────────── */}
      <Tabs.Screen
        name="sos"
        options={{
          title: '',
          tabBarLabel: () => null,
          tabBarIcon: () => null,
          tabBarButton: (props) => (
            <SOSButton onPress={props.onPress ?? undefined} />
          ),
        }}
      />

      {/* ── Tab 4: Map ──────────────────────────────── */}
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'map' : 'map-outline'}
              focused={focused}
              color={color}
            />
          ),
        }}
      />

      {/* ── Tab 5: Rakshak ──────────────────────────── */}
      <Tabs.Screen
        name="rakshak"
        options={{
          title: 'Rakshak',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'shield' : 'shield-outline'}
              focused={focused}
              color={color}
            />
          ),
        }}
      />

      {/* ── Hidden Tabs (still accessible via router.push) ── */}
      <Tabs.Screen name="multilingual" options={{ href: null }} />
      <Tabs.Screen name="blackbox" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      {/* ── PHASE 11: AI Chatbot (hidden tab, opened via router.push('/chatbot')) ── */}
      <Tabs.Screen name="chatbot" options={{ href: null }} />
    </Tabs>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  tabIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // SOS Button — prototype style
  sosTouchable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
  },
  rippleRing: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: 'rgba(239, 62, 40, 0.22)',
  },
  sosButtonOuter: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    ...Shadows.emergency,
  },
  sosText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
});