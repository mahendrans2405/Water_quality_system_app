import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';

import { api } from '../src/api/client';
import { authStore } from '../src/state/authStore';

interface ExportModalProps {
  visible: boolean;
  onClose: () => void;
  deviceId: string;
  deviceName: string;
}

export function ExportModal({ visible, onClose, deviceId, deviceName }: ExportModalProps) {
  const canDownload = authStore((s) => s.canDownload());
  const [range, setRange] = useState<'latest' | '1h' | '6h' | '24h' | '7d' | '30d'>('latest');
  const [loading, setLoading] = useState(false);

  const ranges = [
    { label: 'Latest 100 Records', value: 'latest' },
    { label: 'Last 1 Hour', value: '1h' },
    { label: 'Last 6 Hours', value: '6h' },
    { label: 'Last 24 Hours', value: '24h' },
    { label: 'Last 7 Days', value: '7d' },
    { label: 'Last 30 Days', value: '30d' },
  ] as const;

  const handleDownload = async () => {
    if (!canDownload) {
      if (Platform.OS === 'web') {
        window.alert('Permission Denied: Managers do not have permission to download or export device data.');
      } else {
        Alert.alert('Permission Denied', 'Managers do not have permission to download or export device data.');
      }
      return;
    }

    setLoading(true);
    try {
      const response = await api.get(`/api/iot/devices/${deviceId}/export`, {
        params: { range },
        responseType: 'text',
      });

      const csvData = response.data;
      const filename = `${deviceName.replace(/\s+/g, '_')}_${range}_${Date.now()}.csv`;

      if (Platform.OS === 'web') {
        // Trigger browser file download
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        window.alert(`Export complete: ${filename} downloaded successfully.`);
      } else {
        Alert.alert('Export Ready', `Exported ${filename}. Check your device downloads.`);
      }

      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to export telemetry data';
      if (Platform.OS === 'web') {
        window.alert(`Export Error: ${msg}`);
      } else {
        Alert.alert('Export Error', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <Text style={styles.title}>Export Telemetry Data</Text>
          <Text style={styles.subtitle}>Device: {deviceName} ({deviceId})</Text>

          {!canDownload ? (
            <View style={styles.restrictedBox}>
              <Text style={styles.restrictedText}>
                ⚠️ You do not have permission to download or export data. Contact your company administrator.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionLabel}>Select Time Range:</Text>
              <View style={styles.rangeOptions}>
                {ranges.map((r) => (
                  <TouchableOpacity
                    key={r.value}
                    style={[styles.rangeBtn, range === r.value && styles.rangeBtnActive]}
                    onPress={() => setRange(r.value)}
                  >
                    <Text style={[styles.rangeText, range === r.value && styles.rangeTextActive]}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.formatNotice}>Format: Standard CSV (pH, TDS, Turbidity, Timestamps, Alerts)</Text>
            </>
          )}

          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={onClose} disabled={loading}>
              <Text style={styles.cancelText}>Close</Text>
            </TouchableOpacity>

            {canDownload && (
              <TouchableOpacity
                style={[styles.btn, styles.downloadBtn, loading && styles.btnDisabled]}
                onPress={handleDownload}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.downloadText}>Download CSV</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 440,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  rangeOptions: {
    gap: 8,
    marginBottom: 16,
  },
  rangeBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  rangeBtnActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  rangeText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  rangeTextActive: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  formatNotice: {
    fontSize: 11,
    color: '#64748b',
    fontStyle: 'italic',
    marginBottom: 20,
  },
  restrictedBox: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 8,
    padding: 12,
    marginVertical: 16,
  },
  restrictedText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '600',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: '#f1f5f9',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  downloadBtn: {
    backgroundColor: '#2563eb',
  },
  downloadText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
