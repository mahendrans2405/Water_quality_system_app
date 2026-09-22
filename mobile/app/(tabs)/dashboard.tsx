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
import type { Branch, Company, DeviceLiveResponse, DeviceSummary, IotSummaryStats } from '../../src/api/types';
import { authStore } from '../../src/state/authStore';
import { CompanySelector } from '../../components/company-selector';
import { StatusBadge } from '../../components/ui/status-badge';

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const isMobile = width < 768;

  const router = useRouter();
  const user = authStore((s) => s.user);
  const companies = authStore((s) => s.companies);
  const selectedCompanyId = authStore((s) => s.selectedCompanyId);
  const signOut = authStore((s) => s.signOut);

  const isSuperAdmin = user?.role === 'SuperAdmin';
  const isCompanyUser = user?.role === 'Company';
  const isManager = user?.role === 'Manager' || user?.role === 'Manager1' || user?.role === 'Manager2';

  const [summaryStats, setSummaryStats] = useState<IotSummaryStats | null>(null);
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [deviceLiveMap, setDeviceLiveMap] = useState<Record<string, DeviceLiveResponse>>({});
  const [loading, setLoading] = useState(false);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');

  const targetCompanyId = isSuperAdmin ? selectedCompanyId : user?.companyId || null;

  const activeCompany = useMemo(() => {
    return (companies as Company[]).find((c) => c.id === targetCompanyId) || null;
  }, [companies, targetCompanyId]);

  const availableBranches = useMemo<Branch[]>(() => {
    return activeCompany?.branches || [];
  }, [activeCompany]);

  const availableUnits = useMemo(() => {
    if (selectedBranch === 'ALL') {
      const allUnits = new Set<string>();
      availableBranches.forEach((b) => b.units?.forEach((u) => allUnits.add(u.name)));
      return Array.from(allUnits);
    }
    const b = availableBranches.find((br) => br.name === selectedBranch);
    return b?.units?.map((u) => u.name) || [];
  }, [availableBranches, selectedBranch]);

  async function loadDashboardData() {
    if (!targetCompanyId && !isSuperAdmin) return;
    setError(null);
    setLoading(true);

    try {
      // 1. Fetch IoT summary KPIs
      const summaryParams: any = {};
      if (isSuperAdmin && selectedCompanyId) summaryParams.companyId = selectedCompanyId;
      if (selectedBranch !== 'ALL') summaryParams.branch = selectedBranch;
      if (selectedUnit !== 'ALL') summaryParams.unit = selectedUnit;

      const summaryRes = await api.get('/api/iot/summary', { params: summaryParams });
      if (summaryRes.data?.ok) {
        setSummaryStats(summaryRes.data.data);
      }

      // 2. Fetch Devices
      setDeviceLoading(true);
      const devParams: any = {};
      if (isSuperAdmin && selectedCompanyId) devParams.companyId = selectedCompanyId;
      if (selectedBranch !== 'ALL') devParams.branch = selectedBranch;
      if (selectedUnit !== 'ALL') devParams.unit = selectedUnit;

      const devRes = await api.get('/api/devices', { params: devParams });
      const devList: DeviceSummary[] = devRes.data?.data || [];
      setDevices(devList);

      // 3. Fetch live telemetry for each device
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
      const interval = setInterval(() => {
        loadDashboardData();
      }, 15000);
      return () => clearInterval(interval);
    }, [selectedCompanyId, user?.companyId, targetCompanyId, selectedBranch, selectedUnit])
  );

  // Client-side filtering by branch and unit for instantaneous feedback
  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      if (selectedBranch !== 'ALL' && d.branch && d.branch !== selectedBranch) return false;
      if (selectedUnit !== 'ALL' && d.unit && d.unit !== selectedUnit) return false;
      return true;
    });
  }, [devices, selectedBranch, selectedUnit]);

  async function handleDeleteDevice(deviceId: string, deviceName: string) {
    if (!isSuperAdmin) {
      Alert.alert('Access Denied', 'Only Super Admin has permission to delete devices.');
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { maxWidth: 1160, width: '100%', alignSelf: 'center', paddingBottom: Math.max(insets.bottom, 24) + 24 },
        ]}
      >
        {/* Header Section with TOP-RIGHT LOGOUT BUTTON */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.platformTitle}>IoT Water Quality Monitoring</Text>
              <Text style={styles.userSubtitle}>
                {user?.name} · <Text style={styles.roleTag}>{user?.role}</Text>
                {user?.branch ? ` · 🌿 ${user.branch}` : ''}
                {user?.unit ? ` · 🧪 ${user.unit}` : ''}
              </Text>
            </View>

            {/* TOP-RIGHT CORNER LOG OUT BUTTON */}
            <TouchableOpacity
              style={styles.headerLogoutBtn}
              onPress={() => {
                signOut();
                router.replace('/login');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.headerLogoutBtnText}>🚪 Log Out</Text>
            </TouchableOpacity>
          </View>

          {isSuperAdmin && <CompanySelector />}

          {activeCompany && (
            <View style={styles.activeCompanyBadge}>
              <Text style={styles.activeCompanyText}>
                Organization: <Text style={{ fontWeight: '700', color: '#0f172a' }}>{activeCompany.name}</Text>
                {activeCompany.address ? ` · Address: ${activeCompany.address}` : ''}
              </Text>
            </View>
          )}

          {/* Manager Assigned Scope Notice */}
          {isManager && (user?.branch || user?.unit) && (
            <View style={styles.managerScopeNotice}>
              <Text style={styles.managerScopeNoticeText}>
                🔒 Data Isolated View: Restricted to your assigned facility{' '}
                <Text style={{ fontWeight: '700' }}>
                  {user.branch ? `[Branch: ${user.branch}]` : ''} {user.unit ? `[Unit: ${user.unit}]` : ''}
                </Text>
              </Text>
            </View>
          )}
        </View>

        {/* Multi-Branch & Unit Filter Controls (For SuperAdmin and Company users) */}
        {!isManager && availableBranches.length > 0 && (
          <View style={styles.filterSectionCard}>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Filter by Branch:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsRow}>
                <TouchableOpacity
                  style={[styles.filterChip, selectedBranch === 'ALL' && styles.filterChipActive]}
                  onPress={() => {
                    setSelectedBranch('ALL');
                    setSelectedUnit('ALL');
                  }}
                >
                  <Text style={[styles.filterChipText, selectedBranch === 'ALL' && styles.filterChipTextActive]}>
                    All Branches ({availableBranches.length})
                  </Text>
                </TouchableOpacity>

                {availableBranches.map((b) => {
                  const isSel = selectedBranch === b.name;
                  return (
                    <TouchableOpacity
                      key={b.name}
                      style={[styles.filterChip, isSel && styles.filterChipActive]}
                      onPress={() => {
                        setSelectedBranch(b.name);
                        setSelectedUnit('ALL');
                      }}
                    >
                      <Text style={[styles.filterChipText, isSel && styles.filterChipTextActive]}>
                        {b.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {availableUnits.length > 0 && (
              <View style={[styles.filterGroup, { marginTop: 8 }]}>
                <Text style={styles.filterLabel}>Filter by Unit:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsRow}>
                  <TouchableOpacity
                    style={[styles.filterChip, selectedUnit === 'ALL' && styles.filterChipActive]}
                    onPress={() => setSelectedUnit('ALL')}
                  >
                    <Text style={[styles.filterChipText, selectedUnit === 'ALL' && styles.filterChipTextActive]}>
                      All Units ({availableUnits.length})
                    </Text>
                  </TouchableOpacity>

                  {availableUnits.map((u) => {
                    const isSel = selectedUnit === u;
                    return (
                      <TouchableOpacity
                        key={u}
                        style={[styles.filterChip, isSel && styles.filterChipActive]}
                        onPress={() => setSelectedUnit(u)}
                      >
                        <Text style={[styles.filterChipText, isSel && styles.filterChipTextActive]}>
                          {u}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        {/* High-Level KPI Cards (Responsive: Desktop sleek 4-bar, Mobile 2x2 grid) */}
        <View style={isDesktop ? styles.kpiGridDesktop : styles.kpiGridMobile}>
          <View style={[styles.kpiCard, isDesktop ? styles.kpiCardFlex : styles.kpiCardHalf, styles.kpiTotal]}>
            <View style={styles.kpiTopRow}>
              <Text style={styles.kpiIcon}>📡</Text>
              <Text style={styles.kpiLabel}>Total Devices</Text>
            </View>
            <Text style={styles.kpiValue}>{summaryStats?.totalDevices ?? filteredDevices.length}</Text>
          </View>

          <View style={[styles.kpiCard, isDesktop ? styles.kpiCardFlex : styles.kpiCardHalf, styles.kpiOnline]}>
            <View style={styles.kpiTopRow}>
              <Text style={styles.kpiIcon}>🟢</Text>
              <Text style={styles.kpiLabel}>Online</Text>
            </View>
            <Text style={[styles.kpiValue, { color: '#16a34a' }]}>
              {summaryStats?.onlineDevices ?? 0}
            </Text>
          </View>

          <View style={[styles.kpiCard, isDesktop ? styles.kpiCardFlex : styles.kpiCardHalf, styles.kpiWarning]}>
            <View style={styles.kpiTopRow}>
              <Text style={styles.kpiIcon}>⚠️</Text>
              <Text style={styles.kpiLabel}>Warning</Text>
            </View>
            <Text style={[styles.kpiValue, { color: '#d97706' }]}>
              {summaryStats?.warningDevices ?? 0}
            </Text>
          </View>

          <View style={[styles.kpiCard, isDesktop ? styles.kpiCardFlex : styles.kpiCardHalf, styles.kpiOffline]}>
            <View style={styles.kpiTopRow}>
              <Text style={styles.kpiIcon}>🔴</Text>
              <Text style={styles.kpiLabel}>Offline</Text>
            </View>
            <Text style={[styles.kpiValue, { color: '#dc2626' }]}>
              {summaryStats?.offlineDevices ?? 0}
            </Text>
          </View>
        </View>

        {/* Actions Bar */}
        <View style={styles.actionsBar}>
          <Text style={styles.sectionHeaderTitle}>
            Connected Devices ({filteredDevices.length})
            {selectedBranch !== 'ALL' ? ` · Branch: ${selectedBranch}` : ''}
            {selectedUnit !== 'ALL' ? ` · Unit: ${selectedUnit}` : ''}
          </Text>

          <View style={styles.actionsBtnRow}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={loadDashboardData}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryBtnText}>{loading ? 'Refreshing...' : '🔄 Refresh'}</Text>
            </TouchableOpacity>

            {isSuperAdmin && (
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
        {!deviceLoading && filteredDevices.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📡</Text>
            <Text style={styles.emptyTitle}>No Devices Configured</Text>
            <Text style={styles.emptyDesc}>
              {selectedBranch !== 'ALL' || selectedUnit !== 'ALL'
                ? 'No devices match the selected branch and unit filters.'
                : 'No IoT devices are registered for this company yet. Super Admin can register stations in the Admin console.'}
            </Text>
            {isSuperAdmin && (
              <TouchableOpacity
                style={[styles.primaryBtn, { marginTop: 12 }]}
                onPress={() => router.push('/(tabs)/admin')}
              >
                <Text style={styles.primaryBtnText}>+ Register Device in Admin ➔</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={isDesktop ? styles.deviceGridDesktop : styles.deviceGridMobile}>
            {filteredDevices.map((device) => {
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
                      <View style={styles.branchUnitRow}>
                        {device.branch ? <Text style={styles.deviceBranchBadge}>Branch: {device.branch}</Text> : null}
                        {device.unit ? <Text style={styles.deviceUnitBadge}>Unit: {device.unit}</Text> : null}
                      </View>
                      <Text style={styles.deviceMeta} numberOfLines={2}>
                        Hardware ID: {device.deviceId} · Channel: {device.channelId}
                        {device.location ? ` · Location: ${device.location}` : ''}
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
                        const severity = paramData.severity;
                        const isParamDanger = severity === 'DANGER';
                        const isParamWarn = severity === 'WARNING';
                        const isParamAlert = severity === 'ALERT';

                        const boxStyle = isParamDanger
                          ? styles.paramBoxDanger
                          : isParamWarn
                          ? styles.paramBoxWarn
                          : isParamAlert
                          ? styles.paramBoxAlert
                          : null;

                        const valStyle = isParamDanger
                          ? styles.paramValueDanger
                          : isParamWarn
                          ? styles.paramValueWarn
                          : isParamAlert
                          ? styles.paramValueAlert
                          : null;

                        return (
                          <View key={paramName} style={[styles.paramBox, boxStyle]}>
                            <Text style={styles.paramLabel}>{paramName}</Text>
                            <Text style={[styles.paramValue, valStyle]}>
                              {val !== null && val !== undefined ? `${val} ${paramData.unit}` : '--'}
                            </Text>
                            {paramData.targetDesc ? (
                              <Text style={styles.thresholdSub}>
                                Target: {paramData.targetDesc}
                              </Text>
                            ) : (paramData.minThreshold !== null || paramData.maxThreshold !== null) ? (
                              <Text style={styles.thresholdSub}>
                                Limits: {paramData.minThreshold ?? 0} - {paramData.maxThreshold ?? '∞'} {paramData.unit}
                              </Text>
                            ) : null}
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

                  {/* Last Communication Time & SuperAdmin Actions */}
                  <View style={styles.cardFooter}>
                    <Text style={styles.lastUpdatedText}>
                      🕒 Last Received:{' '}
                      {live?.lastDataReceived || device.lastDataReceived
                        ? new Date(live?.lastDataReceived || device.lastDataReceived!).toLocaleString()
                        : 'Never'}
                    </Text>

                    {isSuperAdmin && (
                      <View style={styles.cardBtnRow}>
                        <TouchableOpacity
                          style={styles.deleteBtn}
                          onPress={() => handleDeleteDevice(device.id, device.name || device.deviceId)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.deleteBtnText}>🗑️ Delete</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  {/* Expanded Device Details */}
                  {isSelected && (
                    <View style={styles.expandedDetails}>
                      <Text style={styles.expandedHeading}>Device Metadata & Isolation Details</Text>
                      <Text style={styles.detailLine}>
                        <Text style={{ fontWeight: '600' }}>Branch Assignment:</Text> {device.branch || 'Main Branch'}
                      </Text>
                      <Text style={styles.detailLine}>
                        <Text style={{ fontWeight: '600' }}>Monitoring Unit:</Text> {device.unit || 'Unit 1'}
                      </Text>
                      <Text style={styles.detailLine}>
                        <Text style={{ fontWeight: '600' }}>Device Type:</Text> {device.deviceType}
                      </Text>
                      <Text style={styles.detailLine}>
                        <Text style={{ fontWeight: '600' }}>Assigned Manager:</Text>{' '}
                        {device.assignedManagerUser
                          ? `${device.assignedManagerUser.name} (${device.assignedManagerUser.email})`
                          : 'Accessible to all managers in branch'}
                      </Text>
                      <Text style={styles.detailLine}>
                        <Text style={{ fontWeight: '600' }}>Offline Threshold:</Text>{' '}
                        {device.offlineThresholdMinutes} minutes
                      </Text>
                      <Text style={styles.detailLine}>
                        <Text style={{ fontWeight: '600' }}>Registered Date:</Text>{' '}
                        {new Date(device.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
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
  headerLogoutBtn: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  headerLogoutBtnText: {
    color: '#dc2626',
    fontSize: 13,
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
  },
  managerScopeNotice: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 2,
  },
  managerScopeNoticeText: {
    fontSize: 12,
    color: '#1e40af',
  },
  // Branch & Unit Filters
  filterSectionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
  },
  filterGroup: {
    gap: 6,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  filterChipsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  filterChip: {
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  filterChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  // KPI Grid Desktop & Mobile
  kpiGridDesktop: {
    flexDirection: 'row',
    gap: 12,
  },
  kpiGridMobile: {
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
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  kpiCardFlex: {
    flex: 1,
  },
  kpiCardHalf: {
    width: '48%',
    flexGrow: 1,
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
    fontSize: 16,
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  // Actions Bar
  actionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  actionsBtnRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  secondaryBtn: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  secondaryBtnText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
  },
  primaryBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    padding: 10,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 32,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 8,
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
    marginTop: 4,
    maxWidth: 400,
  },
  // Device Cards Grid
  deviceGridDesktop: {
    gap: 16,
  },
  deviceGridMobile: {
    gap: 12,
  },
  deviceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  deviceCardActive: {
    borderColor: '#2563eb',
  },
  deviceCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
  },
  branchUnitRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  deviceBranchBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#065f46',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  deviceUnitBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1e40af',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  deviceMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  expandChevronBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  expandChevronText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  // Parameter Grid
  paramGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paramBox: {
    flex: 1,
    minWidth: 100,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
  },
  paramBoxAlert: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  paramBoxWarn: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  paramBoxDanger: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  paramLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  paramValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  paramValueAlert: {
    color: '#d97706',
  },
  paramValueWarn: {
    color: '#ea580c',
  },
  paramValueDanger: {
    color: '#dc2626',
  },
  thresholdSub: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  noDataBox: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
    flexWrap: 'wrap',
    gap: 8,
  },
  lastUpdatedText: {
    fontSize: 11,
    color: '#64748b',
  },
  cardBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  deleteBtn: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  deleteBtnText: {
    color: '#dc2626',
    fontSize: 11,
    fontWeight: '600',
  },
  expandedDetails: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  expandedHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  detailLine: {
    fontSize: 12,
    color: '#475569',
  },
});
