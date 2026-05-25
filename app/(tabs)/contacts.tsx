import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Layout, BorderRadius, Shadows } from '../../theme';
import { emergencyContactsService } from '../../services/EmergencyContacts';
import type { EmergencyContact, UserProfile } from '../../services/EmergencyContacts/types';
import { router } from 'expo-router';

export default function ContactsScreen() {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [profile, setProfile] = useState<UserProfile>({ name: '' });
  
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newShareLocation, setNewShareLocation] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const c = await emergencyContactsService.getContacts();
    const p = await emergencyContactsService.getUserProfile();
    setContacts(c);
    setProfile(p);
  }

  async function handleAddContact() {
    if (!newName.trim() || !newPhone.trim()) {
      Alert.alert('Error', 'Please enter both name and phone number.');
      return;
    }
    const newContact: EmergencyContact = {
      id: Math.random().toString(36).substr(2, 9),
      name: newName.trim(),
      phone: newPhone.trim(),
      shareLocation: newShareLocation,
    };
    const updated = [...contacts, newContact];
    setContacts(updated);
    await emergencyContactsService.saveContacts(updated);
    setNewName('');
    setNewPhone('');
    setNewShareLocation(true);
  }

  async function handleRemoveContact(id: string) {
    const updated = contacts.filter(c => c.id !== id);
    setContacts(updated);
    await emergencyContactsService.saveContacts(updated);
  }

  async function handleSaveProfile() {
    await emergencyContactsService.saveUserProfile(profile);
    Alert.alert('Success', 'Profile saved.');
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.label.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Emergency Contacts</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        
        <Text style={styles.sectionTitle}>Your Profile</Text>
        <Text style={styles.sectionSub}>This name will be sent in SOS SMS messages.</Text>
        <View style={styles.card}>
          <TextInput
            style={styles.input}
            placeholder="Your Full Name"
            value={profile.name}
            onChangeText={(t) => setProfile({ ...profile, name: t })}
          />
          <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveProfile}>
            <Text style={styles.primaryBtnText}>Save Profile</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Add New Contact</Text>
        <Text style={styles.sectionSub}>They will receive an SMS if you trigger an SOS.</Text>
        <View style={styles.card}>
          <TextInput
            style={styles.input}
            placeholder="Contact Name"
            value={newName}
            onChangeText={setNewName}
          />
          <TextInput
            style={styles.input}
            placeholder="Phone Number (e.g. +91...)"
            value={newPhone}
            onChangeText={setNewPhone}
            keyboardType="phone-pad"
          />
          <TouchableOpacity 
            style={styles.toggleRow} 
            onPress={() => setNewShareLocation(!newShareLocation)}
          >
            <View style={[styles.checkbox, newShareLocation && styles.checkboxActive]}>
              {newShareLocation && <Ionicons name="checkmark" size={12} color="#FFF" />}
            </View>
            <Text style={styles.toggleText}>Share exact location via SMS</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleAddContact}>
            <Text style={styles.primaryBtnText}>Add Contact</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Your Contacts ({contacts.length})</Text>
        {contacts.length === 0 ? (
          <Text style={styles.emptyText}>No contacts added yet.</Text>
        ) : (
          contacts.map(c => (
            <View key={c.id} style={styles.contactItem}>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{c.name}</Text>
                <Text style={styles.contactPhone}>{c.phone}</Text>
                {c.shareLocation && (
                  <Text style={styles.contactShare}>Location sharing enabled</Text>
                )}
              </View>
              <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemoveContact(c.id)}>
                <Ionicons name="trash-outline" size={18} color={Colors.status.warning} />
              </TouchableOpacity>
            </View>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.grouped,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Layout.STATUS_BAR_HEIGHT + 10,
    paddingBottom: 10,
    paddingHorizontal: Layout.HORIZONTAL_PADDING,
    backgroundColor: Colors.background.primary,
    ...Shadows.xs,
    zIndex: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -10,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.label.primary,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: Layout.HORIZONTAL_PADDING,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.label.primary,
    marginTop: 20,
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 12,
    color: Colors.label.secondary,
    marginBottom: 12,
  },
  card: {
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.xl,
    padding: 16,
    ...Shadows.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border.medium,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    marginBottom: 12,
    backgroundColor: Colors.background.primary,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: Colors.brand.primary,
    borderColor: Colors.brand.primary,
  },
  toggleText: {
    fontSize: 14,
    color: Colors.label.secondary,
  },
  primaryBtn: {
    backgroundColor: Colors.brand.primary,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.label.tertiary,
    fontStyle: 'italic',
    marginTop: 10,
  },
  contactItem: {
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.xl,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Shadows.xs,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.label.primary,
    marginBottom: 2,
  },
  contactPhone: {
    fontSize: 14,
    color: Colors.label.secondary,
    marginBottom: 4,
  },
  contactShare: {
    fontSize: 11,
    color: Colors.status.success,
    fontWeight: '500',
  },
  removeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.soft.red,
    borderRadius: 20,
  },
});
