import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';

import { api } from '../../src/api/client';
import type { DeviceSummary, DeviceLiveResponse, IotSummaryStats } from '../../src/api/types';
import { authStore } from '../../src/state/authStore';
import { CompanySelector } from '../../components/company-selector';
import { StatusBadge } from '../../components/ui/status-badge';
import { ExportModal } from '../../components/export-modal';

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 960;
  const isTablet = width >= 640 && width < 960;
  const isMobile = width < 640;

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
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { maxWidth: 1080, width: '100%', alignSelf: 'center', paddingBottom: Math.max(insets.bottom, 24) + 24 }]}>
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1, marginRight: 10 }}>
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
              activeOpacity={0.7}
            >
              <Text style={styles.logoutBtnText}>Logout</Text>
            </TouchableOpacity>
          </View>

          {isSuperAdmin && <CompanySelector />}

          {selectedCompany && (
            <View style={styles.activeCompanyBadge}>
              <Text style={styles.activeCompanyText}>
                Organization: <Text style={{ fontWeight: '700', color: '#0f172a' }}>{selectedCompany.name}</Text>
              </Text>
            </View>
          )}
        </View>

        {/* High-Level KPI Cards */}
        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, isMobile ? styles.kpiCardMobile : styles.kpiCardDesktop, styles.kpiTotal]}>
            <View style={styles.kpiTopRow}>
              <Text style={styles.kpiIcon}>📡</Text>
              <Text style={styles.kpiLabel}>Total Devices</Text>
            </View>
            <Text style={styles.kpiValue}>{summaryStats?.totalDevices ?? devices.length}</Text>
          </View>

          <View style={[styles.kpiCard, isMobile ? styles.kpiCardMobile : styles.kpiCardDesktop, styles.kpiOnline]}>
            <View style={styles.kpiTopRow}>
              <Text style={styles.kpiIcon}>🟢</Text>
              <Text style={styles.kpiLabel}>Online</Text>
            </View>
            <Text style={[styles.kpiValue, { color: '#16a34a' }]}>
              {summaryStats?.onlineDevices ?? 0}
            </Text>
          </View>

          <View style={[styles.kpiCard, isMobile ? styles.kpiCardMobile : styles.kpiCardDesktop, styles.kpiWarning]}>
            <View style={styles.kpiTopRow}>
              <Text style={styles.kpiIcon}>⚠️</Text>
              <Text style={styles.kpiLabel}>Warning</Text>
            </View>
            <Text style={[styles.kpiValue, { color: '#d97706' }]}>
              {summaryStats?.warningDevices ?? 0}
            </Text>
          </View>

          <View style={[styles.kpiCard, isMobile ? styles.kpiCardMobile : styles.kpiCardDesktop, styles.kpiOffline]}>
            <View style={styles.kpiTopRow}>
              <Text style={styles.kpiIcon}>🔴</Text>
              <Text style={styles.kpiLabel}>Offline</Text>
            </View>
            <Text style={[styles.kpiValue, { color: '#dc2626' }]}>
              {summaryStats?.offlineDevices ?? 0}
            </Text>
          </View>
        </View>

        {/* Action Controls */}
        <View style={[styles.actionsBar, isMobile && styles.actionsBarMobile]}>
          <Text style={styles.sectionHeaderTitle}>Connected Devices ({devices.length})</Text>
          <View style={styles.actionsBtnRow}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={loadDashboardData} disabled={loading} activeOpacity={0.7}>
              <Text style={styles.secondaryBtnText}>{loading ? 'Refreshing...' : '🔄 Refresh'}</Text>
            </TouchableOpacity>

            {canManageDevices && (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => router.push('/(tabs)/admin')}
                activeOpacity={0.7}
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
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <View style={styles.titleWithBadge}>
                      <Text style={styles.deviceCardTitle}>{device.name || device.deviceId}</Text>
                      <StatusBadge status={status} size="small" />
                    </View>
                    <Text style={styles.deviceMeta} numberOfLines={2}>
                      ID: {device.deviceId} · Channel: {device.channelId}
                      {device.location ? ` · 📍 ${device.location}` : ''}
                    </Text>
                  </View>

                  <View style={styles.expandChevronBadge}>
                    <Text style={styles.expandChevronText}>{isSelected ? '▲ Less' : '▼ Details'}</Text>
                  </View>
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

                {/* Last Communication Time & Actions */}
                <View style={[styles.cardFooter, isMobile && styles.cardFooterMobile]}>
                  <Text style={styles.lastUpdatedText}>
                    🕒 Last Received:{' '}
                    {live?.lastDataReceived || device.lastDataReceived
                      ? new Date(live?.lastDataReceived || device.lastDataReceived!).toLocaleString()
                      : 'Never'}
                  </Text>

                  {/* Actions Row */}
                  <View style={[styles.cardBtnRow, isMobile && styles.cardBtnRowMobile]}>
                    {/* CSV Download - Visible for SuperAdmin & Company; Hidden for Managers */}
                    {canDownload && (
                      <TouchableOpacity
                        style={styles.exportBtn}
                        onPress={() => setExportModalDevice({ id: device.id, name: device.name || device.deviceId })}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.exportBtnText}>📥 Export CSV</Text>
                      </TouchableOpacity>
                    )}

                    {canManageDevices && (
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => handleDeleteDevice(device.id, device.name || device.deviceId)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.deleteBtnText}>🗑️ Delete</Text>
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
  activeCompanyBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 4,
  },
  activeCompanyText: {
    fontSize: 13,
    color: '#475569',
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  kpiCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  kpiCardMobile: {
    width: '48%',
    flexGrow: 1,
    minWidth: 135,
  },
  kpiCardDesktop: {
    flex: 1,
    minWidth: 160,
  },
  kpiTotal: {
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  kpiOnline: {
    borderLeftWidth: 4,
    borderLeftColor: '#16a34a',
  },
  kpiWarning: {
    borderLeftWidth: 4,
    borderLeftColor: '#d97706',
  },
  kpiOffline: {
    borderLeftWidth: 4,
    borderLeftColor: '#dc2626',
  },
  kpiTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  kpiIcon: {
    fontSize: 14,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  actionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  actionsBarMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 10,
  },
  actionsBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  primaryBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  secondaryBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
  },
  secondaryBtnText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
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
    gap: 10,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  deviceCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  deviceMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 3,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  expandChevronBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  expandChevronText: {
    fontSize: 11,
    color: '#1d4ed8',
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  paramGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paramBox: {
    flex: 1,
    minWidth: 95,
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
    fontWeight: '700',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  paramValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  paramValueAlert: {
    color: '#e11d48',
  },
  thresholdSub: {
    fontSize: 9,
    color: '#94a3b8',
    marginTop: 3,
    fontWeight: '500',
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
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
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
    gap: 8,
  },
  cardFooterMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 10,
  },
  lastUpdatedText: {
    fontSize: 11,
    color: '#64748b',
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  cardBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardBtnRowMobile: {
    alignSelf: 'flex-start',
    flexWrap: 'wrap',
  },
  exportBtn: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  exportBtnText: {
    fontSize: 11,
    color: '#1d4ed8',
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  deleteBtn: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteBtnText: {
    fontSize: 11,
    color: '#dc2626',
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  expandedDetails: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
    gap: 6,
  },
  expandedHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  detailLine: {
    fontSize: 12,
    color: '#475569',
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
});
