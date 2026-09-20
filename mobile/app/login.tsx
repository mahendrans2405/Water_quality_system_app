import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { api } from '../src/api/client';
import { authStore } from '../src/state/authStore';

export default function LoginScreen() {
  const router = useRouter();
  const setAuth = authStore((s) => s.setAuth);
  const setCompanies = authStore((s) => s.setCompanies);
  const isAuthed = authStore((s) => Boolean(s.accessToken));
  const user = authStore((s) => s.user);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showDemoDrawer, setShowDemoDrawer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthed && user) {
      if (user.role === 'SuperAdmin') {
        router.replace('/(tabs)/admin');
      } else {
        router.replace('/(tabs)/dashboard');
      }
    }
  }, [isAuthed, router, user]);

  async function handleLoginSuccess(userData: any, tokens: any) {
    if (userData.role === 'SuperAdmin') {
      try {
        const companiesRes = await api.get('/api/companies', {
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        });
        if (companiesRes.data.ok) {
          setCompanies(companiesRes.data.data);
        }
      } catch (err) {
        console.warn('Failed to fetch companies:', err);
      }
    }

    if (
      userData.role === 'Company' ||
      userData.role === 'Manager' ||
      userData.role === 'Manager1' ||
      userData.role === 'Manager2'
    ) {
      try {
        const companyRes = await api.get('/api/companies/me', {
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        });
        if (companyRes.data.ok) {
          setCompanies([companyRes.data.data]);
        }
      } catch (err) {
        console.warn('Failed to fetch company profile:', err);
      }
    }

    setAuth({ user: userData, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const comps = authStore.getState().companies;
        const selComp = authStore.getState().selectedCompanyId;
        window.localStorage.setItem(
          'aquaflow_auth',
          JSON.stringify({
            user: userData,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            companies: comps,
            selectedCompanyId: selComp,
          })
        );
      } catch (e) {}
    }

    if (userData.role === 'SuperAdmin') {
      router.replace('/(tabs)/admin');
    } else {
      router.replace('/(tabs)/dashboard');
    }
  }

  async function onLogin() {
    if (!email.trim() || !password) {
      setError('Please enter your email and password');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const res = await api.post('/api/auth/login', { email: email.trim(), password });
      const { user: loggedInUser, tokens } = res.data.data;
      await handleLoginSuccess(loggedInUser, tokens);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Quick demo login for SuperAdmin
  const quickLoginSuperAdmin = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.post('/api/auth/login', {
        email: 'superadmin@system.local',
        password: '12345678',
      });
      const { user: loggedInUser, tokens } = res.data.data;
      await handleLoginSuccess(loggedInUser, tokens);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Quick login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            {/* Brand Logo & Header */}
            <View style={styles.brandHeader}>
              <View style={styles.logoBadge}>
                <Text style={styles.logoIcon}>💧</Text>
              </View>
              <Text style={styles.brandTitle}>AQUAFLOW IOT</Text>
              <Text style={styles.brandSubtitle}>Water Quality Monitoring & Telemetry Platform</Text>
            </View>

            {/* Form Title */}
            <View style={styles.formHeader}>
              <Text style={styles.welcomeText}>Sign In</Text>
              <Text style={styles.instructionText}>
                Enter your credentials to access live sensor data and telemetry.
              </Text>
            </View>

            {/* Error Notification Banner */}
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorIcon}>⚠️</Text>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Email Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@organization.com"
                  placeholderTextColor="#94a3b8"
                  editable={!loading}
                  style={styles.input}
                />
              </View>
            </View>

            {/* Password Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#94a3b8"
                  editable={!loading}
                  style={[styles.input, { paddingRight: 60 }]}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword((p) => !p)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.loginButton, loading && styles.buttonDisabled]}
              onPress={onLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.loginButtonText}>Sign In to Dashboard →</Text>
              )}
            </TouchableOpacity>

            {/* Collapsible Demo Access Section */}
            <View style={styles.demoCard}>
              <TouchableOpacity
                style={styles.demoHeader}
                onPress={() => setShowDemoDrawer((p) => !p)}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.demoIcon}>⚡</Text>
                  <Text style={styles.demoTitle}>Demo / Testing Credentials</Text>
                </View>
                <Text style={styles.demoPill}>{showDemoDrawer ? '▲ Hide' : '▼ View Demo'}</Text>
              </TouchableOpacity>

              {showDemoDrawer && (
                <>
                  <Text style={styles.demoDetails}>
                    Pre-configured administrator account with full platform and device access:
                  </Text>
                  <Text style={styles.demoCredentials}>
                    Email: <Text style={styles.codeText}>superadmin@system.local</Text>
                    {'\n'}Password: <Text style={styles.codeText}>12345678</Text>
                  </Text>

                  <TouchableOpacity
                    style={[styles.demoButton, loading && styles.buttonDisabled]}
                    onPress={quickLoginSuperAdmin}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.demoButtonText}>Quick Login as SuperAdmin</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>


            {/* Security Footer Notice */}
            <View style={styles.securityFooter}>
              <Text style={styles.securityText}>🔒 256-Bit SSL Encrypted · Multi-Tenant Isolated Platform</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // Rich enterprise navy slate background
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    paddingVertical: 32,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 460,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#eff6ff',
    borderWidth: 2,
    borderColor: '#bfdbfe',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#2563eb',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  logoIcon: {
    fontSize: 28,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 1.5,
  },
  brandSubtitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  formHeader: {
    marginBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 16,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  instructionText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 18,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorIcon: {
    fontSize: 16,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0f172a',
  },
  eyeButton: {
    position: 'absolute',
    right: 14,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  eyeText: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '700',
  },
  loginButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#2563eb',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  demoCard: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    padding: 14,
    marginTop: 20,
    gap: 6,
  },
  demoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  demoIcon: {
    fontSize: 14,
  },
  demoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },
  demoPill: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803d',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  demoDetails: {
    fontSize: 11,
    color: '#4b5563',
    lineHeight: 16,
  },
  demoCredentials: {
    fontSize: 11,
    color: '#374151',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: '#ffffff',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginVertical: 4,
  },
  codeText: {
    fontWeight: '700',
    color: '#0f172a',
  },
  demoButton: {
    backgroundColor: '#16a34a',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  demoButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  securityFooter: {
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    alignItems: 'center',
  },
  securityText: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '500',
  },
});
