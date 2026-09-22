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
    case 'Normal':
      badgeStyle = styles.successBadge;
      textStyle = styles.successText;
      dotStyle = styles.successDot;
      label = status === 'Online' ? '● Online' : '✓ Safe';
      break;
    case 'Alert':
      badgeStyle = styles.alertBadge;
      textStyle = styles.alertText;
      dotStyle = styles.alertDot;
      label = '! Alert';
      break;
    case 'Warning':
      badgeStyle = styles.warningBadge;
      textStyle = styles.warningText;
      dotStyle = styles.warningDot;
      label = '▲ Warning';
      break;
    case 'Danger':
    case 'Critical':
      badgeStyle = styles.dangerBadge;
      textStyle = styles.dangerText;
      dotStyle = styles.dangerDot;
      label = '✕ Danger';
      break;
    case 'Offline':
      badgeStyle = styles.dangerBadge;
      textStyle = styles.dangerText;
      dotStyle = styles.dangerDot;
      label = '○ Offline';
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
    backgroundColor: '#ffedd5',
    borderColor: '#fed7aa',
    borderWidth: 1,
  },
  warningText: {
    color: '#c2410c',
  },
  warningDot: {
    backgroundColor: '#ea580c',
  },
  // Alert
  alertBadge: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde047',
    borderWidth: 1,
  },
  alertText: {
    color: '#b45309',
  },
  alertDot: {
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
