import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { colors, spacing, borderRadius } from '../../theme/colors';
import apiClient from '../../api/client';
import { Calculator, ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react-native';

export default function NewAnalysisScreen({ navigation }) {
  const [sampleName, setSampleName] = useState('ZnO Nanoparticle Sample');
  const [concentration, setConcentration] = useState('50');
  const [size, setSize] = useState('25');
  const [exposureTime, setExposureTime] = useState('24');
  const [hydrodynamicRadius, setHydrodynamicRadius] = useState('45');
  const [surfaceCharge, setSurfaceCharge] = useState('-15');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleCalculate = async () => {
    if (!concentration || !size || !exposureTime) {
      Alert.alert('Missing Fields', 'Please enter Concentration, Size, and Exposure Time.');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const payload = {
        sample_name: sampleName,
        concentration: parseFloat(concentration),
        size_nm: parseFloat(size),
        exposure_hours: parseFloat(exposureTime),
        hydrodynamic_radius: parseFloat(hydrodynamicRadius) || 45,
        zeta_potential: parseFloat(surfaceCharge) || -15,
      };

      const res = await apiClient.post('/analysis/calculate', payload);
      setResult(res.data);
    } catch (e) {
      console.error('Calculation error:', e);
      Alert.alert('Error', e.response?.data?.error || 'Failed to process experiment data.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>ZnO Cytotoxicity Predictor</Text>
      <Text style={styles.screenSubtitle}>
        Input nanoparticle experimental parameters to calculate biocompatibility.
      </Text>

      <View style={styles.card}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Sample Name / Trial ID</Text>
          <TextInput
            style={styles.input}
            value={sampleName}
            onChangeText={setSampleName}
            placeholder="e.g. ZnO-NP Batch #4"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, styles.halfInput]}>
            <Text style={styles.label}>Concentration (µg/mL)</Text>
            <TextInput
              style={styles.input}
              value={concentration}
              onChangeText={setConcentration}
              keyboardType="numeric"
            />
          </View>

          <View style={[styles.inputGroup, styles.halfInput]}>
            <Text style={styles.label}>Particle Size (nm)</Text>
            <TextInput
              style={styles.input}
              value={size}
              onChangeText={setSize}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, styles.halfInput]}>
            <Text style={styles.label}>Exposure Time (Hours)</Text>
            <TextInput
              style={styles.input}
              value={exposureTime}
              onChangeText={setExposureTime}
              keyboardType="numeric"
            />
          </View>

          <View style={[styles.inputGroup, styles.halfInput]}>
            <Text style={styles.label}>Hydrodynamic Rad (nm)</Text>
            <TextInput
              style={styles.input}
              value={hydrodynamicRadius}
              onChangeText={setHydrodynamicRadius}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Zeta Potential / Surface Charge (mV)</Text>
          <TextInput
            style={styles.input}
            value={surfaceCharge}
            onChangeText={setSurfaceCharge}
            keyboardType="numeric"
          />
        </View>

        <TouchableOpacity
          style={styles.calcBtn}
          onPress={handleCalculate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Calculator size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.calcBtnText}>Run ML Prediction Model</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Prediction Result Display */}
      {result && (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            {result.viability_pct >= 75 ? (
              <ShieldCheck size={36} color={colors.safe} />
            ) : result.viability_pct >= 50 ? (
              <AlertTriangle size={36} color={colors.moderate} />
            ) : (
              <ShieldAlert size={36} color={colors.danger} />
            )}

            <View style={styles.resultHeaderText}>
              <Text style={styles.resultTitle}>{result.safety_category || 'Analysis Complete'}</Text>
              <Text style={styles.resultSub}>Predicted ML Viability Output</Text>
            </View>
          </View>

          <View style={styles.viabilityRow}>
            <Text style={styles.viabilityValue}>{result.viability_pct || result.viability || 0}%</Text>
            <Text style={styles.viabilityLabel}>Cell Viability</Text>
          </View>

          <View style={styles.detailBox}>
            <Text style={styles.detailText}>
              • Nanoparticle Type: ZnO (Zinc Oxide)
            </Text>
            <Text style={styles.detailText}>
              • Status: {result.viability_pct >= 75 ? 'Safe / Non-toxic to human cells' : 'Potential Cellular Cytotoxicity detected'}
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: spacing.xs,
  },
  screenSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  halfInput: {
    width: '48%',
  },
  label: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    fontSize: 14,
  },
  calcBtn: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  calcBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    marginTop: spacing.lg,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  resultHeaderText: {
    marginLeft: spacing.md,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  resultSub: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  viabilityRow: {
    backgroundColor: colors.inputBg,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  viabilityValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primaryLight,
  },
  viabilityLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  detailBox: {
    marginTop: spacing.sm,
  },
  detailText: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: 4,
  },
});
