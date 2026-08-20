import React, { useState, useContext } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity
} from 'react-native';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { ThemeContext } from '../../context/ThemeContext';
import { LanguageContext } from '../../context/LanguageContext';
import { BookOpen, ShieldCheck, HeartPulse, Dna, ChevronDown, ChevronUp, Info, HelpCircle } from 'lucide-react-native';

const ISO_TABLE = [
  { tier: '🟢 Low Risk (Safe)', viab: '≥ 80.0%', ros: '≤ 1.5×', ldh: '≤ 10.0%', apop: '≤ 8.0%', action: 'PASS: Biocompatible for clinical use', tierType: 'safe' },
  { tier: '🟡 Moderate Risk', viab: '70.0% – 79.9%', ros: '1.5× – 3.0×', ldh: '10.0% – 20.0%', apop: '8.0% – 15.0%', action: 'CONDITIONAL: Low-dose surveillance required', tierType: 'moderate' },
  { tier: '🔴 High Risk (Toxic)', viab: '< 70.0%', ros: '> 3.0×', ldh: '> 20.0%', apop: '> 15.0%', action: 'FAIL: Cytotoxic; exceeds cellular tolerance', tierType: 'danger' },
];

const ASTM_TABLE = [
  { tier: '🟢 Non-Hemolytic (< 2.0%)', hemo: '< 2.0%', rbc: 'Intact erythrocyte membrane, no hemoglobin leakage', action: 'PASS: Safe for vascular & blood-contacting devices', tierType: 'safe' },
  { tier: '🟡 Slightly Hemolytic (2.0 – 5.0%)', hemo: '2.0% – 5.0%', rbc: 'Minor red blood cell lysis under shear stress', action: 'CONDITIONAL: Surface passivation (PEG) required', tierType: 'moderate' },
  { tier: '🔴 Hemolytic (> 5.0%)', hemo: '> 5.0%', rbc: 'Severe erythrocyte rupture and free hemoglobin release', action: 'FAIL: Unacceptable for vascular contact / high risk', tierType: 'danger' },
];

const CLINICAL_APPS = [
  { title: '🩹 Wound Dressings & Antimicrobial', desc: 'ZnO nanoparticles act as an active antimicrobial barrier, promoting re-epithelialization and collagen synthesis while inhibiting bacterial colonization.', targetViab: '≥ 80%', range: '10 – 30 µg/mL', targetCell: 'Fibroblasts / Keratinocytes', borderKey: 'primary' },
  { title: '🦷 Dental Biomaterials & Cements', desc: 'Used in root canal sealers and restorative liners to prevent secondary caries without triggering gingival necrosis.', targetViab: '≥ 75%', range: '15 – 40 µg/mL', targetCell: 'Gingival Fibroblasts', borderKey: 'accent' },
  { title: '💊 Targeted Drug Delivery', desc: 'Formulated as pH-sensitive nanocarriers for targeted delivery. Demands highest safety margins to prevent vascular lysis.', targetViab: '≥ 90%', range: '5 – 15 µg/mL', targetCell: 'Endothelial Lines', borderKey: 'purple' },
  { title: '🧫 Tissue Engineering & Scaffolds', desc: 'Incorporated into scaffolds to stimulate osteoblast proliferation and extracellular matrix mineralization.', targetViab: '≥ 85%', range: '10 – 25 µg/mL', targetCell: 'Osteoblasts / Stem Cells', borderKey: 'safe' },
];

const MECHANISMS = [
  { title: '⚡ Particle Size & Surface Area', text: 'Particles <30 nm exhibit increased surface reactivity and rapid uptake, leading to higher dissolution rates than >50 nm particles.' },
  { title: '🧪 Zn²⁺ Ion Release & ROS Cascade', text: 'Intracellular dissolution of Zn²⁺ ions disrupts mitochondrial membrane potential, triggering oxidative stress and caspase cascades.' },
  { title: '⏱️ Exposure Time Dynamics', text: 'Prolonged exposure (48h–72h) shifts the effective IC50 downward due to cumulative intracellular zinc ion accumulation.' },
];

const FAQS = [
  {
    q: '1. In what medical applications are ZnO nanoparticles considered, and why is safety evaluation important?',
    a: 'Zinc oxide nanoparticles are commonly considered for wound dressings, antimicrobial coatings, dental materials, drug delivery systems, and tissue engineering because they possess strong antibacterial activity and promote healing.\n\nHowever, their nanoscale size allows them to interact with and enter intracellular compartments, potentially causing oxidative stress if unmonitored. Safety evaluation defines clear concentration ceilings so therapeutic benefits are achieved without patient harm.'
  },
  {
    q: '2. What is the main challenge in establishing nanoparticle safety?',
    a: 'Biological behavior varies dynamically with particle size, concentration, surface chemistry, and cell line. A dose tolerated in one tissue may become cytotoxic in another. In addition, distinguishing nanoparticle-specific effects from soluble Zn²⁺ ion effects requires standardized multi-biomarker testing.'
  },
  {
    q: '3. What occurs clinically if cytotoxicity thresholds are exceeded?',
    a: 'Exceeding safe dosage triggers acute inflammatory cascades, cellular necrosis, impaired tissue regeneration, and systemic absorption risks, directly compromising patient safety and therapy efficacy.'
  },
  {
    q: '4. What evidence confirms a nanoparticle concentration is biocompatible?',
    a: 'High viability (≥80–90%), baseline ROS levels (≤1.5×), minimal LDH membrane leakage (≤10%), normal cell morphology, and absence of excessive apoptosis under ISO 10993-5 standards.'
  }
];

export default function ClinicalGuideScreen() {
  const { t } = useContext(LanguageContext);
  const { colors, isDark } = useContext(ThemeContext);
  const [expandedFaq, setExpandedFaq] = useState(null);

  const toggleFaq = (idx) => {
    setExpandedFaq(expandedFaq === idx ? null : idx);
  };

  const getTierColor = (type) => {
    if (type === 'safe') return colors.safe;
    if (type === 'moderate') return colors.moderate;
    return colors.danger;
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>{t('isoStandardsTitle', 'Clinical Standards & Bio-Reference')}</Text>
        <Text style={styles.heroSub}>
          ISO 10993-5 regulatory evaluation framework, clinical therapeutic windows, and mechanistic cytotoxicity guidelines for ZnO nanoparticles.
        </Text>
      </View>

      {/* 1. ISO Standards Section */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <ShieldCheck size={20} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('conformance', 'ISO 10993-5 Framework')}</Text>
        </View>
        <Text style={[styles.sectionSub, { color: colors.textMuted }]}>International in vitro cytotoxicity criteria for medical nanomaterials.</Text>

        {ISO_TABLE.map((item) => {
          const c = getTierColor(item.tierType);
          return (
            <View key={item.tier} style={[styles.isoCard, { backgroundColor: colors.inputBg, borderColor: colors.border, borderLeftColor: c }]}>
              <View style={styles.isoCardTop}>
                <Text style={[styles.isoTier, { color: c }]}>{item.tier}</Text>
                <Text style={[styles.isoViab, { color: colors.textSecondary }]}>Viability: <Text style={{ fontWeight: '800', color: colors.text }}>{item.viab}</Text></Text>
              </View>
              <View style={styles.isoMetricsRow}>
                <Text style={[styles.isoMetric, { color: colors.textMuted }]}>ROS: {item.ros}</Text>
                <Text style={[styles.isoMetric, { color: colors.textMuted }]}>LDH: {item.ldh}</Text>
                <Text style={[styles.isoMetric, { color: colors.textMuted }]}>Apop: {item.apop}</Text>
              </View>
              <Text style={[styles.isoAction, { color: colors.textSecondary }]}>{item.action}</Text>
            </View>
          );
        })}
      </View>

            {/* 2. ASTM F756 Hemocompatibility Standards */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <ShieldCheck size={20} color="#dc2626" />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>ASTM F756 Hemocompatibility Standard</Text>
        </View>
        <Text style={[styles.sectionSub, { color: colors.textMuted }]}>Standard practice for assessment of hemolytic properties in medical nanomaterials (Paper 3).</Text>

        {ASTM_TABLE.map((item) => {
          const c = getTierColor(item.tierType);
          return (
            <View key={item.tier} style={[styles.isoCard, { backgroundColor: colors.inputBg, borderColor: colors.border, borderLeftColor: c }]}>
              <View style={styles.isoCardTop}>
                <Text style={[styles.isoTier, { color: c }]}>{item.tier}</Text>
                <Text style={[styles.isoViab, { color: colors.textSecondary }]}>Index: <Text style={{ fontWeight: '800', color: colors.text }}>{item.hemo}</Text></Text>
              </View>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginVertical: 4 }}>{item.rbc}</Text>
              <Text style={[styles.isoAction, { color: colors.textSecondary }]}>{item.action}</Text>
            </View>
          );
        })}
      </View>

      {/* 2. Clinical Applications */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <HeartPulse size={20} color={colors.accent} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('dosageSafe', 'Therapeutic Dosage Windows')}</Text>
        </View>
        <Text style={[styles.sectionSub, { color: colors.textMuted }]}>Target biocompatibility profiles by clinical domain.</Text>

        {CLINICAL_APPS.map((app) => {
          const borderColor = app.borderKey === 'primary' ? colors.primary : (app.borderKey === 'accent' ? colors.accent : (app.borderKey === 'safe' ? colors.safe : '#8b5cf6'));
          return (
            <View key={app.title} style={[styles.appCard, { backgroundColor: colors.inputBg, borderColor: colors.border, borderLeftColor: borderColor }]}>
              <Text style={[styles.appTitle, { color: colors.text }]}>{app.title}</Text>
              <Text style={[styles.appDesc, { color: colors.textMuted }]}>{app.desc}</Text>
              <View style={styles.specRow}>
                <View style={[styles.specPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.specPillText, { color: colors.textSecondary }]}>Target: {app.targetViab}</Text>
                </View>
                <View style={[styles.specPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.specPillText, { color: colors.textSecondary }]}>Dose: {app.range}</Text>
                </View>
                <View style={[styles.specPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.specPillText, { color: colors.textSecondary }]}>{app.targetCell}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* 3. Mechanistic Toxicology */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Dna size={20} color={colors.safe} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Cytotoxicity Mechanisms</Text>
        </View>
        <Text style={[styles.sectionSub, { color: colors.textMuted }]}>Physicochemical drivers influencing biocompatibility.</Text>

        {MECHANISMS.map((m) => (
          <View key={m.title} style={[styles.mechCard, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <Text style={[styles.mechTitle, { color: colors.text }]}>{m.title}</Text>
            <Text style={[styles.mechText, { color: colors.textMuted }]}>{m.text}</Text>
          </View>
        ))}
      </View>

      {/* 4. Expert Q&A Accordion */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <HelpCircle size={20} color={colors.moderate} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Expert Clinical Q&A</Text>
        </View>
        <Text style={[styles.sectionSub, { color: colors.textMuted }]}>Authoritative responses for clinical translation and toxicology.</Text>

        {FAQS.map((faq, idx) => {
          const isExpanded = expandedFaq === idx;
          return (
            <View key={idx} style={[styles.faqCard, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <TouchableOpacity style={styles.faqHeader} onPress={() => toggleFaq(idx)}>
                <Text style={[styles.faqQuestion, { color: colors.text }]}>{faq.q}</Text>
                {isExpanded ? <ChevronUp size={18} color={colors.primary} /> : <ChevronDown size={18} color={colors.textMuted} />}
              </TouchableOpacity>
              {isExpanded && (
                <View style={[styles.faqBody, { borderTopColor: colors.border }]}>
                  <Text style={[styles.faqAnswer, { color: colors.textSecondary }]}>{faq.a}</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 40 },
  hero: {
    backgroundColor: '#0f766e',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  heroTitle: { fontSize: 23, fontWeight: '800', color: '#fff' },
  heroSub: { fontSize: 14.5, color: '#e0f2fe', marginTop: 4, lineHeight: 20 },
  section: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  sectionTitle: { fontSize: 18.5, fontWeight: '800' },
  sectionSub: { fontSize: 14.5, marginBottom: spacing.md },
  isoCard: {
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    borderWidth: 1,
  },
  isoCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  isoTier: { fontSize: 15.5, fontWeight: '800' },
  isoViab: { fontSize: 14.5 },
  isoMetricsRow: { flexDirection: 'row', gap: 12, marginVertical: 4 },
  isoMetric: { fontSize: 13.5, fontWeight: '600' },
  isoAction: { fontSize: 13.5, marginTop: 4, fontStyle: 'italic' },
  appCard: {
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    borderWidth: 1,
  },
  appTitle: { fontSize: 16.5, fontWeight: '800', marginBottom: 4 },
  appDesc: { fontSize: 14.5, lineHeight: 20, marginBottom: 8 },
  specRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  specPill: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  specPillText: { fontSize: 12.5, fontWeight: '700' },
  mechCard: {
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
  },
  mechTitle: { fontSize: 15.5, fontWeight: '700', marginBottom: 2 },
  mechText: { fontSize: 14, lineHeight: 19 },
  faqCard: {
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
  },
  faqQuestion: { fontSize: 15.5, fontWeight: '700', flex: 1, marginRight: 8, lineHeight: 20 },
  faqBody: {
    padding: spacing.sm,
    paddingTop: 0,
    borderTopWidth: 1,
  },
  faqAnswer: { fontSize: 14.5, lineHeight: 21, marginTop: 8 },
});
