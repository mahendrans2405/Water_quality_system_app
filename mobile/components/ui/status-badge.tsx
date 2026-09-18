import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StatusBadgeProps {
  status: 'Online' | 'Offline' | 'Warning' | 'No Recent Data' | 'Safe' | 'Alert' | string;
  size?: 'small' | 'medium';
}

export function StatusBadge({ status, size = 'small' }: StatusBadgeProps) {
  let badgeStyle = styles.neutralBadge;
  let textStyle = styles.neutralText;
  let dotStyle = styles.neutralDot;
  let label = status;

  switch (status) {
    case 'Online':
    case 'Safe':
      badgeStyle = styles.successBadge;
      textStyle = styles.successText;
      dotStyle = styles.successDot;
      label = status === 'Safe' ? '✓ Safe' : '● Online';
      break;
    case 'Offline':
      badgeStyle = styles.dangerBadge;
      textStyle = styles.dangerText;
      dotStyle = styles.dangerDot;
      label = '○ Offline';
      break;
    case 'Warning':
    case 'Alert':
      badgeStyle = styles.warningBadge;
      textStyle = styles.warningText;
      dotStyle = styles.warningDot;
      label = '▲ Warning';
      break;
    case 'No Recent Data':
      badgeStyle = styles.neutralBadge;
      textStyle = styles.neutralText;
      dotStyle = styles.neutralDot;
      label = '— No Data';
      break;
    default:
      break;
  }

  const isSmall = size === 'small';

  return (
    <View style={[styles.badge, badgeStyle, isSmall ? styles.badgeSmall : styles.badgeMedium]}>
      <Text style={[styles.text, textStyle, isSmall ? styles.textSmall : styles.textMedium]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  badgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeMedium: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  text: {
    fontWeight: '700',
  },
  textSmall: {
    fontSize: 11,
  },
  textMedium: {
    fontSize: 13,
  },
  // Success
  successBadge: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
    borderWidth: 1,
  },
  successText: {
    color: '#15803d',
  },
  successDot: {
    backgroundColor: '#16a34a',
  },
  // Danger
  dangerBadge: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
    borderWidth: 1,
  },
  dangerText: {
    color: '#b91c1c',
  },
  dangerDot: {
    backgroundColor: '#dc2626',
  },
  // Warning
  warningBadge: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde047',
    borderWidth: 1,
  },
  warningText: {
    color: '#b45309',
  },
  warningDot: {
    backgroundColor: '#d97706',
  },
  // Neutral
  neutralBadge: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
    borderWidth: 1,
  },
  neutralText: {
    color: '#475569',
  },
  neutralDot: {
    backgroundColor: '#64748b',
  },
});
