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

  const getTodayStr = () => new Date().toISOString().split('T')[0];

  const getDaysAgoStr = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  };

  const getNowTimeStr = () => {
    const d = new Date();
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  };

  const getDecomposedStart = () => {
    const today = getTodayStr();
    if (!customStart) return { date: today, time: '00:00' };
    const [d, t] = customStart.split('T');
    return { date: d || today, time: t ? t.substring(0, 5) : '00:00' };
  };

  const getDecomposedEnd = () => {
    const today = getTodayStr();
    if (!customEnd) return { date: today, time: '23:59' };
    const [d, t] = customEnd.split('T');
    return { date: d || today, time: t ? t.substring(0, 5) : '23:59' };
  };

  const handleStartDateChange = (newDate: string) => {
    const { time } = getDecomposedStart();
    onCustomStartChange(`${newDate}T${time}`);
  };

  const handleStartTimeChange = (newTime: string) => {
    const { date } = getDecomposedStart();
    onCustomStartChange(`${date}T${newTime}`);
  };

  const handleEndDateChange = (newDate: string) => {
    const { time } = getDecomposedEnd();
    onCustomEndChange(`${newDate}T${time}`);
  };

  const handleEndTimeChange = (newTime: string) => {
    const { date } = getDecomposedEnd();
    onCustomEndChange(`${date}T${newTime}`);
  };

  const handleSelect = (val: CornerRangeType) => {
    setMenuVisible(false);
    if (val === 'custom') {
      if (!customStart) {
        onCustomStartChange(`${getTodayStr()}T00:00`);
      }
      if (!customEnd) {
        onCustomEndChange(`${getTodayStr()}T23:59`);
      }
      setCustomModalVisible(true);
    } else {
      onRangeChange(val);
    }
  };

  const handleApply = () => {
    const s = getDecomposedStart();
    const e = getDecomposedEnd();
    onCustomStartChange(`${s.date}T${s.time}`);
    onCustomEndChange(`${e.date}T${e.time}`);
    setCustomModalVisible(false);
    onRangeChange('custom');
    onApplyCustom();
  };

  const handleReset = () => {
    setCustomModalVisible(false);
    onReset();
    onRangeChange('1d');
  };

  const startDec = getDecomposedStart();
  const endDec = getDecomposedEnd();

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

      {/* Custom Date/Time Modal with Calendar and Time Selectors */}
      <Modal
        visible={customModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCustomModalVisible(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.customCard}>
            {/* Header */}
            <View style={styles.customHeader}>
              <View>
                <Text style={styles.customTitle}>Custom Calendar & Time Picker</Text>
                <Text style={styles.customSubtitle}>
                  Select exact date from calendar and specify hour/minute.
                </Text>
              </View>
              <TouchableOpacity onPress={() => setCustomModalVisible(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Active Selected Range Preview */}
            <View style={styles.previewBox}>
              <Text style={styles.previewLabel}>Active Range Window:</Text>
              <Text style={styles.previewText}>
                {startDec.date} {startDec.time} ➔ {endDec.date} {endDec.time}
              </Text>
            </View>

            {/* FROM (Start Window) */}
            <View style={styles.pickerSectionBox}>
              <Text style={styles.sectionHeaderTitle}>📅 From (Start Point):</Text>
              <View style={styles.pickerRow}>
                {/* Calendar Date Picker */}
                <View style={{ flex: 1.4 }}>
                  <Text style={styles.pickerSubLabel}>Calendar Date:</Text>
                  {Platform.OS === 'web' ? (
                    // @ts-ignore
                    <input
                      type="date"
                      value={startDec.date}
                      onChange={(e: any) => handleStartDateChange(e.target.value)}
                      style={webDateInputStyle}
                    />
                  ) : (
                    <TextInput
                      style={styles.textInput}
                      value={startDec.date}
                      placeholder="YYYY-MM-DD"
                      onChangeText={handleStartDateChange}
                    />
                  )}
                </View>

                {/* Time Picker */}
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickerSubLabel}>Time (Clock):</Text>
                  {Platform.OS === 'web' ? (
                    // @ts-ignore
                    <input
                      type="time"
                      value={startDec.time}
                      onChange={(e: any) => handleStartTimeChange(e.target.value)}
                      style={webDateInputStyle}
                    />
                  ) : (
                    <TextInput
                      style={styles.textInput}
                      value={startDec.time}
                      placeholder="HH:mm"
                      onChangeText={handleStartTimeChange}
                    />
                  )}
                </View>
              </View>

              {/* Start Quick Presets */}
              <View style={styles.shortcutsRow}>
                <TouchableOpacity
                  style={styles.shortcutChip}
                  onPress={() => handleStartDateChange(getTodayStr())}
                >
                  <Text style={styles.shortcutChipText}>Today</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.shortcutChip}
                  onPress={() => handleStartDateChange(getDaysAgoStr(1))}
                >
                  <Text style={styles.shortcutChipText}>Yesterday</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.shortcutChip}
                  onPress={() => handleStartDateChange(getDaysAgoStr(7))}
                >
                  <Text style={styles.shortcutChipText}>-7 Days</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.shortcutChipTime}
                  onPress={() => handleStartTimeChange('00:00')}
                >
                  <Text style={styles.shortcutChipTimeText}>00:00 (Start)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.shortcutChipTime}
                  onPress={() => handleStartTimeChange('12:00')}
                >
                  <Text style={styles.shortcutChipTimeText}>12:00 (Noon)</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* TO (End Window) */}
            <View style={styles.pickerSectionBox}>
              <Text style={styles.sectionHeaderTitle}>📅 To (End Point):</Text>
              <View style={styles.pickerRow}>
                {/* Calendar Date Picker */}
                <View style={{ flex: 1.4 }}>
                  <Text style={styles.pickerSubLabel}>Calendar Date:</Text>
                  {Platform.OS === 'web' ? (
                    // @ts-ignore
                    <input
                      type="date"
                      value={endDec.date}
                      onChange={(e: any) => handleEndDateChange(e.target.value)}
                      style={webDateInputStyle}
                    />
                  ) : (
                    <TextInput
                      style={styles.textInput}
                      value={endDec.date}
                      placeholder="YYYY-MM-DD"
                      onChangeText={handleEndDateChange}
                    />
                  )}
                </View>

                {/* Time Picker */}
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickerSubLabel}>Time (Clock):</Text>
                  {Platform.OS === 'web' ? (
                    // @ts-ignore
                    <input
                      type="time"
                      value={endDec.time}
                      onChange={(e: any) => handleEndTimeChange(e.target.value)}
                      style={webDateInputStyle}
                    />
                  ) : (
                    <TextInput
                      style={styles.textInput}
                      value={endDec.time}
                      placeholder="HH:mm"
                      onChangeText={handleEndTimeChange}
                    />
                  )}
                </View>
              </View>

              {/* End Quick Presets */}
              <View style={styles.shortcutsRow}>
                <TouchableOpacity
                  style={styles.shortcutChip}
                  onPress={() => handleEndDateChange(getTodayStr())}
                >
                  <Text style={styles.shortcutChipText}>Today</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.shortcutChipTime}
                  onPress={() => handleEndTimeChange('23:59')}
                >
                  <Text style={styles.shortcutChipTimeText}>23:59 (End)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.shortcutChipTime}
                  onPress={() => handleEndTimeChange(getNowTimeStr())}
                >
                  <Text style={styles.shortcutChipTimeText}>Now</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Action Buttons */}
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

const webDateInputStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: '8px',
  border: '1.5px solid #cbd5e1',
  fontSize: '13px',
  color: '#0f172a',
  backgroundColor: '#ffffff',
  outline: 'none',
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
  cursor: 'pointer',
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
    padding: 18,
    width: '100%',
    maxWidth: 440,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    gap: 12,
  },
  customHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  customTitle: {
    fontSize: 15,
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
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  previewBox: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  previewLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1e40af',
    textTransform: 'uppercase',
  },
  previewText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1d4ed8',
    marginTop: 2,
  },
  pickerSectionBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-end',
  },
  pickerSubLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
  },
  shortcutsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  shortcutChip: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  shortcutChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#334155',
  },
  shortcutChipTime: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  shortcutChipTimeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#3730a3',
  },
  textInput: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: '#0f172a',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
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
