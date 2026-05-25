import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  isActive: boolean;
  incidentId: string;
}

export function SOSNotificationBanner({ isActive, incidentId }: Props) {
  if (!isActive) return null;

  return (
    <View style={styles.banner}>
      <View style={styles.iconWrap}>
        <Ionicons name="people" size={16} color={Colors.brand.primary} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>Notifying Emergency Contacts</Text>
        <Text style={styles.subtitle}>Alerting contacts via SMS / Mesh Relay</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: Colors.soft.red,
    borderWidth: 1,
    borderColor: Colors.soft.redBorder,
    borderRadius: 12,
    marginBottom: 14,
    gap: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(239, 62, 40, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.label.primary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 11,
    color: Colors.label.secondary,
  },
});
