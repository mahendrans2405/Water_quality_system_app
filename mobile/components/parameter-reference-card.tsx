import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

interface ParameterReferenceCardProps {
  title?: string;
  subtitle?: string;
  showValueBadges?: boolean;
}

export function ParameterReferenceCard({
  title = 'Parameter Reference & Alert Thresholds',
  subtitle = 'World Health Organization (WHO) and standard drinking water specification targets.',
  showValueBadges = true,
}: ParameterReferenceCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>📊 {title}</Text>
        <Text style={styles.cardSubtitle}>{subtitle}</Text>
      </View>

      <View style={styles.grid}>
        {/* Value 1: pH */}
        <View style={styles.item}>
          <View style={styles.itemHeader}>
            {showValueBadges && (
              <View style={[styles.badge, { backgroundColor: '#eff6ff' }]}>
                <Text style={[styles.badgeText, { color: '#2563eb' }]}>Value 1</Text>
              </View>
            )}
            <Text style={styles.paramTitle}>pH (pH)</Text>
          </View>
          <View style={styles.tiers}>
            <View style={styles.tierRow}>
              <Text style={styles.tierLabelNormal}>✓ Normal Target</Text>
              <Text style={styles.tierVal}>6.5 – 8.5</Text>
            </View>
            <View style={styles.tierRow}>
              <Text style={styles.tierLabelAlert}>! Alert Level</Text>
              <Text style={styles.tierVal}>&lt;6.5 or &gt;8.5</Text>
            </View>
            <View style={styles.tierRow}>
              <Text style={styles.tierLabelWarn}>▲ Warning Level</Text>
              <Text style={styles.tierVal}>&lt;6.0 or &gt;9.0</Text>
            </View>
            <View style={styles.tierRow}>
              <Text style={styles.tierLabelDanger}>✕ Danger Level</Text>
              <Text style={styles.tierVal}>&lt;5.5 or &gt;9.5</Text>
            </View>
          </View>
        </View>

        {/* Value 2: Turbidity */}
        <View style={styles.item}>
          <View style={styles.itemHeader}>
            {showValueBadges && (
              <View style={[styles.badge, { backgroundColor: '#fffbeb' }]}>
                <Text style={[styles.badgeText, { color: '#d97706' }]}>Value 2</Text>
              </View>
            )}
            <Text style={styles.paramTitle}>Turbidity (NTU)</Text>
          </View>
          <View style={styles.tiers}>
            <View style={styles.tierRow}>
              <Text style={styles.tierLabelNormal}>✓ Normal Target</Text>
              <Text style={styles.tierVal}>&lt;1 NTU (preferred)</Text>
            </View>
            <View style={styles.tierRow}>
              <Text style={styles.tierLabelAlert}>! Alert Level</Text>
              <Text style={styles.tierVal}>1 – 5 NTU</Text>
            </View>
            <View style={styles.tierRow}>
              <Text style={styles.tierLabelWarn}>▲ Warning Level</Text>
              <Text style={styles.tierVal}>5 – 10 NTU</Text>
            </View>
            <View style={styles.tierRow}>
              <Text style={styles.tierLabelDanger}>✕ Danger Level</Text>
              <Text style={styles.tierVal}>&gt;10 NTU</Text>
            </View>
          </View>
        </View>

        {/* Value 3: TDS */}
        <View style={styles.item}>
          <View style={styles.itemHeader}>
            {showValueBadges && (
              <View style={[styles.badge, { backgroundColor: '#ecfdf5' }]}>
                <Text style={[styles.badgeText, { color: '#059669' }]}>Value 3</Text>
              </View>
            )}
            <Text style={styles.paramTitle}>TDS (mg/L / ppm)</Text>
          </View>
          <View style={styles.tiers}>
            <View style={styles.tierRow}>
              <Text style={styles.tierLabelNormal}>✓ Normal Target</Text>
              <Text style={styles.tierVal}>&lt;600 ppm</Text>
            </View>
            <View style={styles.tierRow}>
              <Text style={styles.tierLabelAlert}>! Alert Level</Text>
              <Text style={styles.tierVal}>600 – 1000 ppm</Text>
            </View>
            <View style={styles.tierRow}>
              <Text style={styles.tierLabelWarn}>▲ Warning Level</Text>
              <Text style={styles.tierVal}>1000 – 1500 ppm</Text>
            </View>
            <View style={styles.tierRow}>
              <Text style={styles.tierLabelDanger}>✕ Danger Level</Text>
              <Text style={styles.tierVal}>&gt;1500 ppm</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
    gap: 3,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  item: {
    flex: 1,
    minWidth: 260,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 10,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  paramTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  tiers: {
    gap: 5,
  },
  tierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  tierLabelNormal: {
    fontSize: 11,
    color: '#16a34a',
    fontWeight: '600',
  },
  tierLabelAlert: {
    fontSize: 11,
    color: '#d97706',
    fontWeight: '600',
  },
  tierLabelWarn: {
    fontSize: 11,
    color: '#ea580c',
    fontWeight: '600',
  },
  tierLabelDanger: {
    fontSize: 11,
    color: '#dc2626',
    fontWeight: '700',
  },
  tierVal: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
});
