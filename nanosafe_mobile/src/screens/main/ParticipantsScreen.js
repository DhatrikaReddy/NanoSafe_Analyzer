import React, { useContext, useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  TextInput, Modal, ScrollView, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard
} from 'react-native';
import Svg, { Path, Line, Circle, Rect, Text as SvgText, G } from 'react-native-svg';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { ThemeContext } from '../../context/ThemeContext';
import apiClient from '../../api/client';
import { LanguageContext } from '../../context/LanguageContext';
import {
  Users, Plus, X, ChevronRight, ChevronDown, CheckCircle, XCircle, Clock,
  HeartPulse, User, RefreshCw, Sparkles, Filter, FlaskConical,
  ShieldCheck, Dna, FileText, Check, ArrowRight, TrendingUp, AlertTriangle, Droplet
} from 'lucide-react-native';

const consentColors = {
  Consented: colors.safe,
  Withdrawn: colors.danger,
  Pending: colors.moderate,
};

const ALL_BLOOD_GROUPS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
const COHORTS = [
  'Wound Care Cohort A',
  'Dental Implant Cohort',
  'Tissue Scaffold Group',
  'Healthy Control Cohort'
];

const fmt = (val, decimals = 1) => {
  if (val === null || val === undefined || val === '') return '—';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]/g, ''));
  if (isNaN(num)) return String(val);
  const fixed = num.toFixed(decimals);
  return fixed.endsWith('.0') && decimals === 1 && num === Math.floor(num) ? String(num) : fixed;
};

// Auto-generate unique patient ID (e.g. PAT-2026-001)
const generatePatientId = (list = []) => {
  const year = new Date().getFullYear();
  const count = (list && list.length ? list.length : 0) + 1;
  let candidate = `PAT-${year}-${String(count).padStart(3, '0')}`;
  const existing = new Set((list || []).map(p => (p.participantId || p.participant_id || '').toUpperCase()));
  let c = count;
  while (existing.has(candidate.toUpperCase())) {
    c++;
    candidate = `PAT-${year}-${String(c).padStart(3, '0')}`;
  }
  return candidate;
};

// MINI 4PL DOSE-RESPONSE CURVE FOR PATIENT ASSAYS
function PatientAssayCurve({ rows }) {
  if (!rows || rows.length === 0) return null;
  const { colors, isDark } = useContext(ThemeContext);
  const textColor = isDark ? '#ffffff' : '#0f172a';
  const gridStroke = isDark ? '#1e293b' : '#e2e8f0';

  const V_WIDTH = 300;
  const V_HEIGHT = 130;
  const padL = 30;
  const padR = 15;
  const padT = 15;
  const padB = 22;
  const graphW = V_WIDTH - padL - padR;
  const graphH = V_HEIGHT - padT - padB;

  const points = rows.map((r, i) => ({
    conc: parseFloat(r.concentration ?? r.Concentration) || (i * 20),
    viab: parseFloat(r.viability ?? r.cell_viability ?? r['Cell Viability']) || 80,
  }));

  const maxConc = Math.max(...points.map(p => p.conc), 50);
  const getX = (c) => padL + (c / maxConc) * graphW;
  const getY = (v) => padT + graphH - (Math.min(Math.max(v, 0), 100) / 100) * graphH;

  const pathD = points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${getX(p.conc)} ${getY(p.viab)}`, '');

  return (
    <View style={[styles.miniChartBox, { backgroundColor: isDark ? '#0b1120' : '#f8fafc', borderColor: colors.border }]}>
      <Svg width="100%" height={130} viewBox={`0 0 ${V_WIDTH} ${V_HEIGHT}`} preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {[0, 50, 80, 100].map(v => (
          <G key={v}>
            <Line x1={padL} y1={getY(v)} x2={V_WIDTH - padR} y2={getY(v)} stroke={v === 80 ? 'rgba(16,185,129,0.35)' : gridStroke} strokeDasharray={v === 80 ? '3 3' : undefined} />
            <SvgText x={padL - 4} y={getY(v) + 4} fontSize="10.5" fill={v === 80 ? '#22c55e' : textColor} textAnchor="end" fontWeight="900">{v}%</SvgText>
          </G>
        ))}
        {/* 4PL Curve */}
        <Path d={pathD} fill="none" stroke={colors.primaryLight} strokeWidth="2.5" />
        {/* Data points */}
        {points.map((p, idx) => (
          <G key={idx}>
            <Circle cx={getX(p.conc)} cy={getY(p.viab)} r="3.5" fill={isDark ? '#090d16' : '#ffffff'} stroke={colors.primaryLight} strokeWidth="2" />
            <SvgText x={getX(p.conc)} y={V_HEIGHT - 6} fontSize="10" fill={textColor} textAnchor="middle" fontWeight="900">{fmt(p.conc, 0)}</SvgText>
          </G>
        ))}
      </Svg>
      <Text style={[styles.miniChartCaption, { color: colors.textMuted }]}>Dose-Response (Viability vs. Concentration µg/mL)</Text>
    </View>
  );
}

export default function ParticipantsScreen({ navigation }) {
  const { t } = useContext(LanguageContext);
  const { colors, isDark } = useContext(ThemeContext);
  const [participants, setParticipants] = useState([]);
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCohortFilter, setSelectedCohortFilter] = useState('All');
  
  // Add Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [profileTab, setProfileTab] = useState('assays'); // 'assays' | 'samples' | 'demo'

  // Form State
  const [form, setForm] = useState({
    participant_id: '',
    name: '',
    age: '',
    sex: 'Male',
    blood_group: 'O+',
    study_group: 'Wound Care Cohort A',
    consent_status: 'Consented',
    notes: ''
  });
  const [activeDropdown, setActiveDropdown] = useState(null); // 'sex' | 'blood' | 'cohort' | 'consent'
  const toggleDropdown = (name) => {
    Keyboard.dismiss();
    setActiveDropdown(prev => prev === name ? null : name);
  };
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchParticipants();
  }, []);

  const fetchParticipants = async () => {
    try {
      setLoading(true);
      const [pRes, sRes] = await Promise.all([
        apiClient.get('/participants/'),
        apiClient.get('/samples/'),
      ]);
      setParticipants(pRes.data.participants || []);
      setSamples(sRes.data.samples || []);
    } catch (e) {
      setError('Failed to load study participants.');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    const autoId = generatePatientId(participants);
    setForm({
      participant_id: autoId,
      name: '',
      age: '',
      sex: 'Male',
      blood_group: 'O+',
      study_group: 'Wound Care Cohort A',
      consent_status: 'Consented',
      notes: ''
    });
    setActiveDropdown(null);
    setShowAddModal(true);
  };

  const handleRegenerateId = () => {
    const autoId = generatePatientId(participants);
    setForm(prev => ({ ...prev, participant_id: autoId }));
  };

  const handleAdd = async () => {
    const pid = form.participant_id.trim() || generatePatientId(participants);
    try {
      setSaving(true);
      await apiClient.post('/participants/', {
        participantId: pid,
        name: form.name.trim(),
        age: form.age ? parseInt(form.age) : null,
        sex: form.sex,
        bloodGroup: form.blood_group,
        studyGroup: form.study_group,
        consentStatus: form.consent_status,
        researchNotes: form.notes.trim(),
      });
      Keyboard.dismiss();
      setShowAddModal(false);
      fetchParticipants();
      Alert.alert('Success', `Study Participant ${pid} enrolled successfully.`);
    } catch (e) {
      Alert.alert('Enrollment Error', e.response?.data?.error || 'Failed to add participant.');
    } finally {
      setSaving(false);
    }
  };

  // KPIs
  const totalCount = participants.length;
  const consentedCount = participants.filter(p => (p.consentStatus || p.consent_status) === 'Consented').length;
  const totalAssays = participants.reduce((acc, p) => acc + (p.totalAssays || (p.linkedAssays ? p.linkedAssays.length : 0)), 0);
  const cohortsCount = new Set(participants.map(p => p.studyGroup || p.study_group).filter(Boolean)).size || 1;

  // Filtered List
  const filtered = participants.filter(p => {
    const name = (p.name || '').toLowerCase();
    const pid = (p.participantId || p.participant_id || '').toLowerCase();
    const cohort = (p.studyGroup || p.study_group || '').toLowerCase();
    const bg = (p.bloodGroup || p.blood_group || '').toLowerCase();
    const q = search.toLowerCase();

    const matchesSearch = !search || name.includes(q) || pid.includes(q) || cohort.includes(q) || bg.includes(q);
    const matchesCohort = selectedCohortFilter === 'All' || (p.studyGroup || p.study_group) === selectedCohortFilter;

    return matchesSearch && matchesCohort;
  });

  const ConsentIcon = ({ status }) => {
    if (status === 'Consented') return <CheckCircle size={14} color={colors.safe} />;
    if (status === 'Withdrawn') return <XCircle size={14} color={colors.danger} />;
    return <Clock size={14} color={colors.moderate} />;
  };

  // Get samples belonging to selected participant
  const getPatientSamples = (p) => {
    if (!p) return [];
    const pid = (p.participantId || p.participant_id || '').toUpperCase();
    return samples.filter(s => (s.participantId || '').toUpperCase() === pid);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 📊 TOP CLINICAL KPI ROW */}
      <View style={styles.kpiRow}>
        <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftWidth: 3, borderLeftColor: colors.primary }]}>
          <Text style={[styles.kpiValue, { color: colors.text }]}>{totalCount}</Text>
          <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>Patients</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftWidth: 3, borderLeftColor: colors.safe }]}>
          <Text style={[styles.kpiValue, { color: colors.safe }]}>{consentedCount}</Text>
          <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>Consented</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftWidth: 3, borderLeftColor: colors.primary }]}>
          <Text style={[styles.kpiValue, { color: colors.primary }]}>{totalAssays}</Text>
          <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>Assays Linked</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftWidth: 3, borderLeftColor: '#38bdf8' }]}>
          <Text style={[styles.kpiValue, { color: '#38bdf8' }]}>{cohortsCount}</Text>
          <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>Cohorts</Text>
        </View>
      </View>

      {/* 🔍 SEARCH AND ENROLL ACTION BAR */}
      <View style={styles.searchRow}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
          placeholder={t('searchPlaceholder', 'Search by Patient ID, Name, Blood Group, Cohort...')}
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={openAddModal}>
          <Plus size={18} color="#fff" style={{ marginRight: 4 }} />
          <Text style={styles.addBtnText}>{t('addPatient', 'Enroll')}</Text>
        </TouchableOpacity>
      </View>

      {/* 🏷️ COHORT FILTER PILLS */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll} contentContainerStyle={styles.pillScrollContent}>
        {['All', ...COHORTS].map(cohort => {
          const isActive = selectedCohortFilter === cohort;
          return (
            <TouchableOpacity
              key={cohort}
              style={[styles.filterPill, { backgroundColor: colors.card, borderColor: colors.border }, isActive && { backgroundColor: colors.primary, borderColor: colors.primary }]}
              onPress={() => setSelectedCohortFilter(cohort)}
            >
              <Text style={[styles.filterPillText, { color: colors.textMuted }, isActive && { color: '#fff', fontWeight: '800' }]}>
                {cohort}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* LIST OF STUDY PARTICIPANTS */}
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : error ? (
        <Text style={{ color: colors.danger, textAlign: 'center', marginTop: 40 }}>{error}</Text>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => {
            const pid = item.participantId || item.participant_id;
            const status = item.consentStatus || item.consent_status || 'Consented';
            const cohort = item.studyGroup || item.study_group || 'General Research';
            const blood = item.bloodGroup || item.blood_group || 'O+';
            const assaysCount = item.totalAssays || (item.linkedAssays ? item.linkedAssays.length : 0);
            const pSamples = getPatientSamples(item);

            return (
              <TouchableOpacity
                style={[styles.patientCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => {
                  setSelectedParticipant({ ...item, samples: pSamples });
                  setProfileTab('assays');
                }}
                activeOpacity={0.75}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
                    <User size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.idRow}>
                      <Text style={[styles.patientIdText, { color: colors.primary }]}>{pid}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: (consentColors[status] || colors.textMuted) + '22' }]}>
                        <ConsentIcon status={status} />
                        <Text style={[styles.statusText, { color: consentColors[status] || colors.textMuted }]}>
                          {status}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.patientName, { color: colors.text }]}>{item.name || 'Anonymous Subject'}</Text>
                  </View>
                </View>

                <View style={[styles.cardDetailsGrid, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: colors.border }]}>
                  <View style={styles.detailTag}>
                    <Text style={[styles.detailTagLabel, { color: colors.textMuted }]}>{t('gender', 'Age / Sex')}</Text>
                    <Text style={[styles.detailTagVal, { color: colors.text }]}>{item.age ? `${item.age} yrs` : 'N/A'} • {item.sex || '—'}</Text>
                  </View>
                  <View style={styles.detailTag}>
                    <Text style={[styles.detailTagLabel, { color: colors.textMuted }]}>{t('bloodGroup', 'Blood Group')}</Text>
                    <Text style={[styles.detailTagVal, { color: '#f87171', fontWeight: '800' }]}>🩸 {blood}</Text>
                  </View>
                  <View style={styles.detailTag}>
                    <Text style={[styles.detailTagLabel, { color: colors.textMuted }]}>{t('totalAssaysCount', 'Assays Run')}</Text>
                    <Text style={[styles.detailTagVal, { color: colors.primary, fontWeight: '800' }]}>
                      🧪 {assaysCount} Test{assaysCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <View style={[styles.cohortBadge, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}>
                    <Text style={[styles.cohortBadgeText, { color: colors.textSecondary }]} numberOfLines={1}>🏷️ {cohort}</Text>
                  </View>
                  <View style={styles.viewProfileRow}>
                    <Text style={[styles.viewProfileText, { color: colors.primary }]}>{t('viewAllRecords', 'View Assays & Profile')}</Text>
                    <ChevronRight size={14} color={colors.primary} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Users size={44} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>{t('noPatientsFound', 'No Study Participants Found')}</Text>
              <Text style={styles.emptySub}>
                {search || selectedCohortFilter !== 'All'
                  ? 'No participants match the selected filters.'
                  : 'Enroll study subjects to track primary cell tolerances and clinical trials.'}
              </Text>
              <TouchableOpacity style={[styles.addFirstBtn, { backgroundColor: colors.primary }]} onPress={openAddModal}>
                <Plus size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.addFirstBtnText}>{t('enrollNewPatient', 'Enroll New Participant')}</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* ============================================================ */}
      {/* ➕ ENROLL STUDY PARTICIPANT MODAL (100% SOLID OPAQUE)        */}
      {/* ============================================================ */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          Keyboard.dismiss();
          setShowAddModal(false);
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>

          <View style={[styles.modalCard, { backgroundColor: isDark ? '#0f172a' : '#ffffff', borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{t('enrollNewPatient', '👤 Enroll Study Participant')}</Text>
                <Text style={[styles.modalSub, { color: colors.textMuted }]}>{t('patientRegistry', 'ISO 14155 / GCP Clinical Subject Registration')}</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  setShowAddModal(false);
                }}
                style={styles.modalCloseBtn}
              >
                <X size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={{ paddingBottom: 60 }}
            >
              {/* 1. Patient ID */}
              <View style={styles.formGroup}>
                <View style={styles.labelRow}>
                  <Text style={[styles.label, { color: colors.text }]}>{t('patientId', 'Patient Code / ID *')}</Text>
                  <View style={styles.autoTag}>
                    <Sparkles size={11} color={colors.primaryLight} />
                    <Text style={styles.autoTagText}>Auto-Generated</Text>
                  </View>
                </View>
                <View style={styles.inputWithActionRow}>
                  <TextInput
                    style={[styles.input, { flex: 1, backgroundColor: isDark ? '#1e293b' : '#f8fafc', color: colors.text, borderColor: colors.border, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontWeight: '700' }]}
                    placeholder="e.g. PAT-2026-001"
                    placeholderTextColor={colors.textMuted}
                    value={form.participant_id}
                    onChangeText={(v) => setForm({ ...form, participant_id: v })}
                    returnKeyType="done"
                  />
                  <TouchableOpacity style={[styles.regenerateBtn, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: colors.border }]} onPress={handleRegenerateId} title="Generate new ID">
                    <RefreshCw size={15} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* 2. Patient Name */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Patient / Subject Pseudonym (Optional)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', color: colors.text, borderColor: colors.border }]}
                  placeholder="e.g. Subject Jane D., Sub-009"
                  placeholderTextColor={colors.textMuted}
                  value={form.name}
                  onChangeText={(v) => setForm({ ...form, name: v })}
                  returnKeyType="done"
                />
              </View>

              {/* 3. Age */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>{t('ageYears', 'Age (years)')}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', color: colors.text, borderColor: colors.border }]}
                  placeholder="e.g. 34"
                  placeholderTextColor={colors.textMuted}
                  value={form.age}
                  onChangeText={(v) => setForm({ ...form, age: v })}
                  keyboardType="number-pad"
                  returnKeyType="done"
                />
              </View>

              {/* 4. Biological Sex Dropdown */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Biological Sex *</Text>
                <TouchableOpacity
                  style={[styles.dropdownBtn, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: colors.border }, activeDropdown === 'sex' && styles.dropdownBtnOpen]}
                  onPress={() => toggleDropdown('sex')}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.dropdownBtnTitle, { color: colors.text }]}>{form.sex || 'Select Sex'}</Text>
                  <ChevronDown
                    size={18}
                    color={activeDropdown === 'sex' ? colors.primary : colors.textMuted}
                    style={{ transform: [{ rotate: activeDropdown === 'sex' ? '180deg' : '0deg' }] }}
                  />
                </TouchableOpacity>

                {activeDropdown === 'sex' && (
                  <View style={[styles.dropdownVerticalMenu, { backgroundColor: isDark ? '#1e293b' : '#ffffff', borderColor: colors.border }]}>
                    {['Male', 'Female', 'Other'].map(g => {
                      const isSel = form.sex === g;
                      return (
                        <TouchableOpacity
                          key={g}
                          style={[styles.dropdownOptionRow, { borderBottomColor: colors.border }, isSel && styles.dropdownOptionRowActive]}
                          onPress={() => {
                            setForm({ ...form, sex: g });
                            setActiveDropdown(null);
                          }}
                        >
                          <Text style={[styles.dropdownOptionTitle, { color: colors.text }, isSel && styles.dropdownOptionTitleActive]}>{g}</Text>
                          {isSel && <Check size={16} color={colors.primary} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* 5. Blood Group Dropdown (8 Types) */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>{t('bloodGroup', 'Blood Group')} (8 Types Available) *</Text>
                <TouchableOpacity
                  style={[styles.dropdownBtn, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: colors.border }, activeDropdown === 'blood' && styles.dropdownBtnOpen]}
                  onPress={() => toggleDropdown('blood')}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.dropdownBtnTitle, { color: colors.text }]}>🩸 {form.blood_group || `Select ${t('bloodGroup', 'Blood Group')}`}</Text>
                  <ChevronDown
                    size={18}
                    color={activeDropdown === 'blood' ? colors.primary : colors.textMuted}
                    style={{ transform: [{ rotate: activeDropdown === 'blood' ? '180deg' : '0deg' }] }}
                  />
                </TouchableOpacity>

                {activeDropdown === 'blood' && (
                  <View style={[styles.dropdownVerticalMenu, { backgroundColor: isDark ? '#1e293b' : '#ffffff', borderColor: colors.border }]}>
                    <ScrollView nestedScrollEnabled style={{ maxHeight: 220 }}>
                      {ALL_BLOOD_GROUPS.map(bg => {
                        const isSel = form.blood_group === bg;
                        return (
                          <TouchableOpacity
                            key={bg}
                            style={[styles.dropdownOptionRow, { borderBottomColor: colors.border }, isSel && styles.dropdownOptionRowActive]}
                            onPress={() => {
                              setForm({ ...form, blood_group: bg });
                              setActiveDropdown(null);
                            }}
                          >
                            <Text style={[styles.dropdownOptionTitle, { color: colors.text }, isSel && styles.dropdownOptionTitleActive]}>
                              🩸 {t('bloodGroup', 'Blood Group')} {bg}
                            </Text>
                            {isSel && <Check size={16} color={colors.primary} />}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* 6. Study Group / Clinical Cohort Dropdown */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Study Group / Clinical Cohort *</Text>
                <TouchableOpacity
                  style={[styles.dropdownBtn, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: colors.border }, activeDropdown === 'cohort' && styles.dropdownBtnOpen]}
                  onPress={() => toggleDropdown('cohort')}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.dropdownBtnTitle, { color: colors.text }]}>🏷️ {form.study_group || 'Select Cohort'}</Text>
                  <ChevronDown
                    size={18}
                    color={activeDropdown === 'cohort' ? colors.primary : colors.textMuted}
                    style={{ transform: [{ rotate: activeDropdown === 'cohort' ? '180deg' : '0deg' }] }}
                  />
                </TouchableOpacity>

                {activeDropdown === 'cohort' && (
                  <View style={[styles.dropdownVerticalMenu, { backgroundColor: isDark ? '#1e293b' : '#ffffff', borderColor: colors.border }]}>
                    <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }}>
                      {COHORTS.map(sg => {
                        const isSel = form.study_group === sg;
                        return (
                          <TouchableOpacity
                            key={sg}
                            style={[styles.dropdownOptionRow, { borderBottomColor: colors.border }, isSel && styles.dropdownOptionRowActive]}
                            onPress={() => {
                              setForm({ ...form, study_group: sg });
                              setActiveDropdown(null);
                            }}
                          >
                            <Text style={[styles.dropdownOptionTitle, { color: colors.text }, isSel && styles.dropdownOptionTitleActive]}>
                              🏷️ {sg}
                            </Text>
                            {isSel && <Check size={16} color={colors.primary} />}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* 7. Informed Consent Dropdown */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Informed {t('consentStatus', 'Consent Status')} *</Text>
                <TouchableOpacity
                  style={[styles.dropdownBtn, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: colors.border }, activeDropdown === 'consent' && styles.dropdownBtnOpen]}
                  onPress={() => toggleDropdown('consent')}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.dropdownBtnTitle, { color: colors.text }]}>
                    {form.consent_status === 'Consented' ? '🟢 Consented (Full Participation)' :
                     form.consent_status === 'Pending' ? '🟡 Pending Approval' : '🔴 Withdrawn Consent'}
                  </Text>
                  <ChevronDown
                    size={18}
                    color={activeDropdown === 'consent' ? colors.primary : colors.textMuted}
                    style={{ transform: [{ rotate: activeDropdown === 'consent' ? '180deg' : '0deg' }] }}
                  />
                </TouchableOpacity>

                {activeDropdown === 'consent' && (
                  <View style={[styles.dropdownVerticalMenu, { backgroundColor: isDark ? '#1e293b' : '#ffffff', borderColor: colors.border }]}>
                    {['Consented', 'Pending', 'Withdrawn'].map(cs => {
                      const isSel = form.consent_status === cs;
                      return (
                        <TouchableOpacity
                          key={cs}
                          style={[styles.dropdownOptionRow, { borderBottomColor: colors.border }, isSel && styles.dropdownOptionRowActive]}
                          onPress={() => {
                            setForm({ ...form, consent_status: cs });
                            setActiveDropdown(null);
                          }}
                        >
                          <Text style={[styles.dropdownOptionTitle, { color: colors.text }, isSel && styles.dropdownOptionTitleActive]}>
                            {cs === 'Consented' ? '🟢 Consented' : cs === 'Pending' ? '🟡 Pending' : '🔴 Withdrawn'}
                          </Text>
                          {isSel && <Check size={16} color={colors.primary} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* 8. Clinical Notes */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Clinical Indications & Notes (Optional)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', color: colors.text, borderColor: colors.border, height: 75, textAlignVertical: 'top' }]}
                  placeholder="Medical history, skin allergies, pre-existing conditions..."
                  placeholderTextColor={colors.textMuted}
                  value={form.notes}
                  onChangeText={(v) => setForm({ ...form, notes: v })}
                  multiline
                />
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary }]}
                onPress={handleAdd}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    <ShieldCheck size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.submitBtnText}>Enroll Study Participant</Text>
                  </View>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ============================================================ */}
      {/* 🪟 PATIENT PROFILE & SPECIMENS MODAL                         */}
      {/* ============================================================ */}
      {selectedParticipant && (
        <Modal
          visible={!!selectedParticipant}
          animationType="slide"
          transparent
          onRequestClose={() => setSelectedParticipant(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: isDark ? '#0f172a' : '#ffffff', borderColor: colors.border }]}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    {selectedParticipant.participantId || selectedParticipant.participant_id} {selectedParticipant.name ? `• ${selectedParticipant.name}` : ''}
                  </Text>
                  <Text style={[styles.modalSub, { color: colors.textMuted }]}>
                    {selectedParticipant.studyGroup || selectedParticipant.study_group} • 🩸 {selectedParticipant.bloodGroup || selectedParticipant.blood_group || 'O+'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedParticipant(null)} style={styles.modalCloseBtn}>
                  <X size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Profile Tabs */}
              <View style={[styles.tabRow, { borderColor: colors.border, backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}>
                <TouchableOpacity
                  style={[styles.tabBtn, profileTab === 'assays' && { backgroundColor: colors.primary }]}
                  onPress={() => setProfileTab('assays')}
                >
                  <Text style={[styles.tabBtnText, { color: profileTab === 'assays' ? '#fff' : colors.textMuted, fontWeight: profileTab === 'assays' ? '800' : '600' }]}>
                    📈 Assays ({selectedParticipant.totalAssays || (selectedParticipant.linkedAssays ? selectedParticipant.linkedAssays.length : 0)})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tabBtn, profileTab === 'samples' && { backgroundColor: colors.primary }]}
                  onPress={() => setProfileTab('samples')}
                >
                  <Text style={[styles.tabBtnText, { color: profileTab === 'samples' ? '#fff' : colors.textMuted, fontWeight: profileTab === 'samples' ? '800' : '600' }]}>
                    🧫 Specimens ({selectedParticipant.samples ? selectedParticipant.samples.length : 0})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tabBtn, profileTab === 'demo' && { backgroundColor: colors.primary }]}
                  onPress={() => setProfileTab('demo')}
                >
                  <Text style={[styles.tabBtnText, { color: profileTab === 'demo' ? '#fff' : colors.textMuted, fontWeight: profileTab === 'demo' ? '800' : '600' }]}>
                    📋 Demographics
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
                {/* 1. ASSAYS TAB */}
                {profileTab === 'assays' && (
                  <View>
                    <TouchableOpacity
                      style={styles.launchAssayBtn}
                      onPress={() => {
                        const p = selectedParticipant;
                        setSelectedParticipant(null);
                        if (navigation?.navigate) {
                          navigation.navigate('NewAnalysis', {
                            prefillPatientId: p.participantId || p.participant_id,
                            prefillSampleName: `Patient Primary Cells (${p.participantId || p.participant_id})`,
                          });
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <FlaskConical size={16} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.launchAssayBtnText}>⚡ Run New Cytotoxicity Bioassay for this Patient</Text>
                    </TouchableOpacity>

                    {selectedParticipant.linkedAssays && selectedParticipant.linkedAssays.length > 0 ? (
                      selectedParticipant.linkedAssays.map((assay, idx) => {
                        const isSafe = assay.viability >= 80;
                        const isMod = assay.viability >= 50 && assay.viability < 80;
                        const badgeColor = isSafe ? colors.safe : isMod ? colors.moderate : colors.danger;

                        return (
                          <View key={assay.id || idx} style={[styles.assayCard, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: colors.border }]}>
                            <View style={styles.assayCardHeader}>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.assayCardTitle, { color: colors.text }]}>{assay.sample_name || `Assay #${assay.id}`}</Text>
                                <Text style={[styles.assayCardMeta, { color: colors.textMuted }]}>{assay.cell_line || 'Primary Cells'} • {assay.date || 'Recent'}</Text>
                              </View>
                              <View style={[styles.assayBadge, { backgroundColor: badgeColor + '22', borderColor: badgeColor }]}>
                                <Text style={[styles.assayBadgeText, { color: badgeColor }]}>{assay.risk_level || (isSafe ? 'Low Risk' : 'Toxic')}</Text>
                              </View>
                            </View>

                            <View style={styles.assayMetricsGrid}>
                              <View style={[styles.metricPill, { backgroundColor: isDark ? '#0f172a' : '#ffffff', borderColor: colors.border }]}>
                                <Text style={[styles.metricPillLabel, { color: colors.textMuted }]}>Viability</Text>
                                <Text style={[styles.metricPillVal, { color: badgeColor }]}>{fmt(assay.viability, 1)}%</Text>
                              </View>
                              <View style={[styles.metricPill, { backgroundColor: isDark ? '#0f172a' : '#ffffff', borderColor: colors.border }]}>
                                <Text style={[styles.metricPillLabel, { color: colors.textMuted }]}>ML Toxicity</Text>
                                <Text style={[styles.metricPillVal, { color: colors.primary }]}>{fmt(assay.toxicity_score, 1)}/100</Text>
                              </View>
                              <View style={[styles.metricPill, { backgroundColor: isDark ? '#0f172a' : '#ffffff', borderColor: colors.border }]}>
                                <Text style={[styles.metricPillLabel, { color: colors.textMuted }]}>4PL IC50</Text>
                                <Text style={[styles.metricPillVal, { color: colors.text }]}>{assay.ic50 || 'N/A'}</Text>
                              </View>
                            </View>

                            {assay.submittedRows && assay.submittedRows.length > 0 ? (
                              <PatientAssayCurve rows={assay.submittedRows} />
                            ) : null}
                          </View>
                        );
                      })
                    ) : (
                      <View style={[styles.emptyAssayBox, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: colors.border }]}>
                        <FlaskConical size={36} color={colors.textMuted} />
                        <Text style={[styles.emptyAssayTitle, { color: colors.text }]}>No Cytotoxicity Assays Linked Yet</Text>
                        <Text style={[styles.emptyAssaySub, { color: colors.textMuted }]}>
                          Tap the button above to run an in-vitro viability test on this patient's primary cell line.
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* 2. SPECIMENS TAB */}
                {profileTab === 'samples' && (
                  <View>
                    {selectedParticipant.samples && selectedParticipant.samples.length > 0 ? (
                      selectedParticipant.samples.map((specimen, idx) => (
                        <View key={specimen.id || idx} style={[styles.specimenCard, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: colors.border }]}>
                          <View style={styles.specimenCardHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Droplet size={16} color="#f87171" />
                              <Text style={[styles.specimenId, { color: colors.text }]}>{specimen.sampleId || specimen.sample_id}</Text>
                            </View>
                            <View style={[styles.statusBadge, { backgroundColor: 'rgba(34,197,94,0.15)', borderColor: '#22c55e' }]}>
                              <Text style={[styles.statusText, { color: '#22c55e' }]}>{specimen.sampleStatus || specimen.sample_status || 'Active'}</Text>
                            </View>
                          </View>

                          <View style={styles.detailRow}>
                            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Sample Matrix</Text>
                            <Text style={[styles.detailValue, { color: colors.text }]}>{specimen.sampleType || specimen.sample_type || 'Tissue'}</Text>
                          </View>
                          <View style={styles.detailRow}>
                            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Cell Line / Lineage</Text>
                            <Text style={[styles.detailValue, { color: colors.text }]}>{specimen.cellType || specimen.cell_type || 'Primary Cells'}</Text>
                          </View>
                          <View style={styles.detailRow}>
                            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Storage Condition</Text>
                            <Text style={[styles.detailValue, { color: colors.text }]}>{specimen.storageCondition || '-80°C Cryopreservation'}</Text>
                          </View>

                          <TouchableOpacity
                            style={styles.specimenTestBtn}
                            onPress={() => {
                              const p = selectedParticipant;
                              const sp = specimen;
                              setSelectedParticipant(null);
                              if (navigation?.navigate) {
                                navigation.navigate('NewAnalysis', {
                                  prefillPatientId: p.participantId || p.participant_id,
                                  prefillSampleName: `${sp.sampleId || sp.sample_id} (${sp.sampleType || 'Specimen'})`,
                                  prefillCellLine: sp.cellType || 'HeLa',
                                });
                              }
                            }}
                          >
                            <FlaskConical size={14} color="#fff" style={{ marginRight: 6 }} />
                            <Text style={styles.specimenTestBtnText}>Test Viability on this Specimen</Text>
                          </TouchableOpacity>
                        </View>
                      ))
                    ) : (
                      <View style={[styles.emptyAssayBox, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: colors.border }]}>
                        <Droplet size={36} color={colors.textMuted} />
                        <Text style={[styles.emptyAssayTitle, { color: colors.text }]}>No Biological Specimens Registered</Text>
                        <Text style={[styles.emptyAssaySub, { color: colors.textMuted }]}>
                          Register a biological sample in the Specimens screen linked to this patient.
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* 3. DEMOGRAPHICS TAB */}
                {profileTab === 'demo' && (
                  <>
                    <View style={[styles.detailCard, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: colors.border }]}>
                      <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Participant ID</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>{selectedParticipant.participantId || selectedParticipant.participant_id}</Text>
                      </View>
                      <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{t('bloodGroup', 'Blood Group')}</Text>
                        <Text style={[styles.detailValue, { color: '#f87171', fontWeight: '800' }]}>🩸 {selectedParticipant.bloodGroup || selectedParticipant.blood_group || 'O+'}</Text>
                      </View>
                      <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{t('consentStatus', 'Consent Status')}</Text>
                        <Text style={[styles.detailValue, { color: consentColors[selectedParticipant.consentStatus || selectedParticipant.consent_status] || colors.safe, fontWeight: '800' }]}>
                          {selectedParticipant.consentStatus || selectedParticipant.consent_status || 'Consented'}
                        </Text>
                      </View>
                      <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Study Cohort</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>{selectedParticipant.studyGroup || selectedParticipant.study_group || 'Wound Care Cohort A'}</Text>
                      </View>
                      <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Demographics</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>
                          {selectedParticipant.age ? `${selectedParticipant.age} yrs` : 'N/A'} • {selectedParticipant.sex || '—'}
                        </Text>
                      </View>
                      <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Enrollment Date</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>{selectedParticipant.createdAt ? selectedParticipant.createdAt.split(' ')[0] : 'Recorded'}</Text>
                      </View>
                    </View>

                    {selectedParticipant.researchNotes ? (
                      <View style={[styles.notesBox, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: colors.border }]}>
                        <Text style={[styles.notesTitle, { color: colors.text }]}>📋 Clinical Indications & Notes</Text>
                        <Text style={[styles.notesText, { color: colors.textSecondary }]}>{selectedParticipant.researchNotes}</Text>
                      </View>
                    ) : null}
                  </>
                )}

                <TouchableOpacity style={[styles.closeModalBtn, { backgroundColor: colors.primary }]} onPress={() => setSelectedParticipant(null)}>
                  <Text style={styles.closeModalBtnText}>Close Profile</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.md },

  // KPI Row
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  kpiCard: {
    flex: 1, borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center',
    borderWidth: 1,
  },
  kpiValue: { fontSize: 21, fontWeight: '800' },
  kpiLabel: { fontSize: 12, marginTop: 2, fontWeight: '600', textTransform: 'uppercase' },

  // Search & Action Row
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  searchInput: {
    flex: 1, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 9,
    borderWidth: 1, fontSize: 15.5
  },
  addBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10
  },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Pills
  pillScroll: { maxHeight: 36, marginBottom: 12 },
  pillScrollContent: { gap: 6, alignItems: 'center' },
  filterPill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    borderWidth: 1,
  },
  filterPillText: { fontSize: 13.5, fontWeight: '600' },

  // Patient Card
  patientCard: {
    borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(20,184,166,0.15)',
    alignItems: 'center', justifyContent: 'center', marginRight: 10
  },
  idRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  patientIdText: { fontSize: 15.5, fontWeight: '800' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  patientName: { fontSize: 16.5, fontWeight: '700', marginTop: 2 },

  cardDetailsGrid: {
    flexDirection: 'row', gap: 6,
    borderRadius: 8, padding: 8, marginBottom: 10, borderWidth: 1,
  },
  detailTag: { flex: 1, alignItems: 'center' },
  detailTagLabel: { fontSize: 11.5, fontWeight: '600', textTransform: 'uppercase' },
  detailTagVal: { fontSize: 14, fontWeight: '700', marginTop: 2 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cohortBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, maxWidth: '65%' },
  cohortBadgeText: { fontSize: 13, fontWeight: '600' },
  viewProfileRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewProfileText: { fontSize: 13.5, fontWeight: '700' },

  emptyContainer: { padding: 40, alignItems: 'center', justifyContent: 'center', marginTop: 30 },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginTop: 12 },
  emptySub: { fontSize: 14, textAlign: 'center', marginTop: 4, marginBottom: 16 },
  addFirstBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  addFirstBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Modals - 100% Solid Non-Transparent Card
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.85)' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)' },
  modalCard: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.lg, maxHeight: '92%', borderTopWidth: 1,
    backgroundColor: '#ffffff',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 25,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  modalTitle: { fontSize: 19, fontWeight: '800' },
  modalSub: { fontSize: 13.5, marginTop: 2 },
  modalCloseBtn: { padding: 4 },

  formGroup: { marginBottom: 12 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  label: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  autoTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(20,184,166,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  autoTagText: { fontSize: 11.5, fontWeight: '800', color: colors.primary },
  inputWithActionRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  input: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15.5 },
  regenerateBtn: { borderWidth: 1, borderRadius: 8, padding: 10, alignItems: 'center', justifyContent: 'center' },

  submitBtn: { borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 10 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  // Profile Modal Tabs
  tabRow: { flexDirection: 'row', borderRadius: 8, padding: 3, marginBottom: 14, borderWidth: 1 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  tabBtnText: { fontSize: 13 },

  detailCard: { borderRadius: 10, padding: 12, borderWidth: 1, marginBottom: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1 },
  detailLabel: { fontSize: 14 },
  detailValue: { fontSize: 14, fontWeight: '700' },

  notesBox: { borderRadius: 10, padding: 12, borderWidth: 1, marginBottom: 12 },
  notesTitle: { fontSize: 14.5, fontWeight: '800', marginBottom: 4 },
  notesText: { fontSize: 14, lineHeight: 19 },

  launchAssayBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f766e', borderRadius: 10, paddingVertical: 12, marginBottom: 14 },
  launchAssayBtnText: { color: '#fff', fontSize: 14.5, fontWeight: '800' },

  // Assay Cards in Profile Modal
  assayCard: { borderRadius: 10, padding: 12, borderWidth: 1, marginBottom: 12 },
  assayCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  assayCardTitle: { fontSize: 16, fontWeight: '800' },
  assayCardMeta: { fontSize: 13, marginTop: 2 },
  assayBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  assayBadgeText: { fontSize: 12, fontWeight: '800' },
  assayMetricsGrid: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  metricPill: { flex: 1, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  metricPillLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  metricPillVal: { fontSize: 14, fontWeight: '800', marginTop: 1 },

  miniChartBox: { borderRadius: 8, padding: 6, borderWidth: 1, marginTop: 4 },
  miniChartCaption: { fontSize: 12, textAlign: 'center', marginTop: 2 },

  emptyAssayBox: { borderRadius: 10, padding: 20, alignItems: 'center', borderWidth: 1 },
  emptyAssayTitle: { fontSize: 16, fontWeight: '800', marginTop: 8 },
  emptyAssaySub: { fontSize: 13.5, textAlign: 'center', marginTop: 4 },

  closeModalBtn: { borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 10 },
  closeModalBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Vertical Dropdown Selectors
  dropdownBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, marginTop: 4
  },
  dropdownBtnOpen: {},
  dropdownBtnTitle: { fontSize: 15, fontWeight: '700' },
  dropdownVerticalMenu: {
    borderWidth: 1, borderRadius: 8, marginTop: 4, overflow: 'hidden'
  },
  dropdownOptionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1
  },
  dropdownOptionRowActive: { backgroundColor: 'rgba(20,184,166,0.15)' },
  dropdownOptionTitle: { fontSize: 14.5, fontWeight: '600' },
  dropdownOptionTitleActive: { fontWeight: '800' },

  // Specimen Card in Profile Tab
  specimenCard: { borderRadius: 10, padding: 12, borderWidth: 1, marginBottom: 10 },
  specimenCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  specimenId: { fontSize: 15.5, fontWeight: '800' },
  specimenTestBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f766e', borderRadius: 8, paddingVertical: 8, marginTop: 8 },
  specimenTestBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
