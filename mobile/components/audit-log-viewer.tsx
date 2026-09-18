import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

import { api } from '../src/api/client';
import type { AuditLogRecord } from '../src/api/types';

interface AuditLogViewerProps {
  companyId?: string | null;
}

export function AuditLogViewer({ companyId }: AuditLogViewerProps) {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAuditLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/api/audit-logs', {
        params: companyId ? { companyId } : undefined,
      });
      if (res.data?.ok) {
        setLogs(res.data.data.items || []);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, [companyId]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>System Audit Trail</Text>
        <TouchableOpacity onPress={loadAuditLogs} style={styles.refreshBtn}>
          <Text style={styles.refreshBtnText}>🔄 Refresh</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitle}>
        Tracks data exports, user changes, and device administrative actions.
      </Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {loading ? <ActivityIndicator style={{ marginVertical: 12 }} /> : null}

      {!loading && logs.length === 0 ? (
        <Text style={styles.emptyText}>No audit entries recorded yet.</Text>
      ) : (
        <ScrollView style={styles.logList} nestedScrollEnabled>
          {logs.map((log) => {
            const isDownload = log.action === 'DATA_DOWNLOAD' || log.action === 'DATA_EXPORT';
            return (
              <View key={log.id} style={[styles.logCard, isDownload && styles.downloadCard]}>
                <View style={styles.logRow}>
                  <Text style={[styles.actionBadge, isDownload && styles.downloadBadge]}>
                    {log.action}
                  </Text>
                  <Text style={styles.timestamp}>
                    {new Date(log.createdAt).toLocaleString()}
                  </Text>
                </View>

                <Text style={styles.logDetail}>
                  👤 <Text style={{ fontWeight: '600' }}>User:</Text> {log.user?.name || log.userEmail || 'System'}
                </Text>

                {log.company && (
                  <Text style={styles.logDetail}>
                    🏢 <Text style={{ fontWeight: '600' }}>Company:</Text> {log.company.name}
                  </Text>
                )}

                <Text style={styles.logDetail}>
                  📁 <Text style={{ fontWeight: '600' }}>Resource:</Text> {log.resource} ({log.resourceId})
                </Text>

                {log.details && Object.keys(log.details).length > 0 && (
                  <Text style={styles.metaDetail}>
                    Details: {JSON.stringify(log.details)}
                  </Text>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginVertical: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  refreshBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  refreshBtnText: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 12,
  },
  logList: {
    maxHeight: 320,
  },
  logCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    marginBottom: 8,
    gap: 4,
  },
  downloadCard: {
    borderColor: '#fed7aa',
    backgroundColor: '#fff7ed',
  },
  logRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  actionBadge: {
    fontSize: 10,
    fontWeight: '700',
    backgroundColor: '#e2e8f0',
    color: '#334155',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  downloadBadge: {
    backgroundColor: '#ffedd5',
    color: '#c2410c',
  },
  timestamp: {
    fontSize: 11,
    color: '#94a3b8',
  },
  logDetail: {
    fontSize: 12,
    color: '#334155',
  },
  metaDetail: {
    fontSize: 11,
    color: '#64748b',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 12,
    marginVertical: 4,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: 10,
    textAlign: 'center',
  },
});
