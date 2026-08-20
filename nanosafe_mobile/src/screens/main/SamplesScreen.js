import React, { useState, useEffect, useContext } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  TextInput, Modal, ScrollView, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { ThemeContext } from '../../context/ThemeContext';
import apiClient from '../../api/client';
import {
  FlaskConical, Plus, X, ChevronRight, CheckCircle2,
  Clock, Archive, User, Droplet, ShieldCheck, Sparkles,
  Search, RefreshCw, Calendar, Tag, ChevronDown, Check, ArrowRight
} from 'lucide-react-native';

const sampleTypeColors = {
  Blood: '#f87171',
  Tissue: '#8b5cf6',
  'Cell Culture': '#14b8a6',
  Serum: '#fbbf24',
  Plasma: '#ec4899',
  Urine: '#eab308',
  Saliva: '#38bdf8',
  Biopsy: '#6366f1',
  Other: '#64748b',
};

const SAMPLE_TYPES = ['Blood', 'Tissue', 'Cell Culture', 'Serum', 'Plasma', 'Urine', 'Saliva', 'Biopsy', 'Other'];
const CELL_TYPES = ['HeLa', 'MCF-7', 'A549', 'HEK293', 'NIH-3T3', 'HepG2', 'Caco-2', 'CHO', 'Jurkat', 'PC12', 'Primary Keratinocytes', 'Primary Fibroblasts', 'Other'];
const STATUSES = ['Active', 'Processing', 'Completed', 'Archived'];

export default function SamplesScreen({ navigation }) {
  const { colors, isDark } = useContext(ThemeContext);
  const [samples, setSamples] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);

  const [form, setForm] = useState({
    sample_id: '',
    participant_id: '',
    sample_type: 'Cell Culture',
    cell_type: 'HeLa',
    sample_status: 'Active',
    collection_date: new Date().toISOString().split('T')[0],
    storage_condition: '-80°C Cryopreservation',
    notes: ''
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [samplesRes, participantsRes] = await Promise.all([
        apiClient.get('/samples/'),
        apiClient.get('/participants/'),
      ]);
      setSamples(samplesRes.data.samples || []);
      setParticipants(participantsRes.data.participants || []);
    } catch (e) {
      setError('Failed to load biological samples & patient records.');
    } finally {
      setLoading(false);
    }
  };

  const autoGenerateSampleId = () => {
    const year = new Date().getFullYear();
    const count = samples.length + 1;
    return `BIO-${year}-${String(count).padStart(3, '0')}`;
  };

  const openAddModal = () => {
    setForm({
      sample_id: autoGenerateSampleId(),
      participant_id: participants.length > 0 ? (participants[0].participantId || participants[0].participant_id) : '',
      sample_type: 'Cell Culture',
      cell_type: 'HeLa',
      sample_status: 'Active',
      collection_date: new Date().toISOString().split('T')[0],
      storage_condition: '-80°C Cryopreservation',
      notes: ''
    });
    setShowPatientDropdown(false);
    setShowAddModal(true);
  };

  const handleAdd = async () => {
    if (!form.sample_id.trim()) {
      Alert.alert('Validation', 'Sample ID / Barcode is required.');
      return;
    }
    try {
      setSaving(true);
      await apiClient.post('/samples/', {
        sampleId: form.sample_id.trim(),
        participantId: form.participant_id.trim() || undefined,
        sampleType: form.sample_type,
        cellType: form.cell_type,
        sampleStatus: form.sample_status,
        collectionDate: form.collection_date || undefined,
        storageCondition: form.storage_condition,
        notes: form.notes,
      });
      setShowAddModal(false);
      fetchData();
      Alert.alert('Success', `Biological Specimen ${form.sample_id} registered and linked.`);
    } catch (e) {
      Alert.alert('Registration Error', e.response?.data?.error || 'Failed to add biological sample.');
    } finally {
      setSaving(false);
    }
  };

  const selectedPatientObj = participants.find(
    p => (p.participantId || p.participant_id) === form.participant_id
  );

  const filtered = samples.filter(s => {
    const q = search.toLowerCase();
    const sid = (s.sampleId || s.sample_id || '').toLowerCase();
    const st = (s.sampleType || s.sample_type || '').toLowerCase();
    const ct = (s.cellType || s.cell_type || '').toLowerCase();
    const pid = (s.participantId || '').toLowerCase();
    const pname = (s.participantName || '').toLowerCase();
    const pbg = (s.participantBloodGroup || '').toLowerCase();

    const matchesSearch = !search || sid.includes(q) || st.includes(q) || ct.includes(q) || pid.includes(q) || pname.includes(q) || pbg.includes(q);
    const matchesType = filterType === 'All' || (s.sampleType || s.sample_type) === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Hero Banner with Clinical Bio-specimen context */}
      <View style={styles.heroBanner}>
        <View style={styles.tagBadge}>
          <Text style={styles.tagText}>🧫 BIO-SPECIMEN & CELL LINE REGISTRY</Text>
        </View>
        <Text style={styles.heroTitle}>Biological Samples & Patient Cells</Text>
        <Text style={styles.heroSub}>
          Track primary patient tissues, cryopreservation lots, and cell lines linked directly to in-vitro ZnO cytotoxicity bioassays.
        </Text>
      </View>

      {/* KPI Overview Pills */}
      <View style={styles.kpiRow}>
        <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.kpiValue, { color: colors.primary }]}>{samples.length}</Text>
          <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>Specimens</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.kpiValue, { color: '#f87171' }]}>
            {samples.filter(s => !!s.participantId).length}
          </Text>
          <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>Patient-Linked</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.kpiValue, { color: '#14b8a6' }]}>
            {samples.filter(s => (s.sampleStatus || s.sample_status) === 'Active').length}
          </Text>
          <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>Active Lots</Text>
        </View>
      </View>

      {/* Search & Add Bar */}
      <View style={styles.searchRow}>
        <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Search size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search specimen ID, patient code, blood group..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={openAddModal}>
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Filter Chips */}
      <View style={{ marginBottom: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {['All', ...SAMPLE_TYPES].map(type => (
            <TouchableOpacity
              key={type}
              style={[
                styles.typePill,
                { borderColor: colors.border, backgroundColor: colors.card },
                filterType === type && { backgroundColor: colors.primary, borderColor: colors.primary }
              ]}
              onPress={() => setFilterType(type)}
            >
              <Text style={[styles.typePillText, { color: colors.textMuted }, filterType === type && { color: '#fff', fontWeight: '800' }]}>
                {type} {type !== 'All' ? `(${samples.filter(s => (s.sampleType || s.sample_type) === type).length})` : `(${samples.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : error ? (
        <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <FlaskConical size={48} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.text }]}>No Biological Samples Found</Text>
          <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
            Register primary cell specimens and link them with consented clinical participants.
          </Text>
          <TouchableOpacity style={[styles.addFirstBtn, { backgroundColor: colors.primary }]} onPress={openAddModal}>
            <Plus size={16} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.addFirstBtnText}>Register First Specimen</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => {
            const sid = item.sampleId || item.sample_id;
            const st = item.sampleType || item.sample_type || 'Other';
            const ct = item.cellType || item.cell_type;
            const pid = item.participantId;
            const pname = item.participantName;
            const pbg = item.participantBloodGroup;
            const pconsent = item.participantConsent;
            const status = item.sampleStatus || item.sample_status || 'Active';
            const stColor = sampleTypeColors[st] || '#14b8a6';

            return (
              <TouchableOpacity
                style={[styles.sampleCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => setSelected(item)}
                activeOpacity={0.8}
              >
                {/* Header: Specimen ID & Type Badge */}
                <View style={styles.sampleCardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.sampleTypeDot, { backgroundColor: stColor }]} />
                    <Text style={[styles.sampleIdText, { color: colors.text }]}>{sid}</Text>
                    <View style={[styles.sampleTypeBadge, { backgroundColor: stColor + '20', borderColor: stColor }]}>
                      <Text style={[styles.sampleTypeBadgeText, { color: stColor }]}>{st}</Text>
                    </View>
                  </View>
                  <View style={[styles.statusBadge, {
                    backgroundColor: status === 'Active' ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)',
                    borderColor: status === 'Active' ? '#22c55e' : '#eab308'
                  }]}>
                    <Text style={[styles.statusText, { color: status === 'Active' ? '#22c55e' : '#eab308' }]}>
                      {status}
                    </Text>
                  </View>
                </View>

                {/* Linked Patient Info Box */}
                <View style={[styles.patientLinkBox, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: colors.border }]}>
                  {pid ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                        <User size={15} color={colors.primary} />
                        <Text style={[styles.patientLinkText, { color: colors.text }]} numberOfLines={1}>
                          <Text style={{ fontWeight: '800' }}>{pid}</Text> {pname ? `• ${pname}` : ''}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {pbg ? (
                          <View style={styles.bloodBadge}>
                            <Text style={styles.bloodBadgeText}>🩸 {pbg}</Text>
                          </View>
                        ) : null}
                        {pconsent ? (
                          <View style={[styles.consentPill, { backgroundColor: pconsent === 'Consented' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)' }]}>
                            <Text style={[styles.consentPillText, { color: pconsent === 'Consented' ? '#22c55e' : '#ef4444' }]}>
                              {pconsent}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <FlaskConical size={14} color={colors.textMuted} />
                      <Text style={[styles.unlinkedText, { color: colors.textMuted }]}>
                        Preclinical Specimen (Unlinked to clinical subject)
                      </Text>
                    </View>
                  )}
                </View>

                {/* Footer Metadata */}
                <View style={styles.sampleCardFooter}>
                  <Text style={[styles.cellLineLabel, { color: colors.textMuted }]}>
                    🧬 Lineage: <Text style={{ color: colors.text, fontWeight: '700' }}>{ct || 'Standard Culture'}</Text>
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <Text style={[styles.viewDetailsText, { color: colors.primary }]}>View Details</Text>
                    <ChevronRight size={14} color={colors.primary} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* ============================================================ */}
      {/* ➕ REGISTER BIOLOGICAL SAMPLE MODAL                          */}
      {/* ============================================================ */}
      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => setShowAddModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
        >
          <View style={[styles.modalCard, { backgroundColor: isDark ? '#0f172a' : '#ffffff', borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>🧫 Register Biological Sample</Text>
                <Text style={[styles.modalSub, { color: colors.textMuted }]}>Link bio-specimens with clinical study participants</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <X size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
              {/* 1. Sample ID */}
              <View style={styles.formGroup}>
                <View style={styles.labelRow}>
                  <Text style={[styles.label, { color: colors.text }]}>Sample ID / Barcode *</Text>
                  <TouchableOpacity onPress={() => setForm({ ...form, sample_id: autoGenerateSampleId() })}>
                    <Text style={[styles.autoGenBtnText, { color: colors.primary }]}>Auto-Generate</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[styles.input, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', color: colors.text, borderColor: colors.border, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontWeight: '700' }]}
                  placeholder="e.g. BIO-2026-001"
                  placeholderTextColor={colors.textMuted}
                  value={form.sample_id}
                  onChangeText={(v) => setForm({ ...form, sample_id: v })}
                />
              </View>

              {/* 2. Interactive Study Participant Selector */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>👤 Link to Study Participant (Patient)</Text>
                <TouchableOpacity
                  style={[styles.dropdownBtn, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: colors.border }]}
                  onPress={() => setShowPatientDropdown(!showPatientDropdown)}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                    <User size={16} color={form.participant_id ? colors.primary : colors.textMuted} />
                    <Text style={[styles.dropdownBtnTitle, { color: form.participant_id ? colors.text : colors.textMuted }]} numberOfLines={1}>
                      {form.participant_id ? (
                        selectedPatientObj
                          ? `[${selectedPatientObj.participantId || selectedPatientObj.participant_id}] ${selectedPatientObj.name || 'Participant'} (🩸 ${selectedPatientObj.bloodGroup || selectedPatientObj.blood_group || 'O+'})`
                          : `[${form.participant_id}]`
                      ) : 'None (Preclinical / Unlinked)'}
                    </Text>
                  </View>
                  <ChevronDown size={18} color={colors.textMuted} />
                </TouchableOpacity>

                {showPatientDropdown && (
                  <View style={[styles.dropdownVerticalMenu, { backgroundColor: isDark ? '#1e293b' : '#ffffff', borderColor: colors.border }]}>
                    <ScrollView nestedScrollEnabled style={{ maxHeight: 220 }}>
                      <TouchableOpacity
                        style={[styles.dropdownOptionRow, { borderBottomColor: colors.border }, !form.participant_id && styles.dropdownOptionRowActive]}
                        onPress={() => {
                          setForm({ ...form, participant_id: '' });
                          setShowPatientDropdown(false);
                        }}
                      >
                        <Text style={[styles.dropdownOptionTitle, { color: colors.text }]}>🧪 Preclinical Screening (No Patient Linked)</Text>
                        {!form.participant_id && <Check size={16} color={colors.primary} />}
                      </TouchableOpacity>

                      {participants.map(p => {
                        const pid = p.participantId || p.participant_id;
                        const isSel = form.participant_id === pid;
                        return (
                          <TouchableOpacity
                            key={pid}
                            style={[styles.dropdownOptionRow, { borderBottomColor: colors.border }, isSel && styles.dropdownOptionRowActive]}
                            onPress={() => {
                              setForm({ ...form, participant_id: pid });
                              setShowPatientDropdown(false);
                            }}
                          >
                            <View>
                              <Text style={[styles.dropdownOptionTitle, { color: colors.text, fontWeight: '700' }]}>
                                👤 {pid} {p.name ? `• ${p.name}` : ''}
                              </Text>
                              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                                🩸 Blood: {p.bloodGroup || p.blood_group || 'O+'} • Cohort: {p.studyGroup || p.study_group || 'General'}
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

              {/* 3. Sample Type */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Sample Matrix / Specimen Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chipRow}>
                    {SAMPLE_TYPES.map((t) => (
                      <TouchableOpacity
                        key={t}
                        style={[
                          styles.chip,
                          { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: colors.border },
                          form.sample_type === t && { backgroundColor: colors.primary, borderColor: colors.primary }
                        ]}
                        onPress={() => setForm({ ...form, sample_type: t })}
                      >
                        <Text style={[styles.chipText, { color: colors.textMuted }, form.sample_type === t && { color: '#fff', fontWeight: '800' }]}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {/* 4. Cell Line / Primary Lineage */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Cell Line / Biological Lineage</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chipRow}>
                    {CELL_TYPES.map((c) => (
                      <TouchableOpacity
                        key={c}
                        style={[
                          styles.chip,
                          { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: colors.border },
                          form.cell_type === c && { backgroundColor: colors.primary, borderColor: colors.primary }
                        ]}
                        onPress={() => setForm({ ...form, cell_type: c })}
                      >
                        <Text style={[styles.chipText, { color: colors.textMuted }, form.cell_type === c && { color: '#fff', fontWeight: '800' }]}>{c}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {/* 5. Sample Status & Storage Condition */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Storage Condition</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', color: colors.text, borderColor: colors.border }]}
                  placeholder="e.g. -80°C Cryopreservation, Liquid N2 Tank B"
                  placeholderTextColor={colors.textMuted}
                  value={form.storage_condition}
                  onChangeText={(v) => setForm({ ...form, storage_condition: v })}
                />
              </View>

              {/* 6. Research Notes */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Research Notes & Culture History</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', color: colors.text, borderColor: colors.border, minHeight: 65 }]}
                  placeholder="Passage #, primary isolation protocol, donor consent reference..."
                  placeholderTextColor={colors.textMuted}
                  value={form.notes}
                  onChangeText={(v) => setForm({ ...form, notes: v })}
                  multiline
                />
              </View>

              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleAdd} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Register Biological Specimen</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ============================================================ */}
      {/* 📋 SPECIMEN DETAIL & ASSAY LAUNCH MODAL                      */}
      {/* ============================================================ */}
      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: isDark ? '#0f172a' : '#ffffff', borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>🧫 Bio-Specimen Record</Text>
                <Text style={[styles.modalSub, { color: colors.textMuted }]}>{selected?.sampleId || selected?.sample_id}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <X size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {selected && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
                {/* 1-Tap Assay Launcher Button */}
                <TouchableOpacity
                  style={styles.launchAssayBtn}
                  onPress={() => {
                    const sel = selected;
                    setSelected(null);
                    if (navigation?.navigate) {
                      navigation.navigate('NewAnalysis', {
                        prefillPatientId: sel.participantId,
                        prefillSampleName: `${sel.sampleId || sel.sample_id} (${sel.sampleType || 'Specimen'})`,
                        prefillCellLine: sel.cellType || 'HeLa',
                      });
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <FlaskConical size={16} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.launchAssayBtnText}>⚡ Run Cytotoxicity Assay for this Specimen</Text>
                </TouchableOpacity>

                {/* Linked Patient Profile Card */}
                {selected.participantId ? (
                  <View style={[styles.detailPatientCard, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: colors.border }]}>
                    <Text style={[styles.detailPatientCardTitle, { color: colors.primary }]}>👤 Linked Clinical Participant</Text>
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Patient Code</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>{selected.participantId}</Text>
                    </View>
                    {selected.participantName ? (
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Pseudonym / Name</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>{selected.participantName}</Text>
                      </View>
                    ) : null}
                    {selected.participantBloodGroup ? (
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Blood Group</Text>
                        <Text style={[styles.detailValue, { color: '#f87171' }]}>🩸 {selected.participantBloodGroup}</Text>
                      </View>
                    ) : null}
                    {selected.participantCohort ? (
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Study Cohort</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>{selected.participantCohort}</Text>
                      </View>
                    ) : null}
                    {selected.participantConsent ? (
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Consent Status</Text>
                        <Text style={[styles.detailValue, { color: selected.participantConsent === 'Consented' ? '#22c55e' : '#ef4444' }]}>
                          {selected.participantConsent}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {/* Specimen Properties */}
                <View style={[styles.detailCard, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: colors.border }]}>
                  <Text style={[styles.detailPatientCardTitle, { color: colors.primary }]}>🔬 Specimen Properties</Text>
                  {[
                    ['Sample ID', selected.sampleId || selected.sample_id],
                    ['Sample Type', selected.sampleType || selected.sample_type || 'N/A'],
                    ['Cell Line', selected.cellType || selected.cell_type || 'N/A'],
                    ['Sample Status', selected.sampleStatus || selected.sample_status || 'Active'],
                    ['Storage Condition', selected.storageCondition || '-80°C Cryopreservation'],
                    ['Collection Date', selected.collectionDate || 'Recorded'],
                    ['Linked Analyses', selected.linkedExperimentsCount ?? 0],
                    ['Notes', selected.notes || 'No additional notes provided.'],
                  ].map(([label, value]) => (
                    <View key={label} style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{label}</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>{String(value)}</Text>
                    </View>
                  ))}
                </View>

                <TouchableOpacity style={[styles.closeModalBtn, { backgroundColor: colors.primary }]} onPress={() => setSelected(null)}>
                  <Text style={styles.closeModalBtnText}>Close Record</Text>
                </TouchableOpacity>
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
  heroTitle: { color: '#fff', fontSize: 21, fontWeight: '800' },
  heroSub: { color: '#e0f2fe', fontSize: 14, marginTop: 4, lineHeight: 19, opacity: 0.9 },

  // KPI Row
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  kpiCard: {
    flex: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 6,
    alignItems: 'center', borderWidth: 1,
  },
  kpiValue: { fontSize: 20, fontWeight: '800' },
  kpiLabel: { fontSize: 12, marginTop: 2, fontWeight: '600', textTransform: 'uppercase' },

  // Search & Action
  searchRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: 10 },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    borderRadius: borderRadius.md, paddingHorizontal: 12, borderWidth: 1,
  },
  searchInput: { flex: 1, paddingVertical: 9, fontSize: 15 },
  addBtn: {
    borderRadius: borderRadius.md, width: 44, height: 44,
    justifyContent: 'center', alignItems: 'center',
  },

  // Type Pills
  typePill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  typePillText: { fontSize: 13, fontWeight: '600' },

  // Sample Card
  sampleCard: { borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1 },
  sampleCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sampleTypeDot: { width: 10, height: 10, borderRadius: 5 },
  sampleIdText: { fontSize: 16, fontWeight: '800' },
  sampleTypeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  sampleTypeBadgeText: { fontSize: 11.5, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  statusText: { fontSize: 12, fontWeight: '700' },

  patientLinkBox: { borderRadius: 8, padding: 8, marginBottom: 8, borderWidth: 1 },
  patientLinkText: { fontSize: 13.5 },
  bloodBadge: { backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  bloodBadgeText: { fontSize: 12, fontWeight: '800', color: '#ef4444' },
  consentPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  consentPillText: { fontSize: 11.5, fontWeight: '800' },
  unlinkedText: { fontSize: 12.5 },

  sampleCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cellLineLabel: { fontSize: 13 },
  viewDetailsText: { fontSize: 13, fontWeight: '700' },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 19, fontWeight: '700', marginTop: spacing.md },
  emptySubtext: { fontSize: 14, marginTop: 4, textAlign: 'center', maxWidth: 280 },
  addFirstBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, marginTop: 16 },
  addFirstBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  errorText: { textAlign: 'center', marginTop: 40 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
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
  formGroup: { marginBottom: 12 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  label: { fontSize: 13.5, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  autoGenBtnText: { fontSize: 12.5, fontWeight: '800' },
  input: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15.5 },
  chipRow: { flexDirection: 'row', gap: 6, paddingVertical: 4 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1 },
  chipText: { fontSize: 13.5 },
  saveBtn: { borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Dropdown for Patients
  dropdownBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11 },
  dropdownBtnTitle: { fontSize: 14.5, fontWeight: '600' },
  dropdownVerticalMenu: { borderWidth: 1, borderRadius: 8, marginTop: 4, overflow: 'hidden' },
  dropdownOptionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  dropdownOptionRowActive: { backgroundColor: 'rgba(20,184,166,0.15)' },
  dropdownOptionTitle: { fontSize: 14 },

  // Detail Modal Elements
  launchAssayBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f766e', borderRadius: 10, paddingVertical: 12, marginBottom: 12 },
  launchAssayBtnText: { color: '#fff', fontSize: 14.5, fontWeight: '800' },
  detailPatientCard: { borderRadius: 10, padding: 12, borderWidth: 1, marginBottom: 12 },
  detailPatientCardTitle: { fontSize: 14.5, fontWeight: '800', marginBottom: 6 },
  detailCard: { borderRadius: 10, padding: 12, borderWidth: 1, marginBottom: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1 },
  detailLabel: { fontSize: 14 },
  detailValue: { fontSize: 14, fontWeight: '700' },
  closeModalBtn: { borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 6 },
  closeModalBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
