import React, { useState, useEffect, useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { AuthContext } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { User, LogOut, Shield, Database, Bell, FileSpreadsheet } from 'lucide-react-native';

export default function ProfileScreen() {
  const { user, logout } = useContext(AuthContext);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.profileHeader}>
        <View style={styles.avatarCircle}>
          <User size={40} color={colors.primaryLight} />
        </View>
        <Text style={styles.userName}>{user?.username || 'Researcher'}</Text>
        <Text style={styles.userRole}>
          {user?.role ? user.role.toUpperCase() : 'NANO-SAFETY RESEARCHER'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Account & Security</Text>

        <View style={styles.menuItem}>
          <Shield size={20} color={colors.primaryLight} style={{ marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>Two-Factor Authentication</Text>
            <Text style={styles.menuSub}>6-Digit Email Verification Enabled</Text>
          </View>
        </View>

        <View style={styles.menuItem}>
          <Database size={20} color={colors.accent} style={{ marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>Local SQLite Sync</Text>
            <Text style={styles.menuSub}>nanosafe.db active</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>System Info</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Platform Framework</Text>
          <Text style={styles.infoValue}>React Native (Expo Core)</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Backend API Protocol</Text>
          <Text style={styles.infoValue}>Flask JSON REST (/mobile/v1/)</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>ML Core Model</Text>
          <Text style={styles.infoValue}>Random Forest Viability Regressor</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <LogOut size={20} color={colors.danger} style={{ marginRight: 8 }} />
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
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
  profileHeader: {
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primaryLight,
    marginBottom: spacing.sm,
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
  },
  userRole: {
    fontSize: 12,
    color: colors.primaryLight,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 1,
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textMuted,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  menuSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
  },
  logoutBtn: {
    flexDirection: 'row',
    backgroundColor: colors.dangerBg,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  logoutText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '600',
  },
});
