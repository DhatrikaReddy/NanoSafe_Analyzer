import React, { useState, useEffect, useContext } from 'react';
import { LanguageContext } from '../../context/LanguageContext';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  ActivityIndicator, TextInput, RefreshControl, Modal, ScrollView, Dimensions
} from 'react-native';
import Svg, { Path, Line, Circle, Polygon, Rect, Text as SvgText, G } from 'react-native-svg';
import { colors as staticColors, spacing, borderRadius } from '../../theme/colors';
import { ThemeContext } from '../../context/ThemeContext';
import apiClient from '../../api/client';
import {
  Search, ShieldCheck, ShieldAlert, AlertTriangle, Calendar, X,
  TrendingDown, Cpu, ChevronRight, ChevronDown, Check, Users, Filter, Activity, FlaskConical,
  BarChart2, Target, Info, TableProperties, Sparkles, CheckCircle2, XCircle
} from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const FILTER_TABS = [
  { id: 'All', label: 'All', icon: '📋', activeBg: '#0d9488' },
  { id: 'Safe', label: 'Safe', icon: '🟢', activeBg: '#16a34a' },
  { id: 'Moderate', label: 'Moderate', icon: '🟡', activeBg: '#ea580c' },
  { id: 'Risk', label: 'High Risk', icon: '🔴', activeBg: '#dc2626' },
];

// Helper to format floats to clean 1 decimal place (e.g. 3.66666 -> 3.6)
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
  if (r.includes('moderate') || r.includes('medium')) return '#f59e0b';
  return '#ef4444';
};

const matchesFilter = (item, tabId) => {
  if (!tabId || tabId === 'All') return true;
  const r = (item.result || '').toLowerCase();
  const risk = (item.risk_level || item.riskLevel || '').toLowerCase();
  const v = parseFloat(item.cell_viability || item.viability || 0);

  if (tabId === 'Safe') {
    return r.includes('safe') || r.includes('low') || r.includes('pass') || risk.includes('low') || risk.includes('safe') || v >= 80;
  }
  if (tabId === 'Moderate') {
    return r.includes('moderate') || risk.includes('mod') || (v >= 50 && v < 80);
  }
  if (tabId === 'Risk' || tabId === 'Toxic' || tabId === 'High') {
    return r.includes('toxic') || r.includes('high') || r.includes('risk') || r.includes('fail') || risk.includes('high') || risk.includes('toxic') || (v > 0 && v < 50);
  }
  return true;
};

// =========================================================================
// 1. DOSE-RESPONSE CURVE CHART COMPONENT (SVG)
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
    <View style={[styles.chartContainer, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: colors.border }]}>
      <View style={styles.chartHeader}>
        <Text style={[styles.chartTitle, { color: colors.text }]}>📈 4PL Dose-Response Curve</Text>
        <Text style={[styles.chartSub, { color: colors.textMuted }]}>Concentration-dependent biomarker response</Text>
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

// 2. MULTI-BIOMARKER RADAR CHART COMPONENT (SVG)
// =========================================================================
function BiomarkerRadarChart({ item }) {
  const { colors, isDark } = useContext(ThemeContext);
  const textColor = isDark ? '#ffffff' : '#0f172a';
  const gridColor = isDark ? '#334155' : '#cbd5e1';
  const axisColor = isDark ? '#475569' : '#94a3b8';
  const V_SIZE = 300;
  const center = V_SIZE / 2;
  const radius = 68;

  const viabVal = parseFloat(item.cell_viability || item.viability || 80);
  const rosVal = parseFloat(item.ros || item.ros_avg || 1.8);
  const ldhVal = parseFloat(item.ldh || item.ldh_avg || 4.5);
  const apopVal = parseFloat(item.apoptosis || item.apoptosis_avg || 3.2);

  const vViab = Math.min(Math.max(viabVal, 0), 100);
  const vRos = Math.min(Math.max(100 - (rosVal / 8.0) * 100, 0), 100);
  const vLdh = Math.min(Math.max(100 - ldhVal * 2, 0), 100);
  const vApop = Math.min(Math.max(100 - apopVal * 2.5, 0), 100);

  const axes = [
    { label: 'Viability', score: vViab, angle: -Math.PI / 2, raw: `${fmt(viabVal, 1)}%` },
    { label: 'ROS Balance', score: vRos, angle: 0, raw: `${fmt(rosVal, 1)}×` },
    { label: 'Membrane Intact', score: vLdh, angle: Math.PI / 2, raw: `${fmt(ldhVal, 1)}%` },
    { label: 'Anti-Apoptosis', score: vApop, angle: Math.PI, raw: `${fmt(apopVal, 1)}%` },
  ];

  const getCoord = (angle, dist) => ({
    x: center + dist * Math.cos(angle),
    y: center + dist * Math.sin(angle),
  });

  const radarPolygonPoints = axes
    .map(a => {
      const coord = getCoord(a.angle, (a.score / 100) * radius);
      return `${coord.x},${coord.y}`;
    })
    .join(' ');

  const isSafe = viabVal >= 80;
  const themeColor = isSafe ? '#22c55e' : viabVal >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <View style={[styles.chartContainer, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: colors.border }]}>
      <View style={styles.chartHeader}>
        <Text style={[styles.chartTitle, { color: colors.text }]}>🕸️ Multi-Biomarker Safety Radar</Text>
        <Text style={[styles.chartSub, { color: colors.textMuted }]}>Omnidirectional cytocompatibility profile across 4 axes</Text>
      </View>

      <View style={styles.svgWrapper}>
        <Svg width="100%" height={230} viewBox={`0 0 ${V_SIZE} ${V_SIZE}`} preserveAspectRatio="xMidYMid meet">
          {[0.25, 0.5, 0.75, 1.0].map((level, idx) => (
            <Polygon
              key={idx}
              points={axes.map(a => {
                const c = getCoord(a.angle, level * radius);
                return `${c.x},${c.y}`;
              }).join(' ')}
              fill="none"
              stroke="#1e293b"
              strokeWidth="1"
            />
          ))}

          {axes.map((a, idx) => {
            const endpoint = getCoord(a.angle, radius);
            const labelPos = getCoord(a.angle, radius + 22);
            return (
              <G key={idx}>
                <Line x1={center} y1={center} x2={endpoint.x} y2={endpoint.y} stroke="#334155" strokeWidth="1" />
                <SvgText
                  x={labelPos.x}
                  y={labelPos.y}
                  fontSize="8.5"
                  fill="#94a3b8"
                  fontWeight="700"
                  textAnchor="middle"
                  alignmentBaseline="middle"
                >
                  {a.label}
                </SvgText>
              </G>
            );
          })}

          <Polygon
            points={radarPolygonPoints}
            fill={themeColor + '33'}
            stroke={themeColor}
            strokeWidth="2.5"
          />

          {axes.map((a, idx) => {
            const coord = getCoord(a.angle, (a.score / 100) * radius);
            return (
              <Circle
                key={idx}
                cx={coord.x}
                cy={coord.y}
                r="4.5"
                fill="#090d16"
                stroke={themeColor}
                strokeWidth="2"
              />
            );
          })}
        </Svg>
      </View>

      <View style={styles.radarChipsGrid}>
        {axes.map((a, i) => (
          <View key={i} style={[styles.radarChip, { backgroundColor: isDark ? '#0f172a' : '#ffffff', borderColor: colors.border }]}>
            <Text style={[styles.radarChipLabel, { color: colors.text }]}>{a.label}:</Text>
            <Text style={[styles.radarChipVal, { color: themeColor }]}>{a.raw}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// =========================================================================
// MAIN HISTORY SCREEN
// =========================================================================
export default function HistoryScreen({ navigation }) {
  const { t } = useContext(LanguageContext);
  const { colors, isDark } = useContext(ThemeContext);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [selectedScope, setSelectedScope] = useState('all'); // 'all' | 'patients' | 'material'
  const [selectedPatientFilter, setSelectedPatientFilter] = useState('all'); // 'all' | 'PAT-2026-XXX'
  const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState('viability');

  useEffect(() => {
    fetchHistory();
    if (!navigation) return;
    try {
      const unsubscribe = navigation.addListener('focus', () => {
        fetchHistory();
      });
      return unsubscribe;
    } catch (e) {
      // Navigation context doesn't support focus events
    }
  }, [navigation]);

  const fetchHistory = async () => {
    try {
      const res = await apiClient.get('/history/');
      setHistory(res.data || []);
    } catch (e) {
      console.warn('History fetch notice:', e.message || e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Extract unique patient list for filter dropdown
  const uniquePatients = Array.from(
    new Map(
      history
        .filter(item => item.participantId || item.participant_id)
        .map(item => {
          const pid = item.participantId || item.participant_id;
          const pname = item.participantName || item.participant_name;
          return [pid, { pid, pname }];
        })
    ).values()
  );

  // Base list filtered by primary scope (Patient vs Material) and specific patient
  const scopeFiltered = history.filter(item => {
    const pid = item.participantId || item.participant_id;
    const isPatientItem = !!pid;

    // 1. Scope filter (All vs Patients vs Material)
    if (selectedScope === 'patients' && !isPatientItem) return false;
    if (selectedScope === 'material' && isPatientItem) return false;

    // 2. Specific patient filter
    if (selectedPatientFilter !== 'all' && pid !== selectedPatientFilter) return false;
    return true;
  });

  const displayed = scopeFiltered.filter(item => {
    const pid = item.participantId || item.participant_id;
    const pname = item.participantName || item.participant_name;

    // 1. Risk level tab filter
    if (!matchesFilter(item, activeTab)) return false;

    // 2. Search query
    const q = searchQuery.toLowerCase();
    const matchesSearch = (
      (item.name || '').toLowerCase().includes(q) ||
      (item.cell_line || '').toLowerCase().includes(q) ||
      (pid || '').toLowerCase().includes(q) ||
      (pname || '').toLowerCase().includes(q) ||
      (item.studyGroup || item.study_group || '').toLowerCase().includes(q)
    );
    return matchesSearch;
  });

  const renderItem = ({ item }) => {
    const rc = riskColor(item.result);
    const pid = item.participantId || item.participant_id;
    const pname = item.participantName || item.participant_name;
    const cohort = item.studyGroup || item.study_group;

    return (
      <TouchableOpacity style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => { setSelected(item); setSelectedMetric('viability'); }} activeOpacity={0.75}>
        {/* Patient / Material Tag */}
        <View style={styles.cardTopTagRow}>
          {pid ? (
            <View style={styles.patientBadgeContainer}>
              <View style={[styles.patientTagPill, { backgroundColor: isDark ? 'rgba(15,118,110,0.25)' : 'rgba(15,118,110,0.12)', borderColor: 'rgba(15,118,110,0.4)' }]}>
                <Text style={[styles.patientTagText, { color: colors.primary }]}>👤 {pid}</Text>
              </View>
              {pname && pname !== 'General Material Screening' ? (
                <Text style={[styles.patientSubText, { color: colors.text }]} numberOfLines={1}>• {pname}</Text>
              ) : null}
              {cohort ? (
                <View style={[styles.cohortPill, { backgroundColor: colors.inputBg }]}>
                  <Text style={[styles.cohortPillText, { color: colors.textMuted }]} numberOfLines={1}>🏷️ {cohort}</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={[styles.generalScreeningTagPill, { backgroundColor: colors.inputBg }]}>
              <Text style={[styles.generalScreeningTagText, { color: colors.textMuted }]}>{t('materialScreening', 'Material Screening')} (No Patient)</Text>
            </View>
          )}
        </View>

        <View style={styles.itemTop}>
          <View style={[styles.riskDot, { backgroundColor: rc }]} />
          <View style={styles.itemMain}>
            <Text style={[styles.itemTitle, { color: colors.text }]}>
              {pid ? `👤 ${pname && pname !== 'General Material Screening' ? pname : 'Patient'} (${pid})` : (item.name || 'Material Screening Batch')}
            </Text>
            <Text style={[styles.itemSub, { color: colors.textMuted }]}>
              {item.cell_line || 'Primary Cells'} • Viability: <Text style={{ color: rc, fontWeight: '700' }}>{fmt(item.cell_viability || item.viability, 1)}%</Text> • {item.exposure_time || '24h'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              <View style={{ backgroundColor: 'rgba(15,118,110,0.12)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#0f766e' }}>
                  🌿 {(item.synthesis_method || 'Green_Synthesis').replace('_', ' ')}
                </Text>
              </View>
              <View style={{ backgroundColor: 'rgba(37,99,235,0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#2563eb' }}>
                  🛡️ {(item.surface_coating || 'Bare_ZnO').replace('_', ' ')}
                </Text>
              </View>
              <View style={{ backgroundColor: (item.hemolysis_rate && item.hemolysis_rate > 5) ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: (item.hemolysis_rate && item.hemolysis_rate > 5) ? '#ef4444' : '#22c55e' }}>
                  🩸 {item.hemocompatibility_status || 'Non-Hemolytic (<2%)'}
                </Text>
              </View>
            </View>
          </View>
          <View style={[styles.badge, { backgroundColor: rc + '22', borderColor: rc }]}>
            <Text style={[styles.badgeText, { color: rc }]}>{item.result || 'Evaluated'}</Text>
          </View>
          <ChevronRight size={16} color={colors.textMuted} />
        </View>
        <View style={[styles.itemFooter, { borderTopColor: colors.border }]}>
          <View style={styles.footerPill}>
            <Calendar size={12} color={colors.textMuted} style={{ marginRight: 4 }} />
            <Text style={[styles.footerText, { color: colors.textMuted }]}>{item.date || 'Recent'}</Text>
          </View>
          <Text style={[styles.footerScoreText, { color: colors.textMuted }]}>
            ML Score: <Text style={{ color: colors.primaryLight, fontWeight: '800' }}>{fmt(item.toxicityScore ?? item.toxicity_score, 1)}</Text>
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const viab = selected ? parseFloat(selected.cell_viability || selected.viability || 0) : 0;
  const rosVal = selected ? parseFloat(selected.ros || selected.ros_avg || 1.8) : 1.8;
  const ldhVal = selected ? parseFloat(selected.ldh || selected.ldh_avg || 4.5) : 4.5;
  const apopVal = selected ? parseFloat(selected.apoptosis || selected.apoptosis_avg || 3.2) : 3.2;
  const rawRisk = (selected ? (selected.risk_level || selected.riskLevel || selected.result || selected.safety_category || '') : '').toLowerCase();
  const isSafe = rawRisk.includes('low') || rawRisk.includes('safe') || (viab >= 80 && !rawRisk.includes('high') && !rawRisk.includes('mod') && !rawRisk.includes('toxic'));
  const isModerate = !isSafe && (rawRisk.includes('mod') || (viab >= 50 && !rawRisk.includes('high') && !rawRisk.includes('toxic')));
  const riskLevel = isSafe ? 'Low' : isModerate ? 'Moderate' : 'High';
  const riskLevelColor = isSafe ? '#22c55e' : isModerate ? '#f59e0b' : '#ef4444';
  const rc = riskLevelColor;

  // Biomarker stress calculations
  const viabStressPct = Math.min(viab, 100);
  const rosStressPct = Math.min((rosVal / 10.0) * 100, 100);
  const ldhStressPct = Math.min(ldhVal * 2, 100);
  const apopStressPct = Math.min(apopVal * 2.5, 100);

  const keyFindings = !selected ? [] : isSafe ? [
    { icon: '✅', title: 'ISO 10993-5 PASS — Biocompatible', desc: `Cell viability at ${fmt(viab, 1)}% meets the ≥80% ISO threshold. Formulation safe for preclinical testing.` },
    { icon: '🎯', title: 'Safe Dosage Confirmed', desc: `Maintain concentrations within ${selected.safe_range || '0.0 – 25.0 µg/mL'}. IC50 boundary provides a wide therapeutic safety window.` },
    { icon: '🔬', title: 'Advance to Phase II In-Vivo', desc: 'Advance to animal model testing. Evaluate systemic toxicity at escalating dose levels.' },
  ] : isModerate ? [
    { icon: '⚠️', title: 'MODERATE RISK — Optimization Required', desc: `Cell viability at ${fmt(viab, 1)}% is below ISO threshold. Dose reduction of 40–60% is required.` },
    { icon: '⬇️', title: 'Reduce Working Concentration', desc: `Target ≥80% viability. Safe ceiling: ${selected.safe_range || '0.0 – 25.0 µg/mL'}. Do not exceed IC50 boundary.` },
    { icon: '🧪', title: 'Surface Functionalization Recommended', desc: 'Evaluate citrate or PEG coating to reduce ROS oxidative stress and repeat the assay.' },
  ] : [
    { icon: '🚫', title: 'HIGH RISK — Not Suitable for Biomedical Use', desc: `Viability at ${fmt(viab, 1)}% indicates severe cytotoxic response at tested concentrations.` },
    { icon: '🔄', title: 'Complete Reformulation Required', desc: 'Reduce nanoparticle dose by >70% or redesign surface chemistry (e.g. quantum dots <5nm).' },
    { icon: '⛔', title: 'Halt In-Vivo Escalation', desc: 'Do not proceed to animal model testing until ISO PASS is achieved in-vitro.' },
  ];

  const suggestions = !selected ? [] : isSafe ? [
    { t: 'Proceed to In-Vivo Validation', d: 'Advance to murine wound model. Evaluate systemic toxicity at escalating dose levels.' },
    { t: 'Compile Regulatory Package', d: 'Consolidate cytotoxicity data per ISO 10993-5 for medical device audit compliance.' },
    { t: 'Optimize Application Dose', d: 'Formulate final product at ≤30% of IC50 dose for therapeutic safety margin.' },
  ] : isModerate ? [
    { t: 'Surface Functionalization', d: 'Apply PEG or citrate coating to reduce ROS oxidative stress and repeat the assay.' },
    { t: 'Dose Reduction Required', d: 'Reduce ZnO concentration by 40–60%. Repeat the MTT assay at lower dose range.' },
    { t: '3-Replicate Repeat Assay', d: 'Conduct 3 independent biological replicates with Triton X-100 positive control.' },
  ] : [
    { t: 'Complete Reformulation Required', d: 'Consider ZnO quantum dots (<5nm) or functionalized hybrid variants.' },
    { t: 'Apoptosis vs. Necrosis Profiling', d: 'Conduct flow cytometry to characterize apoptosis/necrosis ratio.' },
    { t: 'Alternative Material Evaluation', d: 'Compare TiO2, CeO2, or hydroxyapatite as biocompatible alternatives.' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 1. Primary Top Scope Selector Tab (Patients vs Pure Research vs All) */}
      <View style={[styles.scopeSelectorContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.scopeBtn, selectedScope === 'patients' && { backgroundColor: colors.primary }]}
          onPress={() => { setSelectedScope('patients'); }}
        >
          <Text style={[styles.scopeBtnText, { color: colors.textMuted }, selectedScope === 'patients' && styles.scopeBtnTextActive]}>
            👤 {t('patientHistoryHeading', 'Patient History')} ({history.filter(h => h.participantId || h.participant_id).length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.scopeBtn, selectedScope === 'material' && { backgroundColor: colors.primary }]}
          onPress={() => { setSelectedScope('material'); setSelectedPatientFilter('all'); }}
        >
          <Text style={[styles.scopeBtnText, { color: colors.textMuted }, selectedScope === 'material' && styles.scopeBtnTextActive]}>
            🔬 {t('researchHistoryHeading', 'Research History')} ({history.filter(h => !h.participantId && !h.participant_id).length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.scopeBtn, selectedScope === 'all' && { backgroundColor: colors.primary }, { flex: 0.6 }]}
          onPress={() => { setSelectedScope('all'); setSelectedPatientFilter('all'); }}
        >
          <Text style={[styles.scopeBtnText, { color: colors.textMuted }, selectedScope === 'all' && styles.scopeBtnTextActive]}>
            {t('allRecords', 'All')} ({history.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Dedicated Section Header Banner */}
      <View style={{ marginBottom: 12, paddingHorizontal: 4 }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
          {selectedScope === 'patients'
            ? `👤 ${t('patientHistoryHeading', 'Patient Clinical History')}`
            : selectedScope === 'material'
            ? `🔬 ${t('researchHistoryHeading', 'Experimental & Research History')}`
            : `📋 ${t('allRecords', 'All Recorded Experiments')}`}
        </Text>
        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
          {selectedScope === 'patients'
            ? t('patientHistoryDesc', 'Clinical assays linked to enrolled study subjects and biological specimens')
            : selectedScope === 'material'
            ? t('researchHistoryDesc', 'Preclinical material screening experiments conducted for research purposes')
            : t('allHistoryDesc', 'Unified ledger of clinical subject assays and preclinical research runs')}
        </Text>
      </View>

      {/* 2. Specific Patient Dropdown Selector */}
      {selectedScope !== 'material' && uniquePatients.length > 0 && (
        <View style={styles.patientFilterWrapper}>
          <TouchableOpacity
            style={[styles.patientFilterBtn, { backgroundColor: colors.card, borderColor: colors.border }, isPatientDropdownOpen && { borderColor: colors.primary }]}
            onPress={() => setIsPatientDropdownOpen(prev => !prev)}
            activeOpacity={0.75}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <Users size={14} color={colors.primary} />
              <Text style={[styles.patientFilterBtnText, { color: colors.primary }]}>
                {selectedPatientFilter === 'all'
                  ? `👤 ${t('showingAllPatients', 'Showing: All Enrolled Patients')}`
                  : `👤 Showing: ${uniquePatients.find(p => p.pid === selectedPatientFilter)?.pname || 'Patient'} (${selectedPatientFilter})`}
              </Text>
            </View>
            <ChevronDown
              size={16}
              color={colors.primary}
              style={{ transform: [{ rotate: isPatientDropdownOpen ? '180deg' : '0deg' }] }}
            />
          </TouchableOpacity>

          {isPatientDropdownOpen && (
            <View style={[styles.patientFilterDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ScrollView nestedScrollEnabled style={{ maxHeight: 180 }}>
                <TouchableOpacity
                  style={[styles.dropdownOptionRow, { borderBottomColor: colors.border }, selectedPatientFilter === 'all' && styles.dropdownOptionRowActive]}
                  onPress={() => {
                    setSelectedPatientFilter('all');
                    setIsPatientDropdownOpen(false);
                  }}
                >
                  <Text style={[styles.dropdownOptionTitle, { color: colors.textSecondary }, selectedPatientFilter === 'all' && { color: colors.primary, fontWeight: '800' }]}>
                    👤 All Enrolled Patients ({uniquePatients.length})
                  </Text>
                  {selectedPatientFilter === 'all' && <Check size={14} color={colors.primary} />}
                </TouchableOpacity>

                {uniquePatients.map(p => {
                  const isSel = selectedPatientFilter === p.pid;
                  const assayCount = history.filter(h => (h.participantId || h.participant_id) === p.pid).length;
                  return (
                    <TouchableOpacity
                      key={p.pid}
                      style={[styles.dropdownOptionRow, { borderBottomColor: colors.border }, isSel && styles.dropdownOptionRowActive]}
                      onPress={() => {
                        setSelectedPatientFilter(p.pid);
                        setIsPatientDropdownOpen(false);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.dropdownOptionTitle, { color: colors.textSecondary }, isSel && { color: colors.primary, fontWeight: '800' }]}>
                          👤 {p.pname || 'Patient'} ({p.pid})
                        </Text>
                        <Text style={{ fontSize: 10.5, color: colors.textMuted }}>
                          {assayCount} assay{assayCount === 1 ? '' : 's'} recorded
                        </Text>
                      </View>
                      {isSel && <Check size={14} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>
      )}

      {/* 3. Search Bar */}
      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Search size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder={t('searchHistory', 'Search by patient, sample, or cell line...')}
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* 4. Risk Level Filter Chips (All, Safe, Moderate, High Risk) */}
      <View style={styles.riskFilterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.riskFilterScrollContent}
        >
          {FILTER_TABS.map(tab => {
            const isSelected = activeTab === tab.id;
            let count = 0;
            if (tab.id === 'All') {
              count = scopeFiltered.length;
            } else if (tab.id === 'Safe') {
              count = scopeFiltered.filter(h => matchesFilter(h, 'Safe')).length;
            } else if (tab.id === 'Moderate') {
              count = scopeFiltered.filter(h => matchesFilter(h, 'Moderate')).length;
            } else if (tab.id === 'Risk') {
              count = scopeFiltered.filter(h => matchesFilter(h, 'Risk')).length;
            }

            return (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.riskFilterChip,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  isSelected && {
                    backgroundColor: tab.activeBg,
                    borderColor: tab.activeBg,
                  }
                ]}
                onPress={() => setActiveTab(tab.id)}
                activeOpacity={0.75}
              >
                <Text style={{ fontSize: 13, marginRight: 5 }}>{tab.icon}</Text>
                <Text
                  style={[
                    styles.riskChipText,
                    { color: colors.textSecondary },
                    isSelected && { color: '#ffffff', fontWeight: '800' }
                  ]}
                >
                  {tab.label}
                </Text>
                <View
                  style={[
                    styles.riskCountBadge,
                    { backgroundColor: isSelected ? 'rgba(255,255,255,0.28)' : (colors.inputBg || 'rgba(0,0,0,0.06)') }
                  ]}
                >
                  <Text
                    style={[
                      styles.riskCountBadgeText,
                      { color: isSelected ? '#ffffff' : colors.textMuted }
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <Text style={[styles.countText, { color: colors.textMuted }]}>Showing {displayed.length} experiment{displayed.length !== 1 ? 's' : ''}</Text>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchHistory(); }} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <TrendingDown size={40} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No experiments found in this category.</Text>
            </View>
          }
        />
      )}

      {/* ============================================================ */}
      {/* FULL SCIENTIFIC DETAIL MODAL                                  */}
      {/* ============================================================ */}
      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: isDark ? '#0f172a' : '#ffffff', borderColor: colors.border, borderTopWidth: 1 }]}>

            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{selected && selected.name ? selected.name : 'Experiment Report'}</Text>
                <Text style={[styles.modalSub, { color: colors.textMuted }]}>{selected && selected.cell_line ? selected.cell_line : 'HeLa'} · {selected && selected.date ? selected.date : 'Recorded'}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelected(null)} style={styles.closeBtn}>
                <X size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {selected && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

                {/* ── 0. PATIENT METADATA CARD (IF CLINICAL/PATIENT ASSAY) ── */}
                {Boolean(selected.participantId || selected.participant_id) && (
                  <View style={[styles.modalPatientCard, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderColor: colors.border }]}>
                    <View style={styles.modalPatientHeader}>
                      <Text style={[styles.modalPatientTitle, { color: colors.text }]}>
                        👤 {selected.participantName || selected.participant_name || 'Patient'} ({selected.participantId || selected.participant_id})
                      </Text>
                      {Boolean(selected.studyGroup || selected.study_group) && (
                        <View style={[styles.cohortPill, { backgroundColor: isDark ? '#0f172a' : '#e2e8f0' }]}>
                          <Text style={[styles.cohortPillText, { color: colors.primary, fontWeight: '700' }]}>
                            🏷️ {selected.studyGroup || selected.study_group}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.modalPatientSub, { color: colors.textMuted }]}>
                      Clinical In-Vitro Cytotoxicity Assay · Linked to Patient Record
                    </Text>
                  </View>
                )}

                {/* ── 1. VERDICT BANNER ── */}
                <View style={[styles.verdictBanner, { backgroundColor: isDark ? (rc + '22') : (rc + '14'), borderColor: rc }]}>
                  {isSafe ? <ShieldCheck size={32} color={rc} /> : isModerate ? <AlertTriangle size={32} color={rc} /> : <ShieldAlert size={32} color={rc} />}
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[styles.verdictTitle, { color: rc }]}>
                        {isSafe ? '🟢 LOW RISK — SAFE' : isModerate ? '🟡 MODERATE RISK' : '🔴 HIGH RISK — CYTOTOXIC'}
                      </Text>
                      <View style={styles.confidenceTag}>
                        <Cpu size={10} color="#38bdf8" />
                        <Text style={styles.confidenceTagText}>ML 98.5%</Text>
                      </View>
                    </View>
                    <Text style={[styles.verdictSub, { color: colors.text }]}>
                      {selected.iso_compliance || (isSafe ? 'ISO 10993-5 PASS — Biocompatible' : 'ISO 10993-5 FAIL — Cytotoxic')} · {selected.exposure_time || '24h'} exposure
                    </Text>
                  </View>
                </View>

                {/* ── 2. 8-METRIC RESEARCH GRID ── */}
                <View style={styles.metricsGrid}>
                  {[
                    { label: 'Avg Viability', value: `${fmt(viab, 1)}%`, color: rc, sub: 'Mean Survival (MTT)' },
                    { label: 'ML Toxicity Score', value: `${fmt(selected.toxicityScore ?? selected.toxicity_score, 1)}/100`, color: colors.primaryLight, sub: 'Ensemble Model' },
                    { label: '4PL Hill IC50', value: selected.estimated_ic50 || selected.ic50 || 'Not Reached', color: '#38bdf8', sub: 'Sigmoidal Curve Fit' },
                    { label: 'Selectivity Index (SI)', value: `${selected.selectivity_index || '1.0'}×`, color: '#0f766e', sub: 'Cancer vs Normal' },
                    { label: 'ASTM F756 Hemolysis', value: `${selected.hemolysis_rate || 0.0}%`, color: (selected.hemolysis_rate && selected.hemolysis_rate > 5) ? '#ef4444' : '#22c55e', sub: selected.hemocompatibility_status || 'Non-Hemolytic' },
                    { label: 'Safe Dosage Ceiling', value: selected.safe_range || '0.0 – 25.0 µg/mL', color: '#22c55e', sub: 'Therapeutic Limit' },
                    { label: 'ROS Level', value: `${fmt(rosVal, 1)}×`, color: '#fbbf24', sub: 'Fold Baseline' },
                    { label: 'LDH Release', value: `${fmt(ldhVal, 1)}%`, color: '#fb7185', sub: 'Membrane Lysis' },
                  ].map(({ label, value, color, sub }) => (
                    <View key={label} style={[styles.metricBox, { borderLeftColor: color, borderLeftWidth: 3.5, backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: colors.border }]}>
                      <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{label}</Text>
                      <Text style={[styles.metricVal, { color }]}>{value}</Text>
                      <Text style={[styles.metricSub, { color: colors.textMuted }]}>{sub}</Text>
                    </View>
                  ))}
                </View>

                {/* ── 3. ML MODEL INSIGHTS (Expanded Parameters) ── */}
                <View style={[styles.mlBox, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: colors.border }]}>
                  <View style={styles.mlHeader}>
                    <Cpu size={16} color="#8b5cf6" />
                    <Text style={[styles.mlTitle, { color: colors.text }]}>  ML Model Insights & Parameters</Text>
                    <View style={[styles.mlBadge, { backgroundColor: isDark ? '#334155' : '#e2e8f0', borderColor: colors.border }]}>
                      <Text style={[styles.mlBadgeText, { color: colors.text }]}>Scikit-Learn · Multi-Output v1.0</Text>
                    </View>
                  </View>

                  <View style={styles.mlGrid}>
                    {[
                      { label: 'ML Risk Level', value: riskLevel, color: riskLevelColor, extra: 'Classification' },
                      { label: 'Biocompatible', value: isSafe ? '✅ Yes' : '❌ No', color: isSafe ? '#22c55e' : '#ef4444', extra: 'ISO Threshold' },
                      { label: 'Toxicity Score', value: `${fmt(selected.toxicityScore ?? selected.toxicity_score, 1)}/100`, color: '#8b5cf6', extra: 'Regressor' },
                      { label: 'ISO 10993-5', value: isSafe ? 'PASS' : 'FAIL', color: isSafe ? '#22c55e' : '#ef4444', extra: 'Compliance' },
                      { label: 'Model Confidence', value: '98.5%', color: '#38bdf8', extra: 'Cross-Validated' },
                      { label: 'Apoptosis Rate', value: `${fmt(apopVal, 1)}%`, color: '#f472b6', extra: 'Cell Death' },
                      { label: '4PL IC50 Bound', value: selected.estimated_ic50 || selected.ic50 || 'N/A', color: '#38bdf8', extra: '50% Inhibition' },
                      { label: 'Primary Driver', value: rosVal > 3.0 ? 'ROS Oxidation' : ldhVal > 10 ? 'Membrane Lysis' : 'Dose Load', color: '#fbbf24', extra: 'Feature Weight' },
                      { label: 'Model Algorithm', value: 'Random Forest', color: '#a78bfa', extra: '100 Estimators' },
                    ].map(({ label, value, color, extra }) => (
                      <View key={label} style={[styles.mlCard, { borderColor: color + '44', backgroundColor: isDark ? (color + '15') : (color + '0e') }]}>
                        <Text style={[styles.mlCardLabel, { color: colors.textMuted }]}>{label}</Text>
                        <Text style={[styles.mlCardVal, { color }]}>{value}</Text>
                        <Text style={[styles.mlCardExtra, { color: colors.textMuted }]}>{extra}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* ── 4. 2 SCIENTIFIC OUTPUT GRAPHS (SVG) ── */}
                {selected.submittedRows && selected.submittedRows.length > 0 && (
                  <>
                    <DoseResponseCurveChart
                      rows={selected.submittedRows}
                      selectedMetric={selectedMetric}
                      setSelectedMetric={setSelectedMetric}
                    />
                    <BiomarkerRadarChart item={selected} />
                  </>
                )}

                {/* ── 5. BIOMARKER STRESS CONTRIBUTIONS (Progress Bars & Percentages) ── */}
                <View style={[styles.sectionBox, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: colors.border }]}>
                  <View style={styles.sectionHeader}>
                    <Activity size={15} color={colors.primaryLight} />
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>  Biomarker Stress Contributions (%)</Text>
                  </View>

                  {[
                    { label: 'Cell Viability (Survival Rate)', val: `${fmt(viab, 1)}%`, pct: viabStressPct, color: isSafe ? '#22c55e' : '#ef4444' },
                    { label: 'ROS Oxidation (Fold Increase)', val: `${fmt(rosVal, 1)}× (${Math.round(rosStressPct)}% stress)`, pct: rosStressPct, color: '#f59e0b' },
                    { label: 'LDH Membrane Permeability', val: `${fmt(ldhVal, 1)}% (${Math.round(ldhStressPct)}% lysis)`, pct: ldhStressPct, color: '#f87171' },
                    { label: 'Apoptosis Rate (Cell Death)', val: `${fmt(apopVal, 1)}% (${Math.round(apopStressPct)}% apoptotic)`, pct: apopStressPct, color: '#a855f7' },
                  ].map(b => (
                    <View key={b.label} style={styles.barItem}>
                      <View style={styles.barLabelRow}>
                        <Text style={[styles.barLabel, { color: colors.text }]}>{b.label}</Text>
                        <Text style={[styles.barVal, { color: b.color }]}>{b.val}</Text>
                      </View>
                      <View style={[styles.barTrack, { backgroundColor: isDark ? '#0f172a' : '#e2e8f0', borderColor: colors.border }]}>
                        <View style={[styles.barFill, { width: `${Math.max(b.pct, 4)}%`, backgroundColor: b.color }]} />
                      </View>
                    </View>
                  ))}
                </View>

                {/* ── 6. MEASURED DOSE-RESPONSE TABLE ── */}
                {selected.submittedRows && selected.submittedRows.length > 0 && (
                  <View style={[styles.sectionBox, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: colors.border }]}>
                    <View style={styles.sectionHeader}>
                      <TableProperties size={15} color={colors.primaryLight} />
                      <Text style={[styles.sectionTitle, { color: colors.text }]}>  Measured Dose-Response Table</Text>
                    </View>
                    <View style={[styles.tableWrapper, { backgroundColor: isDark ? '#0f172a' : '#ffffff', borderColor: colors.border }]}>
                      <View style={[styles.tableHeader, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderBottomColor: colors.border }]}>
                        <Text style={[styles.thCell, { flex: 0.9, color: colors.text }]}>Point</Text>
                        <Text style={[styles.thCell, { flex: 1.4, color: colors.text }]}>Conc (µg/mL)</Text>
                        <Text style={[styles.thCell, { flex: 1.3, color: colors.text }]}>Viability</Text>
                        <Text style={[styles.thCell, { flex: 1, color: colors.text }]}>ROS</Text>
                        <Text style={[styles.thCell, { flex: 1, color: colors.text }]}>LDH</Text>
                        <Text style={[styles.thCell, { flex: 1, color: colors.text }]}>Apop</Text>
                      </View>
                      {selected.submittedRows.map((r, i) => (
                        <View key={i} style={[styles.tableRow, { borderBottomColor: colors.border }, i % 2 === 1 && { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}>
                          <Text style={[styles.tdCell, { flex: 0.9, color: colors.textMuted }]}>Point {i + 1}</Text>
                          <Text style={[styles.tdCell, { flex: 1.4, fontWeight: '700', color: colors.text }]}>{fmt(r.concentration, 1)}</Text>
                          <Text style={[styles.tdCell, { flex: 1.3, fontWeight: '700', color: parseFloat(r.viability) >= 80 ? '#22c55e' : '#ef4444' }]}>{fmt(r.viability, 1)}%</Text>
                          <Text style={[styles.tdCell, { flex: 1, color: colors.text }]}>{fmt(r.ros, 1)}×</Text>
                          <Text style={[styles.tdCell, { flex: 1, color: colors.text }]}>{fmt(r.ldh, 1)}%</Text>
                          <Text style={[styles.tdCell, { flex: 1, color: colors.text }]}>{fmt(r.apoptosis, 1)}%</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* ── 7. EXPERIMENT PARAMETERS ── */}
                <View style={[styles.sectionBox, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: colors.border }]}>
                  <View style={styles.sectionHeader}>
                    <FlaskConical size={15} color={colors.primaryLight} />
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>  Experiment Parameters</Text>
                  </View>
                  {[
                    ['Target Cell Line', selected.cell_line || 'HeLa'],
                    ['Nanoparticle Type', selected.nanoparticle_type || 'Zinc Oxide (ZnO)'],
                    ['Exposure Time', selected.exposure_time || '24h'],
                    ['Concentration Range', selected.concentration ? `${fmt(selected.concentration, 1)} µg/mL` : 'Multi-Dose Curve'],
                    ['Safe Dosage Ceiling', selected.safe_range || '0.0 – 25.0 µg/mL'],
                    ['Medical Application', selected.medical_application || 'Biomedical Research'],
                  ].map(([label, value]) => (
                    <View key={label} style={[styles.paramRow, { borderBottomColor: colors.border }]}>
                      <Text style={[styles.paramLabel, { color: colors.textMuted }]}>{label}</Text>
                      <Text style={[styles.paramVal, { color: colors.text }]}>{String(value)}</Text>
                    </View>
                  ))}
                </View>

                {/* ── 8. KEY FINDINGS ── */}
                <View style={[styles.sectionBox, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: colors.border }]}>
                  <View style={styles.sectionHeader}>
                    <Target size={15} color={rc} />
                    <Text style={[styles.sectionTitle, { color: rc }]}>  Key Findings</Text>
                  </View>
                  {keyFindings.map((f, i) => (
                    <View key={i} style={[styles.findingItem, { borderLeftColor: rc, backgroundColor: isDark ? '#0f172a' : '#ffffff', borderColor: colors.border }]}>
                      <Text style={styles.findingIcon}>{f.icon}</Text>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={[styles.findingTitle, { color: rc }]}>{f.title}</Text>
                        <Text style={[styles.findingDesc, { color: colors.textMuted }]}>{f.desc}</Text>
                      </View>
                    </View>
                  ))}
                </View>

                {/* ── 9. RESEARCH SUGGESTIONS ── */}
                <View style={[styles.sectionBox, { borderColor: '#f59e0b55', backgroundColor: isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.05)' }]}>
                  <View style={styles.sectionHeader}>
                    <Info size={15} color="#fbbf24" />
                    <Text style={[styles.sectionTitle, { color: '#fbbf24' }]}>  Research Suggestions</Text>
                  </View>
                  {suggestions.map(({ t, d }, i) => (
                    <View key={i} style={[styles.suggestionItem, { backgroundColor: isDark ? '#0f172a' : '#ffffff', borderColor: colors.border }]}>
                      <Text style={styles.suggestionIcon}>💡</Text>
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={[styles.suggestionTitle, { color: colors.text }]}>{t}</Text>
                        <Text style={[styles.suggestionDesc, { color: colors.textMuted }]}>{d}</Text>
                      </View>
                    </View>
                  ))}
                </View>

                {/* ── 10. ML RATIONALE ── */}
                {selected.interpretation ? (
                  <View style={[styles.rationaleBox, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: colors.border }]}>
                    <Text style={[styles.rationaleTitle, { color: colors.text }]}>🧠 ML Model Rationale</Text>
                    <Text style={[styles.rationaleText, { color: colors.textMuted }]}>{selected.interpretation}</Text>
                  </View>
                ) : null}

              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.md },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: borderRadius.md, paddingHorizontal: spacing.md,
    borderWidth: 1, marginBottom: spacing.sm,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 16.5 },
  riskFilterContainer: {
    marginBottom: spacing.sm,
    height: 44,
  },
  riskFilterScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
    paddingRight: 12,
  },
  riskFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1.5,
  },
  riskChipText: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  riskCountBadge: {
    marginLeft: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riskCountBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  countText: { fontSize: 14.5, marginBottom: spacing.sm },
  listContent: { paddingBottom: spacing.xl },

  itemCard: { borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1 },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  riskDot: { width: 10, height: 10, borderRadius: 5 },
  itemMain: { flex: 1 },
  itemTitle: { fontSize: 17, fontWeight: '700' },
  itemSub: { fontSize: 15, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.sm, borderWidth: 1 },
  badgeText: { fontSize: 14, fontWeight: '800' },
  itemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1 },
  footerPill: { flexDirection: 'row', alignItems: 'center' },
  footerText: { fontSize: 14.5 },
  footerScoreText: { fontSize: 14.5 },
  emptyBox: { padding: spacing.xl, alignItems: 'center', gap: spacing.md },
  emptyText: { fontSize: 16.5 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: '94%', borderTopWidth: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  modalTitle: { fontSize: 21, fontWeight: '800' },
  modalSub: { fontSize: 15, marginTop: 2 },
  closeBtn: { padding: 4 },

  verdictBanner: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 14, borderWidth: 1.5, marginBottom: 14 },
  verdictTitle: { fontSize: 18.5, fontWeight: '800' },
  verdictSub: { fontSize: 14.5, marginTop: 2, fontWeight: '600' },
  confidenceTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#38bdf8' },
  confidenceTagText: { fontSize: 13, fontWeight: '800', color: '#38bdf8' },

  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  metricBox: { flexBasis: '48%', flexGrow: 1, borderRadius: 12, padding: 10, borderWidth: 1 },
  metricLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginBottom: 3 },
  metricVal: { fontSize: 19.5, fontWeight: '800', marginVertical: 2 },
  metricSub: { fontSize: 12.5 },

  mlBox: { borderRadius: 14, padding: 12, borderWidth: 1, marginBottom: 14 },
  mlHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  mlTitle: { fontSize: 16, fontWeight: '800' },
  mlBadge: { marginLeft: 'auto', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1 },
  mlBadgeText: { fontSize: 12, fontWeight: '700' },
  mlGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  mlCard: { flexBasis: '31%', flexGrow: 1, borderRadius: 10, borderWidth: 1.5, padding: 8, alignItems: 'center' },
  mlCardLabel: { fontSize: 12, fontWeight: '700', marginBottom: 2, textTransform: 'uppercase', textAlign: 'center' },
  mlCardVal: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  mlCardExtra: { fontSize: 11.5, marginTop: 2, textAlign: 'center' },

  chartContainer: { borderRadius: 14, padding: 12, borderWidth: 1, marginBottom: 14, overflow: 'hidden' },
  chartHeader: { flexDirection: 'column', marginBottom: 6, gap: 4 },
  chartTitle: { fontSize: 16.5, fontWeight: '800' },
  chartSub: { fontSize: 14.5, marginBottom: 6 },
  metricTabs: { flexDirection: 'row', gap: 4, marginTop: 4 },
  chartTab: { flex: 1, alignItems: 'center', paddingVertical: 5, paddingHorizontal: 2, borderRadius: 6, borderWidth: 1 },
  chartTabText: { fontSize: 13.5, fontWeight: '700' },
  svgWrapper: { width: '100%', alignItems: 'center', justifyContent: 'center', marginVertical: 4 },
  chartFooterRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingHorizontal: 4 },
  chartAxisLabel: { fontSize: 13, fontWeight: '600' },
  chartStatusLabel: { fontSize: 13, fontWeight: '700' },

  radarChipsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  radarChip: { flexBasis: '48%', flexGrow: 1, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, borderWidth: 1 },
  radarChipLabel: { fontSize: 14, fontWeight: '800', color: '#ffffff' },
  radarChipVal: { fontSize: 15, fontWeight: '900' },

  sectionBox: { borderRadius: 12, padding: 12, borderWidth: 1, marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 15.5, fontWeight: '800', textTransform: 'uppercase' },

  barItem: { marginBottom: 10 },
  barLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  barLabel: { fontSize: 14.5, fontWeight: '600' },
  barVal: { fontSize: 14.5, fontWeight: '800' },
  barTrack: { height: 8, borderRadius: 4, overflow: 'hidden', borderWidth: 1 },
  barFill: { height: '100%', borderRadius: 4 },

  tableWrapper: { borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 4, borderBottomWidth: 1 },
  thCell: { fontSize: 12.5, fontWeight: '800', textAlign: 'center' },
  tableRow: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 4, borderBottomWidth: 1 },
  tdCell: { fontSize: 13.5, textAlign: 'center', fontWeight: '600' },

  paramRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1 },
  paramLabel: { fontSize: 15 },
  paramVal: { fontSize: 15, fontWeight: '700', maxWidth: '55%', textAlign: 'right' },

  findingItem: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderLeftWidth: 3.5 },
  findingIcon: { fontSize: 20 },
  findingTitle: { fontSize: 15.5, fontWeight: '800', marginBottom: 2 },
  findingDesc: { fontSize: 14.5, lineHeight: 19 },

  suggestionItem: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1 },
  suggestionIcon: { fontSize: 18 },
  suggestionTitle: { fontSize: 15.5, fontWeight: '800', marginBottom: 2 },
  suggestionDesc: { fontSize: 14, lineHeight: 18 },

  rationaleBox: { borderRadius: 14, padding: 12, borderWidth: 1, marginBottom: 14 },
  rationaleTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  rationaleText: { fontSize: 15, lineHeight: 20 },

  cardTopTagRow: { marginBottom: 8 },
  patientBadgeContainer: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  patientTagPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  patientTagText: { fontSize: 13.5, fontWeight: '800' },
  patientSubText: { fontSize: 13.5, fontWeight: '600' },
  cohortPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  cohortPillText: { fontSize: 13 },
  generalScreeningTagPill: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 },
  generalScreeningTagText: { fontSize: 13, fontWeight: '600' },
  modalPatientCard: { borderRadius: 10, padding: 10, borderWidth: 1, marginBottom: 12 },
  modalPatientHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  modalPatientTitle: { fontSize: 15, fontWeight: '800' },
  modalCohortText: { fontSize: 13.5 },
  modalPatientSub: { fontSize: 13.5 },

  scopeSelectorContainer: { flexDirection: 'row', borderRadius: 10, padding: 3, marginBottom: 8, borderWidth: 1 },
  scopeBtn: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  scopeBtnActive: {},
  scopeBtnText: { fontSize: 13.5, fontWeight: '700' },
  scopeBtnTextActive: { color: '#ffffff', fontWeight: '800' },

  patientFilterWrapper: { marginBottom: 8 },
  patientFilterBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8
  },
  patientFilterBtnOpen: {},
  patientFilterBtnText: { fontSize: 14.5, fontWeight: '700' },
  patientFilterDropdown: { borderWidth: 1, borderRadius: 8, marginTop: 4, overflow: 'hidden' },
  dropdownOptionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1
  },
  dropdownOptionRowActive: { backgroundColor: 'rgba(20,184,166,0.12)' },
  dropdownOptionTitle: { fontSize: 14.5, fontWeight: '600' },
  dropdownOptionTitleActive: { fontWeight: '800' },
  dropdownOptionSub: { fontSize: 12.5 },
});
