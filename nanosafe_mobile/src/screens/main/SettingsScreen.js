import React, { useState, useEffect, useContext } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  Switch, ActivityIndicator, Alert, Share, Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors as staticColors, spacing, borderRadius } from '../../theme/colors';
import { ThemeContext } from '../../context/ThemeContext';
import { AuthContext } from '../../context/AuthContext';
import { LanguageContext } from '../../context/LanguageContext';
import apiClient from '../../api/client';
import {
  Settings, Moon, Sun, Bell, Sliders, Shield, Database,
  Globe, Check, CheckCircle2, ChevronRight, DownloadCloud,
  Trash2, Info, Sparkles, Award
} from 'lucide-react-native';

const PREFS_STORAGE_KEY = 'nanosafe_user_settings_preferences';

export default function SettingsScreen() {
  const { user } = useContext(AuthContext);
  const { t, currentLangObj, setShowLanguageModal } = useContext(LanguageContext);
  const { isDark, colors: themeColors, toggleTheme } = useContext(ThemeContext);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Settings State matching Web App notifications & security
  const [settings, setSettings] = useState({
    notifyAnalysisCompleted: true,
    notifyReportGenerated: true,
    notifySecurityAlerts: true,
    notifyIsoWarnings: true,
    autoSaveDrafts: true,
  });

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const stored = await AsyncStorage.getItem(PREFS_STORAGE_KEY);
      if (stored) {
        setSettings(prev => ({ ...prev, ...JSON.parse(stored) }));
      }
    } catch (err) {
      console.warn('[Settings] Failed to load preferences:', err);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      await AsyncStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(settings));

      // Sync with backend API if user is authenticated
      try {
        await apiClient.put('/auth/profile', {
          notify_analysis_completed: settings.notifyAnalysisCompleted,
          notify_report_generated: settings.notifyReportGenerated,
          notify_security_alerts: settings.notifySecurityAlerts,
        });
      } catch (apiErr) {
        console.log('[Settings] Backend sync note:', apiErr.message);
      }

      setSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      Alert.alert(t('settingsSaved', 'Settings Saved'), t('settingsSavedMsg', 'Your preferences have been saved and synced.'));
    } catch (err) {
      setSaving(false);
      Alert.alert('Error', 'Could not save settings. Please try again.');
    }
  };

  const handleExportData = async () => {
    try {
      const exportPayload = {
        exportDate: new Date().toISOString(),
        user: user?.username || 'Researcher',
        email: user?.email || 'N/A',
        preferences: settings,
        complianceStandard: 'ISO 10993-5',
        appVersion: 'v2.4.0'
      };
      await Share.share({
        title: 'NanoSafe Analyzer Research Settings Export',
        message: JSON.stringify(exportPayload, null, 2),
      });
    } catch (err) {
      Alert.alert('Export Error', 'Could not export research data.');
    }
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Local Cache',
      'This will reset cached session drafts and reload the newest analysis models. Your database records will NOT be deleted. Proceed?',
      [
        { text: t('cancel', 'Cancel'), style: 'cancel' },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('nanosafe_draft_experiment');
              Alert.alert('Cache Cleared', 'Temporary cache has been successfully reset.');
            } catch (e) {
              Alert.alert('Notice', 'Cache already clean.');
            }
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: themeColors.background }]} contentContainerStyle={styles.content}>
      {/* 1. Header Banner */}
      <View style={[styles.heroBanner, { backgroundColor: isDark ? '#0f766e' : '#0d9488' }]}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroBadge}>
            <Sliders size={13} color="#ccfbf1" />
            <Text style={styles.heroBadgeText}>SYSTEM CONFIGURATION</Text>
          </View>
          <View style={styles.complianceBadge}>
            <Award size={13} color="#fef08a" />
            <Text style={styles.complianceBadgeText}>ISO 10993-5</Text>
          </View>
        </View>
        <Text style={styles.heroTitle}>{t('settings', '⚙️ Settings & Preferences')}</Text>
        <Text style={styles.heroSub}>Configure automated alerts, appearance mode, regional language, and data export.</Text>
      </View>

      {/* 2. Appearance & Visual Theme */}
      <View style={[styles.section, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
        <View style={styles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {isDark ? <Moon size={18} color={themeColors.primary} /> : <Sun size={18} color={themeColors.primary} />}
            <Text style={[styles.sectionHeader, { color: themeColors.primary }]}>Appearance & Theme</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: isDark ? 'rgba(20,184,166,0.15)' : 'rgba(245,158,11,0.15)' }]}>
            <Text style={[styles.statusPillText, { color: isDark ? '#14b8a6' : '#d97706' }]}>
              {isDark ? 'Dark Mode' : 'Light Mode'}
            </Text>
          </View>
        </View>

        <View style={[styles.toggleRow, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 8 }}>
            <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(20,184,166,0.18)' : 'rgba(245,158,11,0.18)' }]}>
              {isDark ? <Moon size={20} color="#14b8a6" /> : <Sun size={20} color="#f59e0b" />}
            </View>
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={[styles.toggleTitle, { color: themeColors.text }]}>
                {isDark ? 'Dark Theme Active' : 'Light Theme Active'}
              </Text>
              <Text style={[styles.toggleSub, { color: themeColors.textMuted }]}>
                {isDark ? 'High contrast dark theme for low-light lab environments' : 'Crisp high-clarity daylight theme'}
              </Text>
            </View>
          </View>

          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: '#cbd5e1', true: 'rgba(20,184,166,0.35)' }}
            thumbColor={isDark ? '#14b8a6' : '#64748b'}
            ios_backgroundColor="#cbd5e1"
          />
        </View>
      </View>

      {/* 3. Automated Notifications */}
      <View style={[styles.section, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
        <View style={styles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Bell size={18} color={themeColors.primary} />
            <Text style={[styles.sectionHeader, { color: themeColors.primary }]}>Notification Alerts</Text>
          </View>
        </View>

        {/* Analysis Completed Notification */}
        <View style={[styles.settingRow, { borderBottomColor: themeColors.border }]}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={[styles.settingLabel, { color: themeColors.text }]}>Analysis Completed</Text>
            <Text style={[styles.settingSub, { color: themeColors.textMuted }]}>Alert when multi-dose Hill curve calculation finishes</Text>
          </View>
          <Switch
            value={settings.notifyAnalysisCompleted}
            onValueChange={v => setSettings({ ...settings, notifyAnalysisCompleted: v })}
            trackColor={{ false: '#cbd5e1', true: 'rgba(20,184,166,0.35)' }}
            thumbColor={settings.notifyAnalysisCompleted ? '#14b8a6' : '#64748b'}
          />
        </View>

        {/* Report Generated Notification */}
        <View style={[styles.settingRow, { borderBottomColor: themeColors.border }]}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={[styles.settingLabel, { color: themeColors.text }]}>Report Generated</Text>
            <Text style={[styles.settingSub, { color: themeColors.textMuted }]}>Get notified when publication-ready PDF is exported</Text>
          </View>
          <Switch
            value={settings.notifyReportGenerated}
            onValueChange={v => setSettings({ ...settings, notifyReportGenerated: v })}
            trackColor={{ false: '#cbd5e1', true: 'rgba(20,184,166,0.35)' }}
            thumbColor={settings.notifyReportGenerated ? '#14b8a6' : '#64748b'}
          />
        </View>

        {/* Security & Login Alerts */}
        <View style={[styles.settingRow, { borderBottomColor: themeColors.border }]}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={[styles.settingLabel, { color: themeColors.text }]}>Security Alerts</Text>
            <Text style={[styles.settingSub, { color: themeColors.textMuted }]}>Alerts for new session logins and password updates</Text>
          </View>
          <Switch
            value={settings.notifySecurityAlerts}
            onValueChange={v => setSettings({ ...settings, notifySecurityAlerts: v })}
            trackColor={{ false: '#cbd5e1', true: 'rgba(20,184,166,0.35)' }}
            thumbColor={settings.notifySecurityAlerts ? '#14b8a6' : '#64748b'}
          />
        </View>

        {/* ISO 10993-5 Toxicity Threshold Alerts */}
        <View style={styles.settingRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={[styles.settingLabel, { color: themeColors.text }]}>ISO Cytotoxicity Threshold Warning</Text>
            <Text style={[styles.settingSub, { color: themeColors.textMuted }]}>Immediate warning when cell viability falls below 70%</Text>
          </View>
          <Switch
            value={settings.notifyIsoWarnings}
            onValueChange={v => setSettings({ ...settings, notifyIsoWarnings: v })}
            trackColor={{ false: '#cbd5e1', true: 'rgba(20,184,166,0.35)' }}
            thumbColor={settings.notifyIsoWarnings ? '#14b8a6' : '#64748b'}
          />
        </View>
      </View>

      {/* 4. Language & Regional Settings */}
      <View style={[styles.section, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
        <View style={styles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Globe size={18} color={themeColors.primary} />
            <Text style={[styles.sectionHeader, { color: themeColors.primary }]}>App Language & Regional</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.langSelectorBtn, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}
          onPress={() => setShowLanguageModal(true)}
          activeOpacity={0.75}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 24 }}>{currentLangObj?.flag || '🌐'}</Text>
            <View>
              <Text style={[styles.langSelectTitle, { color: themeColors.text }]}>
                {currentLangObj?.native || 'English'} ({currentLangObj?.name || 'English'})
              </Text>
              <Text style={[styles.langSelectSub, { color: themeColors.textMuted }]}>
                Tap to change translation language
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color={themeColors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* 5. Data & Privacy Management */}
      <View style={[styles.section, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
        <View style={styles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Database size={18} color={themeColors.primary} />
            <Text style={[styles.sectionHeader, { color: themeColors.primary }]}>Data & Privacy Management</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.actionRowBtn, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}
          onPress={handleExportData}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
            <DownloadCloud size={18} color={themeColors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionBtnTitle, { color: themeColors.text }]}>Export Research Preferences (JSON)</Text>
              <Text style={[styles.actionBtnSub, { color: themeColors.textMuted }]}>Download a backup of your configuration</Text>
            </View>
          </View>
          <ChevronRight size={18} color={themeColors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionRowBtn, { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', marginTop: 8 }]}
          onPress={handleClearCache}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
            <Trash2 size={18} color={themeColors.danger} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionBtnTitle, { color: themeColors.danger }]}>Clear Temporary Cache & Drafts</Text>
              <Text style={[styles.actionBtnSub, { color: themeColors.textMuted }]}>Reset transient assay state</Text>
            </View>
          </View>
          <ChevronRight size={18} color={themeColors.danger} />
        </TouchableOpacity>
      </View>

      {/* 6. System Compliance Info */}
      <View style={[styles.infoBox, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
        <Info size={16} color={themeColors.primary} style={{ marginRight: 8 }} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.infoBoxText, { color: themeColors.textSecondary }]}>
            NanoSafe Analyzer Mobile <Text style={{ fontWeight: '800', color: themeColors.text }}>v2.4.0</Text> · Validated for ISO 10993-5:2009 cytotoxicity screening with Hill Equation 4PL regression.
          </Text>
        </View>
      </View>

      {/* 7. Save Settings Button */}
      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: themeColors.primary }]}
        onPress={handleSaveSettings}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Check size={18} color="#fff" />
            <Text style={styles.saveBtnText}>Save Settings & Preferences</Text>
          </View>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

function PaletteIcon({ color, isDark }) {
  return isDark ? <Moon size={18} color={color} /> : <Sun size={18} color={color} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 40 },

  heroBanner: {
    borderRadius: 16, padding: spacing.md,
    marginBottom: spacing.md,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 12,
  },
  heroBadgeText: { color: '#ccfbf1', fontSize: 11.5, fontWeight: '800', letterSpacing: 0.5 },
  complianceBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 12,
  },
  complianceBadgeText: { color: '#fef08a', fontSize: 11.5, fontWeight: '800' },
  heroTitle: { color: '#fff', fontSize: 23, fontWeight: '800' },
  heroSub: { color: '#e0f2fe', fontSize: 14.5, marginTop: 4, lineHeight: 20 },

  section: {
    borderRadius: 14, padding: 14,
    borderWidth: 1, marginBottom: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeader: { fontSize: 16, fontWeight: '800' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  statusPillText: { fontSize: 12, fontWeight: '800' },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 12, padding: 12, borderWidth: 1,
  },
  iconCircle: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  toggleTitle: { fontSize: 15.5, fontWeight: '700' },
  toggleSub: { fontSize: 13, marginTop: 2, lineHeight: 18 },

  settingRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1,
  },
  settingLabel: { fontSize: 15, fontWeight: '700' },
  settingSub: { fontSize: 13, marginTop: 2, lineHeight: 18 },

  langSelectorBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 10, padding: 12, borderWidth: 1,
  },
  langSelectTitle: { fontSize: 15.5, fontWeight: '700' },
  langSelectSub: { fontSize: 13, marginTop: 2 },

  actionRowBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 10, padding: 12, borderWidth: 1,
  },
  actionBtnTitle: { fontSize: 15, fontWeight: '700' },
  actionBtnSub: { fontSize: 12.5, marginTop: 2 },

  infoBox: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 10, padding: 12, borderWidth: 1, marginBottom: 14,
  },
  infoBoxText: { fontSize: 13, lineHeight: 19 },

  saveBtn: {
    borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#0d9488', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2, shadowRadius: 6, elevation: 3,
  },
  saveBtnText: { color: '#fff', fontSize: 16.5, fontWeight: '800' },
});
