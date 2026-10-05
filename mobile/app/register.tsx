import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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

export default function RegisterScreen() {
  const router = useRouter();
  const setAuth = authStore((s) => s.setAuth);
  const isAuthed = authStore((s) => Boolean(s.accessToken));

  useEffect(() => {
    if (isAuthed) {
      router.replace('/(tabs)/dashboard');
    }
  }, [isAuthed, router]);

  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onRegister() {
    if (!name.trim() || !email.trim() || !password) {
      setError('Please fill in all required fields');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const res = await api.post('/api/auth/register', {
        name: name.trim(),
        email: email.trim(),
        password,
        companyName: companyName.trim() || undefined,
      });
      const { user, tokens } = res.data.data;
      setAuth({ user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });

      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.setItem(
            'aquaflow_auth',
            JSON.stringify({
              user,
              accessToken: tokens.accessToken,
              refreshToken: tokens.refreshToken,
            })
          );
        } catch (e) {}
      }

      router.replace('/(tabs)/dashboard');
    } catch (e: any) {
      const apiMessage = e?.response?.data?.error?.message;
      const fallback = e?.message ? String(e.message) : null;
      setError(apiMessage ?? fallback ?? 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

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
              <Image
                source={require('../assets/images/app-logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <Text style={styles.brandTitle}>Next-Gen Water Safety</Text>
              <Text style={styles.ipdSubtitle}>IPD - 342</Text>
              <Text style={styles.brandSubtitle}>Water Quality Monitoring & Telemetry Platform</Text>
            </View>

            {/* Form Title */}
            <View style={styles.formHeader}>
              <Text style={styles.welcomeText}>Create Account</Text>
              <Text style={styles.instructionText}>
                Register a new administrator or enterprise user account.
              </Text>
            </View>

            {/* Error Notification Banner */}
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorIcon}>⚠️</Text>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Name Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. John Doe"
                placeholderTextColor="#94a3b8"
                editable={!loading}
                style={styles.input}
              />
            </View>

            {/* Company Name Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Organization / Company Name</Text>
              <TextInput
                value={companyName}
                onChangeText={setCompanyName}
                placeholder="e.g. Metro Water Utility Ltd."
                placeholderTextColor="#94a3b8"
                editable={!loading}
                style={styles.input}
              />
            </View>

            {/* Email Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address *</Text>
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

            {/* Password Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password * (Min 8 Characters)</Text>
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
              style={[styles.submitButton, loading && styles.buttonDisabled]}
              onPress={onRegister}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Create Account →</Text>
              )}
            </TouchableOpacity>

            {/* Link back to Sign In */}
            <View style={styles.signInLinkRow}>
              <Text style={styles.signInPromptText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/login')}>
                <Text style={styles.signInLinkText}>Sign In</Text>
              </TouchableOpacity>
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
    backgroundColor: '#0f172a',
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
  logoImage: {
    width: 70,
    height: 70,
    borderRadius: 18,
    marginBottom: 12,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  ipdSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 2,
    marginTop: 4,
    textAlign: 'center',
  },
  brandSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  formHeader: {
    marginBottom: 18,
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
    marginBottom: 14,
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
    paddingVertical: 11,
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
  submitButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#2563eb',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  signInLinkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },
  signInPromptText: {
    fontSize: 13,
    color: '#64748b',
  },
  signInLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563eb',
  },
  securityFooter: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 14,
    alignItems: 'center',
  },
  securityText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
    textAlign: 'center',
  },
});
