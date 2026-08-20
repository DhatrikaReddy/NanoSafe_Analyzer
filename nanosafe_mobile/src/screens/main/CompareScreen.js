import React, { useState, useEffect, useContext } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Share, Modal, Linking,
  Dimensions, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard
} from 'react-native';
import Svg, { Path, Line, Circle, Polygon, Rect, Text as SvgText, G } from 'react-native-svg';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { ThemeContext } from '../../context/ThemeContext';
import { ALL_CELL_LINES } from '../../theme/cellLines';
import apiClient from '../../api/client';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import {
  Columns3, Plus, Trash2, CheckSquare, Square, ChartBar,
  TableProperties, Sparkles, Award, ShieldCheck, ShieldAlert,
  AlertTriangle, ArrowRight, Download, Share2, FileText, Upload,
  RotateCcw, CheckCircle2, History, Edit3, Cpu, Activity, Info, X,
  User, ChevronDown, Check, Layers, FlaskConical
} from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const EXPOSURE_DURATIONS = ['6h', '12h', '24h', '48h', '72h'];
const SERIES_COLORS = ['#38bdf8', '#22c55e', '#a855f7', '#fbbf24', '#ec4899'];

const SYNTHESIS_METHODS = [
  { id: 'Green_Synthesis', label: '🌿 Green (Plant/Biogenic)' },
  { id: 'Chemical_Precipitation', label: '🧪 Chemical Precipitation' },
  { id: 'Sol-Gel', label: '🔬 Sol-Gel Hydrolysis' },
  { id: 'Hydrothermal', label: '⚗️ Hydrothermal Autoclave' },
];

const SURFACE_COATINGS = [
  { id: 'Bare_ZnO', label: '⚪ Bare ZnO' },
  { id: 'PEG_Coated', label: '🛡️ PEG-Coated' },
  { id: 'Chitosan_Coated', label: '🌱 Chitosan-Coated' },
  { id: 'Silica_Coated', label: '💎 Silica-Coated' },
];

const MEDICAL_APPLICATIONS = [
  { id: 'general', label: 'General (ISO 10993-5)' },
  { id: 'wound_dressing', label: '🩹 Wound Dressing' },
  { id: 'dental', label: '🦷 Dental Biomaterial' },
  { id: 'drug_delivery', label: '💊 Drug Delivery' },
  { id: 'tissue_engineering', label: '🧫 Tissue Scaffold' },
];

const fmt = (val, decimals = 1) => {
  if (val === null || val === undefined || val === '') return '—';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]/g, ''));
  if (isNaN(num)) return String(val);
  const fixed = num.toFixed(decimals);
  return fixed.endsWith('.0') && decimals === 1 && num === Math.floor(num) ? String(num) : fixed;
};

const riskColor = (result = '') => {
  const r = (result || '').toLowerCase();
  if (r.includes('safe') || r.includes('low') || r.includes('pass')) return '#22c55e';
  if (r.includes('moderate')) return '#eab308';
  return '#ef4444';
};

// =========================================================================
// 1. MULTI-SERIES DOSE-RESPONSE OVERLAY CHART (SVG)
// =========================================================================
function MultiSeriesCurveChart({ experiments, selectedMetric, setSelectedMetric }) {
  if (!experiments || experiments.length === 0) return null;
  const { colors, isDark } = React.useContext(ThemeContext);
  const textColor = isDark ? '#ffffff' : '#0f172a';
  const gridColor = isDark ? '#334155' : '#cbd5e1';

  const V_WIDTH = 340;
  const V_HEIGHT = 190;
  const paddingLeft = 38;
  const paddingRight = 18;
  const paddingTop = 15;
  const paddingBottom = 28;
  const graphWidth = V_WIDTH - paddingLeft - paddingRight;
  const graphHeight = V_HEIGHT - paddingTop - paddingBottom;

  // Find overall max concentration across all experiments
  let allConcs = [];
  experiments.forEach(exp => {
    (exp.submittedRows || []).forEach(r => {
      const c = parseFloat(r.concentration) || 0;
      allConcs.push(c);
    });
  });
  const maxConc = Math.max(...allConcs, 100) || 100;

  const getX = (conc) => paddingLeft + (conc / maxConc) * graphWidth;
  const getY = (val) => paddingTop + graphHeight - (val / 100) * graphHeight;

  return (
    <View style={[styles.chartContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.chartHeader}>
        <Text style={[styles.chartTitle, { color: colors.text }]}>📉 Multi-Sample Overlay Dose Curve</Text>
        <Text style={[styles.chartSub, { color: colors.textMuted }]}>Comparative cellular viability trajectories across all formulations</Text>
        <View style={styles.metricTabs}>
          {[
            { id: 'viability', label: 'Viability %' },
            { id: 'ros', label: 'ROS (×)' },
            { id: 'ldh', label: 'LDH Lysis' },
            { id: 'apoptosis', label: 'Apoptosis' },
          ].map(t => (
            <TouchableOpacity
              key={t.id}
              style={[styles.chartTab, { borderColor: colors.border, backgroundColor: isDark ? '#1e293b' : '#f8fafc' }, selectedMetric === t.id && { backgroundColor: '#38bdf825', borderColor: '#38bdf8' }]}
              onPress={() => setSelectedMetric(t.id)}
            >
              <Text style={[styles.chartTabText, { color: colors.textMuted }, selectedMetric === t.id && { color: '#38bdf8', fontWeight: '800' }]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* SVG Canvas */}
      <View style={styles.svgWrapper}>
        <Svg width="100%" height={190} viewBox={`0 0 ${V_WIDTH} ${V_HEIGHT}`} preserveAspectRatio="xMidYMid meet">
          {/* Background Grid & X-Axis Ticks */}
          {[0, 20, 40, 60, 80, 100].map(c => (
            <G key={`x-${c}`}>
              <Line x1={getX(c)} y1={paddingTop} x2={getX(c)} y2={V_HEIGHT - paddingBottom} stroke={gridColor} strokeWidth="0.8" strokeDasharray="2, 2" />
              <SvgText x={getX(c)} y={V_HEIGHT - 6} fontSize="10.5" fill={textColor} textAnchor="middle" fontWeight="900">{c}</SvgText>
            </G>
          ))}
          {[0, 25, 50, 75, 100].map(pct => (
            <G key={pct}>
              <Line x1={paddingLeft} y1={getY(pct)} x2={V_WIDTH - paddingRight} y2={getY(pct)} stroke={gridColor} strokeWidth="1" />
              <SvgText x={paddingLeft - 5} y={getY(pct) + 4} fontSize="11.5" fill={textColor} textAnchor="end" fontWeight="900">
                {pct}%
              </SvgText>
            </G>
          ))}

          {/* 80% ISO Threshold Line */}
          {selectedMetric === 'viability' && (
            <G>
              <Line x1={paddingLeft} y1={getY(80)} x2={V_WIDTH - paddingRight} y2={getY(80)} stroke="#22c55e" strokeWidth="1.5" strokeDasharray="4, 4" />
              <SvgText x={V_WIDTH - paddingRight} y={getY(80) - 4} fontSize="11.5" fill="#22c55e" textAnchor="end" fontWeight="900">
                80% ISO Line
              </SvgText>
            </G>
          )}

          {/* 50% IC50 Line */}
          <Line x1={paddingLeft} y1={getY(50)} x2={V_WIDTH - paddingRight} y2={getY(50)} stroke="rgba(239, 68, 68, 0.4)" strokeWidth="1" strokeDasharray="3, 3" />

          {/* Curves for each experiment */}
          {experiments.map((exp, expIdx) => {
            const seriesColor = SERIES_COLORS[expIdx % SERIES_COLORS.length];
            const rows = exp.submittedRows || [];
            const points = rows.map(r => {
              const conc = parseFloat(r.concentration) || 0;
              let val = 0;
              if (selectedMetric === 'viability') val = parseFloat(r.viability) || 0;
              else if (selectedMetric === 'ros') val = Math.min((parseFloat(r.ros) || 1.0) * 10, 100);
              else if (selectedMetric === 'ldh') val = Math.min((parseFloat(r.ldh) || 0) * 2, 100);
              else if (selectedMetric === 'apoptosis') val = Math.min((parseFloat(r.apoptosis) || 0) * 2.5, 100);
              return { conc, val: Math.max(0, Math.min(val, 100)) };
            });

            let pathD = '';
            points.forEach((p, i) => {
              const x = getX(p.conc);
              const y = getY(p.val);
              if (i === 0) {
                pathD += `M ${x} ${y}`;
              } else {
                const prevX = getX(points[i - 1].conc);
                const prevY = getY(points[i - 1].val);
                const cpX1 = prevX + (x - prevX) / 2;
                const cpY1 = prevY;
                const cpX2 = prevX + (x - prevX) / 2;
                const cpY2 = y;
                pathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${x} ${y}`;
              }
            });

            return (
              <G key={expIdx}>
                {pathD !== '' && (
                  <Path d={pathD} fill="none" stroke={seriesColor} strokeWidth="2.8" strokeLinecap="round" />
                )}
                {points.map((p, i) => (
                  <Circle key={i} cx={getX(p.conc)} cy={getY(p.val)} r="3.5" fill={isDark ? '#090d16' : '#ffffff'} stroke={seriesColor} strokeWidth="2" />
                ))}
              </G>
            );
          })}
        </Svg>
      </View>

      {/* Series Legend */}
      <View style={styles.legendRow}>
        {experiments.map((exp, expIdx) => (
          <View key={expIdx} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: SERIES_COLORS[expIdx % SERIES_COLORS.length] }]} />
            <Text style={[styles.legendText, { color: colors.text }]} numberOfLines={1}>{exp.name || `Sample ${expIdx + 1}`}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// =========================================================================
// MAIN COMPARE SCREEN
// =========================================================================
const createEmptyManualExperiment = (id, cardLetter = 'A') => ({
  id: id || Date.now(),
  name: '',
  participant_id: '',
  cell_line: '',
  exposure_time: '',
  medical_app: '',
  synthesis_method: '',
  surface_coating: '',
  hemolysis_rate: '',
  rows: [
    { id: 1, concentration: '', viability: '', ros: '', ldh: '', apoptosis: '' },
  ],
});

export default function CompareScreen({ navigation }) {
  const { colors, isDark } = React.useContext(ThemeContext);
  const [activeTab, setActiveTab] = useState('history'); // 'history' | 'manual'
  const [selectedMetric, setSelectedMetric] = useState('viability');

  // History Picker State & Filters
  const [history, setHistory] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState([]);
  const [historyFilter, setHistoryFilter] = useState('all'); // 'all' | 'patients' | 'research'
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Manual Entry State with all attributes from NewAnalysisScreen (Starts with Formulation A; user adds B as needed)
  const [manualExperiments, setManualExperiments] = useState([
    createEmptyManualExperiment(1, 'A'),
  ]);

  // CSV import state
  const [csvParsed, setCsvParsed] = useState(null);
  const [csvPreviewVisible, setCsvPreviewVisible] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);

  // Results state
  const [evaluating, setEvaluating] = useState(false);
  const [comparisonResults, setComparisonResults] = useState(null);
  const [resultsTab, setResultsTab] = useState('summary'); // 'summary' | 'curves' | 'table' | 'cards'

  useEffect(() => {
    fetchInitialData();
    if (!navigation) return;
    try {
      const unsubscribe = navigation.addListener('focus', () => {
        fetchInitialData();
      });
      return unsubscribe;
    } catch (e) {}
  }, [navigation]);

  const fetchInitialData = async () => {
    setLoadingHistory(true);
    try {
      const [hRes, pRes] = await Promise.all([
        apiClient.get('/history/'),
        apiClient.get('/participants/'),
      ]);
      const items = hRes.data || [];
      setHistory(items);
      setParticipants(pRes.data.participants || []);
    } catch (e) {
      console.log('Error fetching compare initial data:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Toggle history selection checkbox
  const toggleSelectHistory = (id) => {
    if (selectedHistoryIds.includes(id)) {
      setSelectedHistoryIds(selectedHistoryIds.filter(i => i !== id));
    } else {
      setSelectedHistoryIds([...selectedHistoryIds, id]);
    }
  };

  // Run Comparison from Selected History Items
  const handleEvaluateHistory = async () => {
    if (selectedHistoryIds.length < 2) {
      Alert.alert('Selection Required', 'Please select at least 2 saved experiments to compare.');
      return;
    }

    setEvaluating(true);
    setComparisonResults(null);

    try {
      const res = await apiClient.post('/analysis/compare', {
        history_ids: selectedHistoryIds,
      });
      setComparisonResults(res.data);
    } catch (e) {
      Alert.alert('Comparison Error', e.response?.data?.error || 'Failed to compare experiments.');
    } finally {
      setEvaluating(false);
    }
  };

  // Manual Form Operations
  const addManualCard = () => {
    if (manualExperiments.length >= 4) {
      Alert.alert('Limit', 'You can compare a maximum of 4 formulations simultaneously.');
      return;
    }
    const newId = Date.now();
    setManualExperiments([
      ...manualExperiments,
      createEmptyManualExperiment(newId, String.fromCharCode(65 + manualExperiments.length)),
    ]);
  };

  const removeManualCard = (id) => {
    if (manualExperiments.length <= 1) {
      Alert.alert('Notice', 'At least 1 formulation is required.');
      return;
    }
    setManualExperiments(manualExperiments.filter(e => e.id !== id));
  };

  const addRowToCard = (cardIdx) => {
    const updated = [...manualExperiments];
    const card = updated[cardIdx];
    const newId = card.rows.length > 0 ? Math.max(...card.rows.map(r => r.id)) + 1 : 1;
    card.rows.push({ id: newId, concentration: '', viability: '', ros: '', ldh: '', apoptosis: '' });
    setManualExperiments(updated);
  };

  const clearCardRows = (cardIdx) => {
    const updated = [...manualExperiments];
    updated[cardIdx].rows = [{ id: 1, concentration: '', viability: '', ros: '', ldh: '', apoptosis: '' }];
    setManualExperiments(updated);
  };

  const deleteRowFromCard = (cardIdx, rowId) => {
    const updated = [...manualExperiments];
    const card = updated[cardIdx];
    if (card.rows.length <= 1) {
      Alert.alert('Notice', 'Each card must have at least 1 measurement row.');
      return;
    }
    card.rows = card.rows.filter(r => r.id !== rowId);
    setManualExperiments(updated);
  };

  const updateCardField = (cardIdx, field, val) => {
    const updated = [...manualExperiments];
    updated[cardIdx][field] = val;
    setManualExperiments(updated);
  };

  const updateRowCell = (cardIdx, rowId, field, val) => {
    const updated = [...manualExperiments];
    const row = updated[cardIdx].rows.find(r => r.id === rowId);
    if (row) {
      row[field] = val;
      setManualExperiments(updated);
    }
  };

  // Run Comparison from Manual Form
  const handleEvaluateManual = async () => {
    if (manualExperiments.length < 2) {
      Alert.alert(
        'Add Second Formulation to Compare',
        'Comparative evaluation benchmarks multiple options against each other. Please tap "+ Add Formulation B" below to add a second formulation to compare.'
      );
      return;
    }

    for (let i = 0; i < manualExperiments.length; i++) {
      const exp = manualExperiments[i];
      const valid = exp.rows.filter(r => r.concentration !== '' && r.viability !== '');
      if (valid.length === 0) {
        Alert.alert(
          'Measurement Data Required',
          `Formulation ${String.fromCharCode(65 + i)} (${exp.name.trim() || 'Unnamed'}) requires at least 1 measurement row with Concentration and Cell Viability entered.`
        );
        return;
      }
    }

    setEvaluating(true);
    setComparisonResults(null);

    try {
      const res = await apiClient.post('/analysis/compare', {
        experiments: manualExperiments.map((exp, idx) => ({
          name: exp.name.trim() || `Formulation ${String.fromCharCode(65 + idx)}`,
          participant_id: exp.participant_id || undefined,
          cell_line: exp.cell_line,
          exposure_time: exp.exposure_time,
          medical_app: exp.medical_app,
          synthesis_method: exp.synthesis_method,
          surface_coating: exp.surface_coating,
          hemolysis_rate: exp.hemolysis_rate !== '' ? (parseFloat(exp.hemolysis_rate) || 0.8) : 0.8,
          rows: exp.rows.filter(r => r.concentration !== '' && r.viability !== '').map(r => ({
            concentration: parseFloat(r.concentration) || 0,
            viability: parseFloat(r.viability) || 0,
            ros: r.ros !== '' ? (parseFloat(r.ros) || 1.0) : 1.0,
            ldh: r.ldh !== '' ? (parseFloat(r.ldh) || 0) : 0,
            apoptosis: r.apoptosis !== '' ? (parseFloat(r.apoptosis) || 0) : 0,
          })),
        })),
      });
      setComparisonResults(res.data);
    } catch (e) {
      Alert.alert('Comparison Error', e.response?.data?.error || 'Failed to compare experiments.');
    } finally {
      setEvaluating(false);
    }
  };

  // CSV parser & import
  const parseCSVText = (text) => {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim() !== '');
    if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row.');

    const parseRow = (line) => {
      const result = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { inQuotes = !inQuotes; }
        else if (ch === ',' && !inQuotes) { result.push(cur.trim()); cur = ''; }
        else { cur += ch; }
      }
      result.push(cur.trim());
      return result;
    };

    const headers = parseRow(lines[0]).map(h => h.toLowerCase().replace(/[\s_]/g, '_'));
    const col = (aliases) => {
      for (const a of aliases) {
        const idx = headers.findIndex(h => h.includes(a));
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const iName        = col(['name','sample','formulation','id']);
    const iPatientId   = col(['patient_id','pid','patient']);
    const iCellLine    = col(['cell_line','cell','line']);
    const iExposure    = col(['exposure','duration','time']);
    const iConc        = col(['conc','concentration','dose']);
    const iViability   = col(['viability','viable','via']);
    const iRos         = col(['ros','reactive']);
    const iLdh         = col(['ldh','lysis']);
    const iApoptosis   = col(['apoptosis','apop']);

    if (iConc === -1 || iViability === -1) {
      throw new Error('CSV must have at minimum "concentration" and "viability" columns.');
    }

    const rowsData = lines.slice(1).map(l => parseRow(l));
    const groupMap = {};

    rowsData.forEach((cols, rIdx) => {
      let nameKey = '';
      let pidKey = '';
      if (iPatientId !== -1 && cols[iPatientId]) {
        pidKey = cols[iPatientId];
        const pname = iName !== -1 ? cols[iName] : '';
        nameKey = pidKey ? `[${pidKey}] ${pname}`.trim() : pname;
      } else if (iName !== -1 && cols[iName]) {
        nameKey = cols[iName];
      } else {
        nameKey = 'Formulation A';
      }

      if (!groupMap[nameKey]) {
        groupMap[nameKey] = {
          name: nameKey,
          participant_id: pidKey,
          cell_line: iCellLine !== -1 ? (cols[iCellLine] || 'HeLa') : 'HeLa',
          exposure_time: iExposure !== -1 ? (cols[iExposure] || '24h') : '24h',
          rows: [],
        };
      }

      groupMap[nameKey].rows.push({
        id: rIdx + 1,
        concentration: cols[iConc] || '0',
        viability:     cols[iViability] || '0',
        ros:           iRos !== -1 ? (cols[iRos] || '1.0') : '1.0',
        ldh:           iLdh !== -1 ? (cols[iLdh] || '0') : '0',
        apoptosis:     iApoptosis !== -1 ? (cols[iApoptosis] || '0') : '0',
      });
    });

    return Object.values(groupMap);
  };

  const handleCsvImport = async () => {
    try {
      setCsvLoading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/plain', 'application/csv', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        setCsvLoading(false);
        return;
      }

      const file = result.assets[0];
      const content = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 });
      const parsed = parseCSVText(content);

      if (parsed.length === 0) throw new Error('No formulation data found in the CSV.');
      if (parsed.length > 4) {
        Alert.alert('Notice', `CSV contains ${parsed.length} groups. First 4 formulations loaded.`);
      }

      setCsvParsed(parsed.slice(0, 4));
      setCsvPreviewVisible(true);
    } catch (err) {
      Alert.alert('CSV Import Error', err.message || 'Could not parse CSV.');
    } finally {
      setCsvLoading(false);
    }
  };

  const applyCsvData = () => {
    if (!csvParsed || csvParsed.length === 0) return;
    const newExperiments = csvParsed.map((f, idx) => ({
      id: Date.now() + idx,
      name: f.name,
      participant_id: f.participant_id || '',
      cell_line: f.cell_line,
      exposure_time: f.exposure_time,
      medical_app: 'general',
      synthesis_method: 'Green_Synthesis',
      surface_coating: 'Bare_ZnO',
      hemolysis_rate: '1.2',
      rows: f.rows,
    }));
    setManualExperiments(newExperiments);
    setCsvPreviewVisible(false);
    setCsvParsed(null);
  };

  const handleShare = async () => {
    if (!comparisonResults?.experiments) return;
    let text = `🧬 NanoSafe Multi-Sample Cytotoxicity Comparison Report\n\n`;
    text += `🏆 Safest Candidate: ${comparisonResults.safest_experiment}\n\n`;
    comparisonResults.experiments.forEach((e, i) => {
      text += `#${i + 1} ${e.name} (${e.cell_line}):\n`;
      text += `  • Viability: ${fmt(e.viability, 1)}%\n`;
      text += `  • ML Toxicity Score: ${fmt(e.toxicity_score, 1)} / 100\n`;
      text += `  • ISO 10993-5: ${e.iso_compliance}\n`;
      text += `  • 4PL IC50: ${e.ic50}\n\n`;
    });
    text += `Generated with NanoSafe Analyzer Platform.`;
    await Share.share({ title: 'NanoSafe Comparison Report', message: text });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.content, { paddingBottom: 180 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={[styles.screenTitle, { color: colors.text }]}>📊 Compare Cytotoxicity Datasets</Text>
        <Text style={[styles.screenSub, { color: colors.textMuted }]}>
          Benchmark multiple ZnO nanoparticle formulations or patient cell lines simultaneously
        </Text>

        {/* Mode Switcher Tabs */}
        <View style={[styles.modeTabs, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.modeTab, activeTab === 'history' && { backgroundColor: colors.primary }]}
            onPress={() => { setActiveTab('history'); setComparisonResults(null); }}
          >
            <History size={16} color={activeTab === 'history' ? '#fff' : colors.textMuted} />
            <Text style={[styles.modeTabText, { color: colors.textMuted }, activeTab === 'history' && styles.modeTabTextActive]}>
              Saved History ({history.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeTab, activeTab === 'manual' && { backgroundColor: colors.primary }]}
            onPress={() => { setActiveTab('manual'); setComparisonResults(null); }}
          >
            <Edit3 size={16} color={activeTab === 'manual' ? '#fff' : colors.textMuted} />
            <Text style={[styles.modeTabText, { color: colors.textMuted }, activeTab === 'manual' && styles.modeTabTextActive]}>
              Manual Data Entry
            </Text>
          </TouchableOpacity>
        </View>

        {/* ============================================================ */}
        {/* MODE 1: SELECT FROM HISTORY                                   */}
        {/* ============================================================ */}
        {activeTab === 'history' && !comparisonResults && (
          <View style={styles.cardSection}>
            {/* Action Bar Directly Under Tabs */}
            <View style={[styles.topActionBarCard, { backgroundColor: colors.card, borderColor: selectedHistoryIds.length >= 2 ? '#0f766e' : colors.border }]}>
              <View style={styles.topActionStatusRow}>
                <View style={[
                  styles.selectionPill,
                  {
                    backgroundColor: selectedHistoryIds.length >= 2 ? 'rgba(15,118,110,0.15)' : 'rgba(239,68,68,0.1)',
                    borderColor: selectedHistoryIds.length >= 2 ? '#0f766e' : 'rgba(239,68,68,0.3)',
                  }
                ]}>
                  <Text style={[styles.selectionPillText, { color: selectedHistoryIds.length >= 2 ? '#0f766e' : '#ef4444' }]}>
                    {selectedHistoryIds.length} Selected (Min 2)
                  </Text>
                </View>

                {history.length >= 2 && (
                  <TouchableOpacity
                    style={[styles.quickSelectBtn, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}
                    onPress={() => {
                      if (selectedHistoryIds.length === history.length) setSelectedHistoryIds([]);
                      else setSelectedHistoryIds(history.map(h => h.id));
                    }}
                  >
                    <Text style={[styles.quickSelectBtnText, { color: colors.primary }]}>
                      {selectedHistoryIds.length === history.length ? 'Clear All' : 'Select All'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={[styles.primaryActionBtn, (selectedHistoryIds.length < 2 || evaluating) && styles.btnDisabled]}
                onPress={handleEvaluateHistory}
                disabled={selectedHistoryIds.length < 2 || evaluating}
              >
                {evaluating ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.primaryActionBtnText}>Evaluating Comparisons...</Text>
                  </View>
                ) : (
                  <>
                    <Columns3 size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.primaryActionBtnText}>
                      {selectedHistoryIds.length >= 2
                        ? `🚀 Run Comparison Analysis (${selectedHistoryIds.length})`
                        : '🚀 Run Comparison Analysis (Select min 2)'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Filter Tabs */}
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
              <TouchableOpacity
                style={[{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }, historyFilter === 'patients' && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => setHistoryFilter('patients')}
              >
                <Text style={[{ fontSize: 12, fontWeight: '700', color: colors.textMuted }, historyFilter === 'patients' && { color: '#fff', fontWeight: '800' }]}>
                  👤 Patients ({history.filter(h => !!(h.participantId || h.participant_id)).length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }, historyFilter === 'research' && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => setHistoryFilter('research')}
              >
                <Text style={[{ fontSize: 12, fontWeight: '700', color: colors.textMuted }, historyFilter === 'research' && { color: '#fff', fontWeight: '800' }]}>
                  🔬 Research ({history.filter(h => !(h.participantId || h.participant_id)).length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[{ flex: 0.6, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }, historyFilter === 'all' && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => setHistoryFilter('all')}
              >
                <Text style={[{ fontSize: 12, fontWeight: '700', color: colors.textMuted }, historyFilter === 'all' && { color: '#fff', fontWeight: '800' }]}>
                  All ({history.length})
                </Text>
              </TouchableOpacity>
            </View>

            {loadingHistory ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 30 }} />
            ) : history.length === 0 ? (
              <View style={[styles.emptyHistoryBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <History size={36} color={colors.textMuted} />
                <Text style={[styles.emptyHistoryText, { color: colors.text }]}>No saved experiments found yet.</Text>
                <Text style={[styles.emptyHistorySub, { color: colors.textMuted }]}>Run an analysis in "New Analysis" first or enter data manually.</Text>
              </View>
            ) : (
              history.filter(item => {
                const isPatient = !!(item.participantId || item.participant_id);
                if (historyFilter === 'patients' && !isPatient) return false;
                if (historyFilter === 'research' && isPatient) return false;
                return true;
              }).map((item) => {
                const isSelected = selectedHistoryIds.includes(item.id);
                const rc = riskColor(item.result);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.historyCheckItem, { backgroundColor: colors.card, borderColor: colors.border }, isSelected && { backgroundColor: 'rgba(20,184,166,0.12)', borderColor: colors.primary }]}
                    onPress={() => toggleSelectHistory(item.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.checkboxBox}>
                      {isSelected ? (
                        <CheckSquare size={20} color={colors.primary} />
                      ) : (
                        <Square size={20} color={colors.textMuted} />
                      )}
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[styles.historyItemTitle, { color: colors.text }]}>{item.name || item.sample_name || 'Unnamed Experiment'}</Text>
                      <Text style={[styles.historyItemSub, { color: colors.textMuted }]}>
                        {item.cell_line || 'HeLa'} · Viability: <Text style={{ color: rc, fontWeight: '700' }}>{fmt(item.cell_viability || item.viability, 1)}%</Text> · ML Score: <Text style={{ color: colors.primary, fontWeight: '700' }}>{fmt(item.toxicityScore ?? item.toxicity_score, 1)}</Text>
                      </Text>
                    </View>
                    <View style={[styles.historyBadge, { backgroundColor: rc + '22', borderColor: rc }]}>
                      <Text style={[styles.historyBadgeText, { color: rc }]}>{item.result || 'Evaluated'}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {/* ============================================================ */}
        {/* MODE 2: MANUAL DATA ENTRY (FULL NEW ANALYSIS ATTRIBUTES)      */}
        {/* ============================================================ */}
        {activeTab === 'manual' && !comparisonResults && (
          <View>
            {/* Action Bar at Top */}
            <View style={[styles.topActionBarCard, { backgroundColor: colors.card, borderColor: colors.primary }]}>
              <View style={styles.topActionStatusRow}>
                <View style={[styles.selectionPill, {
                  backgroundColor: manualExperiments.length >= 2 ? 'rgba(15,118,110,0.15)' : 'rgba(245,158,11,0.15)',
                  borderColor: manualExperiments.length >= 2 ? '#0f766e' : '#f59e0b',
                }]}>
                  <Text style={[styles.selectionPillText, { color: manualExperiments.length >= 2 ? '#0f766e' : '#f59e0b' }]}>
                    {manualExperiments.length === 1 ? '1 Formulation Active · Add B to Compare' : `${manualExperiments.length} Formulations Configured`}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.addCardBtn, { backgroundColor: 'rgba(20,184,166,0.15)', borderColor: '#14b8a6' }]}
                  onPress={handleCsvImport}
                  disabled={csvLoading}
                >
                  {csvLoading ? <ActivityIndicator size="small" color="#14b8a6" /> : <Upload size={13} color="#14b8a6" />}
                  <Text style={[styles.addCardBtnText, { color: '#14b8a6' }]}>Import CSV</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.primaryActionBtn, evaluating && styles.btnDisabled]}
                onPress={handleEvaluateManual}
                disabled={evaluating}
              >
                {evaluating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Sparkles size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.primaryActionBtnText}>
                      {manualExperiments.length >= 2 ? `Run Comparative Evaluation (${manualExperiments.length} Formulations)` : 'Run Comparative Evaluation (Add Formulation B)'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Formulation Cards */}
            {manualExperiments.map((exp, cardIdx) => {
              const seriesColor = SERIES_COLORS[cardIdx % SERIES_COLORS.length];
              return (
                <View key={exp.id} style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {/* Card Header */}
                  <View style={styles.formCardHeader}>
                    <View style={[styles.cardTag, { backgroundColor: seriesColor + '25', borderColor: seriesColor }]}>
                      <Text style={[styles.cardTagText, { color: seriesColor }]}>
                        Formulation {String.fromCharCode(65 + cardIdx)}
                      </Text>
                    </View>
                    {manualExperiments.length > 1 && (
                      <TouchableOpacity onPress={() => removeManualCard(exp.id)} style={styles.deleteCardBtn}>
                        <Trash2 size={16} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* 1. Sample Name & Patient Selector */}
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.fieldLabel, { color: colors.text }]}>Formulation Name / Sample Code *</Text>
                    <TextInput
                      style={[styles.fieldInput, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', color: colors.text, borderColor: colors.border }]}
                      placeholder={`e.g. ZnO Formulation ${String.fromCharCode(65 + cardIdx)} (PEG-Coated)`}
                      placeholderTextColor={colors.textMuted}
                      value={exp.name}
                      onChangeText={(v) => updateCardField(cardIdx, 'name', v)}
                    />
                  </View>

                  {/* Patient Linking (Optional) */}
                  {participants.length > 0 && (
                    <View style={styles.fieldGroup}>
                      <Text style={[styles.fieldLabel, { color: colors.text }]}>👤 Linked Patient Primary Cell Line</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                        <TouchableOpacity
                          style={[
                            styles.smallChip,
                            { borderColor: colors.border, backgroundColor: isDark ? '#1e293b' : '#f8fafc' },
                            !exp.participant_id && styles.smallChipActive
                          ]}
                          onPress={() => updateCardField(cardIdx, 'participant_id', '')}
                        >
                          <Text style={[styles.smallChipText, { color: colors.textMuted }, !exp.participant_id && styles.smallChipTextActive]}>
                            Preclinical / Unlinked
                          </Text>
                        </TouchableOpacity>
                        {participants.map(p => {
                          const pid = p.participantId || p.participant_id;
                          const isSel = exp.participant_id === pid;
                          return (
                            <TouchableOpacity
                              key={pid}
                              style={[
                                styles.smallChip,
                                { borderColor: colors.border, backgroundColor: isDark ? '#1e293b' : '#f8fafc' },
                                isSel && styles.smallChipActive
                              ]}
                              onPress={() => updateCardField(cardIdx, 'participant_id', pid)}
                            >
                              <Text style={[styles.smallChipText, { color: colors.textMuted }, isSel && styles.smallChipTextActive]}>
                                {pid} {p.name ? `(${p.name})` : ''}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}

                  {/* 2. Cell Line Selector */}
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.fieldLabel, { color: colors.text }]}>Cell Line / Model *</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                      {['HeLa', 'A549', 'MCF-7', 'HEK-293', 'HepG2', 'HUVEC', 'NIH-3T3', 'Primary Keratinocytes'].map(cl => {
                        const isSel = exp.cell_line === cl;
                        return (
                          <TouchableOpacity
                            key={cl}
                            style={[
                              styles.smallChip,
                              { borderColor: colors.border, backgroundColor: isDark ? '#1e293b' : '#f8fafc' },
                              isSel && styles.smallChipActive
                            ]}
                            onPress={() => updateCardField(cardIdx, 'cell_line', cl)}
                          >
                            <Text style={[styles.smallChipText, { color: colors.textMuted }, isSel && styles.smallChipTextActive]}>{cl}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  {/* 3. Exposure Duration */}
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.fieldLabel, { color: colors.text }]}>Exposure Duration</Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {EXPOSURE_DURATIONS.map(dur => {
                        const isSel = exp.exposure_time === dur;
                        return (
                          <TouchableOpacity
                            key={dur}
                            style={[
                              styles.smallChip,
                              { flex: 1, alignItems: 'center', borderColor: colors.border, backgroundColor: isDark ? '#1e293b' : '#f8fafc' },
                              isSel && styles.smallChipActive
                            ]}
                            onPress={() => updateCardField(cardIdx, 'exposure_time', dur)}
                          >
                            <Text style={[styles.smallChipText, { color: colors.textMuted }, isSel && styles.smallChipTextActive]}>{dur}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* 4. Synthesis Method & Surface Coating */}
                  <View style={styles.fieldRow}>
                    <View style={{ flex: 1, marginRight: 6 }}>
                      <Text style={[styles.fieldLabel, { color: colors.text }]}>Synthesis Method</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
                        {SYNTHESIS_METHODS.map(sm => (
                          <TouchableOpacity
                            key={sm.id}
                            style={[
                              styles.miniChip,
                              { borderColor: colors.border, backgroundColor: isDark ? '#1e293b' : '#f8fafc' },
                              exp.synthesis_method === sm.id && styles.miniChipActive
                            ]}
                            onPress={() => updateCardField(cardIdx, 'synthesis_method', sm.id)}
                          >
                            <Text style={[styles.miniChipText, { color: colors.textMuted }, exp.synthesis_method === sm.id && styles.miniChipTextActive]}>
                              {sm.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </View>

                  <View style={styles.fieldRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: colors.text }]}>Surface Coating</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
                        {SURFACE_COATINGS.map(sc => (
                          <TouchableOpacity
                            key={sc.id}
                            style={[
                              styles.miniChip,
                              { borderColor: colors.border, backgroundColor: isDark ? '#1e293b' : '#f8fafc' },
                              exp.surface_coating === sc.id && styles.miniChipActive
                            ]}
                            onPress={() => updateCardField(cardIdx, 'surface_coating', sc.id)}
                          >
                            <Text style={[styles.miniChipText, { color: colors.textMuted }, exp.surface_coating === sc.id && styles.miniChipTextActive]}>
                              {sc.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </View>

                  {/* 5. Medical Application & Hemolysis */}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    <View style={{ flex: 1.5 }}>
                      <Text style={[styles.fieldLabel, { color: colors.text }]}>Intended Application</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
                        {MEDICAL_APPLICATIONS.map(ma => (
                          <TouchableOpacity
                            key={ma.id}
                            style={[
                              styles.miniChip,
                              { borderColor: colors.border, backgroundColor: isDark ? '#1e293b' : '#f8fafc' },
                              exp.medical_app === ma.id && styles.miniChipActive
                            ]}
                            onPress={() => updateCardField(cardIdx, 'medical_app', ma.id)}
                          >
                            <Text style={[styles.miniChipText, { color: colors.textMuted }, exp.medical_app === ma.id && styles.miniChipTextActive]}>
                              {ma.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: colors.text }]}>Hemolysis %</Text>
                      <TextInput
                        style={[styles.miniInput, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', color: colors.text, borderColor: colors.border }]}
                        placeholder="1.2"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="decimal-pad"
                        value={exp.hemolysis_rate}
                        onChangeText={(v) => updateCardField(cardIdx, 'hemolysis_rate', v)}
                      />
                    </View>
                  </View>

                  {/* 6. FULL 5-COLUMN DOSE-RESPONSE TABLE */}
                  <View style={styles.doseTableSection}>
                    <View style={styles.doseTableHeaderRow}>
                      <Text style={[styles.doseTableHeading, { color: colors.text }]}>
                        📈 Dose-Response Points ({exp.rows.length})
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TouchableOpacity style={styles.addRowBtn} onPress={() => addRowToCard(cardIdx)}>
                          <Plus size={13} color="#22c55e" />
                          <Text style={styles.addRowBtnText}>Add Point</Text>
                        </TouchableOpacity>
                        {exp.rows.length > 1 && (
                          <TouchableOpacity
                            style={[styles.addRowBtn, { borderColor: 'rgba(239, 68, 68, 0.4)', backgroundColor: 'rgba(239, 68, 68, 0.08)' }]}
                            onPress={() => clearCardRows(cardIdx)}
                          >
                            <RotateCcw size={12} color="#ef4444" />
                            <Text style={[styles.addRowBtnText, { color: '#ef4444' }]}>Clear</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    {/* Table Header: 5 Columns */}
                    <View style={[styles.manualTableHeader, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
                      <Text style={[styles.mthCell, { flex: 1.2, color: colors.text }]}>Conc (µg/mL)</Text>
                      <Text style={[styles.mthCell, { flex: 1.2, color: colors.text }]}>Viab (%)</Text>
                      <Text style={[styles.mthCell, { flex: 1.0, color: colors.text }]}>ROS (×)</Text>
                      <Text style={[styles.mthCell, { flex: 1.0, color: colors.text }]}>LDH (%)</Text>
                      <Text style={[styles.mthCell, { flex: 1.0, color: colors.text }]}>Apop (%)</Text>
                      <Text style={{ width: 26 }}></Text>
                    </View>

                    {exp.rows.map((r, rIdx) => (
                      <View key={r.id} style={styles.manualTableRow}>
                        <TextInput
                          style={[styles.miniInput, { flex: 1.2, backgroundColor: isDark ? '#1e293b' : '#f8fafc', color: colors.text, borderColor: colors.border }]}
                          placeholder="0.0"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="decimal-pad"
                          value={r.concentration}
                          onChangeText={(v) => updateRowCell(cardIdx, r.id, 'concentration', v)}
                        />
                        <TextInput
                          style={[styles.miniInput, { flex: 1.2, backgroundColor: isDark ? '#1e293b' : '#f8fafc', color: colors.text, borderColor: colors.border }]}
                          placeholder="100.0"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="decimal-pad"
                          value={r.viability}
                          onChangeText={(v) => updateRowCell(cardIdx, r.id, 'viability', v)}
                        />
                        <TextInput
                          style={[styles.miniInput, { flex: 1.0, backgroundColor: isDark ? '#1e293b' : '#f8fafc', color: colors.text, borderColor: colors.border }]}
                          placeholder="1.0"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="decimal-pad"
                          value={r.ros}
                          onChangeText={(v) => updateRowCell(cardIdx, r.id, 'ros', v)}
                        />
                        <TextInput
                          style={[styles.miniInput, { flex: 1.0, backgroundColor: isDark ? '#1e293b' : '#f8fafc', color: colors.text, borderColor: colors.border }]}
                          placeholder="0.5"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="decimal-pad"
                          value={r.ldh}
                          onChangeText={(v) => updateRowCell(cardIdx, r.id, 'ldh', v)}
                        />
                        <TextInput
                          style={[styles.miniInput, { flex: 1.0, backgroundColor: isDark ? '#1e293b' : '#f8fafc', color: colors.text, borderColor: colors.border }]}
                          placeholder="0.2"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="decimal-pad"
                          value={r.apoptosis}
                          onChangeText={(v) => updateRowCell(cardIdx, r.id, 'apoptosis', v)}
                        />
                        <TouchableOpacity
                          style={{ width: 26, alignItems: 'center', justifyContent: 'center' }}
                          onPress={() => deleteRowFromCard(cardIdx, r.id)}
                        >
                          <Trash2 size={13} color={colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}

            {/* Add Formulation Card Button */}
            {manualExperiments.length < 4 && (
              <TouchableOpacity
                style={[
                  styles.addAnotherCardBtn,
                  {
                    borderColor: colors.primary,
                    backgroundColor: isDark ? 'rgba(20,184,166,0.08)' : 'rgba(20,184,166,0.05)',
                    borderStyle: 'dashed',
                  }
                ]}
                onPress={addManualCard}
              >
                <Plus size={18} color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.addAnotherCardBtnText, { color: colors.primary, fontWeight: '800', fontSize: 14 }]}>
                  {manualExperiments.length === 1
                    ? '➕ Add Formulation B (Compare 2 Formulations)'
                    : `➕ Add Formulation ${String.fromCharCode(65 + manualExperiments.length)} (${manualExperiments.length + 1} of 4)`}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.primaryActionBtn, evaluating && styles.btnDisabled]}
              onPress={handleEvaluateManual}
              disabled={evaluating}
            >
              {evaluating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Sparkles size={18} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryActionBtnText}>
                    {manualExperiments.length >= 2
                      ? `Run Comparative Evaluation (${manualExperiments.length} Formulations)`
                      : 'Run Comparative Evaluation (Add Formulation B)'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ============================================================ */}
        {/* CSV PREVIEW MODAL                                             */}
        {/* ============================================================ */}
        <Modal
          visible={csvPreviewVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setCsvPreviewVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: isDark ? '#0f172a' : '#ffffff', borderColor: colors.border }]}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>📊 CSV Import Preview</Text>
                  <Text style={[styles.modalSub, { color: colors.textMuted }]}>
                    {csvParsed?.length} formulation{csvParsed?.length !== 1 ? 's' : ''} detected
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setCsvPreviewVisible(false)}>
                  <X size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ paddingBottom: 10 }}>
                {(csvParsed || []).map((f, fi) => (
                  <View key={fi} style={[styles.previewCard, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: colors.border }]}>
                    <View style={styles.previewCardHeader}>
                      <View style={[styles.cardTag, { backgroundColor: SERIES_COLORS[fi % SERIES_COLORS.length] + '25', borderColor: SERIES_COLORS[fi % SERIES_COLORS.length] }]}>
                        <Text style={[styles.cardTagText, { color: SERIES_COLORS[fi % SERIES_COLORS.length] }]}>
                          Formulation {String.fromCharCode(65 + fi)}
                        </Text>
                      </View>
                      <Text style={[styles.previewNameText, { color: colors.text }]} numberOfLines={1}>{f.name}</Text>
                    </View>
                    <Text style={[styles.previewMeta, { color: colors.textMuted }]}>{f.cell_line} · {f.exposure_time} · {f.rows.length} dose points</Text>

                    <View style={[styles.previewTableHead, { backgroundColor: isDark ? '#0f172a' : '#e2e8f0' }]}>
                      {['Conc', 'Viab %', 'ROS', 'LDH', 'Apop'].map(h => (
                        <Text key={h} style={[styles.previewTh, { color: colors.text }]}>{h}</Text>
                      ))}
                    </View>
                    {f.rows.slice(0, 4).map((r, ri) => (
                      <View key={ri} style={[styles.previewTableRow, { borderBottomColor: colors.border }]}>
                        {[r.concentration, r.viability, r.ros, r.ldh, r.apoptosis].map((v, ci) => (
                          <Text key={ci} style={[styles.previewTd, { color: colors.text }]}>{v || '—'}</Text>
                        ))}
                      </View>
                    ))}
                  </View>
                ))}
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderColor: colors.border }]}
                  onPress={() => setCsvPreviewVisible(false)}
                >
                  <Text style={[styles.modalBtnText, { color: colors.textMuted }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: colors.primary, borderColor: colors.primary, flex: 2 }]}
                  onPress={applyCsvData}
                >
                  <Upload size={16} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.modalBtnText}>Apply {csvParsed?.length} Formulations</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ============================================================ */}
        {/* COMPARISON RESULTS OUTPUT                                     */}
        {/* ============================================================ */}
        {comparisonResults && (
          <View style={styles.resultsContainer}>
            {/* Top Toolbar */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <TouchableOpacity
                style={[styles.recompareBtn, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: colors.border }]}
                onPress={() => setComparisonResults(null)}
              >
                <RotateCcw size={14} color={colors.primary} />
                <Text style={[styles.recompareBtnText, { color: colors.primary }]}>New Comparison</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.recompareBtn, { backgroundColor: '#38bdf820', borderColor: '#38bdf8' }]}
                onPress={handleShare}
              >
                <Share2 size={14} color="#38bdf8" />
                <Text style={[styles.recompareBtnText, { color: '#38bdf8' }]}>Share Report</Text>
              </TouchableOpacity>
            </View>

            {/* 1. EXECUTIVE WINNER BANNER */}
            <View style={styles.winnerBanner}>
              <Award size={30} color="#fbbf24" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.winnerLabel}>🏆 SAFEST FORMULATION IDENTIFIED</Text>
                <Text style={styles.winnerTitle}>{comparisonResults.safest_experiment}</Text>
                <Text style={styles.winnerDesc} numberOfLines={3}>{comparisonResults.summary}</Text>
              </View>
            </View>

            {/* 2. SEGMENTED TABS */}
            <View style={{ flexDirection: 'row', backgroundColor: isDark ? '#1e293b' : '#f1f5f9', padding: 4, borderRadius: 10, marginBottom: 16 }}>
              {[
                { id: 'summary', label: '🏆 Verdict' },
                { id: 'curves', label: '📉 Curves' },
                { id: 'table', label: '📊 Matrix' },
                { id: 'cards', label: '🧬 Candidates' },
              ].map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 }, resultsTab === t.id && { backgroundColor: '#0f766e' }]}
                  onPress={() => setResultsTab(t.id)}
                >
                  <Text style={[{ fontSize: 12, fontWeight: '700', color: colors.textMuted }, resultsTab === t.id && { color: '#fff' }]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* TAB 1: SUMMARY & VERDICT */}
            {resultsTab === 'summary' && (
              <View style={{ gap: 16 }}>
                <MultiSeriesCurveChart
                  experiments={comparisonResults.experiments}
                  selectedMetric={selectedMetric}
                  setSelectedMetric={setSelectedMetric}
                />

                <View style={[styles.sectionBox, { backgroundColor: colors.card, borderColor: colors.border, padding: 16 }]}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#38bdf8', marginBottom: 6 }}>💡 Automated Decision Support</Text>
                  <Text style={{ fontSize: 13, color: colors.text, lineHeight: 20 }}>
                    {comparisonResults.summary || 'Comparative cytotoxicity evaluation complete.'}
                  </Text>
                </View>

                {/* Quick Matrix Table */}
                <View style={[styles.sectionBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.sectionHeader}>
                    <TableProperties size={15} color={colors.primary} />
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>  Side-by-Side Parameter Matrix</Text>
                  </View>

                  <View style={[styles.tableWrapper, { borderColor: colors.border }]}>
                    <View style={[styles.tableHeader, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderBottomColor: colors.border }]}>
                      <Text style={[styles.thCell, { flex: 1.4, color: colors.text }]}>Parameter</Text>
                      {comparisonResults.experiments.map((exp, i) => (
                        <Text key={i} style={[styles.thCell, { flex: 1, color: colors.text }]} numberOfLines={1}>
                          {exp.name.replace('ZnO Formulation ', 'Form ')}
                        </Text>
                      ))}
                    </View>

                    {[
                      { label: 'Viability %', key: 'viability', isColor: true },
                      { label: 'Toxicity Score', key: 'toxicity_score' },
                      { label: '4PL IC50', key: 'ic50' },
                      { label: 'Safe Range', key: 'safe_range' },
                      { label: 'ROS Level', key: 'ros_avg', suffix: '×' },
                      { label: 'LDH Lysis', key: 'ldh_avg', suffix: '%' },
                      { label: 'Apoptosis', key: 'apoptosis_avg', suffix: '%' },
                      { label: 'ISO Verdict', key: 'iso_compliance' },
                    ].map((row, rIdx) => (
                      <View key={rIdx} style={[styles.tableRow, { borderBottomColor: colors.border }, rIdx % 2 === 1 && { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }]}>
                        <Text style={[styles.tdCell, { flex: 1.4, fontWeight: '700', color: colors.textMuted }]}>{row.label}</Text>
                        {comparisonResults.experiments.map((exp, i) => {
                          const val = exp[row.key] ?? '—';
                          const rc = riskColor(exp.risk_level);
                          return (
                            <Text
                              key={i}
                              style={[
                                styles.tdCell,
                                { flex: 1, fontWeight: '700', color: colors.text },
                                row.isColor && { color: rc },
                              ]}
                            >
                              {typeof val === 'number' ? fmt(val, 1) : val}{row.suffix || ''}
                            </Text>
                          );
                        })}
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* TAB 2: OVERLAY CURVES */}
            {resultsTab === 'curves' && (
              <MultiSeriesCurveChart
                experiments={comparisonResults.experiments}
                selectedMetric={selectedMetric}
                setSelectedMetric={setSelectedMetric}
              />
            )}

            {/* TAB 3: MATRIX TABLE */}
            {resultsTab === 'table' && (
              <View style={[styles.sectionBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.sectionHeader}>
                  <TableProperties size={15} color={colors.primary} />
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>  Side-by-Side Parameter Matrix</Text>
                </View>

                <View style={[styles.tableWrapper, { borderColor: colors.border }]}>
                  <View style={[styles.tableHeader, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderBottomColor: colors.border }]}>
                    <Text style={[styles.thCell, { flex: 1.4, color: colors.text }]}>Parameter</Text>
                    {comparisonResults.experiments.map((exp, i) => (
                      <Text key={i} style={[styles.thCell, { flex: 1, color: colors.text }]} numberOfLines={1}>
                        {exp.name.replace('ZnO Formulation ', 'Form ')}
                      </Text>
                    ))}
                  </View>

                  {[
                    { label: 'Viability %', key: 'viability', isColor: true },
                    { label: 'Toxicity Score', key: 'toxicity_score' },
                    { label: '4PL IC50', key: 'ic50' },
                    { label: 'Safe Range', key: 'safe_range' },
                    { label: 'ROS Level', key: 'ros_avg', suffix: '×' },
                    { label: 'LDH Lysis', key: 'ldh_avg', suffix: '%' },
                    { label: 'Apoptosis', key: 'apoptosis_avg', suffix: '%' },
                    { label: 'ISO Verdict', key: 'iso_compliance' },
                  ].map((row, rIdx) => (
                    <View key={rIdx} style={[styles.tableRow, { borderBottomColor: colors.border }, rIdx % 2 === 1 && { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }]}>
                      <Text style={[styles.tdCell, { flex: 1.4, fontWeight: '700', color: colors.textMuted }]}>{row.label}</Text>
                      {comparisonResults.experiments.map((exp, i) => {
                        const val = exp[row.key] ?? '—';
                        const rc = riskColor(exp.risk_level);
                        return (
                          <Text
                            key={i}
                            style={[
                              styles.tdCell,
                              { flex: 1, fontWeight: '700', color: colors.text },
                              row.isColor && { color: rc },
                            ]}
                          >
                            {typeof val === 'number' ? fmt(val, 1) : val}{row.suffix || ''}
                          </Text>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* TAB 4: CANDIDATE CARDS */}
            {resultsTab === 'cards' && (
              <View style={styles.cardsGrid}>
                {comparisonResults.experiments.map((exp, idx) => {
                  const isSafest = exp.name === comparisonResults.safest_experiment;
                  const rc = riskColor(exp.risk_level);
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.candidateCard,
                        { backgroundColor: colors.card, borderColor: colors.border },
                        isSafest && { borderColor: '#fbbf24', borderWidth: 2, backgroundColor: 'rgba(251,191,36,0.06)' },
                      ]}
                    >
                      <View style={styles.candidateHeader}>
                        <View style={[styles.rankCircle, { backgroundColor: isSafest ? '#fbbf24' : (isDark ? '#1e293b' : '#e2e8f0') }]}>
                          <Text style={[styles.rankText, { color: isSafest ? '#000' : colors.text }]}>#{exp.rank || idx + 1}</Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={[styles.candidateName, { color: colors.text }]} numberOfLines={1}>{exp.name}</Text>
                          <Text style={[styles.candidateSub, { color: colors.textMuted }]}>{exp.cell_line} · {exp.exposure_time}</Text>
                        </View>
                      </View>

                      <View style={[styles.candidateDivider, { backgroundColor: colors.border }]} />

                      <View style={styles.candidateMetricRow}>
                        <Text style={[styles.cMetricLabel, { color: colors.textMuted }]}>Cell Viability</Text>
                        <Text style={[styles.cMetricVal, { color: rc }]}>{fmt(exp.viability, 1)}%</Text>
                      </View>

                      <View style={styles.candidateMetricRow}>
                        <Text style={[styles.cMetricLabel, { color: colors.textMuted }]}>ML Toxicity Score</Text>
                        <Text style={[styles.cMetricVal, { color: colors.primary }]}>{fmt(exp.toxicity_score, 1)} / 100</Text>
                      </View>

                      <View style={styles.candidateMetricRow}>
                        <Text style={[styles.cMetricLabel, { color: colors.textMuted }]}>4PL IC50</Text>
                        <Text style={[styles.cMetricVal, { color: colors.text }]}>{exp.ic50 || 'N/A'}</Text>
                      </View>

                      <View style={styles.candidateMetricRow}>
                        <Text style={[styles.cMetricLabel, { color: colors.textMuted }]}>Safe Range</Text>
                        <Text style={[styles.cMetricVal, { color: '#22c55e' }]}>{exp.safe_range || '—'}</Text>
                      </View>

                      <View style={[styles.isoTag, { backgroundColor: rc + '20', borderColor: rc }]}>
                        <Text style={[styles.isoTagText, { color: rc }]}>{exp.iso_compliance}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity style={[styles.shareBtn, { backgroundColor: colors.primary }]} onPress={handleShare}>
                <Share2 size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.shareBtnText}>Share Comparison Report</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.md },
  screenTitle: { fontSize: 21, fontWeight: '800', marginBottom: 4 },
  screenSub: { fontSize: 14, marginBottom: 14 },

  // Mode Switcher Tabs
  modeTabs: { flexDirection: 'row', borderRadius: 12, padding: 4, marginBottom: 14, borderWidth: 1 },
  modeTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, gap: 6 },
  modeTabText: { fontSize: 14.5, fontWeight: '600' },
  modeTabTextActive: { color: '#fff', fontWeight: '800' },

  cardSection: { marginBottom: 14 },
  topActionBarCard: {
    borderRadius: 14, padding: 12, marginBottom: 14, borderWidth: 1.5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
  },
  topActionStatusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  selectionPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  selectionPillText: { fontSize: 12.5, fontWeight: '800' },
  quickSelectBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  quickSelectBtnText: { fontSize: 12.5, fontWeight: '700' },

  primaryActionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 10, paddingVertical: 13, backgroundColor: '#0f766e',
    marginTop: 8, marginBottom: 4,
  },
  primaryActionBtnText: { color: '#fff', fontSize: 15.5, fontWeight: '800' },
  btnDisabled: { opacity: 0.5 },

  // History Items
  historyCheckItem: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1.5,
  },
  checkboxBox: { padding: 2 },
  historyItemTitle: { fontSize: 15.5, fontWeight: '700' },
  historyItemSub: { fontSize: 13, marginTop: 2 },
  historyBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  historyBadgeText: { fontSize: 12, fontWeight: '800' },
  emptyHistoryBox: { padding: 30, alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1 },
  emptyHistoryText: { fontSize: 16, fontWeight: '700' },
  emptyHistorySub: { fontSize: 13.5, textAlign: 'center' },

  // Manual Form Cards
  formCard: { borderRadius: 14, padding: 12, marginBottom: 14, borderWidth: 1 },
  formCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  cardTagText: { fontSize: 13, fontWeight: '800' },
  deleteCardBtn: { padding: 4 },

  fieldGroup: { marginBottom: 10 },
  fieldLabel: { fontSize: 12.5, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase' },
  fieldInput: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15 },
  fieldRow: { flexDirection: 'row', marginBottom: 6 },
  smallChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  smallChipActive: { backgroundColor: '#0f766e', borderColor: '#0f766e' },
  smallChipText: { fontSize: 13, fontWeight: '600' },
  smallChipTextActive: { color: '#fff', fontWeight: '800' },

  miniChip: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, borderWidth: 1 },
  miniChipActive: { backgroundColor: '#0f766e', borderColor: '#0f766e' },
  miniChipText: { fontSize: 12, fontWeight: '600' },
  miniChipTextActive: { color: '#fff', fontWeight: '800' },

  addCardBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  addCardBtnText: { fontSize: 12.5, fontWeight: '700' },
  addAnotherCardBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 10, paddingVertical: 12, borderWidth: 1, marginBottom: 12,
  },
  addAnotherCardBtnText: { fontSize: 14.5, fontWeight: '700' },

  // Dose table
  doseTableSection: { marginTop: 8 },
  doseTableHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  doseTableHeading: { fontSize: 13.5, fontWeight: '700' },
  addRowBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 4, backgroundColor: 'rgba(34,197,94,0.1)', borderWidth: 1, borderColor: '#22c55e' },
  addRowBtnText: { fontSize: 12, color: '#22c55e', fontWeight: '700' },
  manualTableHeader: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 4, borderRadius: 6, marginBottom: 4 },
  mthCell: { fontSize: 11, fontWeight: '800', textAlign: 'center' },
  manualTableRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 4 },
  miniInput: { borderRadius: 6, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 4, fontSize: 13.5, textAlign: 'center' },

  // Chart styling
  chartContainer: { borderRadius: 14, padding: 12, borderWidth: 1, marginBottom: 14 },
  chartHeader: { marginBottom: 6 },
  chartTitle: { fontSize: 15.5, fontWeight: '800' },
  chartSub: { fontSize: 13, marginBottom: 6 },
  metricTabs: { flexDirection: 'row', gap: 4 },
  chartTab: { flex: 1, alignItems: 'center', paddingVertical: 5, borderRadius: 6, borderWidth: 1 },
  chartTabText: { fontSize: 12, fontWeight: '700' },
  svgWrapper: { width: '100%', alignItems: 'center', justifyContent: 'center', marginVertical: 4 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, fontWeight: '600', maxWidth: 120 },

  // Results
  resultsContainer: { marginTop: 4 },
  recompareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1 },
  recompareBtnText: { fontSize: 14, fontWeight: '700' },

  winnerBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(251,191,36,0.08)',
    borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#fbbf24', marginBottom: 14,
  },
  winnerLabel: { fontSize: 12, color: '#fbbf24', fontWeight: '800', textTransform: 'uppercase' },
  winnerTitle: { fontSize: 17, fontWeight: '800', marginVertical: 2, color: '#fbbf24' },
  winnerDesc: { fontSize: 13, lineHeight: 18, color: '#e2e8f0' },

  sectionBox: { borderRadius: 12, padding: 12, borderWidth: 1, marginBottom: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 14.5, fontWeight: '800' },
  tableWrapper: { borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 4, borderBottomWidth: 1 },
  thCell: { fontSize: 11.5, fontWeight: '800', textAlign: 'center' },
  tableRow: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 4, borderBottomWidth: 1 },
  tdCell: { fontSize: 12.5, textAlign: 'center' },

  // Candidates
  cardsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  candidateCard: { flexBasis: '48%', flexGrow: 1, borderRadius: 12, padding: 10, borderWidth: 1 },
  candidateHeader: { flexDirection: 'row', alignItems: 'center' },
  rankCircle: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 12, fontWeight: '800' },
  candidateName: { fontSize: 14.5, fontWeight: '800' },
  candidateSub: { fontSize: 12 },
  candidateDivider: { height: 1, marginVertical: 8 },
  candidateMetricRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 },
  cMetricLabel: { fontSize: 12.5 },
  cMetricVal: { fontSize: 13.5, fontWeight: '800' },
  isoTag: { marginTop: 8, paddingVertical: 3, borderRadius: 5, borderWidth: 1, alignItems: 'center' },
  isoTagText: { fontSize: 11.5, fontWeight: '800' },

  actionButtonsRow: { marginBottom: 20 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingVertical: 12 },
  shareBtnText: { color: '#fff', fontSize: 15.5, fontWeight: '800' },

  // CSV Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 34, borderTopWidth: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalSub: { fontSize: 13.5, marginTop: 2 },
  previewCard: { borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1 },
  previewCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  previewNameText: { fontSize: 14.5, fontWeight: '700', flex: 1 },
  previewMeta: { fontSize: 12.5, marginBottom: 6 },
  previewTableHead: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 4, borderRadius: 5, marginBottom: 2 },
  previewTh: { flex: 1, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  previewTableRow: { flexDirection: 'row', paddingVertical: 3, borderBottomWidth: 1 },
  previewTd: { flex: 1, fontSize: 12, textAlign: 'center' },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  modalBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, borderWidth: 1 },
  modalBtnText: { color: '#fff', fontSize: 14.5, fontWeight: '800' },
});
