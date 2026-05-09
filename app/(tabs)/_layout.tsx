/**
 * Tabs Layout — Floating Pill Bottom Navigation
 *
 * Premium iOS-style floating navigation bar.
 * Pill-shaped, white, shadow-elevated, floating above the screen edge.
 * SOS button is a prominent red circle in the center.
 */

import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '../../theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 24,
          left: 20,
          right: 20,
          borderRadius: BorderRadius.full,
          height: 72,
          backgroundColor: 'rgba(255, 255, 255, 0.96)',
          // Floating pill shadow
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.12,
          shadowRadius: 28,
          elevation: 24,
          borderTopWidth: 0,
          paddingHorizontal: 4,
        },
        tabBarItemStyle: {
          height: 72,
          paddingVertical: 0,
        },
        tabBarActiveTintColor: Colors.brand.primary,
        tabBarInactiveTintColor: 'rgba(60, 60, 67, 0.4)',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
          letterSpacing: -0.1,
          marginTop: -4,
        },
        tabBarShowLabel: true,
      }}
    >
      {/* Home */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIcon, focused && styles.tabIconActive]}>
              <Ionicons
                name={focused ? 'home' : 'home-outline'}
                size={22}
                color={color}
              />
            </View>
          ),
        }}
      />

      {/* Services */}
      <Tabs.Screen
        name="services"
        options={{
          title: 'Services',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIcon, focused && styles.tabIconActive]}>
              <Ionicons
                name={focused ? 'grid' : 'grid-outline'}
                size={21}
                color={color}
              />
            </View>
          ),
        }}
      />

      {/* SOS — Custom elevated red button */}
      <Tabs.Screen
        name="sos"
        options={{
          title: '',
          tabBarLabel: () => null,
          tabBarIcon: () => null,
          tabBarButton: (props) => (
            <TouchableOpacity
              onPress={props.onPress}
              style={styles.sosTouchable}
              activeOpacity={0.85}
            >
              <View style={styles.sosButtonOuter}>
                <View style={styles.sosButtonInner}>
                  <Text style={styles.sosText}>SOS</Text>
                </View>
              </View>
            </TouchableOpacity>
          ),
        }}
      />

      {/* Map */}
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIcon, focused && styles.tabIconActive]}>
              <Ionicons
                name={focused ? 'map' : 'map-outline'}
                size={22}
                color={color}
              />
            </View>
          ),
        }}
      />

      {/* Settings */}
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIcon, focused && styles.tabIconActive]}>
              <Ionicons
                name={focused ? 'settings' : 'settings-outline'}
                size={21}
                color={color}
              />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  tabIconActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.08)',
  },

  // SOS Button — floats above the nav bar via negative top margin
  sosTouchable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // Lift the button above the nav pill surface
    marginTop: -28,
  },
  sosButtonOuter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    // Glow shadow
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.40,
    shadowRadius: 14,
    elevation: 14,
  },
  sosText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
});