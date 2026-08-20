import React, { useState, useEffect, useContext } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions, Image
} from 'react-native';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { ThemeContext } from '../../context/ThemeContext';
import { AuthContext } from '../../context/AuthContext';
import { LanguageContext } from '../../context/LanguageContext';
import apiClient from '../../api/client';
import {
  Activity, PlusCircle, Award, AlertTriangle, ShieldAlert,
  Cpu, Users, FlaskConical, Gauge, CheckCircle2, ShieldCheck,
  ChevronRight, Sparkles, Sliders, Columns3, BookOpen, Clock, Shield
} from 'lucide-react-native';

const APP_LOGO = require('../../assets/logo.png');

export default function DashboardScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const { t } = useContext(LanguageContext);
  const { colors, isDark } = useContext(ThemeContext);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = async () => {
    try {
      const res = await apiClient.get('/history/');
      setHistory(res.data || []);
    } catch (e) {
      console.error('Fetch history error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

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

  const totalExperiments = history.length;
  const safeCount = history.filter(h => {
    const r = (h.result || h.safety_level || '').toLowerCase();
    return r.includes('safe') || r.includes('low') || r.includes('pass') || (parseFloat(h.viability || h.cell_viability) >= 80);
  }).length;

  const avgViability = totalExperiments > 0
    ? (history.reduce((acc, cur) => acc + (parseFloat(cur.viability) || parseFloat(cur.cell_viability) || 80), 0) / totalExperiments).toFixed(1)
    : '0.0';

  const avgToxicity = totalExperiments > 0
    ? (history.reduce((acc, cur) => acc + (parseFloat(cur.toxicityScore ?? cur.toxicity_score) || 0), 0) / totalExperiments).toFixed(1)
    : '0.0';

  const passRate = totalExperiments > 0
    ? ((safeCount / totalExperiments) * 100).toFixed(0)
    : '100';

  const quickActions = [
    {
      label: t('newAnalysis', 'New Experiment'),
      sub: t('step3Dose', 'Multi-Dose 4PL IC50 & Viability'),
      icon: PlusCircle,
      screen: 'NewAnalysis',
      accent: colors.primary,
      bg: colors.primaryLight,
    },
    {
      label: t('compare', 'Multi-Compare'),
      sub: t('sideBySide', 'Side-by-Side Curve Overlay'),
      icon: Columns3,
      screen: 'Compare',
      accent: colors.accent,
      bg: colors.accentLight,
    },
    {
      label: t('simulator', 'Dose Simulator'),
      sub: t('sandbox', 'Interactive What-If Sandbox'),
      icon: Sliders,
      screen: 'Simulator',
      accent: '#a855f7',
      bg: 'rgba(168, 85, 247, 0.12)',
    },
    {
      label: t('patients', 'Study Participants'),
      sub: t('clinicalCohorts', 'Clinical Cohorts & Assays'),
      icon: Users,
      screen: 'Participants',
      accent: colors.safe,
      bg: colors.safeBg,
    },
    {
      label: t('samples', 'Biological Samples'),
      sub: t('samplesSub', 'Cell Line Library & Specs'),
      icon: FlaskConical,
      screen: 'Samples',
      accent: '#ec4899',
      bg: 'rgba(236, 72, 153, 0.12)',
    },
    {
      label: t('isoGuide', 'Clinical Standards'),
      sub: t('isoSub', 'ISO 10993-5 Bio-Reference'),
      icon: BookOpen,
      screen: 'ClinicalGuide',
      accent: colors.moderate,
      bg: colors.moderateBg,
    },
  ];

  const getStatusBadge = (item) => {
    const viab = parseFloat(item.viability || item.cell_viability || 0);
    const r = (item.result || item.safety_level || '').toLowerCase();
    if (viab >= 80 || r.includes('safe') || r.includes('pass')) {
      return { label: 'SAFE', color: colors.safe, bg: colors.safeBg, border: colors.safeBorder };
    }
    if (viab >= 60 || r.includes('moderate')) {
      return { label: 'MODERATE', color: colors.moderate, bg: colors.moderateBg, border: colors.moderateBorder };
    }
    return { label: 'TOXIC', color: colors.danger, bg: colors.dangerBg, border: colors.dangerBorder };
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchHistory(); }}
          tintColor={colors.primary}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Project Title Banner */}
      <View style={[styles.projectTitleCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: colors.primary }]}>
        <Text style={[styles.projectTitleLabel, { color: colors.primary }]}>
          {t('researchProject', 'BIOMEDICAL RESEARCH INITIATIVE')}
        </Text>
        <Text style={[styles.projectTitle, { color: colors.text }]}>
          {t('projectTitle', 'Evaluation of the Biocompatibility and Cytotoxicity of ZnO Nanoparticles to Determine Safe Biomedical Usage Levels')}
        </Text>
      </View>

      {/* Hero Welcome Card */}
      <View style={[styles.heroCard, { backgroundColor: isDark ? '#131d31' : '#ffffff', borderColor: colors.border }]}>
        <View style={styles.heroLeft}>
          <View style={[styles.statusPill, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
            <View style={[styles.liveDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.statusPillText, { color: colors.primary }]}>
              {t('mlEngineActive', 'ML Toxicology Engine Active')}
            </Text>
          </View>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>
            {t('welcomeBack', 'Welcome back,')}
          </Text>
          <Text style={[styles.userName, { color: colors.text }]}>
            {user?.username || 'Lead Researcher'}
          </Text>
          <Text style={[styles.heroTagline, { color: colors.textMuted }]}>
            {t('appSub', 'ZnO Nanoparticle Biocompatibility & ISO 10993-5 Suite')}
          </Text>
        </View>
        <View style={[styles.heroLogoContainer, { backgroundColor: colors.background, borderColor: colors.primary }]}>
          <Image source={APP_LOGO} style={styles.heroLogo} resizeMode="cover" />
        </View>
      </View>

      {/* 4-Stat Metric KPI Cards (Matching Web App) */}
      <View style={styles.metricsGrid}>
        {/* Metric 1: Total Assays */}
        <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: colors.primary }]}>
          <View style={[styles.metricIconWrap, { backgroundColor: colors.primaryLight }]}>
            <Activity size={18} color={colors.primary} />
          </View>
          <Text style={[styles.metricVal, { color: colors.text }]}>{totalExperiments}</Text>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{t('totalAssays', 'Total Bio-Assays')}</Text>
        </View>

        {/* Metric 2: Avg Viability */}
        <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: colors.safe }]}>
          <View style={[styles.metricIconWrap, { backgroundColor: colors.safeBg }]}>
            <ShieldCheck size={18} color={colors.safe} />
          </View>
          <Text style={[styles.metricVal, { color: colors.safe }]}>{avgViability}%</Text>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{t('avgViability', 'Mean Viability')}</Text>
        </View>

        {/* Metric 3: Mean Toxicity Score */}
        <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: colors.accent }]}>
          <View style={[styles.metricIconWrap, { backgroundColor: colors.accentLight }]}>
            <Cpu size={18} color={colors.accent} />
          </View>
          <Text style={[styles.metricVal, { color: colors.accent }]}>{avgToxicity}</Text>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{t('toxicityScore', 'Toxicity Index')}</Text>
        </View>

        {/* Metric 4: Safety Pass Rate */}
        <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: colors.moderate }]}>
          <View style={[styles.metricIconWrap, { backgroundColor: colors.moderateBg }]}>
            <Award size={18} color={colors.moderate} />
          </View>
          <Text style={[styles.metricVal, { color: colors.moderate }]}>{passRate}%</Text>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{t('safetyCompliance', 'ISO Pass Rate')}</Text>
        </View>
      </View>

      {/* Quick Launch Action Hub */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('quickModules', 'Enterprise Research Modules')}</Text>
      </View>
      <View style={styles.actionsGrid}>
        {quickActions.map(({ label, sub, icon: Icon, screen, accent, bg }) => (
          <TouchableOpacity
            key={screen}
            style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => navigation.navigate(screen)}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconBox, { backgroundColor: bg, borderColor: accent }]}>
              <Icon size={20} color={accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionTitle, { color: colors.text }]}>{label}</Text>
              <Text style={[styles.actionSub, { color: colors.textMuted }]}>{sub}</Text>
            </View>
            <ChevronRight size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Recent Experiments Activity Stream */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('recentExperiments', 'Recent Experiment Activity')}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('History')}>
          <Text style={[styles.viewAllText, { color: colors.primary }]}>{t('viewAll', 'View All Records →')}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
      ) : history.length === 0 ? (
        <View style={[styles.cleanEmptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.cleanEmptyIcon}>🧪</Text>
          <Text style={[styles.cleanEmptyTitle, { color: colors.text }]}>{t('noExperimentsYet', 'No Experiments Recorded')}</Text>
          <Text style={[styles.cleanEmptySub, { color: colors.textMuted }]}>
            {t('runFirstAnalysis', 'Start a new 4PL dose-response experiment to track cytotoxicity data.')}
          </Text>
        </View>
      ) : (
        history.slice(0, 5).map((item, idx) => {
          const badge = getStatusBadge(item);
          const sampleName = item.sample_name || item.name || `Assay #${item.id || idx + 1}`;
          const cellLine = item.cell_line || 'HeLa';
          const viab = item.viability || item.cell_viability || '85.0';

          return (
            <TouchableOpacity
              key={item.id || idx}
              style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => navigation.navigate('History')}
              activeOpacity={0.7}
            >
              <View style={[styles.riskStripe, { backgroundColor: badge.color }]} />
              <View style={styles.historyBody}>
                <View style={styles.historyMainRow}>
                  <Text style={[styles.historyName, { color: colors.text }]} numberOfLines={1}>{sampleName}</Text>
                  <View style={[styles.badge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                    <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                  </View>
                </View>
                <View style={styles.historyMetaRow}>
                  <Text style={[styles.historyMeta, { color: colors.textMuted }]}>
                    {cellLine} · Viability: <Text style={{ color: badge.color, fontWeight: '700' }}>{parseFloat(viab).toFixed(1)}%</Text>
                  </Text>
                  <Text style={[styles.historyScore, { color: colors.textSecondary }]}>
                    {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Recent'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },

  // Project Title Banner
  projectTitleCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  projectTitleLabel: {
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  projectTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    lineHeight: 20,
  },

  // Hero Card
  heroCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroLeft: { flex: 1, paddingRight: 10 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 8,
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: '800',
  },
  greeting: { fontSize: 15.5, fontWeight: '500' },
  userName: { fontSize: 23, fontWeight: '800', marginTop: 1 },
  heroTagline: { fontSize: 14, marginTop: 4, lineHeight: 18 },
  heroLogoContainer: {
    width: 58,
    height: 58,
    borderRadius: 14,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  heroLogo: {
    width: 48,
    height: 48,
    borderRadius: 10,
  },

  // 4 Stat Metrics Grid
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    minWidth: '47%',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderLeftWidth: 3.5,
  },
  metricIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricVal: { fontSize: 25, fontWeight: '800', marginBottom: 2 },
  metricLabel: { fontSize: 14, fontWeight: '600' },

  // Section Headers
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 6,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },
  viewAllText: { fontSize: 14.5, fontWeight: '700' },

  // Quick Action Hub
  actionsGrid: {
    flexDirection: 'column',
    gap: 8,
    marginBottom: 16,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    gap: 12,
  },
  actionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTitle: { fontSize: 16, fontWeight: '700' },
  actionSub: { fontSize: 13.5, marginTop: 1 },

  // Clean Empty Card
  cleanEmptyCard: {
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 20,
  },
  cleanEmptyIcon: { fontSize: 34, marginBottom: 8 },
  cleanEmptyTitle: { fontSize: 16.5, fontWeight: '700' },
  cleanEmptySub: { fontSize: 14.5, textAlign: 'center', marginTop: 4, lineHeight: 18 },

  // Recent History Cards
  historyCard: {
    flexDirection: 'row',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  riskStripe: { width: 4 },
  historyBody: { flex: 1, padding: 12 },
  historyMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  historyName: { fontSize: 16, fontWeight: '700', flex: 1, marginRight: 8 },
  historyMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyMeta: { fontSize: 14 },
  historyScore: { fontSize: 14 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: { fontSize: 12.5, fontWeight: '800' },
});
