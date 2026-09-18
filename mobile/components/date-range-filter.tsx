import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  TextInput,
} from 'react-native';

export type DateRangeType = 'latest' | '1h' | '6h' | '24h' | '7d' | '30d' | 'custom';

interface DateRangeFilterProps {
  range: DateRangeType;
  onRangeChange: (range: DateRangeType) => void;
  customStart: string;
  customEnd: string;
  onCustomStartChange: (val: string) => void;
  onCustomEndChange: (val: string) => void;
  onApplyCustom: () => void;
  onReset: () => void;
  totalCount?: number;
  loading?: boolean;
  onRefresh?: () => void;
}

export function DateRangeFilter({
  range,
  onRangeChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
  onApplyCustom,
  onReset,
  totalCount,
  loading,
  onRefresh,
}: DateRangeFilterProps) {
  const [panelOpen, setPanelOpen] = useState(range === 'custom');

  const presets: { label: string; value: DateRangeType }[] = [
    { label: '⚡ Latest 100', value: 'latest' },
    { label: '1H', value: '1h' },
    { label: '6H', value: '6h' },
    { label: '24H', value: '24h' },
    { label: '7D', value: '7d' },
    { label: '30D', value: '30d' },
    { label: '📅 Custom Range', value: 'custom' },
  ];

  const handleSelectRange = (r: DateRangeType) => {
    onRangeChange(r);
    if (r === 'custom') {
      setPanelOpen(true);
    } else {
      setPanelOpen(false);
    }
  };

  const formatSummaryText = () => {
    if (range === 'latest') {
      return `Showing: Latest 100 data records ${totalCount !== undefined ? `(${totalCount} loaded)` : ''}`;
    }
    if (range === 'custom') {
      if (customStart || customEnd) {
        const s = customStart ? new Date(customStart).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Start';
        const e = customEnd ? new Date(customEnd).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Now';
        return `Showing: ${s} → ${e} ${totalCount !== undefined ? `(${totalCount} records)` : ''}`;
      }
      return 'Showing: Custom Date & Time Range';
    }
    return `Showing: Last ${range.toUpperCase()} time-series ${totalCount !== undefined ? `(${totalCount} records)` : ''}`;
  };

  return (
    <View style={styles.container}>
      {/* Top Bar: Presets + Refresh */}
      <View style={styles.topBar}>
        <View style={styles.presetsRow}>
          {presets.map((p) => {
            const isActive = range === p.value;
            return (
              <TouchableOpacity
                key={p.value}
                style={[styles.presetBtn, isActive && styles.presetBtnActive]}
                onPress={() => handleSelectRange(p.value)}
              >
                <Text style={[styles.presetBtnText, isActive && styles.presetBtnTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {onRefresh && (
          <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh} disabled={loading}>
            <Text style={styles.refreshBtnText}>{loading ? 'Loading...' : '🔄 Refresh'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Info Status Banner */}
      <View style={styles.statusBanner}>
        <Text style={styles.statusText}>ℹ️ {formatSummaryText()}</Text>
        {range === 'custom' && (
          <TouchableOpacity onPress={() => setPanelOpen((prev) => !prev)}>
            <Text style={styles.toggleText}>{panelOpen ? 'Hide Picker ▲' : 'Edit Dates ▼'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Expandable Custom Date & Time Selector Panel */}
      {panelOpen && (
        <View style={styles.customPanel}>
          <Text style={styles.panelTitle}>Select Specific Date & Time Window</Text>
          <Text style={styles.panelSubtitle}>
            Specify start and end date/time to inspect historical data points.
          </Text>

          <View style={styles.inputsGrid}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>From (Start Date & Time):</Text>
              {Platform.OS === 'web' ? (
                // @ts-ignore
                <input
                  type="datetime-local"
                  value={customStart}
                  onChange={(e: any) => onCustomStartChange(e.target.value)}
                  style={webInputStyle}
                />
              ) : (
                <TextInput
                  style={styles.textInput}
                  value={customStart}
                  placeholder="2026-09-17T10:00"
                  onChangeText={onCustomStartChange}
                />
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>To (End Date & Time):</Text>
              {Platform.OS === 'web' ? (
                // @ts-ignore
                <input
                  type="datetime-local"
                  value={customEnd}
                  onChange={(e: any) => onCustomEndChange(e.target.value)}
                  style={webInputStyle}
                />
              ) : (
                <TextInput
                  style={styles.textInput}
                  value={customEnd}
                  placeholder="2026-09-17T20:00"
                  onChangeText={onCustomEndChange}
                />
              )}
            </View>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.applyBtn} onPress={onApplyCustom} disabled={loading}>
              <Text style={styles.applyBtnText}>
                {loading ? 'Fetching...' : '✓ Apply Date & Time Filter'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.resetBtn} onPress={onReset}>
              <Text style={styles.resetBtnText}>↺ Reset to Latest 100</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const webInputStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  fontSize: '13px',
  color: '#0f172a',
  backgroundColor: '#ffffff',
  outline: 'none',
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: '#f1f5f9',
    padding: 4,
    borderRadius: 8,
  },
  presetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  presetBtnActive: {
    backgroundColor: '#2563eb',
    shadowColor: '#2563eb',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  presetBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  presetBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  refreshBtn: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  refreshBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  statusBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#2563eb',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
    marginLeft: 8,
  },
  customPanel: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 10,
  },
  panelTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  panelSubtitle: {
    fontSize: 11,
    color: '#64748b',
  },
  inputsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  inputGroup: {
    flex: 1,
    minWidth: 180,
    gap: 4,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  textInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: '#0f172a',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  applyBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  applyBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  resetBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  resetBtnText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
});
