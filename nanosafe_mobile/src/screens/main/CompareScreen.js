import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { colors, spacing, borderRadius } from '../../theme/colors';
import apiClient from '../../api/client';
import { Columns3, CheckSquare, Square, BarChart2 } from 'lucide-react-native';

export default function CompareScreen() {
  const [history, setHistory] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await apiClient.get('/history/');
      setHistory(res.data || []);
    } catch (e) {
      console.error('Fetch history error:', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      if (selectedIds.length >= 3) {
        return; // limit 3
      }
      setSelectedIds([...selectedIds, id]);
    }
  };

  const selectedItems = history.filter((item) => selectedIds.includes(item.id));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>Compare Experiments</Text>
      <Text style={styles.screenSubtitle}>
        Select up to 3 experiments to generate side-by-side comparative analysis.
      </Text>

      {/* Comparison Output Charts Bar */}
      {selectedItems.length >= 2 && (
        <View style={styles.compareResultCard}>
          <View style={styles.compareResultHeader}>
            <BarChart2 size={24} color={colors.primaryLight} />
            <Text style={styles.compareResultTitle}>Comparative Viability Analysis</Text>
          </View>

          <View style={styles.barsContainer}>
            {selectedItems.map((item) => (
              <View key={item.id} style={styles.barColumn}>
                <Text style={styles.barValue}>{item.viability_pct}%</Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: `${Math.min(item.viability_pct, 100)}%`,
                        backgroundColor:
                          item.viability_pct >= 75
                            ? colors.safe
                            : item.viability_pct >= 50
                            ? colors.moderate
                            : colors.danger,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barLabel} numberOfLines={1}>
                  {item.sample_name}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <Text style={styles.selectHeader}>
        Select Experiments ({selectedIds.length}/3)
      </Text>

      {loading ? (
        <ActivityIndicator color={colors.primaryLight} style={{ marginTop: 20 }} />
      ) : (
        history.map((item) => {
          const isSelected = selectedIds.includes(item.id);
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.selectCard, isSelected && styles.selectCardActive]}
              onPress={() => toggleSelect(item.id)}
            >
              {isSelected ? (
                <CheckSquare size={22} color={colors.primaryLight} style={{ marginRight: 12 }} />
              ) : (
                <Square size={22} color={colors.textMuted} style={{ marginRight: 12 }} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{item.sample_name}</Text>
                <Text style={styles.itemSub}>
                  Conc: {item.concentration} µg/mL • Size: {item.size_nm || 25} nm
                </Text>
              </View>
              <Text style={styles.itemViability}>{item.viability_pct}%</Text>
            </TouchableOpacity>
          );
        })
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
  compareResultCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  compareResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  compareResultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginLeft: 8,
  },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    height: 180,
    alignItems: 'flex-end',
    paddingTop: spacing.md,
  },
  barColumn: {
    alignItems: 'center',
    width: 80,
    height: '100%',
    justifyContent: 'flex-end',
  },
  barValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  barTrack: {
    width: 32,
    height: 120,
    backgroundColor: colors.inputBg,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderRadius: borderRadius.sm,
  },
  barLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 6,
    textAlign: 'center',
  },
  selectHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  selectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectCardActive: {
    borderColor: colors.primaryLight,
    backgroundColor: colors.cardHover,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  itemSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  itemViability: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primaryLight,
  },
});
