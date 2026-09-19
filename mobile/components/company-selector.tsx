import { useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import { api } from '../src/api/client';
import { authStore } from '../src/state/authStore';

interface CompanySelectorProps {
  onCompanySelected?: (companyId: string) => void;
}

export function CompanySelector({ onCompanySelected }: CompanySelectorProps) {
  const user = authStore((s) => s.user);
  const companies = authStore((s) => s.companies);
  const selectedCompanyId = authStore((s) => s.selectedCompanyId);
  const setSelectedCompanyId = authStore((s) => s.setSelectedCompanyId);
  const setCompanies = authStore((s) => s.setCompanies);

  useEffect(() => {
    if (user?.role === 'SuperAdmin' && companies.length === 0) {
      api.get('/api/companies')
        .then((res) => {
          if (res.data?.ok && res.data?.data) {
            setCompanies(res.data.data);
            if (!selectedCompanyId && res.data.data.length > 0) {
              setSelectedCompanyId(res.data.data[0].id);
            }
          }
        })
        .catch((err) => {
          console.warn('CompanySelector failed to load companies:', err);
        });
    }
  }, [user?.role, companies.length, selectedCompanyId, setCompanies, setSelectedCompanyId]);

  const handleSelectCompany = (companyId: string) => {
    setSelectedCompanyId(companyId);
    onCompanySelected?.(companyId);
  };

  if (companies.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Select Organization:</Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        {companies.map((company) => {
          const isSelected = selectedCompanyId === company.id;
          return (
            <TouchableOpacity
              key={company.id}
              style={[
                styles.companyButton,
                isSelected && styles.companyButtonActive,
              ]}
              onPress={() => handleSelectCompany(company.id)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.companyText,
                  isSelected && styles.companyTextActive,
                ]}
              >
                {company.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  scrollContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  companyButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  companyButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#1d4ed8',
  },
  companyText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  companyTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
