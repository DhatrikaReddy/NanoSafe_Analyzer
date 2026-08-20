import React, { useState } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert
} from 'react-native';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { ALL_CELL_LINES } from '../../theme/cellLines';
import apiClient from '../../api/client';
import { Cpu, Zap, AlertTriangle, CheckCircle } from 'lucide-react-native';

const riskColors = {
  Low: colors.safe,
  Moderate: colors.moderate,
  High: colors.danger,
};

export default function MLPredictionScreen() {
  const [form, setForm] = useState({
    cell_line: 'HeLa',
    concentration: '',
    exposure_time: '24h',
    ros_level: '',
    ldh_level: '',
    apoptosis_rate: '',
    cell_viability: '',
  });
  const [result, setResult] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const exposureTimes = ['6h', '12h', '24h', '48h', '72h'];


  const handlePredict = async () => {
    const required = ['concentration', 'ros_level', 'ldh_level', 'apoptosis_rate', 'cell_viability'];
    for (const field of required) {
      if (!form[field]) {
        Alert.alert('Missing Data', `Please enter a value for ${field.replace(/_/g, ' ')}.`);
        return;
      }
    }
    try {
      setLoading(true);
      setError(null);
      setResult(null);
      const payload = {
        cell_line: form.cell_line,
        concentration: parseFloat(form.concentration),
        exposure_time: form.exposure_time,
        ros_level: parseFloat(form.ros_level),
        ldh_level: parseFloat(form.ldh_level),
        apoptosis_rate: parseFloat(form.apoptosis_rate),
        cell_viability: parseFloat(form.cell_viability),
      };
      const res = await apiClient.post('/analysis/calculate', payload);
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Prediction failed. Please check your inputs.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ cell_line: 'HeLa', concentration: '', exposure_time: '24h', ros_level: '', ldh_level: '', apoptosis_rate: '', cell_viability: '' });
    setResult(null);
    setError(null);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={styles.header}>
        <Cpu size={32} color={colors.primaryLight} />
        <View style={{ marginLeft: spacing.sm }}>
          <Text style={styles.headerTitle}>ML Toxicity Predictor</Text>
          <Text style={styles.headerSubtitle}>ZnO Nanoparticle Biocompatibility Model</Text>
        </View>
      </View>

      {/* Cell Line Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Target Cell Line ({ALL_CELL_LINES.length} Models Available)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipRow}>
            {ALL_CELL_LINES.map((cl) => (
              <TouchableOpacity
                key={cl.id}
                style={[styles.chip, form.cell_line === cl.id && styles.chipActive]}
                onPress={() => setForm({ ...form, cell_line: cl.id })}
              >
                <Text style={[styles.chipText, form.cell_line === cl.id && styles.chipTextActive]}>{cl.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>


      {/* Exposure Time */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Exposure Time</Text>
        <View style={styles.chipRow}>
          {exposureTimes.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.chip, form.exposure_time === t && styles.chipActive]}
              onPress={() => setForm({ ...form, exposure_time: t })}
            >
              <Text style={[styles.chipText, form.exposure_time === t && styles.chipTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Numeric Inputs */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Input Parameters</Text>
        {[
          { label: 'ZnO Concentration (µg/mL)', key: 'concentration', placeholder: 'e.g. 50' },
          { label: 'Cell Viability (%)', key: 'cell_viability', placeholder: 'e.g. 75' },
          { label: 'ROS Level (RFU)', key: 'ros_level', placeholder: 'e.g. 1200' },
          { label: 'LDH Release (%)', key: 'ldh_level', placeholder: 'e.g. 30' },
          { label: 'Apoptosis Rate (%)', key: 'apoptosis_rate', placeholder: 'e.g. 15' },
        ].map((field) => (
          <View key={field.key} style={styles.inputGroup}>
            <Text style={styles.label}>{field.label}</Text>
            <TextInput
              style={styles.input}
              placeholder={field.placeholder}
              placeholderTextColor={colors.textMuted}
              value={form[field.key]}
              onChangeText={(v) => setForm({ ...form, [field.key]: v })}
              keyboardType="decimal-pad"
            />
          </View>
        ))}
      </View>

      {/* Predict Button */}
      <TouchableOpacity style={styles.predictBtn} onPress={handlePredict} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Zap size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.predictBtnText}>Run ML Prediction</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Error */}
      {error && (
        <View style={styles.errorBox}>
          <AlertTriangle size={16} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Results */}
      {result && (
        <View style={styles.resultsCard}>
          <View style={styles.resultsHeader}>
            <CheckCircle size={20} color={colors.safe} />
            <Text style={styles.resultsTitle}>Prediction Results</Text>
          </View>

          <View style={[styles.riskBadge, { backgroundColor: riskColors[result.risk_level] + '22', borderColor: riskColors[result.risk_level] }]}>
            <Text style={[styles.riskLabel, { color: riskColors[result.risk_level] }]}>
              {result.risk_level} Risk
            </Text>
          </View>

          {[
            ['Toxicity Score', `${result.toxicity_score?.toFixed(2) ?? 'N/A'}`],
            ['IC50 Value', result.ic50 ? `${parseFloat(result.ic50).toFixed(2)} µg/mL` : 'N/A'],
            ['Biocompatibility', result.is_biocompatible ? '✅ Biocompatible' : '❌ Not Biocompatible'],
            ['Cell Viability', `${result.cell_viability ?? form.cell_viability}%`],
          ].map(([label, value]) => (
            <View key={label} style={styles.resultRow}>
              <Text style={styles.resultLabel}>{label}</Text>
              <Text style={styles.resultValue}>{value}</Text>
            </View>
          ))}

          <TouchableOpacity style={styles.resetBtn} onPress={resetForm}>
            <Text style={styles.resetBtnText}>New Prediction</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <AlertTriangle size={14} color={colors.moderate} />
        <Text style={styles.disclaimerText}>
          Model trained on synthetic data. Not for clinical use.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  header: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  headerTitle: { color: colors.text, fontSize: 19.5, fontWeight: '700' },
  headerSubtitle: { color: colors.textMuted, fontSize: 14.5, marginTop: 2 },
  section: { marginBottom: spacing.md },
  sectionTitle: { color: colors.textSecondary, fontSize: 15.5, fontWeight: '600', marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    paddingVertical: 7, paddingHorizontal: 14, borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: 15.5 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  inputGroup: { marginBottom: spacing.sm },
  label: { color: colors.textSecondary, fontSize: 15.5, fontWeight: '500', marginBottom: 6 },
  input: {
    backgroundColor: colors.card, color: colors.text, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm,
    paddingVertical: 10, fontSize: 16.5,
  },
  predictBtn: {
    backgroundColor: colors.primary, borderRadius: borderRadius.md,
    paddingVertical: 15, flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', marginBottom: spacing.md,
  },
  predictBtnText: { color: '#fff', fontSize: 18.5, fontWeight: '700' },
  errorBox: {
    flexDirection: 'row', gap: 8, alignItems: 'center',
    backgroundColor: colors.dangerBg, borderRadius: borderRadius.md,
    padding: spacing.sm, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.danger,
  },
  errorText: { color: colors.danger, fontSize: 15.5, flex: 1 },
  resultsCard: {
    backgroundColor: colors.card, borderRadius: borderRadius.lg,
    padding: spacing.lg, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  resultsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md },
  resultsTitle: { color: colors.text, fontSize: 19.5, fontWeight: '700' },
  riskBadge: {
    alignSelf: 'flex-start', borderWidth: 1, borderRadius: borderRadius.full,
    paddingVertical: 6, paddingHorizontal: 16, marginBottom: spacing.md,
  },
  riskLabel: { fontSize: 16.5, fontWeight: '700' },
  resultRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  resultLabel: { color: colors.textMuted, fontSize: 15.5 },
  resultValue: { color: colors.text, fontSize: 15.5, fontWeight: '600' },
  resetBtn: {
    borderWidth: 1, borderColor: colors.primaryLight, borderRadius: borderRadius.md,
    paddingVertical: 10, alignItems: 'center', marginTop: spacing.md,
  },
  resetBtnText: { color: colors.primaryLight, fontSize: 16.5, fontWeight: '600' },
  disclaimer: {
    flexDirection: 'row', gap: 6, alignItems: 'center',
    backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: borderRadius.sm,
    padding: spacing.sm, marginBottom: spacing.md,
  },
  disclaimerText: { color: colors.moderate, fontSize: 13.5, flex: 1 },
});
