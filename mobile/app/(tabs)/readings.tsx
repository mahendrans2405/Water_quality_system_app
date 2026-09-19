import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../../src/api/client';
import { authStore } from '../../src/state/authStore';
import { CompanySelector } from '../../components/company-selector';
import { StatusBadge } from '../../components/ui/status-badge';
import { ExportModal } from '../../components/export-modal';
import { CornerDatePicker, type CornerRangeType } from '../../components/corner-date-picker';
import type { DeviceSummary, TelemetryRecord, FieldMapping } from '../../src/api/types';

export default function ReadingsScreen() {
  const user = authStore((s) => s.user);
  const selectedCompanyId = authStore((s) => s.selectedCompanyId);
  const isSuperAdmin = user?.role === 'SuperAdmin';
  const canDownload = authStore((s) => s.canDownload());
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const isMobile = width < 650;
  const [viewMode, setViewMode] = useState<'cards' | 'table'>(isMobile ? 'cards' : 'table');

  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [range, setRange] = useState<CornerRangeType>('1d');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [items, setItems] = useState<TelemetryRecord[]>([]);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportModalVisible, setExportModalVisible] = useState(false);

  // 1. Load available devices
  async function loadDevices() {
    setDeviceLoading(true);
    try {
      const res = await api.get('/api/devices', {
        params: isSuperAdmin && selectedCompanyId ? { companyId: selectedCompanyId } : undefined,
      });

      const list: DeviceSummary[] = res.data?.data || [];
      setDevices(list);

      if (list.length > 0 && (!selectedDeviceId || !list.some((d) => d.id === selectedDeviceId))) {
        setSelectedDeviceId(list[0].id);
      }
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || 'Failed to load devices');
    } finally {
      setDeviceLoading(false);
    }
  }

  // 2. Load telemetry history for selected device
  async function loadTelemetry() {
    if (!selectedDeviceId) {
      setItems([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params: any = { range };
      if (range === 'custom') {
        if (customStart) params.start = new Date(customStart).toISOString();
        if (customEnd) params.end = new Date(customEnd).toISOString();
        params.limit = 200;
      } else {
        params.limit = 200;
      }

      const res = await api.get(`/api/iot/devices/${selectedDeviceId}/telemetry`, {
        params,
      });

      if (res.data?.ok) {
        setItems(res.data.data.items || []);
        setFieldMappings(res.data.data.fieldMappings || []);
      }
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || 'Failed to load telemetry data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDevices();
  }, [selectedCompanyId, user?.companyId]);

  useEffect(() => {
    loadTelemetry();
  }, [selectedDeviceId, range]);

  const selectedDevice = useMemo(
    () => devices.find((d) => d.id === selectedDeviceId) || null,
    [devices, selectedDeviceId]
  );

  const displayMappings = useMemo(() => {
    if (fieldMappings.length > 0) return fieldMappings;
    return selectedDevice?.fieldMappings || [
      { fieldNumber: 1, parameterName: 'pH', unit: 'pH' },
      { fieldNumber: 2, parameterName: 'Turbidity', unit: 'NTU' },
      { fieldNumber: 3, parameterName: 'TDS', unit: 'ppm' },
    ];
  }, [fieldMappings, selectedDevice]);

  // Sort items descending so the latest reading is at the TOP of the table / list
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [items]);

  const getParamColor = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('ph')) return '#2563eb';
    if (lower.includes('turbid')) return '#f59e0b';
    if (lower.includes('tds')) return '#10b981';
    if (lower.includes('temp')) return '#ef4444';
    return '#8b5cf6';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={[styles.content, { maxWidth: 1080, width: '100%', alignSelf: 'center', paddingBottom: Math.max(insets.bottom, 16) }]}>
        {/* Header Title & Corner Date Picker */}
        <View style={[styles.headerRow, isMobile && styles.headerRowMobile]}>
          <View style={{ flex: isMobile ? undefined : 1 }}>
            <Text style={styles.title}>Historical Readings</Text>
            <Text style={styles.subtitle}>
              Sensor logs (Latest at top · {sortedItems.length} records)
            </Text>
          </View>

          {/* Corner Date Selection: One Day, One Week, One Month, Custom */}
          <CornerDatePicker
            range={range}
            onRangeChange={(newRange) => setRange(newRange)}
            customStart={customStart}
            customEnd={customEnd}
            onCustomStartChange={setCustomStart}
            onCustomEndChange={setCustomEnd}
            onApplyCustom={loadTelemetry}
            onReset={() => {
              setCustomStart('');
              setCustomEnd('');
              setRange('1d');
            }}
            loading={loading}
          />
        </View>

        {isSuperAdmin && <CompanySelector />}

        {/* Device Selector Tabs */}
        {deviceLoading ? (
          <ActivityIndicator size="small" color="#2563eb" />
        ) : devices.length === 0 ? (
          <Text style={styles.noDeviceNotice}>No connected devices found for this organization.</Text>
        ) : (
          <View style={styles.deviceTabsWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.deviceTabs}>
              {devices.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  style={[styles.deviceTab, selectedDeviceId === d.id && styles.deviceTabActive]}
                  onPress={() => setSelectedDeviceId(d.id)}
                >
                  <Text style={[styles.deviceTabText, selectedDeviceId === d.id && styles.deviceTabTextActive]}>
                    {d.name || d.deviceId}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Mobile View Toggle & Export Bar */}
        <View style={styles.toolbar}>
          {/* Toggle between Card View and Table View */}
          <View style={styles.viewToggleGroup}>
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === 'cards' && styles.viewToggleBtnActive]}
              onPress={() => setViewMode('cards')}
            >
              <Text style={[styles.viewToggleText, viewMode === 'cards' && styles.viewToggleTextActive]}>
                📱 Mobile Cards
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === 'table' && styles.viewToggleBtnActive]}
              onPress={() => setViewMode('table')}
            >
              <Text style={[styles.viewToggleText, viewMode === 'table' && styles.viewToggleTextActive]}>
                📄 Table
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TouchableOpacity style={styles.refreshButton} onPress={loadTelemetry} disabled={loading}>
              <Text style={styles.refreshButtonText}>{loading ? '...' : '🔄 Refresh'}</Text>
            </TouchableOpacity>

            {canDownload && selectedDevice && (
              <TouchableOpacity
                style={styles.exportButton}
                onPress={() => setExportModalVisible(true)}
              >
                <Text style={styles.exportButtonText}>📥 Export</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {loading && <ActivityIndicator style={{ marginVertical: 12 }} />}

        {/* DATA DISPLAY: Mobile Cards (NO HORIZONTAL SCROLL) OR Traditional Table */}
        {!loading && sortedItems.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No telemetry records found in this time window.</Text>
          </View>
        ) : viewMode === 'cards' ? (
          /* MOBILE CARD VIEW: Everything fits perfectly without horizontal scrolling */
          <ScrollView
            style={styles.cardsScrollView}
            contentContainerStyle={styles.cardsContainer}
            showsVerticalScrollIndicator
          >
            {sortedItems.map((item, idx) => {
              const isSafe = !item.alerts || item.alerts.length === 0;

              return (
                <View key={item.id || idx} style={[styles.mobileCard, !isSafe && styles.mobileCardAlert]}>
                  {/* Card Header: Timestamp + Status */}
                  <View style={styles.mobileCardHeader}>
                    <View style={styles.timestampRow}>
                      <Text style={styles.clockIcon}>🕒</Text>
                      <Text style={styles.mobileCardTimestamp}>
                        {new Date(item.timestamp).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </Text>
                    </View>
                    <StatusBadge status={isSafe ? 'Safe' : 'Alert'} size="small" />
                  </View>

                  {/* Metrics Row: Fits on any phone width without horizontal scrolling */}
                  <View style={styles.metricsGrid}>
                    {displayMappings.map((m) => {
                      const param = item.parameters?.[m.parameterName];
                      const val = param?.value;
                      const hasAlert =
                        typeof val === 'number' &&
                        ((m.minThreshold !== null && m.minThreshold !== undefined && val < m.minThreshold) ||
                          (m.maxThreshold !== null && m.maxThreshold !== undefined && val > m.maxThreshold));
                      const paramColor = getParamColor(m.parameterName);

                      return (
                        <View
                          key={m.parameterName}
                          style={[styles.metricBox, hasAlert && styles.metricBoxAlert]}
                        >
                          <Text style={styles.metricParamName}>
                            {m.parameterName} {m.unit ? `(${m.unit})` : ''}
                          </Text>
                          <Text
                            style={[
                              styles.metricValue,
                              { color: hasAlert ? '#dc2626' : paramColor },
                            ]}
                          >
                            {val !== null && val !== undefined ? `${val}` : '--'}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        ) : (
          /* TABLE VIEW: (Horizontal scroll available if user chooses table mode) */
          <View style={styles.tableCard}>
            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
              <View style={{ minWidth: Math.max(520, width - 48) }}>
                {/* Table Header (Alerts column removed) */}
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableHeaderCell, { width: 180 }]}>Timestamp</Text>
                  {displayMappings.map((m) => (
                    <Text key={m.parameterName} style={[styles.tableHeaderCell, { width: 120 }]}>
                      {m.parameterName} {m.unit ? `(${m.unit})` : ''}
                    </Text>
                  ))}
                  <Text style={[styles.tableHeaderCell, { width: 100 }]}>Status</Text>
                </View>

                {/* Table Body */}
                <ScrollView style={{ maxHeight: 480 }} nestedScrollEnabled showsVerticalScrollIndicator>
                  {sortedItems.map((item, idx) => {
                    const isSafe = !item.alerts || item.alerts.length === 0;

                    return (
                      <View
                        key={item.id || idx}
                        style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}
                      >
                        <Text style={[styles.tableCell, { width: 180, fontSize: 11 }]}>
                          {new Date(item.timestamp).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </Text>

                        {displayMappings.map((m) => {
                          const param = item.parameters?.[m.parameterName];
                          const val = param?.value;
                          const hasAlert =
                            typeof val === 'number' &&
                            ((m.minThreshold !== null && m.minThreshold !== undefined && val < m.minThreshold) ||
                              (m.maxThreshold !== null && m.maxThreshold !== undefined && val > m.maxThreshold));

                          return (
                            <Text
                              key={m.parameterName}
                              style={[
                                styles.tableCell,
                                { width: 120, fontWeight: '700' },
                                hasAlert && styles.cellAlert,
                              ]}
                            >
                              {val !== null && val !== undefined ? `${val}` : '--'}
                            </Text>
                          );
                        })}

                        <View style={{ width: 100, justifyContent: 'center' }}>
                          <StatusBadge status={isSafe ? 'Safe' : 'Alert'} size="small" />
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            </ScrollView>
          </View>
        )}
      </View>

      {/* Export CSV Modal */}
      {selectedDevice && (
        <ExportModal
          visible={exportModalVisible}
          onClose={() => setExportModalVisible(false)}
          deviceId={selectedDevice.id}
          deviceName={selectedDevice.name || selectedDevice.deviceId}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    padding: 14,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  headerRowMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  subtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  noDeviceNotice: {
    color: '#64748b',
    fontSize: 13,
    fontStyle: 'italic',
  },
  deviceTabsWrapper: {
    gap: 4,
  },
  deviceTabs: {
    flexDirection: 'row',
    gap: 6,
  },
  deviceTab: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  deviceTabActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  deviceTabText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  deviceTabTextActive: {
    color: '#fff',
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  viewToggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    padding: 2,
  },
  viewToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  viewToggleBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  viewToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  viewToggleTextActive: {
    color: '#0f172a',
    fontWeight: '700',
  },
  refreshButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  refreshButtonText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
  },
  exportButton: {
    backgroundColor: '#16a34a',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  exportButtonText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '700',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 12,
  },
  emptyBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 30,
    alignItems: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 13,
    fontStyle: 'italic',
  },
  // Mobile Card Styles (No horizontal scrolling!)
  cardsScrollView: {
    flex: 1,
  },
  cardsContainer: {
    gap: 10,
    paddingBottom: 24,
  },
  mobileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  mobileCardAlert: {
    borderColor: '#fca5a5',
    backgroundColor: '#fffbfb',
  },
  mobileCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  clockIcon: {
    fontSize: 12,
  },
  mobileCardTimestamp: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricBox: {
    flex: 1,
    minWidth: 90,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  metricBoxAlert: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  metricParamName: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  // Table View Styles
  tableCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tableHeaderCell: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  tableRowAlt: {
    backgroundColor: '#f8fafc',
  },
  tableCell: {
    fontSize: 12,
    color: '#0f172a',
  },
  cellAlert: {
    color: '#dc2626',
  },
});
