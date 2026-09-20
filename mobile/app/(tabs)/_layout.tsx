import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { authStore } from '../../src/state/authStore';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isAuthed = authStore((s) => Boolean(s.accessToken));
  const role = authStore((s) => s.user?.role);

  if (!isAuthed) {
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedAuth = window.localStorage.getItem('aquaflow_auth');
      if (savedAuth) {
        try {
          const parsed = JSON.parse(savedAuth);
          if (parsed.accessToken && parsed.user) {
            authStore.getState().setAuth(parsed);
            if (Array.isArray(parsed.companies) && parsed.companies.length > 0) {
              authStore.getState().setCompanies(parsed.companies);
            }
            if (parsed.selectedCompanyId) {
              authStore.getState().setSelectedCompanyId(parsed.selectedCompanyId);
            }
            return null;
          }
        } catch (e) {}
      }
    }
    return <Redirect href="/login" />;
  }

  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 10 : 8);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#64748b',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e2e8f0',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 56 + insets.bottom : 64 + (insets.bottom > 0 ? insets.bottom : 6),
          paddingBottom: bottomInset,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
        },
      }}>
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="readings"
        options={{
          title: 'Readings',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="list.bullet" color={color} />,
        }}
      />
      <Tabs.Screen
        name="charts"
        options={{
          title: 'Charts',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="chart.xyaxis.line" color={color} />,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: (role === 'SuperAdmin' || role === 'Company') ? 'Admin' : 'Settings',
          tabBarIcon: ({ color }) => (
            <IconSymbol
              size={28}
              name={(role === 'SuperAdmin' || role === 'Company') ? 'person.3.fill' : 'gearshape.fill'}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
