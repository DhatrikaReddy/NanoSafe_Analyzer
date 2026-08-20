import React, { useState, useEffect, useContext } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput
} from 'react-native';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { ThemeContext } from '../../context/ThemeContext';
import { ALL_CELL_LINES } from '../../theme/cellLines';
import apiClient from '../../api/client';
import { Sliders, Sparkles, Activity, ShieldCheck, ShieldAlert, AlertTriangle, Cpu } from 'lucide-react-native';

const EXPOSURE_TIMES = [6, 12, 24, 48, 72];

const SYNTHESIS_METHODS = [
  { id: 'Green_Synthesis', label: '🌿 Green Synthesis' },
  { id: 'Chemical_Precipitation', label: '🧪 Chemical Precip.' },
  { id: 'Sol-Gel', label: '🔬 Sol-Gel Route' },
  { id: 'Hydrothermal', label: '⚗️ Hydrothermal' },
];

const SURFACE_COATINGS = [
  { id: 'Bare_ZnO', label: '⚪ Bare ZnO' },
  { id: 'PEG_Coated', label: '🛡️ PEG-Coated' },
  { id: 'Chitosan_Coated', label: '🌱 Chitosan-Coated' },
  { id: 'Silica_Coated', label: '💎 Silica-Coated' },
];

const MEDICAL_APPS = [
  { id: 'wound_dressing', label: '🩹 Wound Dressing' },
  { id: 'dental', label: '🦷 Dental Material' },
  { id: 'drug_delivery', label: '💊 Drug Delivery' },
  { id: 'tissue_eng', label: '🧫 Bone Scaffold' },
];

export default function SimulatorScreen() {
  const { colors, isDark } = useContext(ThemeContext);
  const [dose, setDose] = useState('');
  const [cellLine, setCellLine] = useState('');
  const [exposureTime, setExposureTime] = useState('');
  const [medicalApp, setMedicalApp] = useState('');
  const [synthesisMethod, setSynthesisMethod] = useState('');
  const [surfaceCoating, setSurfaceCoating] = useState('');
  const [hemolysisRate, setHemolysisRate] = useState('');
  const [simData, setSimData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (dose !== '' && cellLine && exposureTime && medicalApp && synthesisMethod && surfaceCoating) {
      runSimulation();
    }
  }, [dose, cellLine, exposureTime, medicalApp, synthesisMethod, surfaceCoating, hemolysisRate]);

  const runSimulation = async () => {
    if (dose === '' || !cellLine || !exposureTime || !medicalApp || !synthesisMethod || !surfaceCoating) {
      return;
    }
    try {
      setLoading(true);
      const res = await apiClient.post('/simulator/dose', {
        dose: parseFloat(dose) || 0,
        cell_line: cellLine,
        exposure_time: exposureTime,
        medical_application: medicalApp,
        synthesis_method: synthesisMethod,
        surface_coating: surfaceCoating,
        hemolysis_rate: hemolysisRate !== '' ? (parseFloat(hemolysisRate) || 0.8) : 0.8,
      });
      setSimData(res.data);
    } catch (e) {
      console.error('Simulation error:', e);
    } finally {
      setLoading(false);
    }
  };

  const viab = simData ? (simData.viability ?? 0) : null;
  const score = simData ? (simData.ml_prediction?.toxicity_score ?? 0) : null;
  const level = simData ? (simData.ml_prediction?.toxicity_level ?? 'Low') : null;
  const iso = simData ? (simData.ml_prediction?.iso_compliance ?? 'PASS — Biocompatible') : null;
  const ic50 = simData ? (simData.eff_ic50 ?? 0) : null;
  const ros = simData ? (simData.ros ?? 1.0) : null;
  const ldh = simData ? (simData.ldh ?? 0) : null;
  const apop = simData ? (simData.apoptosis ?? 0) : null;

  const viabColor = viab !== null ? (viab >= 80 ? colors.safe : (viab >= 50 ? colors.moderate : colors.danger)) : colors.textMuted;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {/* Hero Header */}
      <View style={styles.heroBanner}>
        <View style={styles.tagBadge}>
          <Text style={styles.tagText}>⚡ REAL-TIME DOSING ENGINE</Text>
        </View>
        <Text style={styles.heroTitle}>Live Dose Simulator</Text>
        <Text style={styles.heroSub}>
          Interactive what-if sandbox simulating ZnO concentration-dependent cytotoxicity and ISO 10993-5 biocompatibility in real time.
        </Text>
      </View>

      {/* Live ML Prediction Card */}
      <View style={[styles.resultsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.resultsHeader}>
          <Cpu size={22} color={colors.primary} />
          <Text style={[styles.resultsCardTitle, { color: colors.text }]}>Real-Time ML Predictions</Text>
          {loading && <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 'auto' }} />}
        </View>

        {!simData ? (
          <View style={{ paddingVertical: 24, alignItems: 'center', justifyContent: 'center' }}>
            <Sliders size={36} color={colors.primary} style={{ marginBottom: 10, opacity: 0.8 }} />
            <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text, textAlign: 'center' }}>
              Awaiting Simulation Parameters
            </Text>
            <Text style={{ fontSize: 12.5, color: colors.textMuted, textAlign: 'center', marginTop: 4, paddingHorizontal: 16 }}>
              Select target cell line, exposure duration, formulation route, and dose below to run live multi-parameter ML simulation.
            </Text>
          </View>
        ) : (
          <>
            {/* Big Gauges */}
            <View style={styles.gaugesRow}>
              <View style={[styles.gaugeBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <Text style={[styles.gaugeTitle, { color: colors.textMuted }]}>Predicted Viability</Text>
                <Text style={[styles.gaugeVal, { color: viabColor }]}>{viab}%</Text>
                <Text style={[styles.gaugeSub, { color: colors.textMuted }]}>Cell survival response</Text>
              </View>
              <View style={[styles.gaugeBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <Text style={[styles.gaugeTitle, { color: colors.textMuted }]}>ML Toxicity Score</Text>
                <Text style={[styles.gaugeVal, { color: colors.primary }]}>{score}</Text>
                <View style={[styles.riskBadge, {
                  backgroundColor: level === 'Low' ? colors.safeBg : level === 'Moderate' ? colors.moderateBg : colors.dangerBg,
                  borderColor: level === 'Low' ? colors.safe : level === 'Moderate' ? colors.moderate : colors.danger,
                }]}>
                  <Text style={[styles.riskBadgeText, {
                    color: level === 'Low' ? colors.safe : level === 'Moderate' ? colors.moderate : colors.danger,
                  }]}>
                    {level === 'Low' ? '🟢 Low (Safe)' : level === 'Moderate' ? '🟡 Moderate' : '🔴 Toxic'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Biomarkers */}
            <View style={styles.bioGrid}>
              <View style={[styles.bioBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <Text style={[styles.bioLabel, { color: colors.textMuted }]}>ROS Stress</Text>
                <Text style={[styles.bioVal, { color: colors.text }]}>{ros}×</Text>
              </View>
              <View style={[styles.bioBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <Text style={[styles.bioLabel, { color: colors.textMuted }]}>LDH Lysis</Text>
                <Text style={[styles.bioVal, { color: colors.text }]}>{ldh}%</Text>
              </View>
              <View style={[styles.bioBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <Text style={[styles.bioLabel, { color: colors.textMuted }]}>Apoptosis</Text>
                <Text style={[styles.bioVal, { color: colors.text }]}>{apop}%</Text>
              </View>
              <View style={[styles.bioBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <Text style={[styles.bioLabel, { color: colors.textMuted }]}>Selectivity (SI)</Text>
                <Text style={[styles.bioVal, { color: '#0f766e' }]}>{simData?.ml_prediction?.selectivity_index || '2.4'}×</Text>
              </View>
            </View>

            {/* ASTM F756 Hemocompatibility Status */}
            <View style={{ backgroundColor: colors.inputBg, padding: 10, borderRadius: 10, marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderColor: colors.border, borderWidth: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted }}>ASTM F756 Blood Safety:</Text>
              <Text style={{ fontSize: 12, fontWeight: '800', color: (simData?.ml_prediction?.hemocompatibility_status?.includes('<2%') || !simData) ? colors.safe : colors.danger }}>
                {simData?.ml_prediction?.hemocompatibility_status || '🟢 Non-Hemolytic (<2%)'}
              </Text>
            </View>

            {/* ISO Verdict */}
            <View style={[styles.isoBanner, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <View>
                <Text style={[styles.isoLabel, { color: colors.textMuted }]}>ISO 10993-5 Verdict</Text>
                <Text style={[styles.isoVal, { color: (iso || '').includes('PASS') ? colors.safe : ((iso || '').includes('CONDITIONAL') ? colors.moderate : colors.danger) }]}>
                  {iso}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.isoLabel, { color: colors.textMuted }]}>Effective IC50</Text>
                <Text style={[styles.ic50Val, { color: colors.primary }]}>{ic50} µg/mL</Text>
              </View>
            </View>
          </>
        )}
      </View>

      {/* Dosing Controls */}
      <View style={[styles.controlCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>⚙️ Dosing & Target Parameters</Text>

        {/* Concentration Quick Adjuster */}
        <View style={styles.controlGroup}>
          <View style={styles.labelRow}>
            <Text style={[styles.controlLabel, { color: colors.textSecondary }]}>ZnO Concentration</Text>
            <View style={[styles.valBadge, { backgroundColor: colors.inputBg, borderColor: colors.primary }]}>
              <Text style={[styles.valBadgeText, { color: colors.primary }]}>{dose !== '' ? `${dose} µg/mL` : 'Enter dose'}</Text>
            </View>
          </View>
          <View style={styles.stepBtnRow}>
            {[5, 15, 25, 50, 75, 100, 150].map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.stepBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }, dose === d && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => setDose(d)}
              >
                <Text style={[styles.stepBtnText, { color: colors.textMuted }, dose === d && { color: '#fff' }]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.sliderAdjRow}>
            <TouchableOpacity style={[styles.adjBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]} onPress={() => setDose(Math.max(1, (parseFloat(dose) || 10) - 5))}>
              <Text style={[styles.adjBtnText, { color: colors.text }]}>- 5</Text>
            </TouchableOpacity>
            <TextInput
              style={[styles.doseInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              value={dose !== '' ? String(dose) : ''}
              placeholder="e.g. 25"
              placeholderTextColor={colors.textMuted}
              onChangeText={(v) => setDose(v)}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity style={[styles.adjBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]} onPress={() => setDose(Math.min(300, (parseFloat(dose) || 0) + 5))}>
              <Text style={[styles.adjBtnText, { color: colors.text }]}>+ 5</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Cell Line Selector */}
        <View style={styles.controlGroup}>
          <Text style={[styles.controlLabel, { color: colors.textSecondary }]}>Target Cell Line ({ALL_CELL_LINES.length} Models Available)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            <View style={styles.pillRow}>
              {ALL_CELL_LINES.map((cl) => (
                <TouchableOpacity
                  key={cl.id}
                  style={[styles.pill, { backgroundColor: colors.inputBg, borderColor: colors.border }, cellLine === cl.id && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  onPress={() => setCellLine(cl.id)}
                >
                  <Text style={[styles.pillText, { color: colors.textMuted }, cellLine === cl.id && { color: '#fff' }]}>{cl.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Exposure Time */}
        <View style={styles.controlGroup}>
          <Text style={[styles.controlLabel, { color: colors.textSecondary }]}>Exposure Duration</Text>
          <View style={[styles.pillRow, { marginTop: 8 }]}>
            {EXPOSURE_TIMES.map((h) => (
              <TouchableOpacity
                key={h}
                style={[styles.pill, { backgroundColor: colors.inputBg, borderColor: colors.border, flex: 1, alignItems: 'center' }, exposureTime === h && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => setExposureTime(h)}
              >
                <Text style={[styles.pillText, { color: colors.textMuted }, exposureTime === h && { color: '#fff' }]}>{h}h</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Medical Application */}
        <View style={styles.controlGroup}>
          <Text style={[styles.controlLabel, { color: colors.textSecondary }]}>Biomedical Application Profile</Text>
          <View style={styles.appGrid}>
            {MEDICAL_APPS.map(({ id, label }) => (
              <TouchableOpacity
                key={id}
                style={[styles.appCard, { backgroundColor: colors.inputBg, borderColor: colors.border }, medicalApp === id && { borderColor: colors.primary, backgroundColor: colors.cardHover }]}
                onPress={() => setMedicalApp(id)}
              >
                <Text style={[styles.appCardText, { color: colors.textMuted }, medicalApp === id && { color: colors.text, fontWeight: '700' }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Synthesis Route Selector */}
        <View style={styles.controlGroup}>
          <Text style={[styles.controlLabel, { color: colors.textSecondary }]}>Synthesis Route (Paper 1 & 7)</Text>
          <View style={[styles.appGrid, { marginTop: 8 }]}>
            {SYNTHESIS_METHODS.map(({ id, label }) => (
              <TouchableOpacity
                key={id}
                style={[styles.appCard, { backgroundColor: colors.inputBg, borderColor: colors.border }, synthesisMethod === id && { borderColor: colors.primary, backgroundColor: colors.cardHover }]}
                onPress={() => setSynthesisMethod(id)}
              >
                <Text style={[styles.appCardText, { color: colors.textMuted }, synthesisMethod === id && { color: colors.text, fontWeight: '700' }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Surface Functionalization Selector */}
        <View style={styles.controlGroup}>
          <Text style={[styles.controlLabel, { color: colors.textSecondary }]}>Surface Functionalization (Paper 2 & 4)</Text>
          <View style={[styles.appGrid, { marginTop: 8 }]}>
            {SURFACE_COATINGS.map(({ id, label }) => (
              <TouchableOpacity
                key={id}
                style={[styles.appCard, { backgroundColor: colors.inputBg, borderColor: colors.border }, surfaceCoating === id && { borderColor: colors.primary, backgroundColor: colors.cardHover }]}
                onPress={() => setSurfaceCoating(id)}
              >
                <Text style={[styles.appCardText, { color: colors.textMuted }, surfaceCoating === id && { color: colors.text, fontWeight: '700' }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 40 },
  heroBanner: {
    backgroundColor: '#0f766e',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  tagBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    marginBottom: 6,
  },
  tagText: { color: '#ccfbf1', fontSize: 12.5, fontWeight: '800', letterSpacing: 0.5 },
  heroTitle: { color: '#fff', fontSize: 23, fontWeight: '800' },
  heroSub: { color: '#e0f2fe', fontSize: 14.5, marginTop: 4, lineHeight: 20, opacity: 0.9 },
  resultsCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  resultsCardTitle: { fontSize: 17.5, fontWeight: '700', marginLeft: 8 },
  resultsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  gaugesRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.md },
  gaugeBox: {
    flex: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  gaugeTitle: { fontSize: 13.5, fontWeight: '600' },
  gaugeVal: { fontSize: 27, fontWeight: '800', marginVertical: 4 },
  gaugeSub: { fontSize: 12.5 },
  riskBadge: { borderWidth: 1, borderRadius: borderRadius.sm, paddingHorizontal: 6, paddingVertical: 2, marginTop: 2 },
  riskBadgeText: { fontSize: 12.5, fontWeight: '700' },
  bioGrid: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  bioBox: {
    flex: 1,
    borderRadius: borderRadius.sm,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  bioLabel: { fontSize: 12.5, fontWeight: '600' },
  bioVal: { fontSize: 16.5, fontWeight: '700', marginTop: 2 },
  isoBanner: {
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
  },
  isoLabel: { fontSize: 12.5, fontWeight: '700', textTransform: 'uppercase' },
  isoVal: { fontSize: 15.5, fontWeight: '800', marginTop: 2 },
  ic50Val: { fontSize: 16.5, fontWeight: '800', marginTop: 2 },
  controlCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
  },
  sectionTitle: { fontSize: 17.5, fontWeight: '700', marginBottom: spacing.md },
  controlGroup: { marginBottom: spacing.md },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  controlLabel: { fontSize: 15.5, fontWeight: '600' },
  valBadge: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.sm },
  valBadgeText: { fontWeight: '800', fontSize: 14.5 },
  stepBtnRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 },
  stepBtn: {
    paddingVertical: 5, paddingHorizontal: 10, borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  stepBtnText: { fontSize: 14.5, fontWeight: '600' },
  sliderAdjRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  adjBtn: {
    borderWidth: 1,
    paddingVertical: 8, paddingHorizontal: 16, borderRadius: borderRadius.md,
  },
  adjBtnText: { fontWeight: '700', fontSize: 16.5 },
  doseInput: {
    flex: 1,
    borderWidth: 1, borderRadius: borderRadius.md,
    paddingVertical: 6, paddingHorizontal: spacing.sm, textAlign: 'center',
    fontSize: 18.5, fontWeight: '700',
  },
  pillRow: { flexDirection: 'row', gap: 8 },
  pill: {
    paddingVertical: 7, paddingHorizontal: 14, borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  pillText: { fontSize: 14.5, fontWeight: '600' },
  appGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  appCard: {
    width: '48%', borderRadius: borderRadius.md,
    padding: 10, borderWidth: 1,
  },
  appCardText: { fontSize: 14.5, fontWeight: '600' },
});
