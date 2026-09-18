import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { api } from '../src/api/client';
import { authStore } from '../src/state/authStore';

interface CreateCompanyFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CreateCompanyForm({ onSuccess, onCancel }: CreateCompanyFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    companyName: '',
    companyAddress: '',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: '',
    confirmPassword: '',
    manager1Limit: '2',
    manager2Limit: '2',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.companyName.trim()) newErrors.companyName = 'Company name is required';
    if (!formData.ownerName.trim()) newErrors.ownerName = 'Owner name is required';
    if (!formData.ownerEmail.trim()) newErrors.ownerEmail = 'Owner email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.ownerEmail))
      newErrors.ownerEmail = 'Invalid email format';
    if (formData.ownerPassword.length < 8) newErrors.ownerPassword = 'Password must be at least 8 characters';
    if (formData.ownerPassword !== formData.confirmPassword)
      newErrors.confirmPassword = 'Passwords do not match';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateCompany = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const response = await api.post('/api/companies', {
        name: formData.companyName,
        address: formData.companyAddress,
        maxManagers: {
          manager1: parseInt(formData.manager1Limit, 10) || 2,
          manager2: parseInt(formData.manager2Limit, 10) || 2,
        },
        owner: {
          name: formData.ownerName,
          email: formData.ownerEmail,
          password: formData.ownerPassword,
        },
      });

      if (response.data.ok) {
        if (Platform.OS === 'web') {
          window.alert('Company created successfully!');
        } else {
          Alert.alert('Success', 'Company created successfully!');
        }
        
        // Refresh companies list
        const companiesRes = await api.get('/api/companies');
        if (companiesRes.data.ok) {
          authStore.getState().setCompanies(companiesRes.data.data);
        }
        
        onSuccess?.();
      }
    } catch (error: any) {
      const message = error?.response?.data?.error?.message || 'Failed to create company';
      if (Platform.OS === 'web') {
        window.alert(`Error: ${message}`);
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create New Company</Text>

      {/* Company Section */}
      <Text style={styles.sectionTitle}>Company Details</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Company Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter company name"
          value={formData.companyName}
          onChangeText={(text) => setFormData({ ...formData, companyName: text })}
          editable={!loading}
        />
        {errors.companyName && <Text style={styles.error}>{errors.companyName}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Company Address</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter company address (optional)"
          value={formData.companyAddress}
          onChangeText={(text) => setFormData({ ...formData, companyAddress: text })}
          editable={!loading}
        />
      </View>

      {/* Manager Limits */}
      <View style={styles.row}>
        <View style={styles.halfInput}>
          <Text style={styles.label}>Manager1 Limit</Text>
          <TextInput
            style={styles.input}
            placeholder="2"
            keyboardType="number-pad"
            value={formData.manager1Limit}
            onChangeText={(text) => setFormData({ ...formData, manager1Limit: text })}
            editable={!loading}
          />
        </View>
        <View style={styles.halfInput}>
          <Text style={styles.label}>Manager2 Limit</Text>
          <TextInput
            style={styles.input}
            placeholder="2"
            keyboardType="number-pad"
            value={formData.manager2Limit}
            onChangeText={(text) => setFormData({ ...formData, manager2Limit: text })}
            editable={!loading}
          />
        </View>
      </View>

      {/* Owner Section */}
      <Text style={styles.sectionTitle}>Company Owner (Admin) Credentials</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Owner Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter owner name"
          value={formData.ownerName}
          onChangeText={(text) => setFormData({ ...formData, ownerName: text })}
          editable={!loading}
        />
        {errors.ownerName && <Text style={styles.error}>{errors.ownerName}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Owner Email *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter owner email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={formData.ownerEmail}
          onChangeText={(text) => setFormData({ ...formData, ownerEmail: text })}
          editable={!loading}
        />
        {errors.ownerEmail && <Text style={styles.error}>{errors.ownerEmail}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Password *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter password (min 8 chars)"
          secureTextEntry
          value={formData.ownerPassword}
          onChangeText={(text) => setFormData({ ...formData, ownerPassword: text })}
          editable={!loading}
        />
        {errors.ownerPassword && <Text style={styles.error}>{errors.ownerPassword}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Confirm Password *</Text>
        <TextInput
          style={styles.input}
          placeholder="Confirm password"
          secureTextEntry
          value={formData.confirmPassword}
          onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
          editable={!loading}
        />
        {errors.confirmPassword && <Text style={styles.error}>{errors.confirmPassword}</Text>}
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonGroup}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={onCancel}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.createButton, loading && styles.buttonDisabled]}
          onPress={handleCreateCompany}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.buttonText, styles.createButtonText]}>Create Company</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
    color: '#333',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 12,
    color: '#555',
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#f9f9f9',
  },
  error: {
    fontSize: 12,
    color: '#d32f2f',
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
    marginBottom: 12,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#e0e0e0',
  },
  createButton: {
    backgroundColor: '#007AFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  createButtonText: {
    color: '#fff',
  },
});
