import { useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
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
      <Text style={styles.label}>Select Company:</Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}
      >
        {companies.map((company) => (
          <TouchableOpacity
            key={company.id}
            style={[
              styles.companyButton,
              selectedCompanyId === company.id && styles.companyButtonActive,
            ]}
            onPress={() => handleSelectCompany(company.id)}
          >
            <Text
              style={[
                styles.companyText,
                selectedCompanyId === company.id && styles.companyTextActive,
              ]}
            >
              {company.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  scrollView: {
    marginBottom: 8,
  },
  companyButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  companyButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  companyText: {
    fontSize: 12,
    color: '#333',
  },
  companyTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
});
