import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Text,
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';

import { api } from '../../src/api/client';
import { authStore } from '../../src/state/authStore';
import { CompanySelector } from '../../components/company-selector';
import { AuditLogViewer } from '../../components/audit-log-viewer';
import { StatusBadge } from '../../components/ui/status-badge';
import { DeviceFieldMapper } from '../../components/device-field-mapper';
import type { DeviceSummary, FieldMapping } from '../../src/api/types';

export default function AdminScreen() {
  const router = useRouter();
  const user = authStore((s) => s.user);
  const companies = authStore((s) => s.companies);
  const selectedCompanyId = authStore((s) => s.selectedCompanyId);
  const setSelectedCompanyId = authStore((s) => s.setSelectedCompanyId);
  const setCompanies = authStore((s) => s.setCompanies);
  const signOut = authStore((s) => s.signOut);

  const isSuperAdmin = user?.role === 'SuperAdmin';
  const isCompanyUser = user?.role === 'Company';
  const canAdmin = isSuperAdmin || isCompanyUser;

  const [activeTab, setActiveTab] = useState<'companies' | 'devices' | 'users' | 'audit' | 'config'>(
    isSuperAdmin ? 'companies' : 'devices'
  );

  const [users, setUsers] = useState<any[]>([]);
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [showDeviceForm, setShowDeviceForm] = useState(false);
  const [managerForm, setManagerForm] = useState({ name: '', email: '', password: '', roleName: 'Manager' });
  const [error, setError] = useState<string | null>(null);

  const [deviceForm, setDeviceForm] = useState<{
    deviceId: string;
    name: string;
    channelId: string;
    readKey: string;
    writeKey: string;
    location: string;
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
    deviceType: 'Water Quality Monitor',
    assignedManager: '',
    fieldMappings: [
      { fieldNumber: 1, parameterName: 'pH', unit: 'pH', dataType: 'number', minThreshold: 6.5, maxThreshold: 8.5 },
      { fieldNumber: 2, parameterName: 'Turbidity', unit: 'NTU', dataType: 'number', minThreshold: 0, maxThreshold: 5.0 },
      { fieldNumber: 3, parameterName: 'TDS', unit: 'ppm', dataType: 'number', minThreshold: 0, maxThreshold: 500 },
    ],
  });

  const [thingspeakConfig, setThingspeakConfig] = useState({
    enabled: false,
    channelId: '',
    readKey: '',
    writeKey: '',
    apiBaseUrl: 'https://api.thingspeak.com',
  });

  const companyConfigTargetId = isCompanyUser ? user.companyId || selectedCompanyId : selectedCompanyId;

  async function loadUsers() {
    setError(null);
    setLoading(true);
    try {
      const res = await api.get('/api/users');
      setUsers(res.data.data || []);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

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

  async function loadThingSpeakConfig(companyId?: string) {
    const targetCompanyId = companyId || companyConfigTargetId;
    if (!targetCompanyId) return;

    try {
      setConfigLoading(true);
      const res = await api.get(`/api/config/company/${targetCompanyId}`);
      if (res.data?.data?.thingspeak) {
        setThingspeakConfig(res.data.data.thingspeak);
      } else {
        setThingspeakConfig({
          enabled: false,
          channelId: '',
          readKey: '',
          writeKey: '',
          apiBaseUrl: 'https://api.thingspeak.com',
        });
      }
    } catch (e: any) {
      console.warn('Failed to load ThingSpeak config:', e);
    } finally {
      setConfigLoading(false);
    }
  }

  async function saveThingSpeakConfig() {
    const targetCompanyId = companyConfigTargetId || selectedCompanyId;
    if (!targetCompanyId) return;

    try {
      setConfigLoading(true);
      const payload = {
        thingspeak: {
          enabled: thingspeakConfig.enabled,
          channelId: thingspeakConfig.channelId.trim(),
          readKey: thingspeakConfig.readKey.trim(),
          writeKey: thingspeakConfig.writeKey.trim(),
          apiBaseUrl: thingspeakConfig.apiBaseUrl.trim() || 'https://api.thingspeak.com',
        },
      };

      const res = await api.put(`/api/config/company/${targetCompanyId}`, payload);
      if (res.data?.ok) {
        setThingspeakConfig(res.data.data.thingspeak || thingspeakConfig);
        Alert.alert('Saved', 'ThingSpeak settings saved successfully.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error?.message ?? 'Failed to save settings');
    } finally {
      setConfigLoading(false);
    }
  }

  async function loadDevices(companyId?: string) {
    const targetCompanyId = companyId || companyConfigTargetId || selectedCompanyId;
    if (!targetCompanyId && !isSuperAdmin) return;

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

  async function handleCreateDevice() {
    const targetCompanyId = companyConfigTargetId || selectedCompanyId;
    if (!targetCompanyId) {
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
        location: deviceForm.location.trim() || undefined,
        assignedManager: deviceForm.assignedManager || undefined,
        companyId: targetCompanyId,
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
          deviceType: 'Water Quality Monitor',
          assignedManager: '',
          fieldMappings: [
            { fieldNumber: 1, parameterName: 'pH', unit: 'pH', dataType: 'number', minThreshold: 6.5, maxThreshold: 8.5 },
            { fieldNumber: 2, parameterName: 'Turbidity', unit: 'NTU', dataType: 'number', minThreshold: 0, maxThreshold: 5.0 },
            { fieldNumber: 3, parameterName: 'TDS', unit: 'ppm', dataType: 'number', minThreshold: 0, maxThreshold: 500 },
          ],
        });
        setShowDeviceForm(false);
        await loadDevices(targetCompanyId);
        Alert.alert(
          'Device Registered Successfully!',
          'Device is now active. Its sensor parameters, thresholds, and live telemetry will automatically stream on the Dashboard.'
        );
      }
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error?.message || 'Failed to register device');
    } finally {
      setDevicesLoading(false);
    }
  }

  async function handleDeleteDevice(deviceId: string, deviceName: string) {
    const targetCompanyId = companyConfigTargetId || selectedCompanyId;
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
      await loadDevices(targetCompanyId || undefined);
      Alert.alert('Device Deleted', `Device ${deviceName} has been removed.`);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error?.message || 'Failed to delete device');
    } finally {
      setDevicesLoading(false);
    }
  }

  useEffect(() => {
    if (canAdmin) {
      loadUsers();
      if (isSuperAdmin) {
        loadCompanies();
      }
    }
  }, [canAdmin, isSuperAdmin]);

  useEffect(() => {
    const targetId = companyConfigTargetId || selectedCompanyId;
    if (canAdmin && targetId) {
      loadThingSpeakConfig(targetId);
      loadDevices(targetId);
    }
  }, [selectedCompanyId, user?.companyId]);

  async function handleCreateManager() {
    const targetCompanyId = isCompanyUser ? user.companyId : selectedCompanyId;
    if (!targetCompanyId) {
      Alert.alert('Selection Error', 'Please select a company first.');
      return;
    }

    if (!managerForm.name.trim() || !managerForm.email.trim() || !managerForm.password) {
      Alert.alert('Validation', 'Name, email, and password are required.');
      return;
    }

    try {
      const res = await api.post('/api/users', {
        name: managerForm.name.trim(),
        email: managerForm.email.trim(),
        password: managerForm.password,
        roleName: managerForm.roleName,
        companyId: targetCompanyId,
      });

      if (res.data?.ok) {
        setManagerForm({ name: '', email: '', password: '', roleName: 'Manager' });
        await loadUsers();
        Alert.alert('Success', `Manager account created for ${managerForm.email}`);
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
      await loadUsers();
      Alert.alert('Success', 'User deleted.');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error?.message ?? 'Failed to delete user');
    }
  }

  async function handleDeleteCompany(companyId: string, companyName: string) {
    const confirmed =
      Platform.OS === 'web'
        ? window.confirm(`Delete company ${companyName}? This removes all company users, devices, and data.`)
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

  if (!canAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.accessDeniedCard}>
          <Text style={styles.accessDeniedTitle}>Access Denied</Text>
          <Text style={styles.accessDeniedText}>
            You do not have administrative privileges. Contact your organization administrator.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.title}>Administration Console</Text>
              <Text style={styles.userInfo}>
                Logged in as: {user?.name} ({user?.role})
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
        </View>

        {/* Section Navigation Tabs */}
        <View style={styles.navTabs}>
          {isSuperAdmin && (
            <TouchableOpacity
              style={[styles.navTab, activeTab === 'companies' && styles.navTabActive]}
              onPress={() => setActiveTab('companies')}
            >
              <Text style={[styles.navTabText, activeTab === 'companies' && styles.navTabTextActive]}>
                🏢 Companies
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.navTab, activeTab === 'devices' && styles.navTabActive]}
            onPress={() => setActiveTab('devices')}
          >
            <Text style={[styles.navTabText, activeTab === 'devices' && styles.navTabTextActive]}>
              📡 IoT Devices ({devices.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navTab, activeTab === 'users' && styles.navTabActive]}
            onPress={() => setActiveTab('users')}
          >
            <Text style={[styles.navTabText, activeTab === 'users' && styles.navTabTextActive]}>
              👥 Users & Managers
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navTab, activeTab === 'audit' && styles.navTabActive]}
            onPress={() => setActiveTab('audit')}
          >
            <Text style={[styles.navTabText, activeTab === 'audit' && styles.navTabTextActive]}>
              📋 Audit Trail
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navTab, activeTab === 'config' && styles.navTabActive]}
            onPress={() => setActiveTab('config')}
          >
            <Text style={[styles.navTabText, activeTab === 'config' && styles.navTabTextActive]}>
              ⚙️ Settings
            </Text>
          </TouchableOpacity>
        </View>

        {/* TAB 1: Companies (SuperAdmin only) */}
        {activeTab === 'companies' && isSuperAdmin && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Client Organizations ({companies.length})</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={styles.createBtn}
                  onPress={() => router.push('/modal')}
                >
                  <Text style={styles.createBtnText}>+ Create Company</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.refreshBtn} onPress={loadCompanies}>
                  <Text style={styles.refreshBtnText}>🔄 Refresh</Text>
                </TouchableOpacity>
              </View>
            </View>

            {companies.map((c) => {
              const isSelected = selectedCompanyId === c.id;
              return (
                <View key={c.id} style={[styles.companyCard, isSelected && styles.companyCardActive]}>
                  <View style={styles.companyCardHeader}>
                    <Text style={styles.companyCardName}>{c.name}</Text>
                    {isSelected && <Text style={styles.activePill}>Active Focus</Text>}
                  </View>

                  {c.address ? <Text style={styles.companyMeta}>📍 {c.address}</Text> : null}
                  <Text style={styles.companyMeta}>
                    Quota: {c.maxManagers?.manager1 ?? 2} M1, {c.maxManagers?.manager2 ?? 2} M2
                  </Text>

                  <View style={styles.companyActionsRow}>
                    <TouchableOpacity
                      style={styles.dashboardLink}
                      onPress={() => {
                        setSelectedCompanyId(c.id);
                        router.push('/(tabs)/dashboard');
                      }}
                    >
                      <Text style={styles.dashboardLinkText}>Open Dashboard →</Text>
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

        {/* TAB: IoT Devices */}
        {activeTab === 'devices' && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>IoT Monitoring Devices ({devices.length})</Text>
                <Text style={styles.formSubtitle}>
                  Physical sensor hardware stations configured for this organization.
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
                  <Text style={styles.refreshBtnText}>
                    {devicesLoading ? '...' : '🔄 Refresh'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Register Device Form */}
            {showDeviceForm && (
              <View style={styles.deviceFormCard}>
                <Text style={styles.formTitle}>Register New IoT Station</Text>
                <Text style={styles.formSubtitle}>
                  Connects to ThingSpeak channel securely. Newly added devices stream telemetry to the Dashboard automatically.
                </Text>

                <Text style={styles.inputLabel}>Device ID * (Hardware ID)</Text>
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
                    <Text style={styles.inputLabel}>Location / Station</Text>
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

                {/* Assigned Manager Selection */}
                {users.filter((u) => u.role?.startsWith('Manager')).length > 0 && (
                  <View style={{ marginTop: 4 }}>
                    <Text style={styles.inputLabel}>Assign Responsible Manager (Optional):</Text>
                    <View style={styles.managerSelectRow}>
                      <TouchableOpacity
                        style={[
                          styles.managerChip,
                          !deviceForm.assignedManager && styles.managerChipActive,
                        ]}
                        onPress={() => setDeviceForm((p) => ({ ...p, assignedManager: '' }))}
                      >
                        <Text
                          style={[
                            styles.managerChipText,
                            !deviceForm.assignedManager && styles.managerChipTextActive,
                          ]}
                        >
                          All Managers
                        </Text>
                      </TouchableOpacity>
                      {users
                        .filter((u) => u.role?.startsWith('Manager'))
                        .map((mgr) => (
                          <TouchableOpacity
                            key={mgr.id}
                            style={[
                              styles.managerChip,
                              deviceForm.assignedManager === mgr.id && styles.managerChipActive,
                            ]}
                            onPress={() => setDeviceForm((p) => ({ ...p, assignedManager: mgr.id }))}
                          >
                            <Text
                              style={[
                                styles.managerChipText,
                                deviceForm.assignedManager === mgr.id && styles.managerChipTextActive,
                              ]}
                            >
                              👤 {mgr.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                    </View>
                  </View>
                )}

                {/* Configurable Field Mappings */}
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
                      </View>
                      <Text style={styles.deviceAdminMeta}>
                        Hardware ID: {dev.deviceId} · Channel: {dev.channelId}
                        {dev.location ? ` · 📍 ${dev.location}` : ''}
                      </Text>
                      <Text style={styles.deviceAdminSubMeta}>
                        Manager:{' '}
                        {dev.assignedManagerUser
                          ? `${dev.assignedManagerUser.name} (${dev.assignedManagerUser.email})`
                          : 'Accessible to all managers'}
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
          </View>
        )}

        {/* TAB 2: Users & Managers */}
        {activeTab === 'users' && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>User Management</Text>
              <TouchableOpacity style={styles.refreshBtn} onPress={loadUsers} disabled={loading}>
                <Text style={styles.refreshBtnText}>🔄 Refresh</Text>
              </TouchableOpacity>
            </View>

            {/* Create Manager Form */}
            <View style={styles.managerForm}>
              <Text style={styles.formTitle}>Add New Manager / Operator</Text>
              <Text style={styles.formSubtitle}>
                Managers receive view-only access and are restricted from downloading telemetry.
              </Text>

              <TextInput
                style={styles.input}
                value={managerForm.name}
                placeholder="Full Name"
                onChangeText={(txt) => setManagerForm((p) => ({ ...p, name: txt }))}
              />

              <TextInput
                style={styles.input}
                value={managerForm.email}
                placeholder="Email Address"
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={(txt) => setManagerForm((p) => ({ ...p, email: txt }))}
              />

              <TextInput
                style={styles.input}
                value={managerForm.password}
                placeholder="Password (min 8 chars)"
                secureTextEntry
                onChangeText={(txt) => setManagerForm((p) => ({ ...p, password: txt }))}
              />

              <TouchableOpacity style={styles.createManagerBtn} onPress={handleCreateManager}>
                <Text style={styles.createManagerBtnText}>Create Manager Account</Text>
              </TouchableOpacity>
            </View>

            {/* User List */}
            {loading && <ActivityIndicator style={{ marginVertical: 12 }} />}
            {users.map((u) => (
              <View key={u.id} style={styles.userCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{u.name}</Text>
                  <Text style={styles.userEmail}>{u.email}</Text>
                  <Text style={styles.userMeta}>Role: {u.role} · Active: {String(u.isActive)}</Text>
                </View>

                {u.role !== 'SuperAdmin' && u.email !== user?.email && (
                  <TouchableOpacity
                    style={styles.userDeleteBtn}
                    onPress={() => handleDeleteUser(u.id, u.name)}
                  >
                    <Text style={styles.userDeleteBtnText}>Delete</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {/* TAB 3: Audit Trail */}
        {activeTab === 'audit' && (
          <AuditLogViewer companyId={isSuperAdmin ? selectedCompanyId : user?.companyId} />
        )}

        {/* TAB 4: ThingSpeak Settings */}
        {activeTab === 'config' && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Default Organization ThingSpeak Settings</Text>
            <Text style={styles.formSubtitle}>
              Default credentials used when querying unassigned channels.
            </Text>

            <TouchableOpacity
              style={[styles.toggleBtn, thingspeakConfig.enabled && styles.toggleBtnActive]}
              onPress={() => setThingspeakConfig((p) => ({ ...p, enabled: !p.enabled }))}
            >
              <Text style={[styles.toggleBtnText, thingspeakConfig.enabled && styles.toggleBtnTextActive]}>
                Status: {thingspeakConfig.enabled ? 'Enabled' : 'Disabled'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.inputLabel}>ThingSpeak Channel ID</Text>
            <TextInput
              style={styles.input}
              value={thingspeakConfig.channelId}
              placeholder="e.g. 1234567"
              onChangeText={(txt) => setThingspeakConfig((p) => ({ ...p, channelId: txt }))}
            />

            <Text style={styles.inputLabel}>Read API Key</Text>
            <TextInput
              style={styles.input}
              value={thingspeakConfig.readKey}
              placeholder="Private Read Key"
              secureTextEntry
              onChangeText={(txt) => setThingspeakConfig((p) => ({ ...p, readKey: txt }))}
            />

            <Text style={styles.inputLabel}>API Base URL</Text>
            <TextInput
              style={styles.input}
              value={thingspeakConfig.apiBaseUrl}
              placeholder="https://api.thingspeak.com"
              onChangeText={(txt) => setThingspeakConfig((p) => ({ ...p, apiBaseUrl: txt }))}
            />

            <TouchableOpacity
              style={[styles.saveConfigBtn, configLoading && styles.btnDisabled]}
              onPress={saveThingSpeakConfig}
              disabled={configLoading}
            >
              <Text style={styles.saveConfigBtnText}>
                {configLoading ? 'Saving...' : 'Save Organization Settings'}
              </Text>
            </TouchableOpacity>
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
  },
  userInfo: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  logoutBtn: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  logoutBtnText: {
    color: '#dc2626',
    fontSize: 11,
    fontWeight: '700',
  },
  navTabs: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
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
  },
  navTabTextActive: {
    color: '#fff',
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
  userCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  userName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  userEmail: {
    fontSize: 12,
    color: '#64748b',
  },
  userMeta: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  userDeleteBtn: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  userDeleteBtnText: {
    color: '#dc2626',
    fontSize: 11,
    fontWeight: '600',
  },
  toggleBtn: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  toggleBtnTextActive: {
    color: '#15803d',
    fontWeight: '700',
  },
  saveConfigBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  saveConfigBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  accessDeniedCard: {
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    padding: 24,
    margin: 20,
    alignItems: 'center',
  },
  accessDeniedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#b91c1c',
    marginBottom: 8,
  },
  accessDeniedText: {
    fontSize: 13,
    color: '#7f1d1d',
    textAlign: 'center',
  },
  // Device Management Styles
  deviceFormCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 14,
    gap: 8,
    marginVertical: 4,
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
    fontSize: 13,
    fontWeight: '700',
  },
  managerSelectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 4,
  },
  managerChip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  managerChipActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  managerChipText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  managerChipTextActive: {
    color: '#2563eb',
    fontWeight: '700',
  },
  deviceAdminCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
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
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  deviceAdminMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  deviceAdminSubMeta: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  deviceActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 6,
  },
  emptyCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 24,
    alignItems: 'center',
    gap: 6,
  },
  emptyIcon: {
    fontSize: 32,
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
    maxWidth: 320,
  },
});
