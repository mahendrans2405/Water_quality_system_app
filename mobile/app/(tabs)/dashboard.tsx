import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Platform,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { api } from '../../src/api/client';
import type { DeviceSummary, DeviceLiveResponse, IotSummaryStats } from '../../src/api/types';
import { authStore } from '../../src/state/authStore';
import { CompanySelector } from '../../components/company-selector';
import { StatusBadge } from '../../components/ui/status-badge';
import { ExportModal } from '../../components/export-modal';

export default function DashboardScreen() {
  const router = useRouter();
  const signOut = authStore((s) => s.signOut);
  const user = authStore((s) => s.user);
  const companies = authStore((s) => s.companies);
  const selectedCompanyId = authStore((s) => s.selectedCompanyId);
  const isSuperAdmin = user?.role === 'SuperAdmin';
  const isCompanyUser = user?.role === 'Company';
  const isManager = user?.role === 'Manager' || user?.role === 'Manager1' || user?.role === 'Manager2';
  const canManageDevices = authStore((s) => s.hasPermission('devices.manage'));
  const canDownload = authStore((s) => s.canDownload());

  const [summaryStats, setSummaryStats] = useState<IotSummaryStats | null>(null);
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [deviceLiveMap, setDeviceLiveMap] = useState<Record<string, DeviceLiveResponse>>({});
  const [loading, setLoading] = useState(false);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [exportModalDevice, setExportModalDevice] = useState<{ id: string; name: string } | null>(null);

  const targetCompanyId = isSuperAdmin ? selectedCompanyId : user?.companyId || null;

  async function loadDashboardData() {
    if (!targetCompanyId && !isSuperAdmin) return;
    setError(null);
    setLoading(true);

    try {
      // 1. Fetch IoT summary KPIs
      const summaryRes = await api.get('/api/iot/summary', {
        params: isSuperAdmin && selectedCompanyId ? { companyId: selectedCompanyId } : undefined,
      });
      if (summaryRes.data?.ok) {
        setSummaryStats(summaryRes.data.data);
      }

      // 2. Fetch Devices
      setDeviceLoading(true);
      const devRes = await api.get('/api/devices', {
        params: isSuperAdmin && selectedCompanyId ? { companyId: selectedCompanyId } : undefined,
      });

      const devList: DeviceSummary[] = devRes.data?.data || [];
      setDevices(devList);

      // 3. Fetch live telemetry for each device via backend IoT service (cached)
      const liveResults: Record<string, DeviceLiveResponse> = {};
      await Promise.all(
        devList.map(async (dev) => {
          try {
            const liveRes = await api.get(`/api/iot/devices/${dev.id}/live`);
            if (liveRes.data?.ok) {
              liveResults[dev.id] = liveRes.data.data;
            }
          } catch (e) {
            console.warn(`Could not load live telemetry for ${dev.deviceId}:`, e);
          }
        })
      );

      setDeviceLiveMap(liveResults);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setDeviceLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
      // Auto-poll live sensor telemetry every 15 seconds
      const interval = setInterval(() => {
        loadDashboardData();
      }, 15000);
      return () => clearInterval(interval);
    }, [selectedCompanyId, user?.companyId, targetCompanyId])
  );



  async function handleDeleteDevice(deviceId: string, deviceName: string) {
    if (!canManageDevices) {
      Alert.alert('Access Denied', 'Managers do not have permission to delete devices.');
      return;
    }

    const doDelete = async () => {
      try {
        await api.delete(`/api/devices/${deviceId}`);
        setDevices((prev) => prev.filter((d) => d.id !== deviceId));
        setSelectedDeviceId(null);
        Alert.alert('Deleted', `Device ${deviceName} removed.`);
      } catch (e: any) {
        Alert.alert('Error', e?.response?.data?.error?.message || 'Failed to delete device');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Are you sure you want to delete ${deviceName}?`)) {
        await doDelete();
      }
      return;
    }

    Alert.alert('Delete Device', `Are you sure you want to delete ${deviceName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ]);
  }

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);
  const selectedDevice = devices.find((d) => d.id === selectedDeviceId);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.platformTitle}>IoT Water Quality Platform</Text>
              <Text style={styles.userSubtitle}>
                {user?.name} · <Text style={styles.roleTag}>{user?.role}</Text>
              </Text>
            </View>

            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={() => {
                signOut();
                router.replace('/login');
              }}
            >
              <Text style={styles.logoutBtnText}>Logout</Text>
            </TouchableOpacity>
          </View>

          {isSuperAdmin && <CompanySelector />}

          {selectedCompany && (
            <Text style={styles.activeCompanyText}>
              Organization: <Text style={{ fontWeight: '700' }}>{selectedCompany.name}</Text>
            </Text>
          )}
        </View>

        {/* High-Level KPI Cards */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, styles.kpiTotal]}>
            <Text style={styles.kpiLabel}>Total Devices</Text>
            <Text style={styles.kpiValue}>{summaryStats?.totalDevices ?? devices.length}</Text>
          </View>

          <View style={[styles.kpiCard, styles.kpiOnline]}>
            <Text style={styles.kpiLabel}>Online</Text>
            <Text style={[styles.kpiValue, { color: '#16a34a' }]}>
              {summaryStats?.onlineDevices ?? 0}
            </Text>
          </View>

          <View style={[styles.kpiCard, styles.kpiWarning]}>
            <Text style={styles.kpiLabel}>Warning</Text>
            <Text style={[styles.kpiValue, { color: '#d97706' }]}>
              {summaryStats?.warningDevices ?? 0}
            </Text>
          </View>

          <View style={[styles.kpiCard, styles.kpiOffline]}>
            <Text style={styles.kpiLabel}>Offline</Text>
            <Text style={[styles.kpiValue, { color: '#dc2626' }]}>
              {summaryStats?.offlineDevices ?? 0}
            </Text>
          </View>
        </View>

        {/* Action Controls */}
        <View style={styles.actionsBar}>
          <Text style={styles.sectionHeaderTitle}>Connected Devices ({devices.length})</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={loadDashboardData} disabled={loading}>
              <Text style={styles.secondaryBtnText}>{loading ? 'Refreshing...' : '🔄 Refresh'}</Text>
            </TouchableOpacity>

            {canManageDevices && (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => router.push('/(tabs)/admin')}
              >
                <Text style={styles.primaryBtnText}>⚙️ Manage in Admin ➔</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Loading and Error states */}
        {deviceLoading && <ActivityIndicator size="large" color="#2563eb" style={{ marginVertical: 20 }} />}
        {error && <Text style={styles.errorBanner}>{error}</Text>}

        {/* Device Cards List */}
        {!deviceLoading && devices.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📡</Text>
            <Text style={styles.emptyTitle}>No Devices Configured</Text>
            <Text style={styles.emptyDesc}>
              No IoT devices are registered for this company yet. Go to the Admin console to register your first ThingSpeak station.
            </Text>
            {canManageDevices && (
              <TouchableOpacity
                style={[styles.primaryBtn, { marginTop: 8 }]}
                onPress={() => router.push('/(tabs)/admin')}
              >
                <Text style={styles.primaryBtnText}>+ Register Device in Admin ➔</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          devices.map((device) => {
            const live = deviceLiveMap[device.id];
            const status = live?.status || device.status || 'No Recent Data';
            const telemetry = live?.telemetry;
            const parameters = telemetry?.parameters || {};
            const isSelected = selectedDeviceId === device.id;

            return (
              <View key={device.id} style={[styles.deviceCard, isSelected && styles.deviceCardActive]}>
                {/* Header Row */}
                <Pressable
                  style={styles.deviceCardTop}
                  onPress={() => setSelectedDeviceId((prev) => (prev === device.id ? null : device.id))}
                >
                  <View style={{ flex: 1 }}>
                    <View style={styles.titleWithBadge}>
                      <Text style={styles.deviceCardTitle}>{device.name || device.deviceId}</Text>
                      <StatusBadge status={status} size="small" />
                    </View>
                    <Text style={styles.deviceMeta}>
                      ID: {device.deviceId} · Channel: {device.channelId}
                      {device.location ? ` · 📍 ${device.location}` : ''}
                    </Text>
                  </View>

                  <Text style={styles.expandChevron}>{isSelected ? '▲ Less' : '▼ More'}</Text>
                </Pressable>

                {/* Telemetry Parameter Grid */}
                <View style={styles.paramGrid}>
                  {Object.keys(parameters).length > 0 ? (
                    Object.entries(parameters).map(([paramName, paramData]) => {
                      const val = paramData.value;
                      const hasThreshold = paramData.minThreshold !== null || paramData.maxThreshold !== null;
                      const isAlert =
                        typeof val === 'number' &&
                        ((paramData.minThreshold !== null && val < (paramData.minThreshold as number)) ||
                          (paramData.maxThreshold !== null && val > (paramData.maxThreshold as number)));

                      return (
                        <View key={paramName} style={[styles.paramBox, isAlert && styles.paramBoxAlert]}>
                          <Text style={styles.paramLabel}>{paramName}</Text>
                          <Text style={[styles.paramValue, isAlert && styles.paramValueAlert]}>
                            {val !== null && val !== undefined ? `${val} ${paramData.unit}` : '--'}
                          </Text>
                          {hasThreshold && (
                            <Text style={styles.thresholdSub}>
                              Limits: {paramData.minThreshold ?? 0} - {paramData.maxThreshold ?? '∞'} {paramData.unit}
                            </Text>
                          )}
                        </View>
                      );
                    })
                  ) : (
                    <View style={styles.noDataBox}>
                      <Text style={styles.noDataText}>
                        {live?.isStale ? '⚠️ Showing cached readings' : 'Awaiting sensor feeds from ThingSpeak...'}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Last Communication Time */}
                <View style={styles.cardFooter}>
                  <Text style={styles.lastUpdatedText}>
                    Last Received:{' '}
                    {live?.lastDataReceived || device.lastDataReceived
                      ? new Date(live?.lastDataReceived || device.lastDataReceived!).toLocaleString()
                      : 'Never'}
                  </Text>

                  {/* Actions Row */}
                  <View style={styles.cardBtnRow}>
                    {/* CSV Download - Visible for SuperAdmin & Company; Hidden for Managers */}
                    {canDownload && (
                      <TouchableOpacity
                        style={styles.exportBtn}
                        onPress={() => setExportModalDevice({ id: device.id, name: device.name || device.deviceId })}
                      >
                        <Text style={styles.exportBtnText}>📥 Export CSV</Text>
                      </TouchableOpacity>
                    )}

                    {canManageDevices && (
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => handleDeleteDevice(device.id, device.name || device.deviceId)}
                      >
                        <Text style={styles.deleteBtnText}>Delete</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Expanded Device Details */}
                {isSelected && (
                  <View style={styles.expandedDetails}>
                    <Text style={styles.expandedHeading}>Device Metadata & Configuration</Text>
                    <Text style={styles.detailLine}>
                      <Text style={{ fontWeight: '600' }}>Device Type:</Text> {device.deviceType}
                    </Text>
                    <Text style={styles.detailLine}>
                      <Text style={{ fontWeight: '600' }}>Offline Threshold:</Text> {device.offlineThresholdMinutes} minutes
                    </Text>
                    <Text style={styles.detailLine}>
                      <Text style={{ fontWeight: '600' }}>Assigned Manager:</Text>{' '}
                      {device.assignedManagerUser ? `${device.assignedManagerUser.name} (${device.assignedManagerUser.email})` : 'Unassigned (Accessible to all company managers)'}
                    </Text>
                    <Text style={styles.detailLine}>
                      <Text style={{ fontWeight: '600' }}>Registered Date:</Text>{' '}
                      {new Date(device.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Export CSV Modal */}
      {exportModalDevice && (
        <ExportModal
          visible={Boolean(exportModalDevice)}
          onClose={() => setExportModalDevice(null)}
          deviceId={exportModalDevice.id}
          deviceName={exportModalDevice.name}
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
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  header: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    gap: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  platformTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  userSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  roleTag: {
    fontWeight: '700',
    color: '#2563eb',
  },
  logoutBtn: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  logoutBtnText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '700',
  },
  activeCompanyText: {
    fontSize: 13,
    color: '#334155',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  kpiCard: {
    flex: 1,
    minWidth: 75,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    alignItems: 'center',
  },
  kpiTotal: {
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  kpiOnline: {
    borderLeftWidth: 4,
    borderLeftColor: '#22c55e',
  },
  kpiWarning: {
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  kpiOffline: {
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  actionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  primaryBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  secondaryBtnText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
  },
  registerFormCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 16,
    gap: 8,
  },
  formHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  formSub: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginTop: 4,
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  formGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  saveDeviceBtn: {
    backgroundColor: '#16a34a',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  saveDeviceBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
    borderWidth: 1,
    color: '#b91c1c',
    padding: 12,
    borderRadius: 8,
    fontSize: 13,
  },
  emptyState: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: {
    fontSize: 36,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  emptyDesc: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    maxWidth: 320,
  },
  deviceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    gap: 12,
  },
  deviceCardActive: {
    borderColor: '#2563eb',
    backgroundColor: '#fafcff',
  },
  deviceCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deviceCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  deviceMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  expandChevron: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '600',
  },
  paramGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paramBox: {
    flex: 1,
    minWidth: 90,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    alignItems: 'center',
  },
  paramBoxAlert: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
  },
  paramLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 2,
  },
  paramValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  paramValueAlert: {
    color: '#e11d48',
  },
  thresholdSub: {
    fontSize: 9,
    color: '#94a3b8',
    marginTop: 2,
  },
  noDataBox: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
  },
  lastUpdatedText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  cardBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  exportBtn: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  exportBtnText: {
    fontSize: 11,
    color: '#1d4ed8',
    fontWeight: '700',
  },
  deleteBtn: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  deleteBtnText: {
    fontSize: 11,
    color: '#dc2626',
    fontWeight: '600',
  },
  expandedDetails: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
    gap: 4,
  },
  expandedHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  detailLine: {
    fontSize: 12,
    color: '#475569',
  },
});
