import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

/**
 * Evaluates water potability & drinkability messages based on status and WHO tier
 */
function getDrinkabilityInfo(status: string, severity?: string, hasData?: boolean) {
  if (!hasData || status === 'No Recent Data') {
    return {
      statusText: 'No Data',
      drinkableMessage: '⚪ Sensor Data Pending',
      badgeColor: '#f1f5f9',
      borderColor: '#cbd5e1',
      textColor: '#475569',
      bannerBg: '#f8fafc',
      bannerBorder: '#e2e8f0',
      bannerIcon: '📡',
      detailMsg: 'Awaiting sensor feeds from ThingSpeak. Water drinkability cannot be verified yet.',
    };
  }

  if (status === 'Offline') {
    return {
      statusText: 'Offline',
      drinkableMessage: '⚪ Station Offline',
      badgeColor: '#fef2f2',
      borderColor: '#fecaca',
      textColor: '#dc2626',
      bannerBg: '#fff1f2',
      bannerBorder: '#fecdd3',
      bannerIcon: '⚠️',
      detailMsg: 'Station is offline (threshold reached). Showing last recorded water quality readings.',
    };
  }

  if (severity === 'DANGER' || status === 'Danger') {
    return {
      statusText: 'Danger',
      drinkableMessage: '🚫 Not Drinkable (Unsafe)',
      badgeColor: '#fef2f2',
      borderColor: '#f87171',
      textColor: '#b91c1c',
      bannerBg: '#fee2e2',
      bannerBorder: '#f87171',
      bannerIcon: '⛔',
      detailMsg: 'DANGER: Critical water contamination thresholds breached! Water is NOT safe for direct drinking. Immediate treatment required.',
    };
  }

  if (severity === 'WARNING' || severity === 'ALERT' || status === 'Warning') {
    return {
      statusText: 'Warning',
      drinkableMessage: '⚠️ Not Drinkable (Filter Required)',
      badgeColor: '#fffbeb',
      borderColor: '#fcd34d',
      textColor: '#b45309',
      bannerBg: '#fef3c7',
      bannerBorder: '#fde68a',
      bannerIcon: '⚠️',
      detailMsg: 'CAUTION: Water parameters deviate from WHO acceptable limits. Filtration, boiling, or treatment required before drinking.',
    };
  }

  return {
    statusText: 'Safe',
    drinkableMessage: '💧 Drinkable (Safe Water)',
    badgeColor: '#ecfdf5',
    borderColor: '#6ee7b7',
    textColor: '#047857',
    bannerBg: '#ecfdf5',
    bannerBorder: '#a7f3d0',
    bannerIcon: '💧',
    detailMsg: 'SAFE: All water quality parameters (pH, TDS, Turbidity) meet WHO drinking standards. Water is potable and safe to drink.',
  };
}

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

  // Branch-based, Unit-based, and Multi-unit manager view scoping
  const managerAssignedUnits: string[] = useMemo(() => {
    // Prefer the units array from the user object (multi-unit support)
    if (Array.isArray(user?.units) && user.units.length > 0) return user.units;
    if (user?.unit) return [user.unit];
    return [];
  }, [user]);

  const isMultiUnitManager = isManager && Boolean(user?.branch) && managerAssignedUnits.length > 1;
  const isBranchScopedManager = isManager && Boolean(user?.branch) && managerAssignedUnits.length === 0;
  const isUnitScopedManager = isManager && Boolean(user?.branch) && managerAssignedUnits.length === 1;

  const managerBranchObj = useMemo(() => {
    if (!user?.branch) return null;
    return availableBranches.find((b) => b.name.toLowerCase() === user.branch?.toLowerCase()) || null;
  }, [user?.branch, availableBranches]);

  // managerUnits: units this manager is allowed to view in their unit filter
  const managerUnits = useMemo(() => {
    if (isMultiUnitManager) return managerAssignedUnits;
    if (isBranchScopedManager && managerBranchObj) return managerBranchObj.units?.map((u) => u.name) || [];
    return managerAssignedUnits;
  }, [isMultiUnitManager, isBranchScopedManager, managerAssignedUnits, managerBranchObj]);

  // Synchronize manager scope selection
  useEffect(() => {
    if (isManager && user?.branch) {
      setSelectedBranch(user.branch);
    }
  }, [isManager, user?.branch]);

  useEffect(() => {
    // For single-unit managers, lock the unit filter
    if (isUnitScopedManager && managerAssignedUnits.length === 1) {
      setSelectedUnit(managerAssignedUnits[0]);
    }
  }, [isUnitScopedManager, managerAssignedUnits]);

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

  // Selected device for live detail inspection: ONLY shown after CLICK (null by default)
  const effectiveSelectedDevice = useMemo(() => {
    if (!selectedDeviceId) return null;
    return filteredDevices.find((d) => d.id === selectedDeviceId) || null;
  }, [selectedDeviceId, filteredDevices]);

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
          {isManager && (
            <View style={styles.managerScopeNotice}>
              <Text style={styles.managerScopeNoticeText}>
                {isMultiUnitManager ? (
                  <>
                    🔒 Multi-Unit View:{' '}
                    <Text style={{ fontWeight: '700' }}>
                      [Branch: {user?.branch}] [Units: {managerAssignedUnits.join(', ')}]
                    </Text>
                  </>
                ) : isUnitScopedManager ? (
                  <>
                    🔒 Restricted Facility View:{' '}
                    <Text style={{ fontWeight: '700' }}>
                      [Branch: {user?.branch}] [Unit: {managerAssignedUnits[0] || user?.unit}]
                    </Text>
                  </>
                ) : isBranchScopedManager ? (
                  <>
                    🌐 Branch-Wide View:{' '}
                    <Text style={{ fontWeight: '700' }}>
                      [Branch: {user?.branch}] (All Units in Branch)
                    </Text>
                  </>
                ) : (
                  <>
                    🏢 Organization View:{' '}
                    <Text style={{ fontWeight: '700' }}>
                      All Branches & Units
                    </Text>
                  </>
                )}
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

        {/* Unit Filter Controls for Branch-Based or Multi-Unit Managers */}
        {(isBranchScopedManager || isMultiUnitManager) && managerUnits.length > 0 && (
          <View style={styles.filterSectionCard}>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>
                {isMultiUnitManager ? `Your Authorized Units in ${user?.branch}:` : `Filter by Unit in ${user?.branch}:`}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsRow}>
                <TouchableOpacity
                  style={[styles.filterChip, selectedUnit === 'ALL' && styles.filterChipActive]}
                  onPress={() => setSelectedUnit('ALL')}
                >
                  <Text style={[styles.filterChipText, selectedUnit === 'ALL' && styles.filterChipTextActive]}>
                    All ({managerUnits.length})
                  </Text>
                </TouchableOpacity>

                {managerUnits.map((u) => {
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
          <View style={styles.horizontalDeviceSection}>
            {/* Horizontal Scroll of Device Cards */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalDeviceRow}
            >
              {filteredDevices.map((device) => {
                const live = deviceLiveMap[device.id];
                const status = live?.status || device.status || 'No Recent Data';
                const telemetry = live?.telemetry;
                const parameters = telemetry?.parameters || {};
                const hasData = Boolean(telemetry && Object.keys(parameters).length > 0);
                const severity =
                  telemetry?.severity ||
                  ((status as string) === 'Danger'
                    ? 'DANGER'
                    : (status as string) === 'Warning'
                    ? 'WARNING'
                    : (status as string) === 'Safe'
                    ? 'NORMAL'
                    : undefined);
                const drinkInfo = getDrinkabilityInfo(status, severity, hasData);
                const isSelected = effectiveSelectedDevice?.id === device.id;

                return (
                  <TouchableOpacity
                    key={device.id}
                    style={[
                      styles.horizontalDeviceCard,
                      isSelected && styles.horizontalDeviceCardSelected,
                    ]}
                    onPress={() => {
                      setSelectedDeviceId((prev) => (prev === device.id ? null : device.id));
                    }}
                    activeOpacity={0.7}
                  >
                    {/* Top Row: Device Name & Status */}
                    <View style={styles.hCardHeader}>
                      <Text style={styles.hCardTitle} numberOfLines={1}>
                        {device.name || device.deviceId}
                      </Text>
                      <StatusBadge status={status} size="small" />
                    </View>

                    {/* Branch & Unit tags */}
                    <View style={styles.hCardBadgesRow}>
                      <Text style={styles.hCardBranchBadge}>
                        🏢 {device.branch || 'Main Branch'}
                      </Text>
                      <Text style={styles.hCardUnitBadge}>
                        📍 {device.unit || 'Unit 1'}
                      </Text>
                    </View>

                    {/* Drinkability Status Pill */}
                    <View
                      style={[
                        styles.hCardDrinkablePill,
                        {
                          backgroundColor: drinkInfo.badgeColor,
                          borderColor: drinkInfo.borderColor,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.hCardDrinkableText,
                          { color: drinkInfo.textColor },
                        ]}
                        numberOfLines={1}
                      >
                        {drinkInfo.drinkableMessage}
                      </Text>
                    </View>

                    {/* Card Footer: Channel & Click indicator */}
                    <View style={styles.hCardFooter}>
                      <Text style={styles.hCardMeta}>
                        Ch: {device.channelId || 'N/A'}
                      </Text>
                      <Text
                        style={
                          isSelected
                            ? styles.hCardSelectedIndicator
                            : styles.hCardUnselectedIndicator
                        }
                      >
                        {isSelected ? '✓ Selected' : 'Click to View'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Below the horizontal cards: Detail Section ONLY SHOWN AFTER CLICK */}
            {effectiveSelectedDevice ? (
              (() => {
                const dev = effectiveSelectedDevice;
                const live = deviceLiveMap[dev.id];
                const status = live?.status || dev.status || 'No Recent Data';
                const telemetry = live?.telemetry;
                const parameters = telemetry?.parameters || {};
                const hasData = Boolean(telemetry && Object.keys(parameters).length > 0);
                const severity =
                  telemetry?.severity ||
                  ((status as string) === 'Danger'
                    ? 'DANGER'
                    : (status as string) === 'Warning'
                    ? 'WARNING'
                    : (status as string) === 'Safe'
                    ? 'NORMAL'
                    : undefined);
                const drinkInfo = getDrinkabilityInfo(status, severity, hasData);

                return (
                  <View style={styles.selectedDeviceDetailCard}>
                    {/* Selected Device Header */}
                    <View style={styles.detailCardHeader}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <View style={styles.detailTitleRow}>
                          <Text style={styles.detailCardStationName}>
                            {dev.name || dev.deviceId}
                          </Text>
                          <StatusBadge status={status} />
                        </View>
                        <View style={styles.branchUnitRow}>
                          <Text style={styles.deviceBranchBadge}>
                            🏢 Branch: {dev.branch || 'Main Branch'}
                          </Text>
                          <Text style={styles.deviceUnitBadge}>
                            📍 Unit: {dev.unit || 'Unit 1'}
                          </Text>
                          {dev.location ? (
                            <Text style={styles.deviceLocationBadge}>
                              📌 {dev.location}
                            </Text>
                          ) : null}
                        </View>
                        <Text style={styles.detailCardSubtitle}>
                          Hardware ID: {dev.deviceId} · ThingSpeak Channel: {dev.channelId}
                        </Text>
                      </View>

                      <View style={styles.detailCardActionButtons}>
                        <TouchableOpacity
                          style={styles.closePanelBtn}
                          onPress={() => setSelectedDeviceId(null)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.closePanelBtnText}>✕ Close</Text>
                        </TouchableOpacity>

                        {isSuperAdmin && (
                          <TouchableOpacity
                            style={styles.deleteBtn}
                            onPress={() => handleDeleteDevice(dev.id, dev.name || dev.deviceId)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.deleteBtnText}>🗑️ Delete Station</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    {/* Drinkability Assessment Banner */}
                    <View
                      style={[
                        styles.drinkabilityBanner,
                        {
                          backgroundColor: drinkInfo.bannerBg,
                          borderColor: drinkInfo.bannerBorder,
                        },
                      ]}
                    >
                      <Text style={styles.drinkabilityBannerIcon}>
                        {drinkInfo.bannerIcon}
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.drinkabilityBannerTitle,
                            { color: drinkInfo.textColor },
                          ]}
                        >
                          {drinkInfo.drinkableMessage}
                        </Text>
                        <Text
                          style={[
                            styles.drinkabilityBannerDesc,
                            { color: drinkInfo.textColor },
                          ]}
                        >
                          {drinkInfo.detailMsg}
                        </Text>
                      </View>
                    </View>

                    {/* Real-Time Sensor Values (TDS, pH, Turbidity) */}
                    <View style={styles.valuesSection}>
                      <View style={styles.valuesSectionHeader}>
                        <Text style={styles.valuesSectionTitle}>
                          📊 Current Sensor Values (Real-Time)
                        </Text>
                        {live?.lastDataReceived && (
                          <Text style={styles.valuesTimestamp}>
                            Updated: {new Date(live.lastDataReceived).toLocaleTimeString()}
                          </Text>
                        )}
                      </View>

                      {hasData ? (
                        <View style={styles.paramGrid}>
                          {Object.entries(parameters).map(([paramName, paramData]) => {
                            const val = paramData.value;
                            const paramSeverity = paramData.severity;
                            const isParamDanger = paramSeverity === 'DANGER';
                            const isParamWarn = paramSeverity === 'WARNING';
                            const isParamAlert = paramSeverity === 'ALERT';

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

                            const tierLabel = isParamDanger
                              ? 'DANGER'
                              : isParamWarn
                              ? 'WARNING'
                              : isParamAlert
                              ? 'ALERT'
                              : 'NORMAL';

                            const tierBadgeStyle = isParamDanger
                              ? styles.tierDanger
                              : isParamWarn
                              ? styles.tierWarn
                              : isParamAlert
                              ? styles.tierAlert
                              : styles.tierNormal;

                            const tierTextColor = isParamDanger
                              ? '#b91c1c'
                              : isParamWarn
                              ? '#c2410c'
                              : isParamAlert
                              ? '#b45309'
                              : '#047857';

                            return (
                              <View key={paramName} style={[styles.paramBox, boxStyle]}>
                                <View style={styles.paramBoxTop}>
                                  <Text style={styles.paramLabel}>{paramName}</Text>
                                  <View style={[styles.paramTierBadge, tierBadgeStyle]}>
                                    <Text style={[styles.paramTierText, { color: tierTextColor }]}>
                                      {tierLabel}
                                    </Text>
                                  </View>
                                </View>
                                <Text style={[styles.paramValue, valStyle]}>
                                  {val !== null && val !== undefined
                                    ? `${val} ${paramData.unit}`
                                    : '--'}
                                </Text>
                                {paramData.targetDesc ? (
                                  <Text style={styles.thresholdSub}>
                                    Target: {paramData.targetDesc}
                                  </Text>
                                ) : paramData.minThreshold !== null || paramData.maxThreshold !== null ? (
                                  <Text style={styles.thresholdSub}>
                                    Limits: {paramData.minThreshold ?? 0} -{' '}
                                    {paramData.maxThreshold ?? '∞'} {paramData.unit}
                                  </Text>
                                ) : null}
                              </View>
                            );
                          })}
                        </View>
                      ) : (
                        <View style={styles.noDataBox}>
                          <Text style={styles.noDataText}>
                            {live?.isStale
                              ? '⚠️ Showing cached readings'
                              : 'Awaiting sensor feeds from ThingSpeak...'}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Active Triggered Alerts (if any) */}
                    {telemetry?.alerts && telemetry.alerts.length > 0 && (
                      <View style={styles.activeAlertsBox}>
                        <Text style={styles.activeAlertsTitle}>🚨 Active Triggered Alerts:</Text>
                        {telemetry.alerts.map((alertText, idx) => (
                          <Text key={idx} style={styles.activeAlertItem}>
                            • {alertText}
                          </Text>
                        ))}
                      </View>
                    )}

                    {/* Device Metadata & Communication Summary */}
                    <View style={styles.detailCardMetaFooter}>
                      <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>🕒 Last Communication:</Text>
                        <Text style={styles.metaValue}>
                          {live?.lastDataReceived || dev.lastDataReceived
                            ? new Date(
                                live?.lastDataReceived || dev.lastDataReceived!
                              ).toLocaleString()
                            : 'Never'}
                        </Text>
                      </View>
                      <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>👤 Assigned Manager:</Text>
                        <Text style={styles.metaValue}>
                          {dev.assignedManagerUser
                            ? `${dev.assignedManagerUser.name} (${dev.assignedManagerUser.email})`
                            : 'Accessible to all managers in branch'}
                        </Text>
                      </View>
                      <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>⏱️ Offline Threshold:</Text>
                        <Text style={styles.metaValue}>
                          {dev.offlineThresholdMinutes} minutes
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })()
            ) : (
              <View style={styles.hoverPromptBox}>
                <Text style={styles.hoverPromptText}>
                  👆 Click on any station card above to inspect real-time sensor values (pH, Turbidity, TDS)
                </Text>
              </View>
            )}
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
  // Horizontal Device Cards
  horizontalDeviceSection: {
    gap: 16,
  },
  horizontalDeviceRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 4,
    paddingRight: 16,
  },
  horizontalDeviceCard: {
    width: 250,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    padding: 14,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  horizontalDeviceCardSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#f8faff',
    shadowColor: '#2563eb',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  hCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 6,
  },
  hCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  hCardBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 10,
  },
  hCardBranchBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: '#065f46',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  hCardUnitBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1e40af',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  hCardDrinkablePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  hCardDrinkableText: {
    fontSize: 12,
    fontWeight: '700',
  },
  hCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
    marginTop: 'auto',
  },
  hCardMeta: {
    fontSize: 11,
    color: '#64748b',
  },
  hCardSelectedIndicator: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
  },
  hCardUnselectedIndicator: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94a3b8',
  },

  // Selected Device Detail Card (Below horizontal cards)
  selectedDeviceDetailCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    padding: 18,
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  detailCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 10,
  },
  detailTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  detailCardStationName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  branchUnitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
    marginBottom: 4,
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
  deviceLocationBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  detailCardSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },

  // Drinkability Assessment Banner
  drinkabilityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  drinkabilityBannerIcon: {
    fontSize: 28,
  },
  drinkabilityBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  drinkabilityBannerDesc: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
  },

  // Values Section
  valuesSection: {
    gap: 10,
  },
  valuesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  valuesSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  valuesTimestamp: {
    fontSize: 11,
    color: '#64748b',
  },

  // Parameter Grid
  paramGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  paramBox: {
    flex: 1,
    minWidth: 120,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
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
  paramBoxTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  paramLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  paramTierBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  paramTierText: {
    fontSize: 9,
    fontWeight: '800',
  },
  tierNormal: {
    backgroundColor: '#d1fae5',
  },
  tierAlert: {
    backgroundColor: '#fef3c7',
  },
  tierWarn: {
    backgroundColor: '#fed7aa',
  },
  tierDanger: {
    backgroundColor: '#fee2e2',
  },
  paramValue: {
    fontSize: 18,
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
    color: '#64748b',
    marginTop: 4,
  },
  noDataBox: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
  },

  // Active Alerts
  activeAlertsBox: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 8,
    padding: 12,
    gap: 4,
  },
  activeAlertsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b91c1c',
    marginBottom: 2,
  },
  activeAlertItem: {
    fontSize: 12,
    color: '#991b1b',
    fontWeight: '500',
  },

  // Detail Card Metadata Footer
  detailCardMetaFooter: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  metaValue: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
  },

  detailCardActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  closePanelBtn: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  closePanelBtnText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
  },

  // SuperAdmin Delete
  deleteBtn: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  deleteBtnText: {
    color: '#dc2626',
    fontSize: 11,
    fontWeight: '700',
  },

  // Hover Prompt Box (Shown when no card is hovered)
  hoverPromptBox: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  hoverPromptText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    textAlign: 'center',
  },
});
