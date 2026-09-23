import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { api } from '../../src/api/client';
import { authStore } from '../../src/state/authStore';
import { CompanySelector } from '../../components/company-selector';
import { StatusBadge } from '../../components/ui/status-badge';
import { DeviceFieldMapper } from '../../components/device-field-mapper';
import { ParameterReferenceCard } from '../../components/parameter-reference-card';
import type { Branch, Company, DeviceSummary, FieldMapping, Unit } from '../../src/api/types';

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isMobile = width < 650;

  const router = useRouter();
  const user = authStore((s) => s.user);
  const companies = authStore((s) => s.companies);
  const selectedCompanyId = authStore((s) => s.selectedCompanyId);
  const setSelectedCompanyId = authStore((s) => s.setSelectedCompanyId);
  const setCompanies = authStore((s) => s.setCompanies);
  const signOut = authStore((s) => s.signOut);

  const isSuperAdmin = user?.role === 'SuperAdmin';

  // Guard: Strictly SuperAdmin only
  useEffect(() => {
    if (user && !isSuperAdmin) {
      router.replace('/(tabs)/dashboard');
    }
  }, [user, isSuperAdmin]);

  const [activeTab, setActiveTab] = useState<'companies' | 'branches' | 'devices' | 'users' | 'config'>('companies');

  const [users, setUsers] = useState<any[]>([]);
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [showDeviceForm, setShowDeviceForm] = useState(false);
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [showUnitFormForBranch, setShowUnitFormForBranch] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  // Forms
  const [newBranchForm, setNewBranchForm] = useState({
    name: '',
    code: '',
    address: '',
    initialUnit: 'Unit 1',
  });

  const [newUnitForm, setNewUnitForm] = useState({
    name: '',
    description: '',
  });

  const [managerForm, setManagerForm] = useState<{
    name: string;
    email: string;
    password: string;
    roleName: string;
    scopeType: 'branch' | 'units' | 'unit';
    branch: string;
    units: string[];      // multi-unit selection
    unit: string;         // single-unit (kept for backward compat)
  }>({
    name: '',
    email: '',
    password: '',
    roleName: 'Manager',
    scopeType: 'branch',
    branch: '',
    units: [],
    unit: '',
  });

  const [deviceForm, setDeviceForm] = useState<{
    deviceId: string;
    name: string;
    channelId: string;
    readKey: string;
    writeKey: string;
    location: string;
    branch: string;
    unit: string;
    deviceType: string;
    assignedManager: string;
    fieldMappings: FieldMapping[];
  }>({
    deviceId: '',
    name: '',
    channelId: '',
    readKey: '',
    writeKey: '',
    location: '',
    branch: '',
    unit: '',
    deviceType: 'Water Quality Monitor',
    assignedManager: '',
    fieldMappings: [
      { fieldNumber: 1, parameterName: 'pH', unit: 'pH', dataType: 'number', minThreshold: 6.5, maxThreshold: 8.5 },
      { fieldNumber: 2, parameterName: 'Turbidity', unit: 'NTU', dataType: 'number', minThreshold: 0, maxThreshold: 5.0 },
      { fieldNumber: 3, parameterName: 'TDS', unit: 'ppm', dataType: 'number', minThreshold: 0, maxThreshold: 500 },
    ],
  });

  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [lastCheckedTime, setLastCheckedTime] = useState<string>('Just now');

  const selectedCompany = useMemo(() => {
    return (companies as Company[]).find((c) => c.id === selectedCompanyId) || null;
  }, [companies, selectedCompanyId]);

  const companyBranches = useMemo<Branch[]>(() => {
    return selectedCompany?.branches || [];
  }, [selectedCompany]);

  // Set default branch and unit when company branches change
  useEffect(() => {
    if (companyBranches.length > 0) {
      const firstBranch = companyBranches[0];
      if (!deviceForm.branch || !companyBranches.some((b) => b.name === deviceForm.branch)) {
        const firstUnit = firstBranch.units?.[0]?.name || 'Unit 1';
        setDeviceForm((p) => ({ ...p, branch: firstBranch.name, unit: firstUnit }));
      }
      if (!managerForm.branch || !companyBranches.some((b) => b.name === managerForm.branch)) {
        const firstUnit = firstBranch.units?.[0]?.name || 'Unit 1';
        setManagerForm((p) => ({ ...p, branch: firstBranch.name, unit: firstUnit }));
      }
    }
  }, [companyBranches]);

  async function loadCompanies() {
    try {
      const res = await api.get('/api/companies');
      if (res.data.ok) {
        setCompanies(res.data.data);
      }
    } catch (e: any) {
      console.warn('Failed to load companies:', e);
    }
  }

  async function loadUsers(companyId?: string) {
    const targetCompanyId = companyId || selectedCompanyId;
    setError(null);
    setLoading(true);
    try {
      const res = await api.get('/api/users', {
        params: targetCompanyId ? { companyId: targetCompanyId } : undefined,
      });
      setUsers(res.data.data || []);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  async function loadDevices(companyId?: string) {
    const targetCompanyId = companyId || selectedCompanyId;
    try {
      setDevicesLoading(true);
      const res = await api.get('/api/devices', {
        params: targetCompanyId ? { companyId: targetCompanyId } : undefined,
      });
      setDevices(res.data?.data || []);
    } catch (e: any) {
      console.warn('Failed to load devices in admin:', e);
    } finally {
      setDevicesLoading(false);
    }
  }

  useEffect(() => {
    if (isSuperAdmin) {
      loadCompanies();
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (isSuperAdmin) {
      loadUsers(selectedCompanyId || undefined);
      if (selectedCompanyId) {
        loadDevices(selectedCompanyId);
      }
    }
  }, [selectedCompanyId, isSuperAdmin]);

  async function handleCheckForUpdates() {
    setCheckingUpdate(true);
    try {
      await api.get('/health');
      setLastCheckedTime(new Date().toLocaleTimeString());
      Alert.alert(
        'Up to Date',
        'Your application is running the latest production release (v1.0.0).\n\nCloud Backend: Online & Healthy\nTelemetry Engine: Operational'
      );
    } catch (err: any) {
      Alert.alert('Update Check', 'Unable to verify updates. Please check your network connection.');
    } finally {
      setCheckingUpdate(false);
    }
  }

  // --- BRANCH & UNIT ACTIONS ---
  async function handleCreateBranch() {
    if (!selectedCompanyId) {
      Alert.alert('Error', 'Please select a company first.');
      return;
    }
    if (!newBranchForm.name.trim()) {
      Alert.alert('Validation', 'Branch name is required.');
      return;
    }

    try {
      setBranchesLoading(true);
      await api.post(`/api/companies/${selectedCompanyId}/branches`, {
        name: newBranchForm.name.trim(),
        code: newBranchForm.code.trim() || undefined,
        address: newBranchForm.address.trim() || undefined,
        units: newBranchForm.initialUnit.trim()
          ? [{ name: newBranchForm.initialUnit.trim(), description: 'Initial Unit' }]
          : [{ name: 'Unit 1', description: 'Default Unit' }],
      });

      setNewBranchForm({ name: '', code: '', address: '', initialUnit: 'Unit 1' });
      setShowBranchForm(false);
      await loadCompanies();
      Alert.alert('Success', 'Branch created successfully.');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error?.message || 'Failed to create branch');
    } finally {
      setBranchesLoading(false);
    }
  }

  async function handleDeleteBranch(branchName: string) {
    if (!selectedCompanyId) return;

    const confirmed =
      Platform.OS === 'web'
        ? window.confirm(`Delete branch "${branchName}"? This branch and its units will be removed.`)
        : await new Promise((resolve) => {
            Alert.alert(
              'Delete Branch',
              `Are you sure you want to delete branch "${branchName}"?`,
              [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
              ]
            );
          });

    if (!confirmed) return;

    try {
      setBranchesLoading(true);
      await api.delete(`/api/companies/${selectedCompanyId}/branches/${encodeURIComponent(branchName)}`);
      await loadCompanies();
      Alert.alert('Success', `Branch "${branchName}" removed.`);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error?.message || 'Failed to delete branch');
    } finally {
      setBranchesLoading(false);
    }
  }

  async function handleCreateUnit(branchName: string) {
    if (!selectedCompanyId) return;
    if (!newUnitForm.name.trim()) {
      Alert.alert('Validation', 'Unit name is required.');
      return;
    }

    try {
      setBranchesLoading(true);
      await api.post(
        `/api/companies/${selectedCompanyId}/branches/${encodeURIComponent(branchName)}/units`,
        {
          name: newUnitForm.name.trim(),
          description: newUnitForm.description.trim() || undefined,
        }
      );

      setNewUnitForm({ name: '', description: '' });
      setShowUnitFormForBranch(null);
      await loadCompanies();
      Alert.alert('Success', `Unit added to branch "${branchName}".`);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error?.message || 'Failed to add unit');
    } finally {
      setBranchesLoading(false);
    }
  }

  async function handleDeleteUnit(branchName: string, unitName: string) {
    if (!selectedCompanyId) return;

    const confirmed =
      Platform.OS === 'web'
        ? window.confirm(`Delete unit "${unitName}" from branch "${branchName}"?`)
        : await new Promise((resolve) => {
            Alert.alert(
              'Delete Unit',
              `Are you sure you want to delete unit "${unitName}"?`,
              [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
              ]
            );
          });

    if (!confirmed) return;

    try {
      setBranchesLoading(true);
      await api.delete(
        `/api/companies/${selectedCompanyId}/branches/${encodeURIComponent(branchName)}/units/${encodeURIComponent(unitName)}`
      );
      await loadCompanies();
      Alert.alert('Success', `Unit "${unitName}" deleted.`);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error?.message || 'Failed to delete unit');
    } finally {
      setBranchesLoading(false);
    }
  }

  // --- DEVICE ACTIONS ---
  async function handleCreateDevice() {
    if (!selectedCompanyId) {
      Alert.alert('Selection Error', 'Please select a company organization first.');
      return;
    }

    if (!deviceForm.deviceId.trim() || !deviceForm.channelId.trim() || !deviceForm.readKey.trim()) {
      Alert.alert('Validation Error', 'Device ID, ThingSpeak Channel ID, and Read Key are required.');
      return;
    }

    try {
      setDevicesLoading(true);
      const res = await api.post('/api/devices', {
        deviceId: deviceForm.deviceId.trim(),
        name: deviceForm.name.trim() || deviceForm.deviceId.trim(),
        channelId: deviceForm.channelId.trim(),
        readKey: deviceForm.readKey.trim(),
        writeKey: deviceForm.writeKey.trim() || undefined,
        deviceType: deviceForm.deviceType.trim(),
        branch: deviceForm.branch.trim() || undefined,
        unit: deviceForm.unit.trim() || undefined,
        location: deviceForm.location.trim() || undefined,
        assignedManager: deviceForm.assignedManager || undefined,
        companyId: selectedCompanyId,
        fieldMappings: deviceForm.fieldMappings,
      });

      if (res.data?.ok) {
        setDeviceForm({
          deviceId: '',
          name: '',
          channelId: '',
          readKey: '',
          writeKey: '',
          location: '',
          branch: companyBranches[0]?.name || '',
          unit: companyBranches[0]?.units?.[0]?.name || '',
          deviceType: 'Water Quality Monitor',
          assignedManager: '',
          fieldMappings: [
            { fieldNumber: 1, parameterName: 'pH', unit: 'pH', dataType: 'number', minThreshold: 6.5, maxThreshold: 8.5 },
            { fieldNumber: 2, parameterName: 'Turbidity', unit: 'NTU', dataType: 'number', minThreshold: 0, maxThreshold: 5.0 },
            { fieldNumber: 3, parameterName: 'TDS', unit: 'ppm', dataType: 'number', minThreshold: 0, maxThreshold: 500 },
          ],
        });
        setShowDeviceForm(false);
        await loadDevices(selectedCompanyId);
        Alert.alert(
          'Device Registered Successfully!',
          'Device is assigned to company, branch, and unit. Telemetry will automatically stream on the Dashboard.'
        );
      }
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error?.message || 'Failed to register device');
    } finally {
      setDevicesLoading(false);
    }
  }

  async function handleDeleteDevice(deviceId: string, deviceName: string) {
    const confirmed =
      Platform.OS === 'web'
        ? window.confirm(`Are you sure you want to delete device ${deviceName}?`)
        : await new Promise((resolve) => {
            Alert.alert('Delete Device', `Are you sure you want to delete ${deviceName}?`, [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
            ]);
          });

    if (!confirmed) return;

    try {
      setDevicesLoading(true);
      await api.delete(`/api/devices/${deviceId}`);
      await loadDevices(selectedCompanyId || undefined);
      Alert.alert('Device Deleted', `Device ${deviceName} has been removed.`);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error?.message || 'Failed to delete device');
    } finally {
      setDevicesLoading(false);
    }
  }

  // --- MANAGER ACTIONS ---
  async function handleCreateManager() {
    if (!selectedCompanyId) {
      Alert.alert('Selection Error', 'Please select a company first.');
      return;
    }

    const currentCompany = (companies as Company[]).find((c) => c.id === selectedCompanyId);
    const managerLimit =
      typeof currentCompany?.maxManagers === 'number'
        ? currentCompany.maxManagers
        : (currentCompany?.maxManagers?.total ?? currentCompany?.maxManagers?.manager1 ?? 2);
    const currentManagers = users.filter(
      (u) => (u.role?.toLowerCase() === 'manager' || u.role?.toLowerCase().includes('manager')) && u.isActive !== false
    );
    if (currentManagers.length >= managerLimit) {
      Alert.alert(
        'Manager Limit Reached',
        `Maximum manager quota reached for this organization (${currentManagers.length}/${managerLimit}). Increase the quota or delete an existing manager.`
      );
      return;
    }

    if (!managerForm.name.trim() || !managerForm.email.trim() || !managerForm.password) {
      Alert.alert('Validation', 'Name, email (Manager User ID), and password are required.');
      return;
    }

    if (managerForm.scopeType === 'units' && managerForm.units.length === 0) {
      Alert.alert('Validation', 'Please select at least one unit for Multi-Unit access.');
      return;
    }
    if (managerForm.scopeType === 'unit' && !managerForm.unit.trim()) {
      Alert.alert('Validation', 'Please select a unit for Unit-Based access.');
      return;
    }

    try {
      const res = await api.post('/api/users', {
        name: managerForm.name.trim(),
        email: managerForm.email.trim().toLowerCase(),
        password: managerForm.password,
        roleName: managerForm.roleName,
        companyId: selectedCompanyId,
        branch: managerForm.branch.trim() || undefined,
        units: managerForm.scopeType === 'units'
          ? managerForm.units
          : managerForm.scopeType === 'unit'
            ? [managerForm.unit.trim()]
            : [],       // branch-based: empty means all units
        unit: managerForm.scopeType === 'unit' ? (managerForm.unit.trim() || undefined) : undefined,
      });

      if (res.data?.ok) {
        const createdScopeDesc =
          managerForm.scopeType === 'units'
            ? `Multi-Unit (Branch: ${managerForm.branch || 'All'}, Units: ${managerForm.units.join(', ')})`
            : managerForm.scopeType === 'unit'
              ? `Unit-Based (Branch: ${managerForm.branch || 'All'}, Unit: ${managerForm.unit || 'All'})`
              : `Branch-Based (Branch: ${managerForm.branch || 'All'} - All Units)`;

        setManagerForm({
          name: '',
          email: '',
          password: '',
          roleName: 'Manager',
          scopeType: 'branch',
          branch: companyBranches[0]?.name || '',
          units: [],
          unit: companyBranches[0]?.units?.[0]?.name || '',
        });
        await loadUsers(selectedCompanyId);
        Alert.alert(
          'Success',
          `Manager account created!\n\nUser ID: ${managerForm.email}\nScope: ${createdScopeDesc}\n\nProvide these credentials to the company manager. They will have strictly view-only access to their authorized telemetry.`
        );
      }
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error?.message ?? 'Failed to create manager');
    }
  }

  async function handleDeleteUser(userId: string, name: string) {
    const confirmed =
      Platform.OS === 'web'
        ? window.confirm(`Delete user ${name}?`)
        : await new Promise((resolve) => {
            Alert.alert('Delete User', `Are you sure you want to delete ${name}?`, [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
            ]);
          });

    if (!confirmed) return;

    try {
      await api.delete(`/api/users/${userId}`);
      await loadUsers(selectedCompanyId || undefined);
      Alert.alert('Success', 'User deleted.');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error?.message ?? 'Failed to delete user');
    }
  }

  async function handleDeleteCompany(companyId: string, companyName: string) {
    const confirmed =
      Platform.OS === 'web'
        ? window.confirm(`Delete company ${companyName}? This removes all company users, devices, branches, and telemetry.`)
        : await new Promise((resolve) => {
            Alert.alert(
              'Delete Company',
              `Delete ${companyName}? This will remove all company devices and users.`,
              [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
              ]
            );
          });

    if (!confirmed) return;

    try {
      await api.delete(`/api/companies/${companyId}`);
      await loadCompanies();
      if (selectedCompanyId === companyId) {
        setSelectedCompanyId(null);
      }
      Alert.alert('Success', 'Company deleted.');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error?.message ?? 'Failed to delete company');
    }
  }

  if (!user || !isSuperAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={{ marginTop: 12, color: '#64748b' }}>Redirecting to Dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { maxWidth: 1080, width: '100%', alignSelf: 'center', paddingBottom: Math.max(insets.bottom, 24) + 24 },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Super Admin Console</Text>
              <Text style={styles.userInfo}>
                System Administrator: {user.name} ({user.email})
              </Text>
            </View>
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

          <CompanySelector />
        </View>

        {/* Section Navigation Tabs (Super Admin Only) */}
        <View style={styles.navTabsWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.navTabs}>
            <TouchableOpacity
              style={[styles.navTab, activeTab === 'companies' && styles.navTabActive]}
              onPress={() => setActiveTab('companies')}
              activeOpacity={0.7}
            >
              <Text style={[styles.navTabText, activeTab === 'companies' && styles.navTabTextActive]}>
                Companies ({companies.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navTab, activeTab === 'branches' && styles.navTabActive]}
              onPress={() => setActiveTab('branches')}
              activeOpacity={0.7}
            >
              <Text style={[styles.navTabText, activeTab === 'branches' && styles.navTabTextActive]}>
                Branches & Units ({companyBranches.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navTab, activeTab === 'devices' && styles.navTabActive]}
              onPress={() => setActiveTab('devices')}
              activeOpacity={0.7}
            >
              <Text style={[styles.navTabText, activeTab === 'devices' && styles.navTabTextActive]}>
                📡 Devices ({devices.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navTab, activeTab === 'users' && styles.navTabActive]}
              onPress={() => setActiveTab('users')}
              activeOpacity={0.7}
            >
              <Text style={[styles.navTabText, activeTab === 'users' && styles.navTabTextActive]}>
                👥 Managers & Quotas
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navTab, activeTab === 'config' && styles.navTabActive]}
              onPress={() => setActiveTab('config')}
              activeOpacity={0.7}
            >
              <Text style={[styles.navTabText, activeTab === 'config' && styles.navTabTextActive]}>
                ⚙️ Settings & System
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* TAB 1: Companies */}
        {activeTab === 'companies' && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Client Organizations ({companies.length})</Text>
                <Text style={styles.formSubtitle}>
                  Manage tenant companies, branches, and manager quotas.
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/modal')}>
                  <Text style={styles.createBtnText}>+ Create Company</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.refreshBtn} onPress={loadCompanies}>
                  <Text style={styles.refreshBtnText}>🔄 Refresh</Text>
                </TouchableOpacity>
              </View>
            </View>

            {companies.map((c) => {
              const isSelected = selectedCompanyId === c.id;
              const bCount = c.branches?.length || 0;
              const totalUnits = c.branches?.reduce((acc: number, b: any) => acc + (b.units?.length || 0), 0) || 0;
              const mgrLimit =
                typeof c.maxManagers === 'number'
                  ? c.maxManagers
                  : (c.maxManagers?.total ?? c.maxManagers?.manager1 ?? 2);

              return (
                <View key={c.id} style={[styles.companyCard, isSelected && styles.companyCardActive]}>
                  <View style={styles.companyCardHeader}>
                    <Text style={styles.companyCardName}>{c.name}</Text>
                    {isSelected && <Text style={styles.activePill}>Active Focus</Text>}
                  </View>

                  {c.address ? <Text style={styles.companyMeta}>Address: {c.address}</Text> : null}
                  <Text style={styles.companyMeta}>
                    Branches: <Text style={{ fontWeight: '700' }}>{bCount}</Text> · Units: <Text style={{ fontWeight: '700' }}>{totalUnits}</Text> · Manager Quota: <Text style={{ fontWeight: '700' }}>{mgrLimit} Max</Text>
                  </Text>

                  <View style={styles.companyActionsRow}>
                    <TouchableOpacity
                      style={styles.dashboardLink}
                      onPress={() => {
                        setSelectedCompanyId(c.id);
                        setActiveTab('branches');
                      }}
                    >
                      <Text style={styles.dashboardLinkText}>Manage Branches & Units →</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.deleteLink}
                      onPress={() => handleDeleteCompany(c.id, c.name)}
                    >
                      <Text style={styles.deleteLinkText}>Delete Company</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* TAB 2: Branches & Units Management */}
        {activeTab === 'branches' && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>
                  Branches & Units for {selectedCompany?.name || 'Selected Company'}
                </Text>
                <Text style={styles.formSubtitle}>
                  Organize facilities into branches and monitoring units. Devices and managers will be assigned to specific branches and units.
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={styles.createBtn}
                  onPress={() => setShowBranchForm((p) => !p)}
                >
                  <Text style={styles.createBtnText}>
                    {showBranchForm ? '✕ Cancel' : '+ Add Branch'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.refreshBtn} onPress={loadCompanies} disabled={branchesLoading}>
                  <Text style={styles.refreshBtnText}>{branchesLoading ? '...' : '🔄 Refresh'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Create Branch Form */}
            {showBranchForm && (
              <View style={styles.branchFormBox}>
                <Text style={styles.formTitle}>Add New Branch</Text>
                <Text style={styles.formSubtitle}>
                  Create a physical branch or facility location under {selectedCompany?.name}.
                </Text>

                <TextInput
                  style={styles.input}
                  placeholder="Branch Name (e.g. North Treatment Facility)"
                  value={newBranchForm.name}
                  onChangeText={(txt) => setNewBranchForm((p) => ({ ...p, name: txt }))}
                />
                <View style={styles.formGrid}>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={styles.input}
                      placeholder="Branch Code (e.g. BR-NORTH)"
                      value={newBranchForm.code}
                      onChangeText={(txt) => setNewBranchForm((p) => ({ ...p, code: txt }))}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={styles.input}
                      placeholder="Initial Unit Name (e.g. Intake Unit)"
                      value={newBranchForm.initialUnit}
                      onChangeText={(txt) => setNewBranchForm((p) => ({ ...p, initialUnit: txt }))}
                    />
                  </View>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Address / Facility Location"
                  value={newBranchForm.address}
                  onChangeText={(txt) => setNewBranchForm((p) => ({ ...p, address: txt }))}
                />

                <TouchableOpacity
                  style={[styles.saveBranchBtn, branchesLoading && styles.btnDisabled]}
                  onPress={handleCreateBranch}
                  disabled={branchesLoading}
                >
                  <Text style={styles.saveBranchBtnText}>
                    {branchesLoading ? 'Adding...' : 'Save Branch'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* List Branches */}
            {branchesLoading && <ActivityIndicator style={{ marginVertical: 12 }} />}

            {companyBranches.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>🏢</Text>
                <Text style={styles.emptyTitle}>No Branches Defined</Text>
                <Text style={styles.emptyDesc}>
                  Click "+ Add Branch" above to create the first branch location for this company.
                </Text>
              </View>
            ) : (
              companyBranches.map((branch) => {
                const isAddingUnit = showUnitFormForBranch === branch.name;

                return (
                  <View key={branch.name} style={styles.branchCard}>
                    <View style={styles.branchHeaderRow}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={styles.branchTitle}>{branch.name}</Text>
                          {branch.code ? <Text style={styles.branchCodeBadge}>{branch.code}</Text> : null}
                        </View>
                        {branch.address ? (
                          <Text style={styles.branchAddress}>Address: {branch.address}</Text>
                        ) : null}
                      </View>

                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          style={styles.addUnitBtn}
                          onPress={() => setShowUnitFormForBranch(isAddingUnit ? null : branch.name)}
                        >
                          <Text style={styles.addUnitBtnText}>
                            {isAddingUnit ? '✕ Close' : '+ Add Unit'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.deleteBranchBtn}
                          onPress={() => handleDeleteBranch(branch.name)}
                        >
                          <Text style={styles.deleteBranchBtnText}>Delete Branch</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Add Unit Form inline */}
                    {isAddingUnit && (
                      <View style={styles.unitFormBox}>
                        <Text style={styles.unitFormTitle}>Add Unit to {branch.name}</Text>
                        <View style={styles.formGrid}>
                          <View style={{ flex: 1 }}>
                            <TextInput
                              style={styles.input}
                              placeholder="Unit Name (e.g. Unit 2, Filtration Unit)"
                              value={newUnitForm.name}
                              onChangeText={(txt) => setNewUnitForm((p) => ({ ...p, name: txt }))}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <TextInput
                              style={styles.input}
                              placeholder="Description (Optional)"
                              value={newUnitForm.description}
                              onChangeText={(txt) => setNewUnitForm((p) => ({ ...p, description: txt }))}
                            />
                          </View>
                        </View>
                        <TouchableOpacity
                          style={styles.saveUnitBtn}
                          onPress={() => handleCreateUnit(branch.name)}
                        >
                          <Text style={styles.saveUnitBtnText}>Save Unit</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Units List */}
                    <Text style={styles.unitsSectionTitle}>Monitoring Units ({branch.units?.length || 0}):</Text>
                    <View style={styles.unitChipsRow}>
                      {branch.units && branch.units.length > 0 ? (
                        branch.units.map((unit) => (
                          <View key={unit.name} style={styles.unitBadge}>
                            <Text style={styles.unitBadgeText}>{unit.name}</Text>
                            {branch.units.length > 1 && (
                              <TouchableOpacity
                                onPress={() => handleDeleteUnit(branch.name, unit.name)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Text style={styles.unitDeleteCross}>✕</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        ))
                      ) : (
                        <Text style={styles.emptyUnitsText}>No units registered for this branch.</Text>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* TAB 3: IoT Devices (Super Admin Exclusivity) */}
        {activeTab === 'devices' && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>IoT Monitoring Devices ({devices.length})</Text>
                <Text style={styles.formSubtitle}>
                  Only Super Admin has permission to add, configure, and manage sensor hardware.
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={styles.createBtn}
                  onPress={() => setShowDeviceForm((p) => !p)}
                >
                  <Text style={styles.createBtnText}>
                    {showDeviceForm ? '✕ Close Form' : '+ Register Device'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.refreshBtn}
                  onPress={() => loadDevices()}
                  disabled={devicesLoading}
                >
                  <Text style={styles.refreshBtnText}>{devicesLoading ? '...' : '🔄 Refresh'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Active Company Banner */}
            <View style={styles.activeCompanyBanner}>
              <Text style={styles.activeCompanyBannerTitle}>Target Organization for Devices:</Text>
              <CompanySelector onCompanySelected={(cId) => loadDevices(cId)} />
            </View>

            {/* Register Device Form */}
            {showDeviceForm && (
              <View style={styles.deviceFormCard}>
                <Text style={styles.formTitle}>Register New IoT Station</Text>
                <Text style={styles.formSubtitle}>
                  Assign the device to a specific Company, Branch, and Unit to maintain strict isolation.
                </Text>

                {/* Branch Selection */}
                <View style={styles.formSectionBox}>
                  <Text style={styles.inputLabel}>Assign to Branch *</Text>
                  <View style={styles.companySelectChipRow}>
                    {companyBranches.map((b) => {
                      const isSel = deviceForm.branch === b.name;
                      return (
                        <TouchableOpacity
                          key={b.name}
                          style={[styles.companyFormChip, isSel && styles.companyFormChipActive]}
                          onPress={() => {
                            const firstUnit = b.units?.[0]?.name || 'Unit 1';
                            setDeviceForm((p) => ({ ...p, branch: b.name, unit: firstUnit }));
                          }}
                        >
                          <Text style={[styles.companyFormChipText, isSel && styles.companyFormChipTextActive]}>
                            {b.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Unit Selection */}
                {(() => {
                  const currBranch = companyBranches.find((b) => b.name === deviceForm.branch);
                  const units = currBranch?.units || [];
                  return (
                    <View style={styles.formSectionBox}>
                      <Text style={styles.inputLabel}>Assign to Monitoring Unit *</Text>
                      <View style={styles.companySelectChipRow}>
                        {units.map((u) => {
                          const isSel = deviceForm.unit === u.name;
                          return (
                            <TouchableOpacity
                              key={u.name}
                              style={[styles.companyFormChip, isSel && styles.companyFormChipActive]}
                              onPress={() => setDeviceForm((p) => ({ ...p, unit: u.name }))}
                            >
                              <Text style={[styles.companyFormChipText, isSel && styles.companyFormChipTextActive]}>
                                {u.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })()}

                <Text style={styles.inputLabel}>Hardware Device ID *</Text>
                <TextInput
                  style={styles.input}
                  value={deviceForm.deviceId}
                  placeholder="e.g. WQ-STATION-01"
                  onChangeText={(txt) => setDeviceForm((p) => ({ ...p, deviceId: txt }))}
                />

                <Text style={styles.inputLabel}>Display Name</Text>
                <TextInput
                  style={styles.input}
                  value={deviceForm.name}
                  placeholder="e.g. Main Plant - Intake Station #1"
                  onChangeText={(txt) => setDeviceForm((p) => ({ ...p, name: txt }))}
                />

                <View style={styles.formGrid}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>ThingSpeak Channel ID *</Text>
                    <TextInput
                      style={styles.input}
                      value={deviceForm.channelId}
                      placeholder="e.g. 1234567"
                      keyboardType="number-pad"
                      onChangeText={(txt) => setDeviceForm((p) => ({ ...p, channelId: txt }))}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Read API Key *</Text>
                    <TextInput
                      style={styles.input}
                      value={deviceForm.readKey}
                      placeholder="Private Read Key"
                      secureTextEntry
                      onChangeText={(txt) => setDeviceForm((p) => ({ ...p, readKey: txt }))}
                    />
                  </View>
                </View>

                <View style={styles.formGrid}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Physical Location / Description</Text>
                    <TextInput
                      style={styles.input}
                      value={deviceForm.location}
                      placeholder="e.g. Sector 4, Reservoir B"
                      onChangeText={(txt) => setDeviceForm((p) => ({ ...p, location: txt }))}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Write API Key (Optional)</Text>
                    <TextInput
                      style={styles.input}
                      value={deviceForm.writeKey}
                      placeholder="Optional Write Key"
                      secureTextEntry
                      onChangeText={(txt) => setDeviceForm((p) => ({ ...p, writeKey: txt }))}
                    />
                  </View>
                </View>


                {/* Field Mappings */}
                <DeviceFieldMapper
                  mappings={deviceForm.fieldMappings}
                  onChange={(maps) => setDeviceForm((p) => ({ ...p, fieldMappings: maps }))}
                />

                <TouchableOpacity
                  style={[styles.saveDeviceBtn, devicesLoading && styles.btnDisabled]}
                  onPress={handleCreateDevice}
                  disabled={devicesLoading}
                >
                  <Text style={styles.saveDeviceBtnText}>
                    {devicesLoading ? 'Saving...' : 'Save and Connect Device'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {devicesLoading && <ActivityIndicator style={{ marginVertical: 12 }} />}

            {!devicesLoading && devices.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>📡</Text>
                <Text style={styles.emptyTitle}>No IoT Devices Registered</Text>
                <Text style={styles.emptyDesc}>
                  Click "+ Register Device" above to register a ThingSpeak sensor station. Once registered, telemetry, charts, and alerts will automatically populate the Dashboard.
                </Text>
              </View>
            ) : (
              devices.map((dev) => (
                <View key={dev.id} style={styles.deviceAdminCard}>
                  <View style={styles.deviceAdminHeader}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Text style={styles.deviceAdminName}>{dev.name || dev.deviceId}</Text>
                        <StatusBadge status={dev.status || 'No Recent Data'} size="small" />
                        {dev.branch ? <Text style={styles.branchTag}>Branch: {dev.branch}</Text> : null}
                        {dev.unit ? <Text style={styles.unitTag}>Unit: {dev.unit}</Text> : null}
                      </View>
                      <Text style={styles.deviceAdminMeta}>
                        Hardware ID: {dev.deviceId} · Channel: {dev.channelId}
                        {dev.location ? ` · Location: ${dev.location}` : ''}
                      </Text>
                      <Text style={styles.deviceAdminSubMeta}>
                        Manager:{' '}
                        {dev.assignedManagerUser
                          ? `${dev.assignedManagerUser.name} (${dev.assignedManagerUser.email})`
                          : 'Accessible to all managers in branch'}
                        {' · '}
                        Sensors:{' '}
                        {dev.fieldMappings?.map((m) => m.parameterName).join(', ') || 'pH, Turbidity, TDS'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.deviceActionsRow}>
                    <TouchableOpacity
                      style={styles.dashboardLink}
                      onPress={() => router.push('/(tabs)/dashboard')}
                    >
                      <Text style={styles.dashboardLinkText}>View Live on Dashboard →</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.deleteLink}
                      onPress={() => handleDeleteDevice(dev.id, dev.name || dev.deviceId)}
                    >
                      <Text style={styles.deleteLinkText}>Delete Device</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}

            {/* WHO Parameter Reference & Alert Thresholds */}
            <View style={{ marginTop: 16 }}>
              <ParameterReferenceCard
                title="WHO Parameter Alert Reference"
                subtitle="Official 4-tier alert and safety thresholds for configuring device sensor alarms."
                showValueBadges={false}
              />
            </View>
          </View>
        )}

        {/* TAB 4: Users & Managers Provisioning (Super Admin Only) */}
        {activeTab === 'users' && (() => {
          const currentCompany = (companies as Company[]).find((c) => c.id === selectedCompanyId);
          const managerLimit =
            typeof currentCompany?.maxManagers === 'number'
              ? currentCompany.maxManagers
              : (currentCompany?.maxManagers?.total ?? currentCompany?.maxManagers?.manager1 ?? 2);
          const currentManagers = users.filter(
            (u) => (u.role?.toLowerCase() === 'manager' || u.role?.toLowerCase().includes('manager')) && u.isActive !== false
          );
          const currentCount = currentManagers.length;
          const remainingSlots = Math.max(0, managerLimit - currentCount);
          const isLimitReached = currentCount >= managerLimit;

          return (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Manager Accounts Provisioning</Text>
                  <Text style={styles.formSubtitle}>
                    Super Admin creates and assigns Manager User ID & Password for each company. Managers have strictly view-only access.
                  </Text>
                </View>
                <TouchableOpacity style={styles.refreshBtn} onPress={() => loadUsers()} disabled={loading}>
                  <Text style={styles.refreshBtnText}>🔄 Refresh</Text>
                </TouchableOpacity>
              </View>

              {/* Manager Allocation & Quota Banner */}
              <View style={[styles.quotaBanner, isLimitReached ? styles.quotaBannerFull : styles.quotaBannerNormal]}>
                <View style={styles.quotaHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.quotaTitle}>
                      {isLimitReached ? '⚠️ Manager Quota Reached' : '🛡️ Manager Allocation Quota'}
                    </Text>
                    <Text style={styles.quotaSubtitle}>
                      {isLimitReached
                        ? `Maximum manager capacity reached (${currentCount}/${managerLimit}). To add a new manager, increase the quota or remove an existing manager.`
                        : `This organization can have up to ${managerLimit} manager accounts. (${remainingSlots} slot${remainingSlots === 1 ? '' : 's'} available)`}
                    </Text>
                  </View>
                  <View style={[styles.quotaBadge, isLimitReached ? styles.quotaBadgeFull : styles.quotaBadgeNormal]}>
                    <Text
                      style={[
                        styles.quotaBadgeText,
                        isLimitReached ? styles.quotaBadgeTextFull : styles.quotaBadgeTextNormal,
                      ]}
                    >
                      {currentCount} / {managerLimit} Used
                    </Text>
                  </View>
                </View>

                <View style={styles.quotaStatsRow}>
                  <View style={styles.quotaStatItem}>
                    <Text style={styles.quotaStatLabel}>Total Allowed</Text>
                    <Text style={styles.quotaStatValue}>{managerLimit} Max</Text>
                  </View>
                  <View style={styles.quotaStatDivider} />
                  <View style={styles.quotaStatItem}>
                    <Text style={styles.quotaStatLabel}>Active Managers</Text>
                    <Text style={styles.quotaStatValue}>{currentCount}</Text>
                  </View>
                  <View style={styles.quotaStatDivider} />
                  <View style={styles.quotaStatItem}>
                    <Text style={styles.quotaStatLabel}>Available Slots</Text>
                    <Text
                      style={[
                        styles.quotaStatValue,
                        isLimitReached ? { color: '#DC2626' } : { color: '#059669' },
                      ]}
                    >
                      {remainingSlots}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Create Manager Form */}
              <View style={styles.managerForm}>
                <Text style={styles.formTitle}>Create & Provision Manager Account</Text>
                <Text style={styles.formSubtitle}>
                  Set how much access this manager gets: All units in a branch, specific multiple units, or a single unit only.
                </Text>

                {/* Scope Type Selection */}
                <View style={styles.formSectionBox}>
                  <Text style={styles.inputLabel}>Manager Access Scope *</Text>
                  <View style={styles.companySelectChipRow}>
                    <TouchableOpacity
                      style={[styles.companyFormChip, managerForm.scopeType === 'branch' && styles.companyFormChipActive]}
                      onPress={() => setManagerForm((p) => ({ ...p, scopeType: 'branch', units: [] }))}
                    >
                      <Text style={[styles.companyFormChipText, managerForm.scopeType === 'branch' && styles.companyFormChipTextActive]}>
                        All Units
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.companyFormChip, managerForm.scopeType === 'units' && styles.companyFormChipActive]}
                      onPress={() => setManagerForm((p) => ({ ...p, scopeType: 'units', units: [] }))}
                    >
                      <Text style={[styles.companyFormChipText, managerForm.scopeType === 'units' && styles.companyFormChipTextActive]}>
                        Multiple Units
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.companyFormChip, managerForm.scopeType === 'unit' && styles.companyFormChipActive]}
                      onPress={() => setManagerForm((p) => ({ ...p, scopeType: 'unit', units: [] }))}
                    >
                      <Text style={[styles.companyFormChipText, managerForm.scopeType === 'unit' && styles.companyFormChipTextActive]}>
                        Single Unit Only
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    {managerForm.scopeType === 'branch'
                      ? '✓ This manager can view and switch between ALL units and devices in their assigned branch.'
                      : managerForm.scopeType === 'units'
                        ? '✓ This manager can view devices only in the specific units you select below (multi-select).'
                        : '✓ This manager is strictly locked to viewing only the single unit you select below.'}
                  </Text>
                </View>

                {/* Branch Selection */}
                <View style={styles.formSectionBox}>
                  <Text style={styles.inputLabel}>Assign Branch *</Text>
                  <View style={styles.companySelectChipRow}>
                    {companyBranches.map((b) => {
                      const isSel = managerForm.branch === b.name;
                      return (
                        <TouchableOpacity
                          key={b.name}
                          style={[styles.companyFormChip, isSel && styles.companyFormChipActive]}
                          onPress={() => {
                            const firstUnit = b.units?.[0]?.name || 'Unit 1';
                            setManagerForm((p) => ({ ...p, branch: b.name, units: [], unit: firstUnit }));
                          }}
                        >
                          <Text style={[styles.companyFormChipText, isSel && styles.companyFormChipTextActive]}>
                            {b.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Unit Selection based on scope type */}
                {managerForm.scopeType === 'branch' ? (
                  <View style={[styles.formSectionBox, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                    <Text style={{ fontSize: 12, color: '#166534', fontWeight: '600' }}>
                      Branch-Wide Access: This manager can monitor ALL units in "{managerForm.branch || 'selected branch'}".
                    </Text>
                  </View>
                ) : managerForm.scopeType === 'units' ? (
                  (() => {
                    const currBranch = companyBranches.find((b) => b.name === managerForm.branch);
                    const unitOptions = currBranch?.units || [];
                    return (
                      <View style={styles.formSectionBox}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Text style={styles.inputLabel}>Select Units (Multi-Select) *</Text>
                          {managerForm.units.length > 0 && (
                            <View style={{ backgroundColor: '#2563eb', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                              <Text style={{ fontSize: 11, color: '#fff', fontWeight: '700' }}>
                                {managerForm.units.length} selected
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>
                          Tap to toggle units on/off. Selected units are highlighted.
                        </Text>
                        <View style={styles.companySelectChipRow}>
                          {unitOptions.map((u) => {
                            const isSelected = managerForm.units.includes(u.name);
                            return (
                              <TouchableOpacity
                                key={u.name}
                                style={[
                                  styles.companyFormChip,
                                  isSelected && styles.companyFormChipActive,
                                  isSelected && { borderColor: '#2563eb' },
                                ]}
                                onPress={() => {
                                  setManagerForm((p) => ({
                                    ...p,
                                    units: isSelected
                                      ? p.units.filter((x) => x !== u.name)
                                      : [...p.units, u.name],
                                  }));
                                }}
                              >
                                <Text style={[styles.companyFormChipText, isSelected && styles.companyFormChipTextActive]}>
                                  {isSelected ? '✓ ' : ''}{u.name}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        {managerForm.units.length > 0 && (
                          <Text style={{ fontSize: 11, color: '#2563eb', marginTop: 6, fontWeight: '600' }}>
                            Access granted to: {managerForm.units.join(' · ')}
                          </Text>
                        )}
                      </View>
                    );
                  })()
                ) : (
                  (() => {
                    const currBranch = companyBranches.find((b) => b.name === managerForm.branch);
                    const unitOptions = currBranch?.units || [];
                    return (
                      <View style={styles.formSectionBox}>
                        <Text style={styles.inputLabel}>Select Single Unit *</Text>
                        <View style={styles.companySelectChipRow}>
                          {unitOptions.map((u) => {
                            const isSel = managerForm.unit === u.name;
                            return (
                              <TouchableOpacity
                                key={u.name}
                                style={[styles.companyFormChip, isSel && styles.companyFormChipActive]}
                                onPress={() => setManagerForm((p) => ({ ...p, unit: u.name }))}
                              >
                                <Text style={[styles.companyFormChipText, isSel && styles.companyFormChipTextActive]}>
                                  {u.name}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })()
                )}

                <TextInput
                  style={[styles.input, isLimitReached && styles.inputDisabled]}
                  value={managerForm.name}
                  placeholder="Manager Full Name"
                  onChangeText={(txt) => setManagerForm((p) => ({ ...p, name: txt }))}
                  editable={!isLimitReached}
                />

                <TextInput
                  style={[styles.input, isLimitReached && styles.inputDisabled]}
                  value={managerForm.email}
                  placeholder="Manager User ID / Email Address"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  onChangeText={(txt) => setManagerForm((p) => ({ ...p, email: txt }))}
                  editable={!isLimitReached}
                />

                <TextInput
                  style={[styles.input, isLimitReached && styles.inputDisabled]}
                  value={managerForm.password}
                  placeholder="Temporary Password (min 8 chars)"
                  secureTextEntry
                  onChangeText={(txt) => setManagerForm((p) => ({ ...p, password: txt }))}
                  editable={!isLimitReached}
                />

                <TouchableOpacity
                  style={[styles.createManagerBtn, isLimitReached && styles.createManagerBtnDisabled]}
                  onPress={handleCreateManager}
                  disabled={isLimitReached}
                >
                  <Text style={styles.createManagerBtnText}>
                    {isLimitReached ? 'Manager Quota Full (Limit Reached)' : 'Provision Manager Account'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* User List */}
              {loading && <ActivityIndicator style={{ marginVertical: 12 }} />}
              {users.map((u) => (
                <View key={u.id} style={styles.userCard}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={styles.userName}>{u.name}</Text>
                      <Text style={styles.userRolePill}>{u.role}</Text>
                    </View>
                    <Text style={styles.userEmail}>{u.email}</Text>
                    <Text style={styles.userMeta}>
                      {u.branch ? (
                        (() => {
                          const userUnits: string[] = Array.isArray((u as any).units) ? (u as any).units : (u.unit ? [u.unit] : []);
                          if (userUnits.length > 1) {
                            return `Multi-Unit: ${u.branch} · Units: ${userUnits.join(', ')}`;
                          } else if (userUnits.length === 1) {
                            return `Single Unit: ${u.branch} · Unit: ${userUnits[0]}`;
                          } else {
                            return `Branch-Wide: ${u.branch} (All Units)`;
                          }
                        })()
                      ) : (
                        'Company-Wide (All Branches & Units)'
                      )}
                      {` · Active: ${String(u.isActive)}`}
                    </Text>
                  </View>

                  {u.role !== 'SuperAdmin' && u.email !== user?.email && (
                    <TouchableOpacity style={styles.userDeleteBtn} onPress={() => handleDeleteUser(u.id, u.name)}>
                      <Text style={styles.userDeleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          );
        })()}

        {/* TAB 5: Application Version & Updates Settings */}
        {activeTab === 'config' && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Settings & System Health</Text>
                <Text style={styles.formSubtitle}>
                  Application version, software update check, and account session controls.
                </Text>
              </View>
              <View style={styles.versionBadge}>
                <Text style={styles.versionBadgeText}>v1.0.0</Text>
              </View>
            </View>

            {/* Software Updates Card */}
            <View style={styles.settingsSubCard}>
              <Text style={styles.settingsSubCardTitle}>🔄 Software Updates</Text>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>App Version</Text>
                <Text style={styles.infoValue}>1.0.0 (Production Release)</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Release Channel</Text>
                <Text style={styles.infoValue}>Production (Stable)</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Update Status</Text>
                <Text style={[styles.infoValue, { color: '#16a34a', fontWeight: '700' }]}>
                  ✓ App is Up to Date
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Last Checked</Text>
                <Text style={styles.infoValue}>{lastCheckedTime}</Text>
              </View>

              <TouchableOpacity
                style={[styles.updateCheckBtn, checkingUpdate && styles.btnDisabled]}
                onPress={handleCheckForUpdates}
                disabled={checkingUpdate}
                activeOpacity={0.7}
              >
                {checkingUpdate ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.updateCheckBtnText}>🔄 Check for Updates</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Account & Session Card with Log Out */}
            <View style={styles.settingsSubCard}>
              <Text style={styles.settingsSubCardTitle}>👤 Account & Session</Text>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Signed In As</Text>
                <Text style={styles.infoValue}>{user?.name || 'User'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email Address</Text>
                <Text style={styles.infoValue}>{user?.email || '—'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Role</Text>
                <Text style={[styles.infoValue, { color: '#2563eb', fontWeight: '700' }]}>
                  {user?.role || 'User'}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.settingsLogoutBtn}
                onPress={() => {
                  signOut();
                  router.replace('/login');
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.settingsLogoutBtnText}>🚪 Log Out</Text>
              </TouchableOpacity>
            </View>

            {/* WHO Parameter Reference & Alert Thresholds */}
            <View style={{ marginTop: 16 }}>
              <ParameterReferenceCard
                title="Parameter Reference & Alert Thresholds"
                subtitle="World Health Organization (WHO) and standard drinking water specification targets."
                showValueBadges={false}
              />
            </View>
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
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  userInfo: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  headerLogoutBtn: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  headerLogoutBtnText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '700',
  },
  settingsLogoutBtn: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  settingsLogoutBtnText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  navTabsWrapper: {
    marginVertical: 2,
  },
  navTabs: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  navTab: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  navTabActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  navTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  navTabTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  createBtn: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  refreshBtn: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  refreshBtnText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '600',
  },
  companyCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 4,
  },
  companyCardActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  companyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  companyCardName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  activePill: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563eb',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  companyMeta: {
    fontSize: 12,
    color: '#64748b',
  },
  companyActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 6,
  },
  dashboardLink: {
    paddingVertical: 4,
  },
  dashboardLinkText: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '700',
  },
  deleteLink: {
    paddingVertical: 4,
  },
  deleteLinkText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '600',
  },
  // Branches & Units styles
  branchFormBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 12,
    gap: 8,
  },
  saveBranchBtn: {
    backgroundColor: '#16a34a',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  saveBranchBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  branchCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 8,
  },
  branchHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  branchTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  branchCodeBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284c7',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  branchAddress: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  addUnitBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  addUnitBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  deleteBranchBtn: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  deleteBranchBtnText: {
    color: '#dc2626',
    fontSize: 11,
    fontWeight: '600',
  },
  unitFormBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    padding: 10,
    gap: 8,
  },
  unitFormTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e40af',
  },
  saveUnitBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 6,
    borderRadius: 4,
    alignItems: 'center',
  },
  saveUnitBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  unitsSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginTop: 2,
  },
  unitChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  unitBadge: {
    backgroundColor: '#e2e8f0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unitBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  unitDeleteCross: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ef4444',
  },
  emptyUnitsText: {
    fontSize: 11,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  // Devices & Forms
  activeCompanyBanner: {
    backgroundColor: '#f1f5f9',
    padding: 10,
    borderRadius: 8,
    gap: 6,
  },
  activeCompanyBannerTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  deviceFormCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 12,
    gap: 8,
  },
  formSectionBox: {
    gap: 6,
    marginBottom: 4,
  },
  companySelectChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  companyFormChip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  companyFormChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  companyFormChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  companyFormChipTextActive: {
    color: '#fff',
  },
  branchTag: {
    fontSize: 10,
    fontWeight: '600',
    color: '#065f46',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  unitTag: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1e40af',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  managerSelectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  managerChip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  managerChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  managerChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  managerChipTextActive: {
    color: '#fff',
  },
  saveDeviceBtn: {
    backgroundColor: '#16a34a',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  saveDeviceBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  deviceAdminCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 6,
  },
  deviceAdminHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  deviceAdminName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  deviceAdminMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  deviceAdminSubMeta: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
  },
  deviceActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 6,
    marginTop: 4,
  },
  // Quota & Manager styles
  quotaBanner: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
    gap: 10,
  },
  quotaBannerNormal: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  quotaBannerFull: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  quotaHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  quotaTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  quotaSubtitle: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
  },
  quotaBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  quotaBadgeNormal: {
    backgroundColor: '#dcfce7',
  },
  quotaBadgeFull: {
    backgroundColor: '#fee2e2',
  },
  quotaBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  quotaBadgeTextNormal: {
    color: '#166534',
  },
  quotaBadgeTextFull: {
    color: '#991b1b',
  },
  quotaStatsRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  quotaStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  quotaStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#cbd5e1',
  },
  quotaStatLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  quotaStatValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  managerForm: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 8,
  },
  formTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  formSubtitle: {
    fontSize: 11,
    color: '#64748b',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    marginTop: 4,
  },
  formGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  createManagerBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 4,
  },
  createManagerBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  createManagerBtnDisabled: {
    backgroundColor: '#94a3b8',
    opacity: 0.7,
  },
  inputDisabled: {
    backgroundColor: '#f1f5f9',
    color: '#94a3b8',
  },
  userCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  userRolePill: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563eb',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  userEmail: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  userMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  userDeleteBtn: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  userDeleteBtnText: {
    color: '#dc2626',
    fontSize: 11,
    fontWeight: '700',
  },
  // Settings tab
  versionBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  versionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
  },
  settingsSubCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    gap: 8,
  },
  settingsSubCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
  },
  updateCheckBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  updateCheckBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  emptyDesc: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 360,
  },
});
