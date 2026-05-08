/**
 * Settings Screen — Language, Country, Preferences
 *
 * Vertical C: Manual country/emergency number override
 * Language selector: all 22 languages
 * Debug panel: shows GPS status, DB count, MCC (for development)
 */

import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppContext } from '../_layout';
import { getAllCountries, setManualCountry } from '../../services/MCCService';
import { getLastKnownLocation } from '../../services/GPSService';
import { getPoiCountByType } from '../../services/POIDatabase';
import { LANGUAGES, STORAGE_KEYS, type LanguageCode } from '../../utils/constants';
import { Colors, Spacing, BorderRadius, Shadows } from '../../theme';

export default function SettingsScreen() {
  const { emergencyNumbers, language, setLanguage } = useAppContext();

  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  const countries = getAllCountries();
  const currentLanguage = LANGUAGES.find(l => l.code === language);

  async function handleLanguageSelect(code: LanguageCode) {
    await setLanguage(code);
    setShowLanguagePicker(false);
  }

  async function handleCountrySelect(mcc: string, countryName: string) {
    try {
      const numbers = await setManualCountry(mcc);
      setShowCountryPicker(false);
      Alert.alert(
        'Country Updated',
        `Emergency numbers set for ${numbers.country}\nAmbulance: ${numbers.ambulance}\nPolice: ${numbers.police}`
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to update country settings');
    }
  }

  async function showDebugInfo() {
    const loc = await getLastKnownLocation();
    const dbCounts = await getPoiCountByType();
    const mcc = await AsyncStorage.getItem(STORAGE_KEYS.MCC);

    const info = [
      `MCC: ${mcc ?? 'Unknown'}`,
      `Country: ${emergencyNumbers.country} (${emergencyNumbers.country_code})`,
      `Ambulance: ${emergencyNumbers.ambulance}`,
      `Police: ${emergencyNumbers.police}`,
      `Language: ${language}`,
      '',
      `GPS: ${loc ? `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}` : 'None'}`,
      `GPS Accuracy: ${loc ? `±${Math.round(loc.accuracy)}m` : 'N/A'}`,
      `GPS Source: ${loc?.source ?? 'N/A'}`,
      '',
      'Database POI Counts:',
      ...Object.entries(dbCounts).map(([type, count]) => `  ${type}: ${count}`),
    ].join('\n');

    setDebugInfo(info);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      {/* Language Section */}
      <Text style={styles.sectionTitle}>Language</Text>
      <TouchableOpacity
        style={styles.settingRow}
        onPress={() => setShowLanguagePicker(true)}
      >
        <View style={styles.settingLeft}>
          <View style={[styles.settingIcon, { backgroundColor: Colors.brand.accent + '20' }]}>
            <Ionicons name="language" size={18} color={Colors.brand.accent} />
          </View>
          <View>
            <Text style={styles.settingLabel}>App Language</Text>
            <Text style={styles.settingValue}>
              {currentLanguage?.nativeName} ({currentLanguage?.name})
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.text.muted} />
      </TouchableOpacity>

      {/* Country/Emergency Numbers Section */}
      <Text style={styles.sectionTitle}>Emergency Numbers</Text>
      <TouchableOpacity
        style={styles.settingRow}
        onPress={() => setShowCountryPicker(true)}
      >
        <View style={styles.settingLeft}>
          <View style={[styles.settingIcon, { backgroundColor: Colors.brand.primary + '20' }]}>
            <Ionicons name="globe" size={18} color={Colors.brand.primary} />
          </View>
          <View>
            <Text style={styles.settingLabel}>Country Override</Text>
            <Text style={styles.settingValue}>
              {emergencyNumbers.country} — Ambulance: {emergencyNumbers.ambulance}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.text.muted} />
      </TouchableOpacity>

      {/* Current Emergency Numbers Display */}
      <View style={styles.emergencyDisplay}>
        <EmergencyRow label="Police" number={emergencyNumbers.police} color="#5856D6" />
        <EmergencyRow label="Ambulance" number={emergencyNumbers.ambulance} color={Colors.brand.primary} />
        <EmergencyRow label="Fire" number={emergencyNumbers.fire} color="#FF9500" />
        <EmergencyRow label="Universal" number={emergencyNumbers.unified} color="#34C759" />
      </View>

      {/* About Section */}
      <Text style={styles.sectionTitle}>About</Text>
      <View style={styles.settingRow}>
        <View style={styles.settingLeft}>
          <View style={[styles.settingIcon, { backgroundColor: Colors.text.muted + '20' }]}>
            <Ionicons name="information-circle" size={18} color={Colors.text.muted} />
          </View>
          <View>
            <Text style={styles.settingLabel}>AETHER</Text>
            <Text style={styles.settingValue}>Accident Emergency & Trauma Hyper-Response</Text>
            <Text style={styles.settingValue}>Version 1.0.0 — Phase 1</Text>
          </View>
        </View>
      </View>

      {/* Debug Panel */}
      <Text style={styles.sectionTitle}>Developer</Text>
      <TouchableOpacity style={styles.settingRow} onPress={showDebugInfo}>
        <View style={styles.settingLeft}>
          <View style={[styles.settingIcon, { backgroundColor: '#FFD700' + '20' }]}>
            <Ionicons name="bug" size={18} color="#FFD700" />
          </View>
          <Text style={styles.settingLabel}>Show Debug Info</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.text.muted} />
      </TouchableOpacity>

      {debugInfo && (
        <View style={styles.debugPanel}>
          <Text style={styles.debugText}>{debugInfo}</Text>
          <TouchableOpacity onPress={() => setDebugInfo(null)}>
            <Text style={styles.debugClose}>Close</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 40 }} />

      {/* Language Picker Modal */}
      <Modal visible={showLanguagePicker} animationType="slide">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Language</Text>
            <TouchableOpacity onPress={() => setShowLanguagePicker(false)}>
              <Ionicons name="close" size={24} color={Colors.text.primary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={LANGUAGES}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.pickerItem,
                  language === item.code && styles.pickerItemSelected,
                ]}
                onPress={() => handleLanguageSelect(item.code)}
              >
                <Text style={styles.pickerItemNative}>{item.nativeName}</Text>
                <Text style={styles.pickerItemLatin}>{item.name}</Text>
                {language === item.code && (
                  <Ionicons name="checkmark" size={18} color={Colors.brand.accent} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      {/* Country Picker Modal */}
      <Modal visible={showCountryPicker} animationType="slide">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Country</Text>
            <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
              <Ionicons name="close" size={24} color={Colors.text.primary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={countries}
            keyExtractor={(item) => item.mcc}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.pickerItem}
                onPress={() => handleCountrySelect(item.mcc, item.country)}
              >
                <Text style={styles.pickerItemNative}>{item.country}</Text>
                <Text style={styles.pickerItemLatin}>MCC: {item.mcc}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </ScrollView>
  );
}

function EmergencyRow({ label, number, color }: { label: string; number: string; color: string }) {
  return (
    <View style={styles.emergencyRow}>
      <Text style={styles.emergencyRowLabel}>{label}</Text>
      <Text style={[styles.emergencyRowNumber, { color }]}>{number}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.primary },
  content: { padding: Spacing.lg, paddingTop: 56 },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingLabel: { fontSize: 15, fontWeight: '600', color: Colors.text.primary },
  settingValue: { fontSize: 12, color: Colors.text.muted, marginTop: 2 },
  emergencyDisplay: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    gap: 8,
  },
  emergencyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  emergencyRowLabel: { fontSize: 14, color: Colors.text.secondary },
  emergencyRowNumber: { fontSize: 20, fontWeight: '800' },
  debugPanel: {
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginTop: Spacing.sm,
  },
  debugText: { fontFamily: 'monospace', fontSize: 11, color: Colors.text.muted, lineHeight: 18 },
  debugClose: { color: Colors.brand.accent, fontSize: 13, marginTop: 12, textAlign: 'right' },
  modal: { flex: 1, backgroundColor: Colors.background.primary },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    paddingTop: 56,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.text.primary },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
    gap: 12,
  },
  pickerItemSelected: { backgroundColor: Colors.brand.accent + '10' },
  pickerItemNative: { fontSize: 16, color: Colors.text.primary, flex: 1 },
  pickerItemLatin: { fontSize: 12, color: Colors.text.muted },
});
