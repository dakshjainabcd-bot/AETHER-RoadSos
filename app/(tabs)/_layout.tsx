// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '../../theme';
import { useEffect, useRef } from 'react';

// ── Animated SOS Button ───────────────────────────────────────────────────────

function SOSButton({ onPress }: { onPress?: (e: any) => void }) {
  const pulse1 = useRef(new Animated.Value(1)).current;
  const pulse2 = useRef(new Animated.Value(1)).current;
  const pulse3 = useRef(new Animated.Value(1)).current;
  const opacity1 = useRef(new Animated.Value(0.6)).current;
  const opacity2 = useRef(new Animated.Value(0.4)).current;
  const opacity3 = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    // Three ripple rings with staggered delays
    const createRipple = (
      scale: Animated.Value,
      opacity: Animated.Value,
      delay: number
    ) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(scale, {
              toValue: 2.2,
              duration: 2000,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 2000,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(scale, {
              toValue: 1,
              duration: 0,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0.5,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        ])
      );

    const anim1 = createRipple(pulse1, opacity1, 0);
    const anim2 = createRipple(pulse2, opacity2, 600);
    const anim3 = createRipple(pulse3, opacity3, 1200);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, []);

  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.sosTouchable}
      activeOpacity={0.85}
    >
      {/* Ripple rings */}
      <Animated.View
        style={[
          styles.rippleRing,
          { transform: [{ scale: pulse1 }], opacity: opacity1 },
        ]}
      />
      <Animated.View
        style={[
          styles.rippleRing,
          { transform: [{ scale: pulse2 }], opacity: opacity2 },
        ]}
      />
      <Animated.View
        style={[
          styles.rippleRing,
          { transform: [{ scale: pulse3 }], opacity: opacity3 },
        ]}
      />

      {/* Main SOS button */}
      <View style={styles.sosButtonOuter}>
        <View style={styles.sosButtonInner}>
          <Text style={styles.sosText}>SOS</Text>
        </View>
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
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (focused) {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.2,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [focused]);

  return (
    <Animated.View
      style={[
        styles.tabIcon,
        focused && styles.tabIconActive,
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      <Ionicons name={name as any} size={22} color={color} />
    </Animated.View>
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
          bottom: 20,
          left: 16,
          right: 16,
          borderRadius: 36,
          height: 70,
          backgroundColor: 'rgba(255, 255, 255, 0.97)',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.15,
          shadowRadius: 30,
          elevation: 30,
          borderTopWidth: 0,
          paddingHorizontal: 8,
        },
        tabBarItemStyle: {
          height: 70,
          paddingVertical: 0,
        },
        tabBarActiveTintColor: Colors.brand.primary,
        tabBarInactiveTintColor: 'rgba(60, 60, 67, 0.35)',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: -0.1,
          marginTop: -4,
          marginBottom: 6,
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
    </Tabs>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Tab icon wrapper
  tabIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  tabIconActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.08)',
  },

  // SOS Button
  sosTouchable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -36, // Lifts button above tab bar
  },
  rippleRing: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FF3B30',
  },
  sosButtonOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 59, 48, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 16,
  },
  sosText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
});