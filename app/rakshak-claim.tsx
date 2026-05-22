import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, ActivityIndicator, Image, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Colors, BorderRadius, Layout, Shadows } from '../theme';
import { rakshakService } from '../services/Rakshak/RakshakService';
import { pdfGenerator } from '../services/Rakshak/PDFGenerator';
import { RewardClaimData, RakshakProfile } from '../services/Rakshak/types';

// ─── Constants ─────────────────────────────────────────────────────────────

const INTERVENTION_OPTIONS = [
  'CPR performed',
  'Bleeding controlled with direct pressure',
  'Recovery position applied',
  'Airways cleared',
  'Called ambulance (108)',
  'Spinal precaution maintained',
  'Burns cooled with water',
  'Fracture immobilized',
  'Victim kept calm and still',
  'Crowd managed for ambulance access',
  'Vital signs monitored',
  'First aid kit applied',
];

const IMAGE_SLOTS: { label: string; hint: string }[] = [
  { label: 'Accident Scene',      hint: 'Wide shot of accident location' },
  { label: 'Victim Assistance',   hint: 'You helping the victim' },
  { label: 'Ambulance Handover',  hint: 'Ambulance arriving / handover' },
  { label: 'Additional Evidence', hint: 'Any other relevant photo' },
];

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProofImage {
  uri: string;
  label: string;
}

// ─── Helper component ───────────────────────────────────────────────────────

function Field({
  label, required, value, onChange, placeholder, multiline, keyboardType,
}: {
  label: string; required?: boolean; value: string;
  onChange: (t: string) => void; placeholder?: string;
  multiline?: boolean; keyboardType?: any;
}) {
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>
        {label}{required ? <Text style={{ color: Colors.brand.primary }}> *</Text> : ''}
      </Text>
      <TextInput
        style={[fieldStyles.input, multiline && { height: 72, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.label.tertiary}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize="sentences"
      />
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap:  { marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '600', color: Colors.label.secondary, marginBottom: 5, letterSpacing: 0.3 },
  input: {
    backgroundColor: Colors.background.grouped,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: Colors.label.primary,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
});

// ─── Main screen ────────────────────────────────────────────────────────────

export default function RakshakClaimScreen() {
  const [profile, setProfile]       = useState<RakshakProfile | null>(null);
  const [generating, setGenerating] = useState(false);

  // Form state
  const [incidentId,       setIncidentId]       = useState('');
  const [incidentDate,     setIncidentDate]      = useState(new Date().toLocaleDateString('en-IN'));
  const [incidentLocation, setIncidentLocation]  = useState('');
  const [arrivalTime,      setArrivalTime]       = useState('');
  const [handoverTime,     setHandoverTime]      = useState('');
  const [ambulanceDetails, setAmbulanceDetails]  = useState('');
  const [certNumber,       setCertNumber]        = useState('');
  const [proofImages,      setProofImages]       = useState<ProofImage[]>([]);
  const [interventions,    setInterventions]     = useState<string[]>([]);
  const [notes,            setNotes]             = useState('');

  useEffect(() => {
    const p = rakshakService.getProfile();
    if (p) setProfile(p);
  }, []);

  // ── Image handling ────────────────────────────────────────────────────────

  const handleAddImage = (slotIndex: number) => {
    const slot = IMAGE_SLOTS[slotIndex];
    Alert.alert(
      `Upload: ${slot.label}`,
      slot.hint,
      [
        { text: '📷 Take Photo',           onPress: () => pickImage('camera',  slot.label) },
        { text: '🖼️ Choose from Gallery', onPress: () => pickImage('gallery', slot.label) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const pickImage = async (source: 'camera' | 'gallery', label: string) => {
    try {
      let result: ImagePicker.ImagePickerResult;

      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Needed', 'Camera access is required to take proof photos.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'] as any,
          quality: 0.6,
          allowsEditing: true,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Needed', 'Gallery access is required to select proof photos.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'] as any,
          quality: 0.6,
          allowsEditing: true,
        });
      }

      if (!result.canceled && result.assets?.[0]) {
        // Replace existing image for same label, or add new
        setProofImages(prev => {
          const existing = prev.findIndex(img => img.label === label);
          const newImg: ProofImage = { uri: result.assets[0].uri, label };
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = newImg;
            return updated;
          }
          return [...prev, newImg];
        });
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const removeImage = (label: string) => {
    setProofImages(prev => prev.filter(img => img.label !== label));
  };

  // ── Intervention toggle ───────────────────────────────────────────────────

  const toggleIntervention = (item: string) => {
    setInterventions(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );
  };

  // ── Validate & Generate ───────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!incidentId.trim()) {
      Alert.alert('Required', 'Please enter the AETHER Incident ID.'); return;
    }
    if (!incidentDate.trim()) {
      Alert.alert('Required', 'Please enter the date of incident.'); return;
    }
    if (!incidentLocation.trim()) {
      Alert.alert('Required', 'Please enter the incident location or address.'); return;
    }
    if (proofImages.length === 0) {
      Alert.alert(
        'Proof Required',
        'Please upload at least 1 proof photo. This is required for a valid claim under Section 134A.',
      );
      return;
    }
    if (interventions.length === 0) {
      Alert.alert('Required', 'Please select at least one intervention you performed.'); return;
    }

    setGenerating(true);
    try {
      // Read each image as base64 for embedding in PDF
      const base64Images: string[] = [];
      const imageLabels: string[]  = [];

      for (const img of proofImages) {
        try {
          const b64 = await FileSystem.readAsStringAsync(img.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          base64Images.push(b64);
          imageLabels.push(img.label);
        } catch (e) {
          console.warn('[Claim] Could not read image:', img.label, e);
          // skip unreadable images — don't block PDF generation
        }
      }

      const claimData: RewardClaimData = {
        rakshakName:      profile?.name     ?? 'Not provided',
        rakshakPhone:     profile?.phone    ?? 'Not provided',
        certificateType:  profile?.certificateType?.replace(/_/g, ' ')
                            .replace(/\b\w/g, c => c.toUpperCase()) ?? 'First Aid Certificate',
        certificateNumber: certNumber || '______________________________',
        incidentId:        incidentId.trim(),
        incidentGPS:       incidentLocation.trim(),
        incidentDate:      incidentDate.trim(),
        arrivalTime:       arrivalTime  || 'Not recorded',
        handoverTime:      handoverTime || 'Not recorded',
        interventions,
        ambulanceDetails:  ambulanceDetails || 'Not recorded',
        proofImageBase64:  base64Images,
        proofImageLabels:  imageLabels,
        additionalNotes:   notes.trim() || undefined,
      };

      const pdfUri = await pdfGenerator.generateRewardClaim(claimData);

      if (pdfUri) {
        await pdfGenerator.sharePDF(pdfUri);
      } else {
        Alert.alert('Error', 'PDF generation failed. Please try again.');
      }
    } catch (err) {
      Alert.alert('Error', String(err));
    } finally {
      setGenerating(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.label.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Reward Claim</Text>
          <Text style={styles.headerSub}>Form MV-134A · AETHER Auto-Generated</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* Info banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="shield-checkmark" size={15} color={Colors.brand.gold} />
          <Text style={styles.infoText}>
            Good Samaritan Law (MV Act §134A) protects you.{' '}
            <Text style={styles.infoBold}>Fill this form with proof photos</Text> to claim ₹25,000 from the Government of India.
          </Text>
        </View>

        {/* ── SECTION A: Incident Details ─────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>A</Text></View>
            <Text style={styles.sectionTitle}>Incident Details</Text>
          </View>

          <Field
            label="AETHER Incident ID" required
            value={incidentId} onChange={setIncidentId}
            placeholder="e.g. a1b2c3d4 (shown on SOS screen)"
          />
          <Field
            label="Date of Incident" required
            value={incidentDate} onChange={setIncidentDate}
            placeholder="DD/MM/YYYY"
          />
          <Field
            label="Incident Location / Address" required
            value={incidentLocation} onChange={setIncidentLocation}
            placeholder="Road name, landmark, nearest town, state"
            multiline
          />
          <Field
            label="Your Arrival Time at Scene"
            value={arrivalTime} onChange={setArrivalTime}
            placeholder="e.g. 2:30 AM"
          />
          <Field
            label="Ambulance Handover Time"
            value={handoverTime} onChange={setHandoverTime}
            placeholder="e.g. 3:15 AM"
          />
          <Field
            label="Ambulance / EMS Details"
            value={ambulanceDetails} onChange={setAmbulanceDetails}
            placeholder="Reg. No., agency name (e.g. GVK-EMRI KA-01-AB-1234)"
          />
          <Field
            label="Your Certificate Number"
            value={certNumber} onChange={setCertNumber}
            placeholder="First-aid certificate number (if known)"
          />
        </View>

        {/* ── SECTION B: Proof Images ─────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>B</Text></View>
            <Text style={styles.sectionTitle}>
              Proof Photos{' '}
              <Text style={styles.required}>(at least 1 required)</Text>
            </Text>
          </View>

          <Text style={styles.sectionNote}>
            Photos will be embedded directly in your official claim document. They are essential for approval.
          </Text>

          <View style={styles.imageGrid}>
            {IMAGE_SLOTS.map((slot, idx) => {
              const uploaded = proofImages.find(img => img.label === slot.label);
              return (
                <View key={slot.label} style={styles.imageSlot}>
                  {uploaded ? (
                    <View style={styles.imagePreviewWrap}>
                      <Image source={{ uri: uploaded.uri }} style={styles.imagePreview} />
                      <TouchableOpacity
                        style={styles.removeBtn}
                        onPress={() => removeImage(slot.label)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close-circle" size={22} color={Colors.brand.primary} />
                      </TouchableOpacity>
                      <View style={styles.uploadedBadge}>
                        <Ionicons name="checkmark-circle" size={12} color="#fff" />
                        <Text style={styles.uploadedBadgeText}>Added</Text>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.emptySlot} onPress={() => handleAddImage(idx)} activeOpacity={0.7}>
                      <Ionicons name="camera-outline" size={26} color={Colors.label.tertiary} />
                      <Text style={styles.slotLabel}>{slot.label}</Text>
                      <Text style={styles.slotHint}>{slot.hint}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>

          {proofImages.length > 0 && (
            <View style={styles.imageCountRow}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.status.success} />
              <Text style={styles.imageCountText}>
                {proofImages.length} of {IMAGE_SLOTS.length} proof photo{proofImages.length > 1 ? 's' : ''} added
              </Text>
            </View>
          )}
        </View>

        {/* ── SECTION C: Interventions ────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>C</Text></View>
            <Text style={styles.sectionTitle}>
              Interventions Provided{' '}
              <Text style={styles.required}>(select all that apply)</Text>
            </Text>
          </View>

          {INTERVENTION_OPTIONS.map(item => {
            const checked = interventions.includes(item);
            return (
              <TouchableOpacity
                key={item}
                style={styles.checkRow}
                onPress={() => toggleIntervention(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                  {checked && <Ionicons name="checkmark" size={13} color="#fff" />}
                </View>
                <Text style={[styles.checkLabel, checked && styles.checkLabelChecked]}>
                  {item}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── SECTION D: Additional Notes ────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>D</Text></View>
            <Text style={styles.sectionTitle}>Additional Notes (Optional)</Text>
          </View>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any additional information about the assistance provided, victim's condition, or other relevant details…"
            placeholderTextColor={Colors.label.tertiary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* ── Generate Button ─────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.generateBtn, generating && styles.generateBtnDisabled]}
          onPress={handleGenerate}
          disabled={generating}
          activeOpacity={0.85}
        >
          {generating ? (
            <View style={styles.generateRow}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.generateBtnText}>Generating Official Document…</Text>
            </View>
          ) : (
            <View style={styles.generateRow}>
              <Ionicons name="document-text" size={20} color="#fff" />
              <Text style={styles.generateBtnText}>Generate Official Claim Document</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.generateNote}>
          The PDF includes your details, all proof photos, an official statutory declaration, and a
          government-format Form MV-134A ready for submission to your State Transport Authority.
        </Text>

        <View style={{ height: 50 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.background.primary, paddingTop: Platform.OS === 'ios' ? 54 : 32 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle,
  },
  backBtn:      { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:  { fontSize: 16, fontWeight: '700', color: Colors.label.primary, letterSpacing: -0.3 },
  headerSub:    { fontSize: 10, color: Colors.label.tertiary, marginTop: 2, letterSpacing: 0.2 },

  // Info banner
  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: `${Colors.brand.gold}12`,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: `${Colors.brand.gold}30`,
    padding: 12, marginBottom: 18,
  },
  infoText: { flex: 1, fontSize: 12, color: Colors.label.primary, lineHeight: 18 },
  infoBold: { fontWeight: '700', color: Colors.brand.gold },

  // Section
  section: {
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.xl,
    borderWidth: 1, borderColor: Colors.border.subtle,
    padding: 16, marginBottom: 14,
    ...Shadows.xs,
  },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  sectionBadge: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.brand.primary, alignItems: 'center', justifyContent: 'center',
  },
  sectionBadgeText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  sectionTitle:     { fontSize: 14, fontWeight: '700', color: Colors.label.primary, flex: 1 },
  sectionNote:      { fontSize: 12, color: Colors.label.secondary, lineHeight: 17, marginBottom: 12 },
  required:         { fontSize: 11, color: Colors.brand.primary, fontWeight: '500' },

  // Image grid
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  imageSlot: { width: '47.5%' },

  imagePreviewWrap: { position: 'relative', borderRadius: 12, overflow: 'hidden', aspectRatio: 1 },
  imagePreview:     { width: '100%', height: '100%', resizeMode: 'cover' },
  removeBtn: {
    position: 'absolute', top: 5, right: 5,
    backgroundColor: '#fff', borderRadius: 11,
  },
  uploadedBadge: {
    position: 'absolute', bottom: 6, left: 6,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.status.success, borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  uploadedBadgeText: { fontSize: 9, color: '#fff', fontWeight: '700' },

  emptySlot: {
    aspectRatio: 1, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border.medium,
    borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.background.grouped,
    padding: 10,
  },
  slotLabel: { fontSize: 11, fontWeight: '600', color: Colors.label.secondary, textAlign: 'center', marginTop: 6 },
  slotHint:  { fontSize: 9,  color: Colors.label.tertiary, textAlign: 'center', marginTop: 2, lineHeight: 13 },

  imageCountRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingTop: 4,
  },
  imageCountText: { fontSize: 12, color: Colors.status.success, fontWeight: '600' },

  // Interventions
  checkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle,
  },
  checkbox: {
    width: 20, height: 20, borderRadius: 5,
    borderWidth: 1.5, borderColor: Colors.border.medium,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.background.grouped,
  },
  checkboxChecked: { backgroundColor: Colors.brand.primary, borderColor: Colors.brand.primary },
  checkLabel:        { flex: 1, fontSize: 13, color: Colors.label.primary },
  checkLabelChecked: { color: Colors.brand.primary, fontWeight: '600' },

  // Notes
  notesInput: {
    backgroundColor: Colors.background.grouped,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: Colors.label.primary,
    borderWidth: 1, borderColor: Colors.border.subtle,
    height: 100,
  },

  // Generate button
  generateBtn: {
    backgroundColor: Colors.brand.primary,
    borderRadius: BorderRadius.xl,
    paddingVertical: 17,
    alignItems: 'center', marginBottom: 14,
    ...Shadows.emergency,
  },
  generateBtnDisabled: { opacity: 0.6 },
  generateRow:         { flexDirection: 'row', alignItems: 'center', gap: 10 },
  generateBtnText:     { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: -0.2 },
  generateNote: {
    fontSize: 11, color: Colors.label.tertiary,
    textAlign: 'center', lineHeight: 17,
  },
});
