// app/rakshak-register.tsx
/**
 * Rakshak Registration Screen
 * 
 * A multi-step form for first-aid certified volunteers to register.
 * 
 * Steps:
 * 1. Personal details (name, phone, address)
 * 2. Certificate information (type, image upload)
 * 3. Account creation (email, password)
 * 
 * After registration:
 * - Profile stored in Firestore
 * - Status = 'pending' (admin reviews certificate)
 * - FCM token saved for push notifications
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors, BorderRadius, Layout, Shadows } from '../theme';
import { rakshakService } from '../services/Rakshak/RakshakService';
import { notificationService } from '../services/Rakshak/NotificationService';
import { CertificateType } from '../services/Rakshak/types';

const CERTIFICATE_OPTIONS: { label: string; value: CertificateType }[] = [
  { label: 'Red Cross First Aid', value: 'red_cross' },
  { label: "St. John Ambulance", value: 'st_john_ambulance' },
  { label: 'First Aid Certificate', value: 'first_aid_cert' },
  { label: 'Medical Professional', value: 'medical_professional' },
  { label: 'Other Certification', value: 'other' },
];

const INTERVENTION_OPTIONS = [
  'CPR performed',
  'Bleeding controlled',
  'Airway cleared',
  'Recovery position',
  'Called ambulance',
  'Spinal precaution',
  'Burn cooling',
  'Kept victim calm',
];

export default function RakshakRegisterScreen() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);

  // Step 1
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  // Step 2
  const [certType, setCertType] = useState<CertificateType>('first_aid_cert');
  const [certImage, setCertImage] = useState<string | null>(null);

  // Step 3
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // ── Step 1: Personal Details ───────────────────────────────────────────

  const handleStep1 = () => {
    if (!name.trim()) { Alert.alert('Error', 'Please enter your full name'); return; }
    if (!phone.trim() || phone.length < 10) { Alert.alert('Error', 'Please enter a valid phone number'); return; }
    if (!address.trim()) { Alert.alert('Error', 'Please enter your address'); return; }
    setStep(2);
  };

  // ── Step 2: Certificate ────────────────────────────────────────────────

  const handlePickCertificate = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setCertImage(result.assets[0].uri);
    }
  };

  const handleStep2 = () => {
    setStep(3);
  };

  // ── Step 3: Account Creation ───────────────────────────────────────────

  const handleRegister = async () => {
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address'); return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters'); return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match'); return;
    }

    setLoading(true);
    try {
      // Register in Firebase
      const profile = await rakshakService.register(email, password, {
        name, phone, address, certificateType: certType,
      });

      if (certImage) {
        // Certificate image saved locally for demo
        // Full upload requires Firebase Blaze plan
        console.log('[Register] Certificate selected - demo mode');
      }

      // Set up push notifications
      const token = await notificationService.initialize();
      if (token) {
        await rakshakService.saveFCMToken(profile.uid, token);
      }

      Alert.alert(
        '✅ Registration Successful!',
        'Your profile is pending verification. You will receive alerts once approved.\n\nThank you for joining the Rakshak network!',
        [{ text: 'OK', onPress: () => router.replace('/rakshak-dashboard') }]
      );
    } catch (error: any) {
      const msg = error.code === 'auth/email-already-in-use'
        ? 'An account with this email already exists'
        : error.message || 'Registration failed. Please try again.';
      Alert.alert('Registration Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => step === 1 ? router.back() : setStep(step === 2 ? 1 : 2)}>
            <Ionicons name="arrow-back" size={24} color={Colors.label.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Join Rakshak Network</Text>
          <Text style={styles.stepIndicator}>Step {step} of 3</Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(step / 3) * 100}%` as `${number}%` }]} />
        </View>

        {/* STEP 1: Personal Details */}
        {step === 1 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Your Details</Text>
            <Text style={styles.stepSubtitle}>This information will appear on your reward claim</Text>

            <FormField label="Full Name" value={name} onChangeText={setName} placeholder="As on certificate" />
            <FormField label="Phone Number" value={phone} onChangeText={setPhone} placeholder="+91 98765 43210" keyboardType="phone-pad" />
            <FormField label="Home Address" value={address} onChangeText={setAddress} placeholder="Street, City, State" multiline />

            <TouchableOpacity style={styles.primaryBtn} onPress={handleStep1}>
              <Text style={styles.primaryBtnText}>Next: Certificate Details →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 2: Certificate */}
        {step === 2 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Your Certification</Text>
            <Text style={styles.stepSubtitle}>Select your first-aid certification type</Text>

            {CERTIFICATE_OPTIONS.map(option => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.certOption,
                  certType === option.value && styles.certOptionSelected,
                ]}
                onPress={() => setCertType(option.value)}
              >
                <View style={[styles.radio, certType === option.value && styles.radioSelected]}>
                  {certType === option.value && <View style={styles.radioInner} />}
                </View>
                <Text style={styles.certOptionText}>{option.label}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.uploadBox} onPress={handlePickCertificate}>
              <Ionicons
                name={certImage ? 'checkmark-circle' : 'cloud-upload-outline'}
                size={28}
                color={certImage ? Colors.status.success : Colors.label.secondary}
              />
              <Text style={styles.uploadText}>
                {certImage ? 'Certificate selected ✓' : 'Upload certificate image (optional)'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleStep2}>
              <Text style={styles.primaryBtnText}>Next: Create Account →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 3: Account */}
        {step === 3 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Create Your Account</Text>
            <Text style={styles.stepSubtitle}>Used to log in and receive alerts</Text>

            <FormField label="Email Address" value={email} onChangeText={setEmail} placeholder="you@email.com" keyboardType="email-address" autoCapitalize="none" />
            <FormField label="Password" value={password} onChangeText={setPassword} placeholder="Min. 6 characters" secureTextEntry />
            <FormField label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Re-enter password" secureTextEntry />

            <View style={styles.legalNote}>
              <Ionicons name="shield-checkmark" size={14} color={Colors.brand.gold} />
              <Text style={styles.legalNoteText}>
                By registering, you agree to respond to alerts in good faith. Good Samaritan Law (MV Act §134A) protects you.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>Complete Registration ✓</Text>
              }
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Helper Components ─────────────────────────────────────────────────────────

function FormField({
  label, value, onChangeText, placeholder, multiline, keyboardType, secureTextEntry, autoCapitalize
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: any;
  secureTextEntry?: boolean;
  autoCapitalize?: any;
}) {
  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && { height: 80, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.label.tertiary}
        multiline={multiline}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize || 'words'}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.grouped },
  content: { paddingTop: Layout.STATUS_BAR_HEIGHT + 8, paddingHorizontal: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: Colors.label.primary, marginLeft: 12 },
  stepIndicator: { fontSize: 12, color: Colors.label.secondary },
  progressTrack: { height: 4, backgroundColor: Colors.fill.tertiary, borderRadius: 2, marginBottom: 24, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.brand.primary, borderRadius: 2 },
  stepContainer: { gap: 14 },
  stepTitle: { fontSize: 22, fontWeight: '700', color: Colors.label.primary, letterSpacing: -0.4 },
  stepSubtitle: { fontSize: 13, color: Colors.label.secondary, lineHeight: 19 },
  fieldWrapper: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: Colors.label.secondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  fieldInput: {
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.lg,
    padding: 14,
    fontSize: 15,
    color: Colors.label.primary,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  certOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border.subtle,
  },
  certOptionSelected: { borderColor: Colors.brand.primary, backgroundColor: `${Colors.brand.primary}08` },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.label.tertiary, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: Colors.brand.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.brand.primary },
  certOptionText: { fontSize: 15, color: Colors.label.primary },
  uploadBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border.medium,
    borderStyle: 'dashed',
  },
  uploadText: { fontSize: 14, color: Colors.label.secondary },
  legalNote: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: `${Colors.brand.gold}10`,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: `${Colors.brand.gold}30`,
  },
  legalNoteText: { flex: 1, fontSize: 11, color: Colors.label.secondary, lineHeight: 17 },
  primaryBtn: {
    backgroundColor: Colors.brand.primary,
    borderRadius: BorderRadius.xl,
    paddingVertical: 16,
    alignItems: 'center',
    ...Shadows.sm,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});