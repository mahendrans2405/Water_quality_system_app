import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

import type { FieldMapping } from '../src/api/types';

interface DeviceFieldMapperProps {
  mappings: FieldMapping[];
  onChange: (newMappings: FieldMapping[]) => void;
  editable?: boolean;
}

export function DeviceFieldMapper({ mappings, onChange, editable = true }: DeviceFieldMapperProps) {
  const [fields, setFields] = useState<FieldMapping[]>(
    mappings.length > 0
      ? mappings
      : [
          { fieldNumber: 1, parameterName: 'pH', unit: 'pH', dataType: 'number', minThreshold: 6.5, maxThreshold: 8.5 },
          { fieldNumber: 2, parameterName: 'Turbidity', unit: 'NTU', dataType: 'number', minThreshold: 0, maxThreshold: 5.0 },
          { fieldNumber: 3, parameterName: 'TDS', unit: 'ppm', dataType: 'number', minThreshold: 0, maxThreshold: 500 },
        ]
  );

  const handleUpdateField = (index: number, key: keyof FieldMapping, value: any) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], [key]: value };
    setFields(updated);
    onChange(updated);
  };

  const handleAddField = () => {
    if (fields.length >= 8) return; // ThingSpeak supports max 8 fields
    const nextFieldNumber = fields.length + 1;
    const nextFields: FieldMapping[] = [
      ...fields,
      {
        fieldNumber: nextFieldNumber,
        parameterName: `Sensor ${nextFieldNumber}`,
        unit: '',
        dataType: 'number',
        minThreshold: null,
        maxThreshold: null,
      },
    ];
    setFields(nextFields);
    onChange(nextFields);
  };

  const handleRemoveField = (index: number) => {
    if (fields.length <= 1) return;
    const nextFields = fields.filter((_, i) => i !== index);
    setFields(nextFields);
    onChange(nextFields);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>ThingSpeak Field Mappings (1 - 8)</Text>
        {editable && fields.length < 8 && (
          <TouchableOpacity onPress={handleAddField} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ Add Field</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.helpText}>
        Map each ThingSpeak channel field to a water sensor parameter with acceptable safety thresholds.
      </Text>

      {fields.map((f, index) => (
        <View key={`field-${f.fieldNumber}-${index}`} style={styles.fieldCard}>
          <View style={styles.fieldHeader}>
            <Text style={styles.fieldBadge}>Field {f.fieldNumber}</Text>
            {editable && fields.length > 1 && (
              <TouchableOpacity onPress={() => handleRemoveField(index)}>
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.row}>
            <View style={{ flex: 2 }}>
              <Text style={styles.inputLabel}>Parameter Name</Text>
              <TextInput
                style={styles.input}
                value={f.parameterName}
                placeholder="e.g. pH, TDS, Turbidity"
                editable={editable}
                onChangeText={(txt) => handleUpdateField(index, 'parameterName', txt)}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Unit</Text>
              <TextInput
                style={styles.input}
                value={f.unit}
                placeholder="pH, ppm, NTU"
                editable={editable}
                onChangeText={(txt) => handleUpdateField(index, 'unit', txt)}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Min Threshold</Text>
              <TextInput
                style={styles.input}
                value={f.minThreshold !== null && f.minThreshold !== undefined ? String(f.minThreshold) : ''}
                placeholder="e.g. 6.5"
                keyboardType="numeric"
                editable={editable}
                onChangeText={(txt) => handleUpdateField(index, 'minThreshold', txt === '' ? null : Number(txt))}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Max Threshold</Text>
              <TextInput
                style={styles.input}
                value={f.maxThreshold !== null && f.maxThreshold !== undefined ? String(f.maxThreshold) : ''}
                placeholder="e.g. 8.5"
                keyboardType="numeric"
                editable={editable}
                onChangeText={(txt) => handleUpdateField(index, 'maxThreshold', txt === '' ? null : Number(txt))}
              />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  addBtn: {
    backgroundColor: '#eff6ff',
    borderColor: '#93c5fd',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  addBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
  },
  helpText: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 10,
  },
  fieldCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  removeText: {
    fontSize: 11,
    color: '#dc2626',
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 2,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
  },
});
