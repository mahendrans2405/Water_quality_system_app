import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  TextInput,
  Modal,
  Pressable,
} from 'react-native';

export type CornerRangeType = '1d' | '7d' | '30d' | 'custom';

interface CornerDatePickerProps {
  range: CornerRangeType;
  onRangeChange: (range: CornerRangeType) => void;
  customStart: string;
  customEnd: string;
  onCustomStartChange: (val: string) => void;
  onCustomEndChange: (val: string) => void;
  onApplyCustom: () => void;
  onReset: () => void;
  loading?: boolean;
}

export function CornerDatePicker({
  range,
  onRangeChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
  onApplyCustom,
  onReset,
  loading,
}: CornerDatePickerProps) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [customModalVisible, setCustomModalVisible] = useState(false);

  const options: { label: string; value: CornerRangeType; desc: string }[] = [
    { label: 'One Day', value: '1d', desc: 'Last 24 Hours of telemetry' },
    { label: 'One Week', value: '7d', desc: 'Last 7 Days of telemetry' },
    { label: 'One Month', value: '30d', desc: 'Last 30 Days of telemetry' },
    { label: 'Custom', value: 'custom', desc: 'Select exact start & end dates' },
  ];

  const getActiveLabel = () => {
    switch (range) {
      case '1d':
        return 'One Day';
      case '7d':
        return 'One Week';
      case '30d':
        return 'One Month';
      case 'custom':
        return 'Custom';
      default:
        return 'One Day';
    }
  };

  const handleSelect = (val: CornerRangeType) => {
    setMenuVisible(false);
    if (val === 'custom') {
      setCustomModalVisible(true);
    } else {
      onRangeChange(val);
    }
  };

  const handleApply = () => {
    setCustomModalVisible(false);
    onRangeChange('custom');
    onApplyCustom();
  };

  const handleReset = () => {
    setCustomModalVisible(false);
    onReset();
    onRangeChange('1d');
  };

  return (
    <View style={styles.wrapper}>
      {/* Corner Dropdown Trigger Pill */}
      <TouchableOpacity
        style={styles.cornerTrigger}
        onPress={() => setMenuVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.calendarIcon}>📅</Text>
        <Text style={styles.triggerText}>{getActiveLabel()}</Text>
        <Text style={styles.dropdownArrow}>▾</Text>
      </TouchableOpacity>

      {/* Popover Selection Modal */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuCard}>
            <Text style={styles.menuTitle}>Select Time Window</Text>
            {options.map((opt) => {
              const isSelected = range === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.menuItem, isSelected && styles.menuItemActive]}
                  onPress={() => handleSelect(opt.value)}
                >
                  <View style={styles.menuItemLeft}>
                    <Text style={[styles.menuItemLabel, isSelected && styles.menuItemLabelActive]}>
                      {opt.label}
                    </Text>
                    <Text style={styles.menuItemDesc}>{opt.desc}</Text>
                  </View>
                  {isSelected && <Text style={styles.checkMark}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {/* Custom Date/Time Modal */}
      <Modal
        visible={customModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCustomModalVisible(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.customCard}>
            <View style={styles.customHeader}>
              <Text style={styles.customTitle}>Custom Date & Time Window</Text>
              <TouchableOpacity onPress={() => setCustomModalVisible(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.customSubtitle}>
              Select specific start and end dates/times to inspect historical records.
            </Text>

            <View style={styles.inputSection}>
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
                  placeholder="YYYY-MM-DDTHH:mm"
                  onChangeText={onCustomStartChange}
                />
              )}
            </View>

            <View style={styles.inputSection}>
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
                  placeholder="YYYY-MM-DDTHH:mm"
                  onChangeText={onCustomEndChange}
                />
              )}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.applyBtn, loading && styles.btnDisabled]}
                onPress={handleApply}
                disabled={loading}
              >
                <Text style={styles.applyBtnText}>
                  {loading ? 'Loading...' : '✓ Apply Range'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
                <Text style={styles.resetBtnText}>↺ Reset to 1 Day</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const webInputStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1.5px solid #cbd5e1',
  fontSize: '13px',
  color: '#0f172a',
  backgroundColor: '#ffffff',
  outline: 'none',
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    alignSelf: 'flex-end',
  },
  cornerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  calendarIcon: {
    fontSize: 13,
  },
  triggerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
  },
  dropdownArrow: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '800',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  menuCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    gap: 8,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  menuItemActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  menuItemLeft: {
    flex: 1,
  },
  menuItemLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  menuItemLabelActive: {
    color: '#2563eb',
  },
  menuItemDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  checkMark: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2563eb',
  },
  customCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 20,
    width: '100%',
    maxWidth: 380,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    gap: 12,
  },
  customHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  closeBtn: {
    fontSize: 18,
    color: '#94a3b8',
    fontWeight: '700',
    padding: 4,
  },
  customSubtitle: {
    fontSize: 12,
    color: '#64748b',
  },
  inputSection: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  textInput: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  applyBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  applyBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  resetBtn: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  resetBtnText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
