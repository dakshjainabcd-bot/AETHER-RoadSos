/**
 * InjuryTypeSelector — Bystander picks injury type after crash confirmed
 *
 * WHY THIS UI MATTERS:
 * The bystander has ~30 seconds to tell us the injury type
 * before we send the pre-alert. A wrong selection = wrong hospital.
 *
 * Design decisions:
 * - Large chips (easy to tap with shaking hands)
 * - 2-column grid (fits 7 options without scrolling)
 * - Color-coded to match medical conventions
 * - "Not Sure" always available as a safe fallback
 * - Selected chip shows a tick mark — clear confirmation
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { INJURY_TYPES, type InjuryType } from '../services/TraumaMatch';
import { Colors, BorderRadius, Shadows } from '../theme';

interface InjuryTypeSelectorProps {
  /** Currently selected injury type (null = none selected yet) */
  selected: InjuryType | null;
  /** Called when bystander taps a chip */
  onSelect: (type: InjuryType) => void;
  /** Whether the selector is disabled (after hospital matched) */
  disabled?: boolean;
}

export function InjuryTypeSelector({
  selected,
  onSelect,
  disabled = false,
}: InjuryTypeSelectorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>What type of injury?</Text>
      <Text style={styles.subheading}>
        This helps us find the right hospital — tap the best match
      </Text>

      {/* 2-column chip grid */}
      <View style={styles.grid}>
        {INJURY_TYPES.map((item) => {
          const isSelected = selected === item.type;
          return (
            <TouchableOpacity
              key={item.type}
              style={[
                styles.chip,
                {
                  borderColor: isSelected ? item.color : `${item.color}30`,
                  backgroundColor: isSelected ? `${item.color}15` : Colors.background.elevated,
                },
                disabled && styles.chipDisabled,
              ]}
              onPress={() => !disabled && onSelect(item.type)}
              activeOpacity={disabled ? 1 : 0.7}
            >
              {/* Icon */}
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: isSelected ? `${item.color}20` : Colors.fill.tertiary },
                ]}
              >
                <Ionicons
                  name={item.icon as any}
                  size={20}
                  color={isSelected ? item.color : Colors.label.secondary}
                />
              </View>

              {/* Label + description */}
              <View style={styles.textWrap}>
                <Text
                  style={[
                    styles.chipLabel,
                    { color: isSelected ? item.color : Colors.label.primary },
                  ]}
                >
                  {item.label}
                </Text>
                <Text style={styles.chipDesc} numberOfLines={1}>
                  {item.description}
                </Text>
              </View>

              {/* Tick when selected */}
              {isSelected && (
                <View style={[styles.tick, { backgroundColor: item.color }]}>
                  <Ionicons name="checkmark" size={12} color="#FFF" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Helper text below grid */}
      {!selected && (
        <Text style={styles.helper}>
          Tap an injury type above to find the nearest specialist hospital
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  heading: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.label.primary,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  subheading: {
    fontSize: 12,
    color: Colors.label.secondary,
    marginBottom: 14,
    lineHeight: 17,
  },

  // 2-column grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  // Each chip takes ~half width (minus gap)
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    gap: 8,
    padding: 10,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    ...Shadows.xs,
    position: 'relative',
  },
  chipDisabled: {
    opacity: 0.55,
  },

  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  textWrap: {
    flex: 1,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
    marginBottom: 1,
  },
  chipDesc: {
    fontSize: 10,
    color: Colors.label.tertiary,
    lineHeight: 13,
  },

  tick: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  helper: {
    fontSize: 11,
    color: Colors.label.tertiary,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 16,
  },
});