/**
 * Tabs Layout — Bottom Navigation Bar
 *
 * WHY TABS?
 * In emergencies, users need to reach any function in ONE tap.
 * A tab bar shows all 5 sections permanently at the bottom.
 * No hidden menus, no back buttons during a crisis.
 *
 * 5 TABS:
 * 1. Home      — Emergency numbers, quick SOS trigger
 * 2. SOS       — Active SOS button (Phase 3 crash detection lives here)
 * 3. Services  — Find hospital / police / towing
 * 4. Map       — Visual map with POI pins
 * 5. Settings  — Language, country, preferences
 */

import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '../../theme';

// Tab configuration — each tab has a name, icon, and label
const TAB_CONFIG = [
  {
    name: 'index',
    label: 'Home',
    icon: 'home',
    activeIcon: 'home',
  },
  {
    name: 'sos',
    label: 'SOS',
    icon: 'warning-outline',
    activeIcon: 'warning',
    isEmergency: true,  // Special styling for the SOS tab
  },
  {
    name: 'services',
    label: 'Services',
    icon: 'search-outline',
    activeIcon: 'search',
  },
  {
    name: 'map',
    label: 'Map',
    icon: 'map-outline',
    activeIcon: 'map',
  },
  {
    name: 'settings',
    label: 'Settings',
    icon: 'settings-outline',
    activeIcon: 'settings',
  },
] as const;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Custom tab bar styling
        tabBarStyle: {
          backgroundColor: Colors.background.secondary,
          borderTopColor: Colors.border.subtle,
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 16,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.brand.primary,
        tabBarInactiveTintColor: Colors.text.muted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.5,
          marginTop: 2,
        },
      }}
    >
      {/* Home Tab */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />

      {/* SOS Tab — Special emergency styling */}
      <Tabs.Screen
        name="sos"
        options={{
          title: 'SOS',
          tabBarIcon: ({ focused }) => (
            <View style={styles.sosTabIcon}>
              <Ionicons
                name={focused ? 'warning' : 'warning-outline'}
                size={22}
                color="#FFFFFF"
              />
            </View>
          ),
          tabBarLabel: ({ focused }) => (
            <Text style={[styles.sosTabLabel, focused && styles.sosTabLabelActive]}>
              SOS
            </Text>
          ),
        }}
      />

      {/* Services Tab */}
      <Tabs.Screen
        name="services"
        options={{
          title: 'Services',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'search' : 'search-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />

      {/* Map Tab */}
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'map' : 'map-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />

      {/* Settings Tab */}
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'settings' : 'settings-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // SOS button is a red circle in the tab bar — stands out
  sosTabIcon: {
    backgroundColor: Colors.brand.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    // Glow effect
    shadowColor: Colors.brand.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  sosTabLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.brand.primary,
    letterSpacing: 0.5,
  },
  sosTabLabelActive: {
    color: Colors.brand.primary,
  },
});
