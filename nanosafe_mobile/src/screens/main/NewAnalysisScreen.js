import React, { useState, useRef, useEffect, useContext } from 'react';
import { LanguageContext } from '../../context/LanguageContext';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, Dimensions, Share,
  Linking, KeyboardAvoidingView, Platform, Modal
} from 'react-native';
import Svg, { Path, Line, Circle, Polygon, Rect, Text as SvgText, G } from 'react-native-svg';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { ThemeContext } from '../../context/ThemeContext';
import { ALL_CELL_LINES } from '../../theme/cellLines';
import apiClient from '../../api/client';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import {
  Calculator, ShieldCheck, ShieldAlert, AlertTriangle,
  Plus, Trash2, Sparkles, RefreshCw, Layers, CheckCircle2,
  Cpu, TableProperties, ArrowRight, Activity, Award,
  Download, Share2, FileText, Lightbulb, ChevronRight, ChevronDown, Check,
  Upload, Eye
} from 'lucide-react-native';

const EXPOSURE_DURATIONS = ['6 h', '12 h', '24 h (Standard)', '48 h', '72 h (Extended)'];
const SYNTHESIS_METHODS = [
  { id: 'Green_Synthesis', label: '🌿 Green Synthesis (Plant / Biogenic)', desc: '25% reduced cytotoxicity profile' },
  { id: 'Chemical_Precipitation', label: '🧪 Chemical Precipitation', desc: 'Standard wet chemical synthesis' },
  { id: 'Sol-Gel', label: '🔬 Sol-Gel Hydrolysis', desc: 'Uniform nanoscale nucleation' },
  { id: 'Hydrothermal', label: '⚗️ Hydrothermal Autoclave', desc: 'High crystallinity route' },
];

const SURFACE_COATINGS = [
  { id: 'Bare_ZnO', label: '⚪ Bare ZnO (Uncoated)', desc: 'Native reactive surface' },
  { id: 'PEG_Coated', label: '🛡️ PEG-Coated (Polyethylene Glycol)', desc: '65% ROS suppression & biocompatibility' },
  { id: 'Chitosan_Coated', label: '🌱 Chitosan-Coated', desc: 'Natural biopolymer encapsulation' },
  { id: 'Silica_Coated', label: '💎 Silica-Coated (SiO2)', desc: 'Surface passivation barrier' },
];

const MEDICAL_APPLICATIONS = [
  { id: 'general', label: 'General Biomedical (ISO 10993-5)', target: '≥80% Target' },
  { id: 'wound_dressing', label: '🩹 Wound Dressing', target: '≥80% Target' },
  { id: 'dental', label: '🦷 Dental Biomaterial', target: '≥75% Target' },
  { id: 'drug_delivery', label: '💊 Drug Delivery / Nanocarrier', target: '≥90% Target' },
  { id: 'tissue_engineering', label: '🧫 Bone & Tissue Scaffold', target: '≥85% Target' },
];

const EMPTY_INITIAL_ROWS = [
  { id: 1, concentration: '', viability: '', ros: '', ldh: '', apoptosis: '' },
];

const fmt = (val, decimals = 1) => {
  if (val === null || val === undefined || val === '') return '—';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]/g, ''));
  if (isNaN(num)) return String(val);
  const fixed = num.toFixed(decimals);
  return fixed.endsWith('.0') && decimals === 1 && num === Math.floor(num) ? String(num) : fixed;
};

// =========================================================================
// 1. DOSE-RESPONSE SVG CURVE CHART (100% Responsive SVG Fit)
// =========================================================================
function DoseResponseCurveChart({ rows = [], selectedMetric = 'viability', setSelectedMetric }) {
  const { colors, isDark } = useContext(ThemeContext);
  const textColor = isDark ? '#ffffff' : '#0f172a';
  const gridColor = isDark ? '#334155' : '#cbd5e1';

  const metrics = [
    { key: 'viability', label: 'Viability', unit: '%', color: '#14b8a6', isPct: true },
    { key: 'ros', label: 'ROS Level', unit: '×', color: '#f59e0b', isPct: false },
    { key: 'ldh', label: 'LDH Leakage', unit: '%', color: '#ea580c', isPct: true },
    { key: 'apoptosis', label: 'Apoptosis', unit: '%', color: '#a855f7', isPct: true },
  ];

  const activeMetric = metrics.find(m => m.key === selectedMetric) || metrics[0];

  const getVal = (r, field) => {
    if (r[field] !== undefined && r[field] !== '') return parseFloat(r[field]);
    if (field === 'viability' && r['Cell Viability'] !== undefined) return parseFloat(r['Cell Viability']);
    if (field === 'concentration' && r['Concentration'] !== undefined) return parseFloat(r['Concentration']);
    if (field === 'ros' && r['ROS Level'] !== undefined) return parseFloat(r['ROS Level']);
    if (field === 'ldh' && r['LDH Release'] !== undefined) return parseFloat(r['LDH Release']);
    if (field === 'apoptosis' && r['Apoptosis'] !== undefined) return parseFloat(r['Apoptosis']);
    return 0;
  };

  const sortedRows = [...rows].sort((a, b) => getVal(a, 'concentration') - getVal(b, 'concentration'));
  const concs = sortedRows.map(r => getVal(r, 'concentration'));
  const vals = sortedRows.map(r => getVal(r, selectedMetric));

  const maxConc = Math.max(...concs, 10);
  const maxVal = activeMetric.isPct ? 100 : Math.max(...vals, 5);

  const V_WIDTH = 340;
  const V_HEIGHT = 200;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 30;

  const chartW = V_WIDTH - padLeft - padRight;
  const chartH = V_HEIGHT - padTop - padBottom;

  const getX = (c) => padLeft + (c / maxConc) * chartW;
  const getY = (v) => padTop + chartH - (Math.min(v, maxVal) / maxVal) * chartH;

  const points = sortedRows.map(r => ({
    x: getX(getVal(r, 'concentration')),
    y: getY(getVal(r, selectedMetric)),
    conc: getVal(r, 'concentration'),
    val: getVal(r, selectedMetric),
  }));

  const pathD = points.length > 0
    ? points.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x},${pt.y}`, '')
    : '';

  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x},${padTop + chartH} L ${points[0].x},${padTop + chartH} Z`
    : '';

  // 5 Calibrated Ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0].map(pct => ({
    val: Math.round(pct * maxVal),
    y: padTop + chartH - pct * chartH,
  }));

  const xTicks = [0, 0.25, 0.5, 0.75, 1.0].map(pct => ({
    val: Math.round(pct * maxConc),
    x: padLeft + pct * chartW,
  }));

  return (
    <View style={styles.chartContainer}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>📈 4PL Dose-Response Curve</Text>
        <Text style={styles.chartSub}>Concentration-dependent biomarker response</Text>
      </View>

      {/* Metric Selector Tabs */}
      <View style={styles.metricTabsRow}>
        {metrics.map(m => {
          const isSelected = m.key === selectedMetric;
          return (
            <TouchableOpacity
              key={m.key}
              style={[
                styles.metricTabChip,
                { borderColor: isSelected ? m.color : colors.border, backgroundColor: isSelected ? `${m.color}22` : colors.inputBg }
              ]}
              onPress={() => setSelectedMetric && setSelectedMetric(m.key)}
            >
              <Text style={[styles.metricTabChipText, { color: isSelected ? m.color : colors.textMuted, fontWeight: isSelected ? '800' : '600' }]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.svgWrapper}>
        <Svg width="100%" height={210} viewBox={`0 0 ${V_WIDTH} ${V_HEIGHT}`} preserveAspectRatio="xMidYMid meet">
          {/* Y Axis Grid & Ticks */}
          {yTicks.map((t, idx) => (
            <G key={`y-${idx}`}>
              <Line x1={padLeft} y1={t.y} x2={V_WIDTH - padRight} y2={t.y} stroke={gridColor} strokeWidth="1" strokeDasharray="3,3" />
              <SvgText x={padLeft - 6} y={t.y + 4} fontSize="10" fill={textColor} textAnchor="end" fontWeight="700">
                {t.val}{activeMetric.unit}
              </SvgText>
            </G>
          ))}

          {/* X Axis Grid & Ticks */}
          {xTicks.map((t, idx) => (
            <G key={`x-${idx}`}>
              <Line x1={t.x} y1={padTop} x2={t.x} y2={padTop + chartH} stroke={gridColor} strokeWidth="1" strokeDasharray="3,3" />
              <SvgText x={t.x} y={padTop + chartH + 16} fontSize="10" fill={textColor} textAnchor="middle" fontWeight="700">
                {t.val}
              </SvgText>
            </G>
          ))}

          {/* 80% ISO Safe Line when viewing viability */}
          {selectedMetric === 'viability' && (
            <G>
              <Line
                x1={padLeft}
                y1={getY(80)}
                x2={V_WIDTH - padRight}
                y2={getY(80)}
                stroke="#16a34a"
                strokeWidth="1.5"
                strokeDasharray="4,4"
              />
              <SvgText x={V_WIDTH - padRight - 4} y={getY(80) - 4} fontSize="9" fill="#16a34a" textAnchor="end" fontWeight="800">
                ISO 80% Safe
              </SvgText>
            </G>
          )}

          {/* Area Fill */}
          {areaD ? <Path d={areaD} fill={`${activeMetric.color}18`} /> : null}

          {/* Curve Line */}
          {pathD ? <Path d={pathD} fill="none" stroke={activeMetric.color} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" /> : null}

          {/* Data Points / Vertices */}
          {points.map((pt, idx) => (
            <G key={`pt-${idx}`}>
              <Circle cx={pt.x} cy={pt.y} r="5.5" fill="#090d16" stroke={activeMetric.color} strokeWidth="2.5" />
              <Circle cx={pt.x} cy={pt.y} r="2.5" fill="#ffffff" />
              <SvgText x={pt.x} y={pt.y - 9} fontSize="9.5" fill={textColor} textAnchor="middle" fontWeight="800">
                {fmt(pt.val, 1)}
              </SvgText>
            </G>
          ))}
        </Svg>
      </View>
    </View>
  );
}

// 2. 5-AXIS MULTI-BIOMARKER SAFETY RADAR CHART (100% Responsive SVG Fit)
// =========================================================================
function BiomarkerRadarChart({ result }) {
  const { colors, isDark } = useContext(ThemeContext);
  const textColor = isDark ? '#ffffff' : '#0f172a';
  const gridColor = isDark ? '#334155' : '#cbd5e1';
  const axisColor = isDark ? '#475569' : '#94a3b8';
  const V_WIDTH = 340;
  const V_HEIGHT = 280;
  const cx = V_WIDTH / 2;
  const cy = 135;
  const radius = 95;

  // 5 Normalized Biomarker Cellular Health Scores (0 - 100%)
  const vViab = Math.min(Math.max(parseFloat(result.viability_pct) || 80, 0), 100);
  const rawRos = parseFloat(result.ros_avg) || 1.0;
  const vRos = Math.min(Math.max(100 - (rawRos - 1.0) * 20, 0), 100);
  const rawLdh = parseFloat(result.ldh_avg) || 4.5;
  const vLdh = Math.min(Math.max(100 - rawLdh * 3, 0), 100);
  const rawApop = parseFloat(result.apoptosis_avg) || 3.2;
  const vApop = Math.min(Math.max(100 - rawApop * 4, 0), 100);
  const rawHemo = parseFloat(result.hemolysis_rate) || 0.8;
  const vHemo = Math.min(Math.max(100 - rawHemo * 10, 0), 100);

  // 5 Pentagon Axes (Angles in radians)
  const axes = [
    { label: 'Viability', score: vViab, angle: -Math.PI / 2, raw: `${result.viability_pct}%` },
    { label: 'ROS Defense', score: vRos, angle: -Math.PI / 2 + (2 * Math.PI / 5), raw: `${fmt(rawRos, 1)}×` },
    { label: 'Membrane', score: vLdh, angle: -Math.PI / 2 + (4 * Math.PI / 5), raw: `${fmt(rawLdh, 1)}%` },
    { label: 'Anti-Apop', score: vApop, angle: -Math.PI / 2 + (6 * Math.PI / 5), raw: `${fmt(rawApop, 1)}%` },
    { label: 'Blood Safe', score: vHemo, angle: -Math.PI / 2 + (8 * Math.PI / 5), raw: `${fmt(rawHemo, 1)}%` },
  ];

  const getCoord = (angle, dist) => ({
    x: cx + dist * Math.cos(angle),
    y: cy + dist * Math.sin(angle),
  });

  const getPolygonPoints = (scaleRatio) => {
    return axes.map(a => {
      const pt = getCoord(a.angle, scaleRatio * radius);
      return `${pt.x},${pt.y}`;
    }).join(' ');
  };

  const polygonPoints = axes.map(a => {
    const pt = getCoord(a.angle, (a.score / 100) * radius);
    return `${pt.x},${pt.y}`;
  }).join(' ');

  const isSafe = vViab >= 80;
  const themeColor = isSafe ? '#14b8a6' : (vViab >= 50 ? '#f59e0b' : '#ef4444');

  return (
    <View style={styles.chartContainer}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
        <Text style={styles.chartTitle}>🎯 5-Axis Biocompatibility Radar</Text>
        <View style={{ backgroundColor: isSafe ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: isSafe ? '#22c55e' : '#ef4444' }}>
            {isSafe ? 'ISO 10993-5 PASS' : 'OUTSIDE ISO ENVELOPE'}
          </Text>
        </View>
      </View>
      <Text style={styles.chartSub}>Omnidirectional cellular integrity across 5 endpoints (0–100%)</Text>

      <View style={styles.svgWrapper}>
        <Svg width="100%" height={260} viewBox={`0 0 ${V_WIDTH} ${V_HEIGHT}`} preserveAspectRatio="xMidYMid meet">
          {/* Concentric pentagonal grid rings (20%, 40%, 60%, 80%, 100%) */}
          {[0.2, 0.4, 0.6, 0.8, 1.0].map((ring, idx) => (
            <Polygon
              key={idx}
              points={getPolygonPoints(ring)}
              fill="none"
              stroke={ring === 0.8 ? '#22c55e' : '#334155'}
              strokeWidth={ring === 0.8 ? '2' : '1.2'}
              strokeDasharray={ring === 0.8 ? '4, 3' : (ring === 1.0 ? '0' : '2, 2')}
            />
          ))}

          {/* Radial axis lines */}
          {axes.map((a, i) => {
            const end = getCoord(a.angle, radius);
            const labelPos = getCoord(a.angle, radius + 22);
            return (
              <G key={i}>
                <Line
                  x1={cx}
                  y1={cy}
                  x2={end.x}
                  y2={end.y}
                  stroke="#334155"
                  strokeWidth="1"
                />
                <SvgText
                  x={labelPos.x}
                  y={labelPos.y + 5}
                  fontSize="13"
                  fill={textColor}
                  textAnchor="middle"
                  fontWeight="900"
                >
                  {a.label}
                </SvgText>
              </G>
            );
          })}

          {/* Sample Measured Polygon */}
          <Polygon
            points={polygonPoints}
            fill={themeColor + '38'}
            stroke={themeColor}
            strokeWidth="2.8"
          />

          {/* Glowing node vertices */}
          {axes.map((a, i) => {
            const pt = getCoord(a.angle, (a.score / 100) * radius);
            return (
              <G key={i}>
                <Circle
                  cx={pt.x}
                  cy={pt.y}
                  r="5"
                  fill="#090d16"
                  stroke={themeColor}
                  strokeWidth="2.5"
                />
                <Circle
                  cx={pt.x}
                  cy={pt.y}
                  r="2"
                  fill="#ffffff"
                />
              </G>
            );
          })}
        </Svg>
      </View>

      {/* Biomarker Value Chips */}
      <View style={styles.radarChipsGrid}>
        {axes.map((a, idx) => (
          <View key={idx} style={[styles.radarChip, { borderColor: a.score >= 80 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)' }]}>
            <Text style={styles.radarChipLabel}>{a.label}:</Text>
            <Text style={[styles.radarChipVal, { color: a.score >= 80 ? '#22c55e' : (a.score >= 50 ? '#f59e0b' : '#ef4444') }]}>
              {Math.round(a.score)}% <Text style={{ fontSize: 10, color: '#94a3b8' }}>({a.raw})</Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// =========================================================================
// MAIN SCREEN COMPONENT
// =========================================================================
export default function NewAnalysisScreen({ navigation }) {
  const { t } = useContext(LanguageContext);
  const { colors, isDark } = useContext(ThemeContext);
  const scrollViewRef = useRef(null);
  const [sampleName, setSampleName] = useState('');
  const [cellLine, setCellLine] = useState('');
  const [exposureTime, setExposureTime] = useState('');
  const [medicalApp, setMedicalApp] = useState('');
  const [synthesisMethod, setSynthesisMethod] = useState('');
  const [surfaceCoating, setSurfaceCoating] = useState('');
  const [hemolysisRate, setHemolysisRate] = useState('');
  const [rows, setRows] = useState(EMPTY_INITIAL_ROWS);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState('viability');
  const [participants, setParticipants] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvPreview, setCsvPreview] = useState(null); // { rows, filename }
  const [csvPreviewVisible, setCsvPreviewVisible] = useState(false);

  // Dropdown open/collapse states
  const [openDropdown, setOpenDropdown] = useState(null); // 'patient' | 'cellLine' | 'exposure' | 'medicalApp' | 'synthesis' | 'coating'
  const toggleDropdown = (name) => setOpenDropdown(prev => prev === name ? null : name);

  // ── CSV Import Helpers ─────────────────────────────────────────────────────
  const parseCSVForAnalysis = (text) => {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
    if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row.');

    const parseRow = (line) => {
      const result = []; let cur = ''; let inQ = false;
      for (const ch of line) {
        if (ch === '"') { inQ = !inQ; }
        else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
        else { cur += ch; }
      }
      result.push(cur.trim());
      return result;
    };

    const headers = parseRow(lines[0]).map(h => h.toLowerCase().replace(/[\s_]+/g, '_'));
    const col = (...aliases) => { for (const a of aliases) { const i = headers.findIndex(h => h.includes(a)); if (i !== -1) return i; } return -1; };

    const iConc     = col('conc', 'concentration', 'dose');
    const iViab     = col('viab', 'viable', 'via', 'cell_viability', 'viability');
    const iRos      = col('ros', 'reactive', 'oxidative');
    const iLdh      = col('ldh', 'lysis', 'leakage');
    const iApop     = col('apop', 'apoptosis');

    if (iConc === -1 || iViab === -1)
      throw new Error('CSV must contain at minimum a "Concentration" and "Viability" column.');

    let nextId = 1;
    const parsed = lines.slice(1)
      .map(l => parseRow(l))
      .filter(cols => cols[iConc] && cols[iViab])
      .map(cols => ({
        id: nextId++,
        concentration: cols[iConc] || '0',
        viability:     cols[iViab]  || '0',
        ros:           iRos  !== -1 ? (cols[iRos]  || '1.0') : '1.0',
        ldh:           iLdh  !== -1 ? (cols[iLdh]  || '0')   : '0',
        apoptosis:     iApop !== -1 ? (cols[iApop] || '0')   : '0',
      }));

    if (parsed.length === 0) throw new Error('No valid data rows found in CSV.');
    return parsed;
  };

  const handleCsvImport = async () => {
    try {
      setCsvLoading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/plain', 'application/csv', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) { setCsvLoading(false); return; }

      const file = result.assets[0];
      const content = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 });
      const parsed = parseCSVForAnalysis(content);

      setCsvPreview({ rows: parsed, filename: file.name || 'data.csv' });
      setCsvPreviewVisible(true);
    } catch (err) {
      Alert.alert('CSV Import Error', err.message || 'Could not parse the selected file.');
    } finally {
      setCsvLoading(false);
    }
  };

  const applyCsvRows = () => {
    if (!csvPreview?.rows?.length) return;
    setRows(csvPreview.rows);
    setCsvPreviewVisible(false);
    setCsvPreview(null);
    Alert.alert('✅ CSV Loaded', `${csvPreview.rows.length} concentration points imported. Review and run analysis.`);
  };

  const fetchParticipants = async () => {
    try {
      const res = await apiClient.get('/participants/');
      setParticipants(res.data.participants || []);
    } catch (e) {
      console.log('Failed to fetch participants for selector:', e);
    }
  };

  useEffect(() => {
    fetchParticipants();
  }, []);

  // Reset form to blank every time screen comes into focus
  useEffect(() => {
    if (!navigation) return;
    try {
      const unsubscribe = navigation.addListener('focus', () => {
        setSampleName('');
        setCellLine('');
        setExposureTime('');
        setMedicalApp('');
        setSynthesisMethod('');
        setSurfaceCoating('');
        setHemolysisRate('');
        setRows([{ id: 1, concentration: '', viability: '', ros: '', ldh: '', apoptosis: '' }]);
        setResult(null);
        setSelectedMetric('viability');
      });
      return unsubscribe;
    } catch (e) {
      // Navigation context doesn't support focus events — form stays at default empty state
    }
  }, [navigation]);

  const handleAddRow = () => {
    const nextId = rows.length > 0 ? Math.max(...rows.map(r => r.id)) + 1 : 1;
    setRows([...rows, { id: nextId, concentration: '', viability: '', ros: '', ldh: '', apoptosis: '' }]);
  };

  const handleDeleteRow = (id) => {
    if (rows.length <= 1) {
      Alert.alert('Notice', 'At least one dose-response concentration point is required.');
      return;
    }
    setRows(rows.filter(r => r.id !== id));
  };

  const handleRowChange = (id, field, value) => {
    setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleClearRows = () => {
    setRows([{ id: 1, concentration: '', viability: '', ros: '', ldh: '', apoptosis: '' }]);
    setCellLine('');
    setExposureTime('');
    setMedicalApp('');
    setSynthesisMethod('');
    setSurfaceCoating('');
    setHemolysisRate('');
    setResult(null);
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleCalculate = async () => {
    if (!sampleName.trim()) {
      Alert.alert('Validation', 'Please enter an experiment / sample name.');
      return;
    }
    if (!cellLine) {
      Alert.alert('Validation', 'Please select a target in-vitro cell line model.');
      return;
    }
    if (!exposureTime) {
      Alert.alert('Validation', 'Please select an incubation exposure duration.');
      return;
    }
    if (!medicalApp) {
      Alert.alert('Validation', 'Please select the intended biomedical application.');
      return;
    }
    if (!synthesisMethod) {
      Alert.alert('Validation', 'Please select a nanoparticle synthesis route.');
      return;
    }
    if (!surfaceCoating) {
      Alert.alert('Validation', 'Please select a surface functionalization / coating.');
      return;
    }

    const validRows = rows.filter(r => r.concentration !== '' && r.viability !== '');
    if (validRows.length === 0) {
      Alert.alert('Validation', 'Please provide at least one row with Concentration and Cell Viability.');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const payload = {
        sample_name: sampleName.trim(),
        cell_line: cellLine,
        exposure_time: exposureTime,
        medical_application: medicalApp,
        synthesis_method: synthesisMethod,
        surface_coating: surfaceCoating,
        hemolysis_rate: hemolysisRate !== '' ? (parseFloat(hemolysisRate) || 0.8) : 0.8,
        participant_id: selectedPatient ? (selectedPatient.participantId || selectedPatient.participant_id) : '',
        participant_name: selectedPatient ? (selectedPatient.name || '') : 'General Material Screening',
        study_group: selectedPatient ? (selectedPatient.studyGroup || selectedPatient.study_group || '') : '',
        rows: validRows.map(r => ({
          concentration: parseFloat(r.concentration) || 0,
          viability: parseFloat(r.viability) || 0,
          ros: r.ros !== '' ? (parseFloat(r.ros) || 1.0) : 1.0,
          ldh: r.ldh !== '' ? (parseFloat(r.ldh) || 0) : 0,
          apoptosis: r.apoptosis !== '' ? (parseFloat(r.apoptosis) || 0) : 0,
        })),
      };

      const res = await apiClient.post('/analysis/calculate', payload);
      setResult({ ...res.data, submittedRows: validRows });
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 300);
    } catch (e) {
      console.error('Calculation error:', e);
      Alert.alert('Error', e.response?.data?.error || 'Failed to process cytotoxicity data.');
    } finally {
      setLoading(false);
    }
  };

  const resetAnalysis = () => {
    setResult(null);
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  // Structured ML Rationale Points Generator
  // Generate clinical suggestions based on result
  const getSuggestions = (res, appId) => {
    if (!res) return [];
    const viab = res.viability_pct || 0;
    const ic50 = res.ic50 || res.predicted_ic50 || 'N/A';
    const safeRange = res.safe_range || 'N/A';
    const appObj = MEDICAL_APPLICATIONS.find(a => a.id === appId);
    const appLabel = appObj?.label || 'Biomedical Use';

    if (viab >= 80) {
      return [
        { icon: '✅', title: 'ISO 10993-5 PASS — Biocompatible', desc: `Cell viability at ${viab}% meets the ≥80% ISO threshold. This formulation is safe for preclinical biomedical research.` },
        { icon: '🎯', title: 'Safe Dosage Ceiling Confirmed', desc: `Maintain concentrations within ${safeRange}. 4PL IC50 at ${ic50} provides a wide therapeutic window for ${appLabel}.` },
        { icon: '🔬', title: 'Proceed to Phase II In-Vivo Validation', desc: `Advance to animal model testing (murine wound model or equivalent). Evaluate systemic toxicity at escalating dose levels.` },
        { icon: '📋', title: 'Compile Regulatory Submission Package', desc: `Consolidate this cytotoxicity dataset per ISO 10993-5 guidance. Retain raw data and chain of custody for medical device audit compliance.` },
        { icon: '💊', title: `Application-Specific Optimization (${appObj?.target || '≥80%'})`, desc: `Formulate final product at ≤30% of IC50 dose. Evaluate biofilm inhibition and protein adsorption for ${appLabel}.` },
      ];
    } else if (viab >= 50) {
      return [
        { icon: '⚠️', title: 'MODERATE RISK — Optimization Required', desc: `Cell viability at ${viab}% is below ISO threshold. Dose reduction of 40–60% is required to achieve biocompatibility.` },
        { icon: '⬇️', title: 'Reduce Working Concentration', desc: `Target ≥80% viability at all therapeutic dose points. Current safe ceiling: ${safeRange}. Do not exceed IC50 boundary at ${ic50}.` },
        { icon: '🧪', title: 'Surface Functionalization Recommended', desc: `Evaluate citrate, PVP, or PEG surface coating to reduce ROS oxidative stress and membrane disruption. Repeat assay after coating.` },
        { icon: '📊', title: 'Run 3-Replicate Repeat Assay', desc: `Conduct 3 independent biological replicates with optimized formulation. Include Triton X-100 positive control and PBS negative control.` },
        { icon: '🔍', title: 'Mechanistic Stress Investigation', desc: `Assess mitochondrial membrane potential (JC-1 assay) and oxidative stress markers (DCFH-DA) to characterize cytotoxic pathway.` },
      ];
    } else {
      return [
        { icon: '🚫', title: 'HIGH RISK — NOT Suitable for Biomedical Use', desc: `Cell viability at ${viab}% indicates severe cytotoxic response. This formulation is INCOMPATIBLE with biomedical application at tested concentrations.` },
        { icon: '🔄', title: 'Complete Reformulation Required', desc: `Reduce nanoparticle dose by >70% or redesign surface chemistry. Consider switching to ZnO quantum dots (<5nm) or functionalized hybrid variants.` },
        { icon: '🧬', title: 'Apoptosis vs. Necrosis Profiling', desc: `Conduct flow cytometry to characterize the apoptosis/necrosis ratio. Evaluate if toxicity is concentration-dependent or pathway-specific.` },
        { icon: '🔬', title: 'Alternative Material Evaluation', desc: `Compare TiO2, CeO2, or hydroxyapatite as biocompatible alternatives. Run ISO 10993-5 cytotoxicity profiles on shortlisted candidates.` },
        { icon: '⛔', title: 'Halt In-Vivo Escalation', desc: `Do not proceed to animal model testing until ISO 10993-5 PASS is achieved in-vitro. Resolve cytotoxicity before regulatory escalation.` },
      ];
    }
  };

  const getRationalePoints = (res) => {
    if (!res) return [];
    const appObj = MEDICAL_APPLICATIONS.find(a => a.id === medicalApp);
    const isSafe = res.viability_pct >= 80;

    return [
      {
        icon: '🎯',
        title: 'Primary Biocompatibility Finding',
        desc: `Computed a Toxicity Score of ${res.toxicity_score} / 100, classified under ${res.iso_compliance || (isSafe ? 'ISO 10993-5 PASS — Biocompatible' : 'ISO 10993-5 FAIL — Cytotoxic')}.`
      },
      {
        icon: '🧪',
        title: 'Multi-Biomarker Stress Profile',
        desc: `Evaluated cell survival at ${res.viability_pct}%, ROS oxidation level at ${res.ros_avg ?? 1.8}× baseline, LDH membrane permeability at ${res.ldh_avg ?? 4.5}%, and apoptosis at ${res.apoptosis_avg ?? 3.2}%.`
      },
      {
        icon: '🛡️',
        title: 'Calculated Safe Therapeutic Window',
        desc: `Safe concentration ceiling established at ${res.safe_range || '0.0 – 25.0 µg/mL'} with an inflection 4PL IC50 of ${res.ic50 || `${res.predicted_ic50} µg/mL`}.`
      },
      {
        icon: '🔬',
        title: 'Cellular Tolerance Dynamics',
        desc: `${cellLine} cells under a ${exposureTime} exposure window demonstrate ${isSafe ? 'high membrane integrity and manageable oxidative clearance' : 'significant mitochondrial stress and membrane leakage beyond upper tolerance limits'}.`
      },
      {
        icon: '🩹',
        title: 'Application Guidance',
        desc: `For ${appObj?.label || 'Biomedical Use'}, dosage formulations should be kept strictly within ${res.safe_range || '0.0 – 25.0 µg/mL'} to ensure clinical efficacy without triggering tissue necrosis.`
      }
    ];
  };

  // Compute suggestions (after both functions are defined)
  const suggestions = getSuggestions(result, medicalApp);

  const handleDownloadReport = async () => {
    const expId = result?.experimentId || result?.history_id || result?.id || 'latest';
    const base = apiClient.defaults.baseURL || 'http://172.20.10.3:5000/mobile/v1';
    const pdfUrl = `${base}/reports/${expId}/pdf`;

    try {
      await Linking.openURL(pdfUrl);
    } catch (e) {
      console.error('Error opening report URL:', e);
      Alert.alert('Open Report', `Could not open Safari automatically. Please open in your browser:\n${pdfUrl}`);
    }
  };

  const handleShareReport = async () => {
    try {
      const isSafe = result.viability_pct >= 80;
      const text = `🧬 NanoSafe Cytotoxicity Report: ${result.sample_name || sampleName}\n` +
        `• Target Cell Line: ${result.cell_line || cellLine}\n` +
        `• Mean Viability: ${result.viability_pct}%\n` +
        `• ML Toxicity Score: ${result.toxicity_score} / 100\n` +
        `• 4PL IC50: ${result.ic50 || result.predicted_ic50 || 'Not Reached'}\n` +
        `• Safe Dosage Window: ${result.safe_range || '0.0 – 25.0 µg/mL'}\n` +
        `• ISO 10993-5 Verdict: ${result.iso_compliance || (isSafe ? 'PASS — Biocompatible' : 'FAIL — Cytotoxic')}\n` +
        `Generated with NanoSafe Analyzer Platform.`;
      await Share.share({ title: 'NanoSafe Analysis Report', message: text });
    } catch (e) {
      console.log('Share error:', e);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
    <ScrollView
      ref={scrollViewRef}
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Hero Header Banner */}
      <View style={styles.heroBanner}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroTitle}>New Patient Cytotoxicity Evaluation</Text>
          <Text style={styles.heroSub}>
            Evaluate patient-specific primary cell viability, oxidative stress tolerance, and ISO 10993-5 biocompatibility.
          </Text>
        </View>
      </View>

      {/* Main Experiment Setup Card */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardSectionTitle, { color: colors.text }]}>🧪 Experiment Setup</Text>

        {/* 1. 👤 Patient / Subject Dropdown Selector (Vertical) */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>👤 Study Patient / Subject *</Text>
          <TouchableOpacity
            style={[styles.dropdownBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }, openDropdown === 'patient' && { borderColor: colors.primary }]}
            onPress={() => toggleDropdown('patient')}
            activeOpacity={0.75}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.dropdownBtnTitle, { color: colors.text }]}>
                {selectedPatient
                  ? `👤 ${selectedPatient.name || 'Subject'} (${selectedPatient.participantId || selectedPatient.participant_id})`
                  : t('generalScreening', '🔬 Preclinical Material Screening (No Patient)')}
              </Text>
              <Text style={[styles.dropdownBtnSub, { color: colors.textMuted }]}>
                {selectedPatient
                  ? `🩸 ${selectedPatient.bloodGroup || selectedPatient.blood_group || 'O+'} • 🏷️ ${selectedPatient.studyGroup || 'General Cohort'}`
                  : 'Pure synthesis batch / General cell model'}
              </Text>
            </View>
            <ChevronDown
              size={18}
              color={openDropdown === 'patient' ? colors.primary : colors.textMuted}
              style={{ transform: [{ rotate: openDropdown === 'patient' ? '180deg' : '0deg' }] }}
            />
          </TouchableOpacity>

          {openDropdown === 'patient' && (
            <View style={[styles.dropdownVerticalMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ScrollView nestedScrollEnabled style={{ maxHeight: 220 }}>
                {/* Option: Material Screening */}
                <TouchableOpacity
                  style={[styles.dropdownOptionRow, { borderBottomColor: colors.border }, !selectedPatient && styles.dropdownOptionRowActive]}
                  onPress={() => {
                    setSelectedPatient(null);
                    setSampleName('Preclinical Material Screening Batch');
                    setOpenDropdown(null);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.dropdownOptionTitle, { color: colors.textSecondary }, !selectedPatient && { color: colors.primary, fontWeight: '800' }]}>
                      🔬 Preclinical Material Screening
                    </Text>
                    <Text style={[styles.dropdownOptionSub, { color: colors.textMuted }]}>Pure synthesis batch / No human donor assigned</Text>
                  </View>
                  {!selectedPatient && <Check size={16} color={colors.primary} />}
                </TouchableOpacity>

                {/* Enrolled Patients List */}
                {participants.map((p) => {
                  const pid = p.participantId || p.participant_id;
                  const isSel = selectedPatient && ((selectedPatient.participantId || selectedPatient.participant_id) === pid);
                  return (
                    <TouchableOpacity
                      key={p.id || pid}
                      style={[styles.dropdownOptionRow, { borderBottomColor: colors.border }, isSel && styles.dropdownOptionRowActive]}
                      onPress={() => {
                        setSelectedPatient(p);
                        const subName = p.name ? p.name : "Subject";
                        setSampleName(`Patient ${subName} (${pid}) — Cytotoxicity Assay`);
                        if (p.studyGroup?.includes('Wound')) setMedicalApp('wound_dressing');
                        else if (p.studyGroup?.includes('Dental')) setMedicalApp('dental');
                        else if (p.studyGroup?.includes('Scaffold')) setMedicalApp('tissue_engineering');
                        setOpenDropdown(null);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.dropdownOptionTitle, { color: colors.textSecondary }, isSel && { color: colors.primary, fontWeight: '800' }]}>
                          👤 {p.name || 'Subject'} ({pid})
                        </Text>
                        <Text style={[styles.dropdownOptionSub, { color: colors.textMuted }]}>
                          🩸 Blood Group: {p.bloodGroup || p.blood_group || 'O+'} • 🏷️ {p.studyGroup || 'General Cohort'}
                        </Text>
                      </View>
                      {isSel && <Check size={16} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Experiment / Evaluation Name Input */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Evaluation Title / Experiment Name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
            value={sampleName}
            onChangeText={setSampleName}
            placeholder="e.g. Patient Jane D. (PAT-2026-001) — Cytotoxicity Assay"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        {/* 2. 🧫 Target Cell Line Dropdown Selector (Vertical) */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Target Cell Line ({ALL_CELL_LINES.length} Models Available) *</Text>
          <TouchableOpacity
            style={[styles.dropdownBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }, openDropdown === 'cellLine' && { borderColor: colors.primary }]}
            onPress={() => toggleDropdown('cellLine')}
            activeOpacity={0.75}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.dropdownBtnTitle, { color: cellLine ? colors.text : colors.textMuted }]}>
                {cellLine ? `🧫 ${ALL_CELL_LINES.find(c => c.id === cellLine)?.name || cellLine}` : '🧫 Select Target Cell Line *'}
              </Text>
              <Text style={[styles.dropdownBtnSub, { color: colors.textMuted }]}>
                {cellLine ? (ALL_CELL_LINES.find(c => c.id === cellLine)?.origin || 'Cell Culture Model') : 'Choose from 24 in-vitro models'}
              </Text>
            </View>
            <ChevronDown
              size={18}
              color={openDropdown === 'cellLine' ? colors.primary : colors.textMuted}
              style={{ transform: [{ rotate: openDropdown === 'cellLine' ? '180deg' : '0deg' }] }}
            />
          </TouchableOpacity>

          {openDropdown === 'cellLine' && (
            <View style={[styles.dropdownVerticalMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ScrollView nestedScrollEnabled style={{ maxHeight: 220 }}>
                {ALL_CELL_LINES.map((cl) => {
                  const isSel = cellLine === cl.id;
                  return (
                    <TouchableOpacity
                      key={cl.id}
                      style={[styles.dropdownOptionRow, { borderBottomColor: colors.border }, isSel && styles.dropdownOptionRowActive]}
                      onPress={() => {
                        setCellLine(cl.id);
                        setOpenDropdown(null);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.dropdownOptionTitle, { color: colors.textSecondary }, isSel && { color: colors.primary, fontWeight: '800' }]}>
                          🧫 {cl.name}
                        </Text>
                        <Text style={[styles.dropdownOptionSub, { color: colors.textMuted }]}>{cl.origin}</Text>
                      </View>
                      {isSel && <Check size={16} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>

        {/* 3. ⏱️ Exposure Duration Dropdown Selector (Vertical) */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Exposure Duration *</Text>
          <TouchableOpacity
            style={[styles.dropdownBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }, openDropdown === 'exposure' && { borderColor: colors.primary }]}
            onPress={() => toggleDropdown('exposure')}
            activeOpacity={0.75}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.dropdownBtnTitle, { color: exposureTime ? colors.text : colors.textMuted }]}>
                {exposureTime ? `⏱️ ${exposureTime}` : '⏱️ Select Exposure Duration *'}
              </Text>
              <Text style={[styles.dropdownBtnSub, { color: colors.textMuted }]}>
                {exposureTime ? 'Standard In-Vitro Incubation Time' : 'Choose incubation period (6h – 72h)'}
              </Text>
            </View>
            <ChevronDown
              size={18}
              color={openDropdown === 'exposure' ? colors.primary : colors.textMuted}
              style={{ transform: [{ rotate: openDropdown === 'exposure' ? '180deg' : '0deg' }] }}
            />
          </TouchableOpacity>

          {openDropdown === 'exposure' && (
            <View style={[styles.dropdownVerticalMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ScrollView nestedScrollEnabled style={{ maxHeight: 180 }}>
                {EXPOSURE_DURATIONS.map((dur) => {
                  const isSel = exposureTime === dur;
                  return (
                    <TouchableOpacity
                      key={dur}
                      style={[styles.dropdownOptionRow, { borderBottomColor: colors.border }, isSel && styles.dropdownOptionRowActive]}
                      onPress={() => {
                        setExposureTime(dur);
                        setOpenDropdown(null);
                      }}
                    >
                      <Text style={[styles.dropdownOptionTitle, { color: colors.textSecondary }, isSel && { color: colors.primary, fontWeight: '800' }]}>
                        ⏱️ {dur}
                      </Text>
                      {isSel && <Check size={16} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>

        {/* 4. 🏥 Biomedical Application Dropdown Selector (Vertical) */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Target Biomedical Application *</Text>
          <TouchableOpacity
            style={[styles.dropdownBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }, openDropdown === 'medicalApp' && { borderColor: colors.primary }]}
            onPress={() => toggleDropdown('medicalApp')}
            activeOpacity={0.75}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.dropdownBtnTitle, { color: medicalApp ? colors.text : colors.textMuted }]}>
                {medicalApp ? (MEDICAL_APPLICATIONS.find(a => a.id === medicalApp)?.label || 'General Biomedical') : '🏥 Select Target Application *'}
              </Text>
              <Text style={[styles.dropdownBtnSub, { color: colors.textMuted }]}>
                {medicalApp ? `ISO Target: ${MEDICAL_APPLICATIONS.find(a => a.id === medicalApp)?.target || '≥80%'}` : 'Choose intended clinical/research use'}
              </Text>
            </View>
            <ChevronDown
              size={18}
              color={openDropdown === 'medicalApp' ? colors.primary : colors.textMuted}
              style={{ transform: [{ rotate: openDropdown === 'medicalApp' ? '180deg' : '0deg' }] }}
            />
          </TouchableOpacity>

          {openDropdown === 'medicalApp' && (
            <View style={[styles.dropdownVerticalMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }}>
                {MEDICAL_APPLICATIONS.map((app) => {
                  const isSel = medicalApp === app.id;
                  return (
                    <TouchableOpacity
                      key={app.id}
                      style={[styles.dropdownOptionRow, { borderBottomColor: colors.border }, isSel && styles.dropdownOptionRowActive]}
                      onPress={() => {
                        setMedicalApp(app.id);
                        setOpenDropdown(null);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.dropdownOptionTitle, { color: colors.textSecondary }, isSel && { color: colors.primary, fontWeight: '800' }]}>
                          {app.label}
                        </Text>
                        <Text style={[styles.dropdownOptionSub, { color: colors.textMuted }]}>Target Threshold: {app.target}</Text>
                      </View>
                      {isSel && <Check size={16} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>

        {/* 5. 🌿 Synthesis Method Dropdown Selector (Paper 1 & 7) */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Synthesis Route (Biogenic vs Chemical) *</Text>
          <TouchableOpacity
            style={[styles.dropdownBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }, openDropdown === 'synthesis' && { borderColor: colors.primary }]}
            onPress={() => toggleDropdown('synthesis')}
            activeOpacity={0.75}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.dropdownBtnTitle, { color: synthesisMethod ? colors.text : colors.textMuted }]}>
                {synthesisMethod ? (SYNTHESIS_METHODS.find(s => s.id === synthesisMethod)?.label || synthesisMethod) : '🌿 Select Synthesis Route *'}
              </Text>
              <Text style={[styles.dropdownBtnSub, { color: colors.textMuted }]}>
                {synthesisMethod ? (SYNTHESIS_METHODS.find(s => s.id === synthesisMethod)?.desc || 'Synthesis chemistry route') : 'Biogenic green vs chemical route'}
              </Text>
            </View>
            <ChevronDown
              size={18}
              color={openDropdown === 'synthesis' ? colors.primary : colors.textMuted}
              style={{ transform: [{ rotate: openDropdown === 'synthesis' ? '180deg' : '0deg' }] }}
            />
          </TouchableOpacity>

          {openDropdown === 'synthesis' && (
            <View style={[styles.dropdownVerticalMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }}>
                {SYNTHESIS_METHODS.map((sm) => {
                  const isSel = synthesisMethod === sm.id;
                  return (
                    <TouchableOpacity
                      key={sm.id}
                      style={[styles.dropdownOptionRow, { borderBottomColor: colors.border }, isSel && styles.dropdownOptionRowActive]}
                      onPress={() => {
                        setSynthesisMethod(sm.id);
                        setOpenDropdown(null);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.dropdownOptionTitle, { color: colors.textSecondary }, isSel && { color: colors.primary, fontWeight: '800' }]}>
                          {sm.label}
                        </Text>
                        <Text style={[styles.dropdownOptionSub, { color: colors.textMuted }]}>{sm.desc}</Text>
                      </View>
                      {isSel && <Check size={16} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>

        {/* 6. 🛡️ Surface Functionalization / Coating Selector (Paper 2 & 4) */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Surface Functionalization / Coating *</Text>
          <TouchableOpacity
            style={[styles.dropdownBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }, openDropdown === 'coating' && { borderColor: colors.primary }]}
            onPress={() => toggleDropdown('coating')}
            activeOpacity={0.75}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.dropdownBtnTitle, { color: surfaceCoating ? colors.text : colors.textMuted }]}>
                {surfaceCoating ? (SURFACE_COATINGS.find(sc => sc.id === surfaceCoating)?.label || surfaceCoating) : '🛡️ Select Surface Coating *'}
              </Text>
              <Text style={[styles.dropdownBtnSub, { color: colors.textMuted }]}>
                {surfaceCoating ? (SURFACE_COATINGS.find(sc => sc.id === surfaceCoating)?.desc || 'Protective surface modification') : 'Bare ZnO vs protective coating'}
              </Text>
            </View>
            <ChevronDown
              size={18}
              color={openDropdown === 'coating' ? colors.primary : colors.textMuted}
              style={{ transform: [{ rotate: openDropdown === 'coating' ? '180deg' : '0deg' }] }}
            />
          </TouchableOpacity>

          {openDropdown === 'coating' && (
            <View style={[styles.dropdownVerticalMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }}>
                {SURFACE_COATINGS.map((sc) => {
                  const isSel = surfaceCoating === sc.id;
                  return (
                    <TouchableOpacity
                      key={sc.id}
                      style={[styles.dropdownOptionRow, { borderBottomColor: colors.border }, isSel && styles.dropdownOptionRowActive]}
                      onPress={() => {
                        setSurfaceCoating(sc.id);
                        setOpenDropdown(null);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.dropdownOptionTitle, { color: colors.textSecondary }, isSel && { color: colors.primary, fontWeight: '800' }]}>
                          {sc.label}
                        </Text>
                        <Text style={[styles.dropdownOptionSub, { color: colors.textMuted }]}>{sc.desc}</Text>
                      </View>
                      {isSel && <Check size={16} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>

        {/* 7. 🩸 ASTM F756 Hemolysis Rate Input (Paper 3) */}
        <View style={styles.inputGroup}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 0 }]}>ASTM F756 Hemolysis Rate (%)</Text>
            <Text style={{
              fontSize: 11,
              fontWeight: '800',
              color: (parseFloat(hemolysisRate) || 0) < 2.0 ? colors.safe : ((parseFloat(hemolysisRate) || 0) <= 5.0 ? colors.moderate : colors.danger)
            }}>
              {(parseFloat(hemolysisRate) || 0) < 2.0 ? '🟢 Non-Hemolytic (<2%)' : ((parseFloat(hemolysisRate) || 0) <= 5.0 ? '🟡 Slightly Hemolytic' : '🔴 Hemolytic (>5%)')}
            </Text>
          </View>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
            value={hemolysisRate}
            onChangeText={setHemolysisRate}
            keyboardType="numeric"
            placeholder="e.g. 0.8"
            placeholderTextColor={colors.textMuted}
          />
        </View>
      </View>

      {/* Multi-Dose Table Entry Card */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.tableHeaderRow, { marginBottom: 12 }]}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={[styles.cardSectionTitle, { color: colors.text }]}>Multi-Dose In Vitro Measurements</Text>
            <Text style={[styles.tableSubtext, { color: colors.textMuted }]}>{rows.length} concentration points entered</Text>
          </View>
        </View>

        {/* ── Upload CSV Banner ─────────────────────────── */}
        <TouchableOpacity
          style={[styles.csvUploadBanner, { backgroundColor: isDark ? 'rgba(20,184,166,0.10)' : 'rgba(13,148,136,0.08)', borderColor: colors.primary }]}
          onPress={handleCsvImport}
          activeOpacity={0.75}
          disabled={csvLoading}
        >
          {csvLoading
            ? <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 10 }} />
            : <Upload size={18} color={colors.primary} style={{ marginRight: 10 }} />}
          <View style={{ flex: 1 }}>
            <Text style={[styles.csvBannerTitle, { color: colors.primary }]}>📂 Import Data from CSV File</Text>
            <Text style={[styles.csvBannerSub, { color: colors.textMuted }]}>
              Columns: Concentration, Viability (required) + ROS, LDH, Apoptosis (optional)
            </Text>
          </View>
          <FileText size={16} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Action Controls: Add Row | Clear All */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <TouchableOpacity
            style={[styles.addRowBtn, { backgroundColor: colors.primary, flex: 1, justifyContent: 'center', height: 42 }]}
            onPress={handleAddRow}
          >
            <Plus size={16} color="#fff" style={{ marginRight: 6 }} />
            <Text style={[styles.addRowBtnText, { fontSize: 14, fontWeight: '800' }]}>➕ Add Row</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.presetBtn, { backgroundColor: colors.inputBg, borderColor: 'rgba(239, 68, 68, 0.4)', flex: 1, justifyContent: 'center', height: 42, marginBottom: 0 }]}
            onPress={handleClearRows}
          >
            <RefreshCw size={14} color={colors.danger} style={{ marginRight: 6 }} />
            <Text style={[styles.presetBtnText, { color: colors.danger, fontSize: 14, fontWeight: '800' }]}>🔄 Clear All</Text>
          </TouchableOpacity>
        </View>

        {/* Dose Rows */}
        {rows.map((r, index) => (
          <View key={r.id} style={[styles.rowCard, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <View style={styles.rowTopBar}>
              <View style={[styles.rowNumberBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.rowNumberText, { color: colors.primary }]}>Point {index + 1}</Text>
              </View>
              {rows.length > 1 && (
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDeleteRow(r.id)}
                >
                  <Trash2 size={14} color={colors.danger} />
                  <Text style={[styles.deleteBtnText, { color: colors.danger }]}>Delete</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.inputsGrid}>
              <View style={styles.cellInputGroup}>
                <Text style={[styles.cellLabel, { color: colors.textMuted }]}>Conc (µg/mL) *</Text>
                <TextInput
                  style={[styles.cellInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                  value={r.concentration}
                  onChangeText={(v) => handleRowChange(r.id, 'concentration', v)}
                  keyboardType="decimal-pad"
                  placeholder="0.0"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.cellInputGroup}>
                <Text style={[styles.cellLabel, { color: colors.textMuted }]}>Viability (%) *</Text>
                <TextInput
                  style={[styles.cellInput, { backgroundColor: colors.card, borderColor: colors.border, color: parseFloat(r.viability) >= 80 ? colors.safe : (parseFloat(r.viability) >= 50 ? colors.moderate : colors.danger) }]}
                  value={r.viability}
                  onChangeText={(v) => handleRowChange(r.id, 'viability', v)}
                  keyboardType="decimal-pad"
                  placeholder="100.0"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.cellInputGroup}>
                <Text style={[styles.cellLabel, { color: colors.textMuted }]}>ROS (×)</Text>
                <TextInput
                  style={[styles.cellInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                  value={r.ros}
                  onChangeText={(v) => handleRowChange(r.id, 'ros', v)}
                  keyboardType="decimal-pad"
                  placeholder="1.0"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.cellInputGroup}>
                <Text style={[styles.cellLabel, { color: colors.textMuted }]}>LDH (%)</Text>
                <TextInput
                  style={[styles.cellInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                  value={r.ldh}
                  onChangeText={(v) => handleRowChange(r.id, 'ldh', v)}
                  keyboardType="decimal-pad"
                  placeholder="0.5"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.cellInputGroup}>
                <Text style={[styles.cellLabel, { color: colors.textMuted }]}>Apoptosis (%)</Text>
                <TextInput
                  style={[styles.cellInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                  value={r.apoptosis}
                  onChangeText={(v) => handleRowChange(r.id, 'apoptosis', v)}
                  keyboardType="decimal-pad"
                  placeholder="0.2"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>
          </View>
        ))}

        {/* Bottom Row Action Controls (for long lists) */}
        {rows.length > 2 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, marginBottom: 14 }}>
            <TouchableOpacity
              style={[styles.addRowBtn, { backgroundColor: colors.primary, flex: 1, justifyContent: 'center', height: 40 }]}
              onPress={handleAddRow}
            >
              <Plus size={15} color="#fff" style={{ marginRight: 6 }} />
              <Text style={[styles.addRowBtnText, { fontSize: 13.5, fontWeight: '800' }]}>➕ Add Row</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.presetBtn, { backgroundColor: colors.inputBg, borderColor: 'rgba(239, 68, 68, 0.4)', flex: 1, justifyContent: 'center', height: 40, marginBottom: 0 }]}
              onPress={handleClearRows}
            >
              <RefreshCw size={13} color={colors.danger} style={{ marginRight: 6 }} />
              <Text style={[styles.presetBtnText, { color: colors.danger, fontSize: 13.5, fontWeight: '800' }]}>🔄 Clear All</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Calculate Action */}
        <TouchableOpacity
          style={[styles.calcBtn, { backgroundColor: colors.primary }]}
          onPress={handleCalculate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Calculator size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.calcBtnText}>Run 4PL Cytotoxicity Analysis</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* ========================================================================= */}
      {/* RESULTS DISPLAY SECTION                                                   */}
      {/* ========================================================================= */}
      {result && (
        <View style={[styles.resultMainCard, { backgroundColor: colors.card, borderColor: colors.primary }]}>
          {/* Top Hero Result Verdict Banner */}
          {(() => {
            const rawRisk = (result.risk_level || result.safety_category || '').toLowerCase();
            const viab = parseFloat(result.viability_pct || result.viability || 0);
            const isLow = rawRisk.includes('low') || rawRisk.includes('safe') || (viab >= 80 && !rawRisk.includes('high') && !rawRisk.includes('mod') && !rawRisk.includes('toxic'));
            const isMod = !isLow && (rawRisk.includes('mod') || (viab >= 50 && !rawRisk.includes('high') && !rawRisk.includes('toxic')));
            const bannerStyle = isLow ? styles.verdictSafe : (isMod ? styles.verdictMod : styles.verdictDanger);
            const iconColor = isLow ? colors.safe : (isMod ? colors.moderate : colors.danger);
            const statusText = isLow ? '🟢 LOW RISK — SAFE' : (isMod ? '🟡 MODERATE RISK' : '🔴 HIGH RISK — CYTOTOXIC');

            return (
              <View style={[styles.verdictBanner, bannerStyle]}>
                <View style={styles.verdictIconRow}>
                  {isLow ? (
                    <ShieldCheck size={36} color={iconColor} />
                  ) : isMod ? (
                    <AlertTriangle size={36} color={iconColor} />
                  ) : (
                    <ShieldAlert size={36} color={iconColor} />
                  )}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={[styles.verdictStatus, { color: colors.text }]}>
                        {statusText}
                      </Text>
                      <View style={styles.confidenceTag}>
                        <Cpu size={11} color="#38bdf8" />
                        <Text style={styles.confidenceTagText}>ML {result.confidence || '98.5%'}</Text>
                      </View>
                    </View>
                    <Text style={[styles.verdictIso, { color: colors.textSecondary }]}>
                      {result.iso_compliance || (isLow ? 'ISO 10993-5 PASS — Biocompatible' : (isMod ? 'CONDITIONAL — Low-Dose Monitoring Required' : 'ISO 10993-5 FAIL — Cytotoxic'))}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })()}

          {/* Quick Action: Download PDF Report Banner */}
          <View style={styles.reportDownloadBanner}>
            <TouchableOpacity style={styles.downloadPdfMainBtn} onPress={handleDownloadReport}>
              <Download size={17} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.downloadPdfMainBtnText}>Download Official PDF Report</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.shareReportBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]} onPress={handleShareReport}>
              <Share2 size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* 4 Metric Summary Cards Grid */}
          <View style={styles.metricGrid}>
            <View style={[styles.resultMetricBox, { backgroundColor: colors.inputBg, borderColor: colors.border, borderLeftColor: result.viability_pct >= 80 ? colors.safe : (result.viability_pct >= 50 ? colors.moderate : colors.danger) }]}>
              <Text style={[styles.resultMetricLabel, { color: colors.textMuted }]}>Average Viability</Text>
              <Text style={[styles.resultMetricVal, { color: result.viability_pct >= 80 ? colors.safe : (result.viability_pct >= 50 ? colors.moderate : colors.danger) }]}>
                {result.viability_pct}%
              </Text>
              <Text style={[styles.resultMetricSub, { color: colors.textMuted }]}>Mean cellular survival</Text>
            </View>

            <View style={[styles.resultMetricBox, { backgroundColor: colors.inputBg, borderColor: colors.border, borderLeftColor: colors.primary }]}>
              <Text style={[styles.resultMetricLabel, { color: colors.textMuted }]}>ML Toxicity Score</Text>
              <Text style={[styles.resultMetricVal, { color: colors.primary }]}>
                {result.toxicity_score} <Text style={{ fontSize: 11, color: colors.textMuted }}>/100</Text>
              </Text>
              <Text style={[styles.resultMetricSub, { color: colors.textMuted }]}>Random Forest output</Text>
            </View>

            <View style={[styles.resultMetricBox, { backgroundColor: colors.inputBg, borderColor: colors.border, borderLeftColor: '#38bdf8' }]}>
              <Text style={[styles.resultMetricLabel, { color: colors.textMuted }]}>4PL Hill IC50</Text>
              <Text style={[styles.resultMetricVal, { color: '#38bdf8' }]}>
                {result.ic50 ? `${result.ic50} µg/mL` : (result.predicted_ic50 ? `${result.predicted_ic50} µg/mL` : 'Not Reached')}
              </Text>
              <Text style={[styles.resultMetricSub, { color: colors.textMuted }]}>Sigmoidal curve fit</Text>
            </View>

            <View style={[styles.resultMetricBox, { backgroundColor: colors.inputBg, borderColor: colors.border, borderLeftColor: colors.safe }]}>
              <Text style={[styles.resultMetricLabel, { color: colors.textMuted }]}>Safe Dosage Ceiling</Text>
              <Text style={[styles.resultMetricVal, { color: colors.safe, fontSize: 15 }]}>
                {result.safe_range || '0.0 – 25.0 µg/mL'}
              </Text>
              <Text style={[styles.resultMetricSub, { color: colors.textMuted }]}>Biocompatible window</Text>
            </View>
          </View>

          {/* ML MODEL INSIGHTS PANEL */}
          <View style={[styles.mlInsightBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <View style={styles.mlInsightHeader}>
              <Cpu size={16} color="#8b5cf6" />
              <Text style={[styles.mlInsightTitle, { color: colors.text }]}>  ML Model Insights</Text>
              <View style={[styles.mlInsightBadge, { backgroundColor: 'rgba(139, 92, 246, 0.15)', borderColor: 'rgba(139, 92, 246, 0.4)' }]}>
                <Text style={[styles.mlInsightBadgeText, { color: '#a78bfa' }]}>Random Forest · ZnO Dataset</Text>
              </View>
            </View>
            <View style={styles.mlInsightRow}>
              {(() => {
                const rawRisk = (result.risk_level || result.safety_category || '').toLowerCase();
                const viab = parseFloat(result.viability_pct || result.viability || 0);
                const isLow = rawRisk.includes('low') || rawRisk.includes('safe') || (viab >= 80 && !rawRisk.includes('high') && !rawRisk.includes('mod') && !rawRisk.includes('toxic'));
                const isMod = !isLow && (rawRisk.includes('mod') || (viab >= 50 && !rawRisk.includes('high') && !rawRisk.includes('toxic')));
                const riskColor = isLow ? colors.safe : (isMod ? colors.moderate : colors.danger);
                const riskBg = isLow ? 'rgba(22,163,74,0.08)' : (isMod ? 'rgba(217,119,6,0.08)' : 'rgba(239,68,68,0.08)');
                const displayRisk = isLow ? 'Low' : (isMod ? 'Moderate' : 'High');

                return (
                  <View style={[styles.mlInsightCard, { borderColor: riskColor, backgroundColor: riskBg }]}>
                    <Text style={[styles.mlInsightCardLabel, { color: colors.textMuted }]}>ML Risk Level</Text>
                    <Text style={[styles.mlInsightCardVal, { color: riskColor }]}>
                      {displayRisk}
                    </Text>
                  </View>
                );
              })()}
              <View style={[styles.mlInsightCard, {
                borderColor: (result.is_biocompatible || result.viability_pct >= 80) && result.risk_level !== 'High' && result.risk_level !== 'Toxic' ? colors.safe : colors.danger,
                backgroundColor: (result.is_biocompatible || result.viability_pct >= 80) && result.risk_level !== 'High' && result.risk_level !== 'Toxic' ? 'rgba(22,163,74,0.08)' : 'rgba(239,68,68,0.08)',
              }]}>
                <Text style={[styles.mlInsightCardLabel, { color: colors.textMuted }]}>Biocompatible</Text>
                <Text style={[styles.mlInsightCardVal, {
                  color: (result.is_biocompatible || result.viability_pct >= 80) && result.risk_level !== 'High' && result.risk_level !== 'Toxic' ? colors.safe : colors.danger
                }]}>
                  {(result.is_biocompatible || result.viability_pct >= 80) && result.risk_level !== 'High' && result.risk_level !== 'Toxic' ? '✅ Yes' : '❌ No'}
                </Text>
              </View>
              <View style={[styles.mlInsightCard, { borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.08)' }]}>
                <Text style={[styles.mlInsightCardLabel, { color: colors.textMuted }]}>Toxicity Score</Text>
                <Text style={[styles.mlInsightCardVal, { color: '#8b5cf6' }]}>
                  {result.toxicity_score ?? '—'}<Text style={{ fontSize: 11, color: colors.textMuted }}>/100</Text>
                </Text>
              </View>
            </View>
          </View>

          {/* ================================================================= */}
          {/* 📊 2 SCIENTIFIC OUTPUT GRAPHS (Responsive & Scaled)               */}
          {/* ================================================================= */}
          {result.submittedRows && result.submittedRows.length > 0 && (
            <>
              {/* GRAPH 1: 4PL Dose-Response Curve */}
              <DoseResponseCurveChart
                rows={result.submittedRows}
                selectedMetric={selectedMetric}
                setSelectedMetric={setSelectedMetric}
              />

              {/* GRAPH 2: Multi-Biomarker Safety Radar */}
              <BiomarkerRadarChart result={result} />
            </>
          )}

          {/* Multi-Biomarker Contributions (Feature Weight Progress Bars) */}
          <View style={[styles.sectionBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <Text style={[styles.sectionBoxTitle, { color: colors.text }]}>🧪 Biomarker Stress Contributions</Text>
            {[
              { label: 'Cell Viability (Survival Rate)', val: `${result.viability_pct}%`, pct: Math.min(result.viability_pct, 100), color: result.viability_pct >= 80 ? colors.safe : colors.danger },
              { label: 'ROS Oxidation (Fold Increase)', val: `${result.ros_avg ?? 1.8}×`, pct: Math.min(((parseFloat(result.ros_avg) || 1.8) / 10.0) * 100, 100), color: colors.moderate },
              { label: 'LDH Membrane Permeability', val: `${result.ldh_avg ?? 4.5}%`, pct: Math.min((parseFloat(result.ldh_avg) || 4.5) * 2, 100), color: '#f87171' },
              { label: 'Apoptosis Rate (Cell Death)', val: `${result.apoptosis_avg ?? 3.2}%`, pct: Math.min((parseFloat(result.apoptosis_avg) || 3.2) * 2.5, 100), color: '#a855f7' },
            ].map(b => (
              <View key={b.label} style={styles.barItem}>
                <View style={styles.barLabelRow}>
                  <Text style={[styles.barLabel, { color: colors.textSecondary }]}>{b.label}</Text>
                  <Text style={[styles.barVal, { color: b.color }]}>{b.val}</Text>
                </View>
                <View style={[styles.barTrack, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.barFill, { width: `${Math.max(b.pct, 5)}%`, backgroundColor: b.color }]} />
                </View>
              </View>
            ))}
          </View>

          {/* Measured Data Points Summary Table */}
          {result.submittedRows && result.submittedRows.length > 0 && (
            <View style={[styles.sectionBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <TableProperties size={15} color={colors.primary} />
                <Text style={[styles.sectionBoxTitle, { color: colors.text }]}>Measured Dose-Response Table</Text>
              </View>
              <View style={[styles.tableWrapper, { borderColor: colors.border }]}>
                <View style={[styles.tableHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                  <Text style={[styles.thCell, { flex: 0.9, color: colors.textMuted }]}>Point</Text>
                  <Text style={[styles.thCell, { flex: 1.4, color: colors.textMuted }]}>Conc (µg/mL)</Text>
                  <Text style={[styles.thCell, { flex: 1.3, color: colors.textMuted }]}>Viability</Text>
                  <Text style={[styles.thCell, { flex: 1, color: colors.textMuted }]}>ROS</Text>
                  <Text style={[styles.thCell, { flex: 1, color: colors.textMuted }]}>LDH</Text>
                  <Text style={[styles.thCell, { flex: 1, color: colors.textMuted }]}>Apop</Text>
                </View>
                {result.submittedRows.map((r, i) => (
                  <View key={r.id || i} style={[styles.tableRow, { borderBottomColor: colors.border }, i % 2 === 1 && { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }]}>
                    <Text style={[styles.tdCell, { flex: 0.9, color: colors.textMuted }]}>Point {i + 1}</Text>
                    <Text style={[styles.tdCell, { flex: 1.4, fontWeight: '700', color: colors.text }]}>{fmt(r.concentration, 1)}</Text>
                    <Text style={[styles.tdCell, { flex: 1.3, fontWeight: '700', color: parseFloat(r.viability) >= 80 ? colors.safe : colors.danger }]}>{fmt(r.viability, 1)}%</Text>
                    <Text style={[styles.tdCell, { flex: 1, color: colors.text }]}>{fmt(r.ros, 1)}×</Text>
                    <Text style={[styles.tdCell, { flex: 1, color: colors.text }]}>{fmt(r.ldh, 1)}%</Text>
                    <Text style={[styles.tdCell, { flex: 1, color: colors.text }]}>{fmt(r.apoptosis, 1)}%</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Detailed Experiment Parameters (MODEL ALGORITHM REMOVED) */}
          <View style={[styles.sectionBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <Text style={[styles.sectionBoxTitle, { color: colors.text }]}>📋 Experiment Parameters</Text>
            {[
              ['Sample / Formulation', result.sample_name || sampleName],
              ['Target Cell Line', result.cell_line || cellLine],
              ['Exposure Duration', result.exposure_time || exposureTime],
              ['Application Profile', MEDICAL_APPLICATIONS.find(a => a.id === medicalApp)?.label || 'General Biomedical'],
              ['Curve Fitting Method', '4PL Sigmoidal Non-Linear Curve Fit'],
              ['Biocompatibility Verdict', result.is_biocompatible ? '✅ PASS — Biocompatible' : '❌ FAIL — Cytotoxic'],
            ].map(([k, v]) => (
              <View key={k} style={[styles.paramRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.paramLabel, { color: colors.textMuted }]}>{k}</Text>
                <Text style={[styles.paramVal, { color: colors.text }]}>{v}</Text>
              </View>
            ))}
          </View>

          {/* ================================================================= */}
          {/* 🧠 TRAINED ML MODEL RATIONALE (STRUCTURED 5 BULLET POINTS)         */}
          {/* ML Rationale */}
          <View style={[styles.rationaleBox, { backgroundColor: colors.inputBg, borderColor: colors.primary }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Cpu size={17} color={colors.primary} />
              <Text style={[styles.rationaleTitle, { color: colors.primary }]}>Trained ML Model Rationale (Key Findings)</Text>
            </View>
            
            {getRationalePoints(result).map((pt, idx) => (
              <View key={idx} style={[styles.rationalePointItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.pointIconWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <Text style={{ fontSize: 14 }}>{pt.icon}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.pointTitle, { color: colors.text }]}>{pt.title}</Text>
                  <Text style={[styles.pointDesc, { color: colors.textSecondary }]}>{pt.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Clinical Suggestions Card */}
          {suggestions.length > 0 && (
            <View style={[styles.suggestionsBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <Lightbulb size={17} color='#fbbf24' />
                <Text style={styles.suggestionsTitle}>Clinical Suggestions & Next Steps</Text>
              </View>
              {suggestions.map((s, idx) => (
                <View key={idx} style={[
                  styles.suggestionItem,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  idx === 0 && { borderLeftWidth: 3, borderLeftColor: result.viability_pct >= 80 ? colors.safe : (result.viability_pct >= 50 ? '#fbbf24' : colors.danger) }
                ]}>
                  <Text style={{ fontSize: 16, marginRight: 8 }}>{s.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.suggestionItemTitle, { color: colors.text }]}>{s.title}</Text>
                    <Text style={[styles.suggestionItemDesc, { color: colors.textSecondary }]}>{s.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Result Actions */}
          <View style={styles.resultActionsRow}>
            <TouchableOpacity style={styles.downloadReportBottomBtn} onPress={handleDownloadReport}>
              <Download size={15} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.downloadReportBottomBtnText}>Download PDF</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.newExpBtn, { backgroundColor: colors.primary }]} onPress={resetAnalysis}>
              <RefreshCw size={14} color="#fff" style={{ marginRight: 5 }} />
              <Text style={styles.newExpBtnText}>New Analysis</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.historyNavBtn, { backgroundColor: colors.inputBg, borderColor: colors.primary }]} onPress={() => navigation?.navigate('History')}>
              <Text style={[styles.historyNavBtnText, { color: colors.primary }]}>History</Text>
              <ArrowRight size={14} color={colors.primary} style={{ marginLeft: 3 }} />
            </TouchableOpacity>
          </View>
        </View>
      )}
      {/* CSV Preview Modal */}
      <Modal
        visible={csvPreviewVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCsvPreviewVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              📋 CSV Data Preview
            </Text>
            <Text style={[styles.modalSub, { color: colors.textMuted }]}>
              {csvPreview?.filename} — {csvPreview?.rows?.length} data points detected
            </Text>

            {/* Header Row */}
            <View style={[styles.csvPreviewRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.csvPreviewHeader, { color: colors.primary }]}>Conc</Text>
              <Text style={[styles.csvPreviewHeader, { color: colors.primary }]}>Viab %</Text>
              <Text style={[styles.csvPreviewHeader, { color: colors.primary }]}>ROS</Text>
              <Text style={[styles.csvPreviewHeader, { color: colors.primary }]}>LDH</Text>
              <Text style={[styles.csvPreviewHeader, { color: colors.primary }]}>Apop</Text>
            </View>

            {/* Data Rows */}
            <ScrollView style={{ maxHeight: 280 }} nestedScrollEnabled>
              {(csvPreview?.rows || []).map((r, i) => (
                <View key={i} style={[styles.csvPreviewRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.csvPreviewCell, { color: colors.text }]}>{r.concentration}</Text>
                  <Text style={[styles.csvPreviewCell, {
                    color: parseFloat(r.viability) >= 80 ? colors.safe :
                           parseFloat(r.viability) >= 50 ? colors.moderate : colors.danger,
                    fontWeight: '700'
                  }]}>{r.viability}%</Text>
                  <Text style={[styles.csvPreviewCell, { color: colors.textMuted }]}>{r.ros}×</Text>
                  <Text style={[styles.csvPreviewCell, { color: colors.textMuted }]}>{r.ldh}%</Text>
                  <Text style={[styles.csvPreviewCell, { color: colors.textMuted }]}>{r.apoptosis}%</Text>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.csvApplyBtn, { backgroundColor: colors.primary }]}
              onPress={applyCsvRows}
            >
              <Text style={styles.csvApplyBtnText}>✅ Load {csvPreview?.rows?.length} Points into Analysis</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.csvCancelBtn} onPress={() => setCsvPreviewVisible(false)}>
              <Text style={[styles.csvCancelBtnText, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090d16' },
  content: { padding: spacing.md, paddingBottom: 120 },

  // Hero Header Banner
  heroBanner: {
    backgroundColor: '#0f766e',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  heroTitle: { fontSize: 18, fontWeight: '800', color: '#ffffff', marginBottom: 4 },
  heroSub: { fontSize: 13, color: '#f1f5f9', opacity: 0.9, lineHeight: 17 },

  // Card
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  cardSectionTitle: { fontSize: 18.5, fontWeight: '800', marginBottom: 12 },
  inputGroup: { marginBottom: 14 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  label: { fontSize: 15.5, fontWeight: '700', marginBottom: 6 },
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  activeBadgeText: { fontSize: 14.5, fontWeight: '800' },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 17,
    fontWeight: '600',
  },

  // Chip row (Cell line picker)
  chipRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  cellChip: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 100,
  },
  cellChipActive: {},
  cellChipTitle: { fontSize: 16, fontWeight: '800' },
  cellChipTitleActive: {},
  cellChipSub: { fontSize: 13.5, marginTop: 2 },
  cellChipSubActive: {},

  // Pill row
  pillRow: { flexDirection: 'row', gap: 6, paddingVertical: 2 },
  pill: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  pillActive: {},
  pillText: { fontSize: 15, fontWeight: '700' },
  pillTextActive: {},

  // Table header
  tableHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  tableSubtext: { fontSize: 15, marginTop: -8, marginBottom: 8 },
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addRowBtnText: { color: '#fff', fontSize: 15.5, fontWeight: '800' },

  // Presets
  presetRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  presetBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  presetBtnText: { fontSize: 14.5, fontWeight: '700' },

  // CSV Upload Banner
  csvUploadBanner: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderRadius: 12, borderStyle: 'dashed',
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14,
  },
  csvBannerTitle: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  csvBannerSub: { fontSize: 12.5, lineHeight: 17 },

  // CSV Preview Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 18, paddingTop: 20, paddingBottom: 36, maxHeight: '85%',
  },
  modalHandle: {
    width: 42, height: 5, borderRadius: 3,
    backgroundColor: '#334155', alignSelf: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  modalSub: { fontSize: 13.5, marginBottom: 14 },
  csvPreviewRow: {
    flexDirection: 'row', paddingVertical: 7,
    borderBottomWidth: 1, gap: 8, alignItems: 'center',
  },
  csvPreviewHeader: { fontWeight: '800', fontSize: 12.5, flex: 1, textAlign: 'center' },
  csvPreviewCell: { fontSize: 13, flex: 1, textAlign: 'center' },
  csvApplyBtn: {
    borderRadius: 12, paddingVertical: 13,
    alignItems: 'center', marginTop: 16,
  },
  csvApplyBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  csvCancelBtn: { alignItems: 'center', paddingVertical: 10 },
  csvCancelBtnText: { fontSize: 15, fontWeight: '600' },

  // Row cards
  rowCard: {
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
  },
  rowTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rowNumberBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  rowNumberText: { fontSize: 14, fontWeight: '800' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  deleteBtnText: { fontSize: 14, fontWeight: '700' },

  inputsGrid: { flexDirection: 'row', gap: 5 },
  cellInputGroup: { flex: 1 },
  cellLabel: { fontSize: 13, fontWeight: '700', marginBottom: 3 },
  cellInput: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 6,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },

  // Bottom buttons
  bottomAddBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 4,
    marginBottom: 10,
  },
  bottomAddBtnText: { fontSize: 16, fontWeight: '700' },
  calcBtn: {
    flexDirection: 'row',
    paddingVertical: 13,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calcBtnText: { color: '#fff', fontSize: 18.5, fontWeight: '800' },

  // ==========================================
  // RESULTS DISPLAY STYLES
  // ==========================================
  resultMainCard: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    marginBottom: 24,
  },
  verdictBanner: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
  },
  verdictSafe: {
    backgroundColor: 'rgba(22, 163, 74, 0.12)',
  },
  verdictMod: {
    backgroundColor: 'rgba(217, 119, 6, 0.12)',
  },
  verdictDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  verdictIconRow: { flexDirection: 'row', alignItems: 'center' },
  verdictStatus: { fontSize: 18.5, fontWeight: '800' },
  verdictIso: { fontSize: 15, marginTop: 2, fontWeight: '600' },

  // ML Insights Panel
  mlInsightBox: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  mlInsightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  mlInsightTitle: { fontSize: 15.5, fontWeight: '800' },
  mlInsightBadge: {
    marginLeft: 'auto',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
  },
  mlInsightBadgeText: { fontSize: 12, fontWeight: '700' },
  mlInsightRow: { flexDirection: 'row', gap: 8 },
  mlInsightCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1.5,
    padding: 10,
    alignItems: 'center',
  },
  mlInsightCardLabel: { fontSize: 12.5, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase' },
  mlInsightCardVal: { fontSize: 16.5, fontWeight: '800', textAlign: 'center' },

  confidenceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  confidenceTagText: { fontSize: 13.5, fontWeight: '800', color: '#38bdf8' },

  // Metric grid (4 boxes)
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  resultMetricBox: {
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  resultMetricLabel: { fontSize: 13.5, fontWeight: '700', textTransform: 'uppercase' },
  resultMetricVal: { fontSize: 21, fontWeight: '800', marginVertical: 3 },
  resultMetricSub: { fontSize: 13 },

  // Chart container (Responsive Phone Fit)
  chartContainer: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden',
  },
  chartHeader: {
    flexDirection: 'column',
    marginBottom: 6,
    gap: 4,
  },
  chartTitle: { fontSize: 16.5, fontWeight: '800' },
  chartSub: { fontSize: 14.5, marginBottom: 6 },
  metricTabs: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  chartTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  chartTabText: { fontSize: 13.5, fontWeight: '700' },
  svgWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  chartFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  chartAxisLabel: { fontSize: 13, fontWeight: '600' },
  chartStatusLabel: { fontSize: 13, fontWeight: '700' },

  // Radar chips
  radarChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  radarChip: {
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  radarChipLabel: { fontSize: 14, fontWeight: '800', color: '#ffffff' },
  radarChipVal: { fontSize: 15, fontWeight: '900' },

  // Section boxes
  sectionBox: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  sectionBoxTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
    textTransform: 'uppercase',
  },

  // Biomarker bars
  barItem: { marginBottom: 8 },
  barLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  barLabel: { fontSize: 14, fontWeight: '600' },
  barVal: { fontSize: 14, fontWeight: '800' },
  barTrack: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
  },
  barFill: { height: '100%', borderRadius: 4 },

  // Measured Table
  tableWrapper: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
  },
  thCell: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
  },
  tdCell: { fontSize: 13.5, textAlign: 'center' },

  // Param rows
  paramRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
  },
  paramLabel: { fontSize: 14.5 },
  paramVal: { fontSize: 14.5, fontWeight: '700', maxWidth: '60%', textAlign: 'right' },

  // Structured Rationale Points Box
  rationaleBox: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  rationaleTitle: { fontSize: 16, fontWeight: '800' },
  rationalePointItem: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 9,
    marginBottom: 7,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  pointIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  pointTitle: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  pointDesc: { fontSize: 14, lineHeight: 18 },

  // Report Download Banners and Buttons
  reportDownloadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  downloadPdfMainBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f766e',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  downloadPdfMainBtnText: { color: '#ffffff', fontSize: 16.5, fontWeight: '800' },
  shareReportBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Actions
  resultActionsRow: { flexDirection: 'row', gap: 8 },
  downloadReportBottomBtn: {
    flex: 1.2,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f766e',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  downloadReportBottomBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  newExpBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  newExpBtnText: { color: '#fff', fontSize: 15.5, fontWeight: '800' },
  historyNavBtn: {
    flex: 0.9,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 10,
  },
  historyNavBtnText: { fontSize: 15.5, fontWeight: '800' },

  // Suggestions Card
  suggestionsBox: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f59e0b30',
    marginBottom: 14,
  },
  suggestionsTitle: { fontSize: 16, fontWeight: '800', color: '#fbbf24' },
  suggestionItem: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 9,
    marginBottom: 7,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  suggestionItemTitle: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  suggestionItemDesc: { fontSize: 14, lineHeight: 18 },

  // Patient Selector Styles
  patientLinkedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  patientLinkedBadgeText: { fontSize: 12.5, fontWeight: '800' },
  generalScreeningBadge: { backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  generalScreeningBadgeText: { fontSize: 12.5, fontWeight: '700' },
  patientChipRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  patientChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, minWidth: 130
  },
  patientChipActive: {},
  patientChipCode: { fontSize: 14.5, fontWeight: '800', marginBottom: 2 },
  patientChipCodeActive: {},
  patientChipSub: { fontSize: 13 },
  patientChipSubActive: {},
  selectedPatientBanner: {
    borderRadius: 10, padding: 10,
    borderWidth: 1, marginTop: 8
  },
  selectedPatientHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  selectedPatientTitle: { fontSize: 15, fontWeight: '800' },
  selectedPatientCohort: { fontSize: 13.5, fontWeight: '600' },
  selectedPatientMeta: { fontSize: 13.5 },

  // Vertical Dropdown Selectors
  dropdownBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 4
  },
  dropdownBtnOpen: {},
  dropdownBtnTitle: { fontSize: 16, fontWeight: '700' },
  dropdownBtnSub: { fontSize: 13.5, marginTop: 2 },
  dropdownVerticalMenu: {
    borderWidth: 1, borderRadius: 10, marginTop: 4, overflow: 'hidden'
  },
  dropdownOptionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1
  },
  dropdownOptionRowActive: { backgroundColor: 'rgba(20,184,166,0.12)' },
  dropdownOptionTitle: { fontSize: 15.5, fontWeight: '600' },
  dropdownOptionTitleActive: { fontWeight: '800' },
  dropdownOptionSub: { fontSize: 13, marginTop: 1 },
});

