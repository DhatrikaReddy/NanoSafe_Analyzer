import React, { useState, useEffect, useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { AuthContext } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { Activity, ShieldAlert, Award, FileSpreadsheet, PlusCircle } from 'lucide-react-native';

export default function DashboardScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await apiClient.get('/history/');
      setHistory(res.data || []);
    } catch (e) {
      console.error('Error fetching history:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  const totalExperiments = history.length;
  const avgViability = totalExperiments > 0
    ? (history.reduce((acc, curr) => acc + (curr.viability_pct || 0), 0) / totalExperiments).toFixed(1)
    : 'N/A';

  const safeCount = history.filter(h => h.safety_category === 'Safe / Biocompatible').length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primaryLight} />}
    >
      {/* Header Greeting */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.userName}>{user?.username || 'Researcher'}</Text>
        </View>
        <TouchableOpacity
          style={styles.newAnalysisBtn}
          onPress={() => navigation.navigate('NewAnalysis')}
        >
          <PlusCircle size={18} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.newAnalysisText}>New Test</Text>
        </TouchableOpacity>
      </View>

      {/* Metrics Row */}
      <View style={styles.metricsContainer}>
        <View style={styles.metricCard}>
          <Activity size={22} color={colors.primaryLight} />
          <Text style={styles.metricValue}>{totalExperiments}</Text>
          <Text style={styles.metricLabel}>Total Analyses</Text>
        </View>

        <View style={styles.metricCard}>
          <Award size={22} color={colors.safe} />
          <Text style={styles.metricValue}>{avgViability}%</Text>
          <Text style={styles.metricLabel}>Avg Viability</Text>
        </View>

        <View style={styles.metricCard}>
          <ShieldAlert size={22} color={colors.accent} />
          <Text style={styles.metricValue}>{safeCount}</Text>
          <Text style={styles.metricLabel}>Biocompatible</Text>
        </View>
      </View>

      {/* Recent Analyses List */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Analyses</Text>
        <TouchableOpacity onPress={() => navigation.navigate('History')}>
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primaryLight} style={{ marginTop: 20 }} />
      ) : history.length === 0 ? (
        <View style={styles.emptyCard}>
          <FileSpreadsheet size={40} color={colors.textMuted} />
          <Text style={styles.emptyText}>No analysis history recorded yet.</Text>
          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => navigation.navigate('NewAnalysis')}
          >
            <Text style={styles.startBtnText}>Run First Analysis</Text>
          </TouchableOpacity>
        </View>
      ) : (
        history.slice(0, 5).map((item) => (
          <View key={item.id} style={styles.historyCard}>
            <View style={styles.historyInfo}>
              <Text style={styles.historyTitle}>{item.sample_name}</Text>
              <Text style={styles.historyDate}>
                Concentration: {item.concentration} µg/mL
              </Text>
            </View>

            <View
              style={[
                styles.badge,
                {
                  backgroundColor:
                    item.safety_category === 'Safe / Biocompatible'
                      ? colors.safeBg
                      : item.safety_category === 'Moderate Toxicity'
                      ? colors.moderateBg
                      : colors.dangerBg,
                },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  {
                    color:
                      item.safety_category === 'Safe / Biocompatible'
                        ? colors.safe
                        : item.safety_category === 'Moderate Toxicity'
                        ? colors.moderate
                        : colors.danger,
                  },
                ]}
              >
                {item.viability_pct}% Viability
              </Text>
            </View>
          </View>
        ))
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
  },
  greeting: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
  },
  newAnalysisBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
  },
  newAnalysisText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 6,
  },
  metricLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  viewAllText: {
    color: colors.primaryLight,
    fontWeight: '500',
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  startBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  startBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  historyCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyInfo: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  historyDate: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
});
