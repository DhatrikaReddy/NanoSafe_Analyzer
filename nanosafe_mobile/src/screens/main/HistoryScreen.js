import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from 'react-native';
import { colors, spacing, borderRadius } from '../../theme/colors';
import apiClient from '../../api/client';
import { Search, Filter, ShieldCheck, ShieldAlert, AlertTriangle, Calendar } from 'lucide-react-native';

export default function HistoryScreen() {
  const [history, setHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await apiClient.get('/history/');
      const data = res.data || [];
      setHistory(data);
      setFilteredHistory(data);
    } catch (e) {
      console.error('Failed to fetch history:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSearch = (text) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setFilteredHistory(history);
      return;
    }
    const filtered = history.filter((item) =>
      item.sample_name.toLowerCase().includes(text.toLowerCase()) ||
      item.nanoparticle_type?.toLowerCase().includes(text.toLowerCase())
    );
    setFilteredHistory(filtered);
  };

  const renderItem = ({ item }) => {
    const isSafe = item.safety_category === 'Safe / Biocompatible';
    const isModerate = item.safety_category === 'Moderate Toxicity';

    return (
      <View style={styles.itemCard}>
        <View style={styles.itemHeader}>
          <View style={styles.iconBox}>
            {isSafe ? (
              <ShieldCheck size={24} color={colors.safe} />
            ) : isModerate ? (
              <AlertTriangle size={24} color={colors.moderate} />
            ) : (
              <ShieldAlert size={24} color={colors.danger} />
            )}
          </View>
          <View style={styles.itemMain}>
            <Text style={styles.itemTitle}>{item.sample_name}</Text>
            <Text style={styles.itemSubtitle}>
              ZnO • {item.concentration} µg/mL • {item.size_nm || 25} nm
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: isSafe ? colors.safeBg : isModerate ? colors.moderateBg : colors.dangerBg }]}>
            <Text style={[styles.badgeText, { color: isSafe ? colors.safe : isModerate ? colors.moderate : colors.danger }]}>
              {item.viability_pct}% Viability
            </Text>
          </View>
        </View>

        <View style={styles.itemFooter}>
          <View style={styles.footerInfo}>
            <Calendar size={14} color={colors.textMuted} style={{ marginRight: 4 }} />
            <Text style={styles.footerDate}>{item.timestamp || item.created_at || 'Recent'}</Text>
          </View>
          <Text style={styles.footerCat}>{item.safety_category}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>Experiment History</Text>

      <View style={styles.searchBar}>
        <Search size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search experiments..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={handleSearch}
        />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primaryLight} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filteredHistory}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchHistory} tintColor={colors.primaryLight} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No experiments found.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    paddingVertical: 10,
    fontSize: 14,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  itemCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    marginRight: spacing.md,
  },
  itemMain: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  itemSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerDate: {
    fontSize: 12,
    color: colors.textMuted,
  },
  footerCat: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  emptyBox: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textMuted,
  },
});
