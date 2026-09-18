import { ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { CreateCompanyForm } from '@/components/create-company-form';

export default function CreateCompanyModal() {
  const router = useRouter();

  const handleSuccess = () => {
    router.back();
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <ScrollView style={styles.container}>
      <CreateCompanyForm onSuccess={handleSuccess} onCancel={handleCancel} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
