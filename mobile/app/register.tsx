import { useEffect, useState } from 'react';
import { ActivityIndicator, Button, SafeAreaView, Text, TextInput, View } from 'react-native';
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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onRegister() {
    setError(null);
    setLoading(true);
    try {
      const res = await api.post('/api/auth/register', {
        name,
        email,
        password,
        companyName: companyName || undefined,
      });
      const { user, tokens } = res.data.data;
      setAuth({ user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
    } catch (e: any) {
      const apiMessage = e?.response?.data?.error?.message;
      const fallback = e?.message ? String(e.message) : null;
      setError(apiMessage ?? fallback ?? 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: '600' }}>Register</Text>

      <View style={{ gap: 8 }}>
        <Text>Name</Text>
        <TextInput value={name} onChangeText={setName} style={{ borderWidth: 1, padding: 10, borderRadius: 8 }} />
      </View>

      <View style={{ gap: 8 }}>
        <Text>Company name (required for non-SuperAdmin)</Text>
        <TextInput
          value={companyName}
          onChangeText={setCompanyName}
          style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}
        />
      </View>

      <View style={{ gap: 8 }}>
        <Text>Email</Text>
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}
        />
      </View>

      <View style={{ gap: 8 }}>
        <Text>Password</Text>
        <TextInput
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}
        />
      </View>

      {error ? <Text style={{ color: 'crimson' }}>{error}</Text> : null}

      <Button title={loading ? 'Creating...' : 'Register'} onPress={onRegister} disabled={loading} />
      {loading ? <ActivityIndicator /> : null}
    </SafeAreaView>
  );
}

