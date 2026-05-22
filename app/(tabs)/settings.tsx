/**
 * Settings Screen — Premium iOS Design
 *
 * iOS-style grouped table rows: white cards on gray background.
 * Chevron rows, modal pickers, debug panel.
 * All logic identical to original — only UI upgraded.
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
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppContext } from '../_layout';
import { getAllCountries, setManualCountry } from '../../services/MCCService';
import { getLastKnownLocation } from '../../services/GPSService';
import { getPoiCountByType } from '../../services/POIDatabase';
import { LANGUAGES, STORAGE_KEYS, type LanguageCode } from '../../utils/constants';
import { Colors, BorderRadius, Shadows, Layout } from '../../theme';
import { crashDetectionEngine } from '../../services/CrashDetection/CrashDetectionEngine';
import { onlinePOIService } from '../../services/OnlinePOIService';

// ── PHASE 9 ──────────────────────────────────────────────────────────────────
import { RoadDNASettingsSection } from '../../components/RoadDNASettingsSection';
// ─────────────────────────────────────────────────────────────────────────────

// Phase 10: Privacy — add after existing imports
import { deleteAllUserData } from '../../utils/PrivacyManager';


export default function SettingsScreen() {
  const { emergencyNumbers, language, setLanguage } = useAppContext();

  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  const countries = getAllCountries();

  // Phase 10: Delete all user data handler
  async function handleDeleteAllData() {
    Alert.alert(
      '⚠️ Delete All My Data',
      'This will permanently delete:\n\n• GPS history\n• Driving event logs\n• Cached POI data\n• Translation cache\n• All preferences\n\nYou will need to accept consent again on next launch.\n\nThis cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAllUserData();
              Alert.alert(
                '✅ Data Deleted',
                'All your data has been deleted. Please restart the app to see the consent screen again.',
                [{ text: 'OK' }]
              );
            } catch (error) {
              Alert.alert('Error', 'Some data could not be deleted. Please try again.');
            }
          },
        },
      ]
    );
  }

  const currentLang = LANGUAGES.find(l => l.code === language);

  async function handleLanguage(code: LanguageCode) {
    await setLanguage(code);
    setShowLangPicker(false);
  }

  async function handleCountry(mcc: string) {
    try {
      const nums = await setManualCountry(mcc);
      setShowCountryPicker(false);
      Alert.alert('Updated', `${nums.country}\nAmbulance: ${nums.ambulance} · Police: ${nums.police}`);
    } catch {
      Alert.alert('Error', 'Failed to update country.');
    }
  }

  async function loadDebug() {
    const loc = await getLastKnownLocation();
    const db = await getPoiCountByType();
    const mcc = await AsyncStorage.getItem(STORAGE_KEYS.MCC);
    const fpRaw = await AsyncStorage.getItem(STORAGE_KEYS.FALSE_POSITIVE_COUNT);
    const crashScore = crashDetectionEngine.getCurrentScore();
    const lines = [
      `MCC: ${mcc ?? 'Unknown'}`,
      `Country: ${emergencyNumbers.country} (${emergencyNumbers.country_code})`,
      `Police: ${emergencyNumbers.police}  Ambulance: ${emergencyNumbers.ambulance}`,
      `Language: ${language}`,
      ``,
      `GPS: ${loc ? `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}` : 'None'}`,
      `Accuracy: ${loc ? `±${Math.round(loc.accuracy)}m` : 'N/A'}`,
      `Source: ${loc?.source ?? 'N/A'}`,
      ``,
      `Crash Detection:`,
      `  State: ${crashDetectionEngine.getState()}`,
      `  Confidence: ${(crashScore.confidence * 100).toFixed(1)}%`,
      `  G-Force: ${crashScore.gForce.toFixed(2)}g`,
      `  False Positives: ${fpRaw ?? '0'}`,
      ``,
      `DB Counts:`,
      ...Object.entries(db).map(([t, c]) => `  ${t}: ${c}`),
    ];
    setDebugInfo(lines.join('\n'));
  }


  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Large title ─────────────────────────────────────── */}
      <Text style={styles.pageTitle}>Settings</Text>

      {/* ── Language ─────────────────────────────────────────── */}
      <SectionLabel text="Language" />
      <View style={styles.group}>
        <SettingsRow
          icon="language"
          iconBg="#E3F0FF"
          iconColor={Colors.brand.accent}
          label="App Language"
          value={`${currentLang?.nativeName} (${currentLang?.name})`}
          onPress={() => setShowLangPicker(true)}
          showChevron
        />
      </View>

      {/* ── Emergency Numbers ────────────────────────────────── */}
      <SectionLabel text="Emergency Numbers" />
      <View style={styles.group}>
        <SettingsRow
          icon="globe"
          iconBg="#FFE9E8"
          iconColor={Colors.brand.primary}
          label="Country Override"
          value={emergencyNumbers.country}
          onPress={() => setShowCountryPicker(true)}
          showChevron
        />
        <View style={styles.separator} />
        {/* Inline emergency number display */}
        {[
          { label: 'Police', number: emergencyNumbers.police, color: Colors.brand.accent },
          { label: 'Ambulance', number: emergencyNumbers.ambulance, color: Colors.brand.primary },
          { label: 'Fire', number: emergencyNumbers.fire, color: Colors.brand.gold },
          { label: 'Universal', number: emergencyNumbers.unified, color: Colors.status.success },
        ].map((item, i, arr) => (
          <View key={item.label}>
            <View style={styles.numRow}>
              <Text style={styles.numLabel}>{item.label}</Text>
              <Text style={[styles.numValue, { color: item.color }]}>{item.number}</Text>
            </View>
            {i < arr.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </View>

      {/* ── PHASE 9: Road DNA Settings ────────────────────────── */}
      <SectionLabel text="Safety" />
      <RoadDNASettingsSection />

      {/* ── Privacy (Phase 10) ─────────────────────────────────────────── */}
      <SectionLabel text="Privacy" />
      <View style={styles.group}>
        <SettingsRow
          icon="shield-checkmark-outline"
          iconBg="#E8F6EF"
          iconColor={Colors.status.success}
          label="View Consent Status"
          value="DPDP Act 2023 compliant"
          onPress={() => Alert.alert(
            'Your Privacy',
            'AETHER collects:\n\n✅ GPS (for crash detection)\n✅ Accelerometer (crash detection)\n✅ Anonymous driving events (road safety)\n\n❌ No audio recordings\n❌ No personal identity\n❌ No advertising data\n\nYou can delete all data at any time.',
            [{ text: 'OK' }]
          )}
          showChevron
        />
        <View style={styles.separator} />
        <SettingsRow
          icon="trash-outline"
          iconBg="#FFEDEC"
          iconColor={Colors.brand.primary}
          label="Delete All My Data"
          value="Right to Erasure — DPDP Section 12"
          onPress={handleDeleteAllData}
          showChevron
        />
      </View>

      {/* ── About ────────────────────────────────────────────── */}
      <SectionLabel text="About" />
      <View style={styles.group}>
        <View style={styles.aboutRow}>
          <View style={[styles.iconWrap, { backgroundColor: '#F0EEFF' }]}>
            <Ionicons name="pulse" size={18} color={Colors.brand.purple} />
          </View>
          <View>
            <Text style={styles.aboutTitle}>AETHER</Text>
            <Text style={styles.aboutSub}>Accident Emergency & Trauma Hyper-Response</Text>
            <Text style={styles.aboutSub}>Version 1.0.0 · Phase 3</Text>
          </View>
        </View>
      </View>

      {/* ── Developer ────────────────────────────────────────── */}
      <SectionLabel text="Developer" />
      <View style={styles.group}>
        <SettingsRow
          icon="bug"
          iconBg="#FFFBEA"
          iconColor="#F0A500"
          label="Show Debug Info"
          onPress={loadDebug}
          showChevron
        />
        <View style={styles.separator} />
        <SettingsRow
          icon="chatbubble-ellipses"
          iconBg="#EBF0FC"
          iconColor={Colors.brand.accent}
          label="AI First-Aid Assistant"
          value="Pocket RAG chatbot · Phase 11"
          onPress={() => router.push('/chatbot' as any)}
          showChevron
        />
        <View style={styles.separator} />
        <SettingsRow
          icon="pulse"
          iconBg="#FFEDEC"
          iconColor={Colors.brand.primary}
          label="Test Crash Detection"
          value="Triggers the 5-second SOS countdown"
          onPress={() => crashDetectionEngine.triggerTestSOS()}
          showChevron
        />
        <View style={styles.separator} />
        <SettingsRow
          icon="trash-outline"
          iconBg="#FFEDEC"
          iconColor={Colors.brand.primary}
          label="Clear Online POI Cache"
          value="Forces re-fetch on next open"
          onPress={async () => {
            await onlinePOIService.clearCache();
            Alert.alert('Done', 'Cache cleared. Will re-fetch on next open.');
          }}
          showChevron
        />
      </View>

      {debugInfo && (
        <View style={styles.debugBox}>
          <Text style={styles.debugText}>{debugInfo}</Text>
          <TouchableOpacity onPress={() => setDebugInfo(null)} style={styles.debugClose}>
            <Text style={styles.debugCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 20 }} />

      {/* ── Language Picker Modal ─────────────────────────────── */}
      <PickerModal
        visible={showLangPicker}
        title="Language"
        onClose={() => setShowLangPicker(false)}
        data={LANGUAGES.map(l => ({ key: l.code, primary: l.nativeName, secondary: l.name }))}
        selected={language}
        onSelect={(key) => handleLanguage(key as LanguageCode)}
      />

      {/* ── Country Picker Modal ──────────────────────────────── */}
      <PickerModal
        visible={showCountryPicker}
        title="Country"
        onClose={() => setShowCountryPicker(false)}
        data={countries.map(c => ({ key: c.mcc, primary: c.country, secondary: `MCC: ${c.mcc}` }))}
        onSelect={(key) => handleCountry(key)}
      />
    </ScrollView>
  );
}

// ── Reusable sub-components ─────────────────────────────────────────────────

function SectionLabel({ text }: { text: string }) {
  return <Text style={styles.sectionLabel}>{text.toUpperCase()}</Text>;
}

function SettingsRow({
  icon, iconBg, iconColor, label, value, onPress, showChevron,
}: {
  icon: string; iconBg: string; iconColor: string;
  label: string; value?: string; onPress: () => void; showChevron?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.settingsRow} onPress={onPress} activeOpacity={0.65}>
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={17} color={iconColor} />
      </View>
      <View style={styles.rowCenter}>
        <Text style={styles.rowLabel}>{label}</Text>
        {value ? <Text style={styles.rowValue} numberOfLines={1}>{value}</Text> : null}
      </View>
      {showChevron && (
        <Ionicons name="chevron-forward" size={16} color={Colors.label.tertiary} />
      )}
    </TouchableOpacity>
  );
}

function PickerModal({
  visible, title, onClose, data, selected, onSelect,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  data: Array<{ key: string; primary: string; secondary: string }>;
  selected?: string;
  onSelect: (key: string) => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modal}>
        {/* Modal handle */}
        <View style={styles.modalHandle} />
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Ionicons name="close" size={20} color={Colors.label.secondary} />
          </TouchableOpacity>
        </View>
        <FlatList
          data={data}
          keyExtractor={(item) => item.key}
          renderItem={({ item, index }) => (
            <View>
              <TouchableOpacity
                style={styles.pickerRow}
                onPress={() => onSelect(item.key)}
                activeOpacity={0.65}
              >
                <View style={styles.pickerTexts}>
                  <Text style={styles.pickerPrimary}>{item.primary}</Text>
                  <Text style={styles.pickerSecondary}>{item.secondary}</Text>
                </View>
                {selected === item.key && (
                  <Ionicons name="checkmark" size={18} color={Colors.brand.accent} />
                )}
              </TouchableOpacity>
              <View style={styles.pickerSep} />
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      </View>
    </Modal>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: Colors.background.grouped,
  },
  content: {
    paddingTop: Layout.STATUS_BAR_HEIGHT + 4,
    paddingHorizontal: Layout.HORIZONTAL_PADDING,
    paddingBottom: Layout.CONTENT_BOTTOM_PADDING,
  },
  pageTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: Colors.label.primary,
    letterSpacing: -0.8,
    marginBottom: 28,
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.label.secondary,
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
    marginTop: 20,
  },

  // iOS-style grouped card
  group: {
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.xs,
  },
  separator: {
    height: 0.5,
    backgroundColor: Colors.border.subtle,
    marginLeft: 56,
  },

  // Settings row
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCenter: { flex: 1 },
  rowLabel: {
    fontSize: 15,
    color: Colors.label.primary,
    fontWeight: '400',
  },
  rowValue: {
    fontSize: 12,
    color: Colors.label.secondary,
    marginTop: 1,
  },

  // Emergency number inline rows
  numRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  numLabel: {
    fontSize: 15,
    color: Colors.label.primary,
  },
  numValue: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },

  // About row
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  aboutTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.label.primary,
    letterSpacing: 0.5,
  },
  aboutSub: {
    fontSize: 12,
    color: Colors.label.secondary,
    marginTop: 1,
  },

  // Debug
  debugBox: {
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.xl,
    padding: 16,
    marginTop: 12,
    ...Shadows.xs,
  },
  debugText: {
    fontFamily: 'Courier',
    fontSize: 11,
    color: Colors.label.secondary,
    lineHeight: 18,
  },
  debugClose: { marginTop: 12, alignSelf: 'flex-end' },
  debugCloseText: {
    fontSize: 13,
    color: Colors.brand.accent,
    fontWeight: '600',
  },

  // Modal
  modal: {
    flex: 1,
    backgroundColor: Colors.background.grouped,
    paddingTop: 12,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.separator.opaque,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Layout.HORIZONTAL_PADDING,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.label.primary,
    letterSpacing: -0.4,
  },
  modalClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.fill.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.HORIZONTAL_PADDING,
    paddingVertical: 14,
    backgroundColor: Colors.background.elevated,
  },
  pickerTexts: { flex: 1 },
  pickerPrimary: {
    fontSize: 15,
    color: Colors.label.primary,
    fontWeight: '400',
  },
  pickerSecondary: {
    fontSize: 12,
    color: Colors.label.secondary,
    marginTop: 1,
  },
  pickerSep: {
    height: 0.5,
    backgroundColor: Colors.border.subtle,
    marginLeft: Layout.HORIZONTAL_PADDING,
  },
});