import { Platform } from 'react-native';

function resolveBaseUrl() {
  const raw = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

  // Android emulator: "localhost" points to the emulator itself, not your PC.
  if (Platform.OS === 'android' && (raw.includes('://localhost') || raw.includes('://127.0.0.1'))) {
    return raw.replace('://localhost', '://10.0.2.2').replace('://127.0.0.1', '://10.0.2.2');
  }

  return raw;
}

export const config = {
  apiBaseUrl: resolveBaseUrl(),
};

