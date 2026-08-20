import React, { useRef, useEffect, useContext } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, Animated,
  TouchableWithoutFeedback, Dimensions, ScrollView, Image
} from 'react-native';
import { colors, spacing, borderRadius } from '../theme/colors';
import { ThemeContext } from '../context/ThemeContext';
import {
  LayoutDashboard, FlaskConical, History,
  ChartBar, FileText, SlidersHorizontal, BookOpen,
  Users, TestTubes, User, Settings, LogOut,
  X, Globe
} from 'lucide-react-native';
import { LanguageContext } from '../context/LanguageContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIDEBAR_WIDTH = Math.min(SCREEN_WIDTH * 0.78, 300);

const APP_LOGO = require('../assets/logo.png');

// NAV_SECTIONS mirrors the web _sidebar.html structure exactly
export const NAV_SECTIONS = [
  {
    sectionKey: 'lab',
    sectionLabel: 'LABORATORY EXPERIMENTS',
    items: [
      { key: 'Dashboard',     translationKey: 'dashboard',   defaultLabel: 'Command Center',          icon: LayoutDashboard, badge: null },
      { key: 'NewAnalysis',   translationKey: 'newAnalysis', defaultLabel: 'New Experiment',          icon: FlaskConical,    badge: null },
      { key: 'History',       translationKey: 'history',     defaultLabel: 'Experiment History',      icon: History,         badge: null },
      { key: 'Compare',       translationKey: 'compare',     defaultLabel: 'Multi-Experiment Compare',icon: ChartBar,        badge: null },
    ],
  },
  {
    sectionKey: 'clinical',
    sectionLabel: 'SIMULATION & CLINICAL',
    items: [
      { key: 'Participants',  translationKey: 'patients',    defaultLabel: 'Study Participants',      icon: Users,           badge: null },
      { key: 'Samples',       translationKey: 'samples',     defaultLabel: 'Biological Samples',      icon: TestTubes,       badge: null },
      { key: 'ClinicalGuide', translationKey: 'isoGuide',    defaultLabel: 'Clinical Standards Hub', icon: BookOpen,        badge: 'ISO' },
      { key: 'Simulator',     translationKey: 'simulator',   defaultLabel: 'Dose Simulator (What-If)',icon: SlidersHorizontal, badge: 'What-If' },
    ],
  },
  {
    sectionKey: 'system',
    sectionLabel: 'SYSTEM & SETTINGS',
    items: [
      { key: 'Profile',       translationKey: 'profile',     defaultLabel: 'Researcher Profile',     icon: User,            badge: null },
      { key: 'Settings',      translationKey: 'settings',    defaultLabel: 'Settings & Config',       icon: Settings,        badge: null },
    ],
  },
];

// Flat list kept for backward-compat consumers that import NAV_ITEMS
export const NAV_ITEMS = NAV_SECTIONS.flatMap(s => s.items);

export default function SidebarDrawer({ isOpen, onClose, currentScreen, onSelectScreen, user, onLogout }) {
  const { t, currentLangObj, setShowLanguageModal } = useContext(LanguageContext);
  const { colors, isDark } = useContext(ThemeContext);
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -SIDEBAR_WIDTH, duration: 200, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [isOpen]);

  if (!isOpen && slideAnim._value === -SIDEBAR_WIDTH) {
    return null;
  }

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents={isOpen ? 'auto' : 'none'}>
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
      </TouchableWithoutFeedback>

      {/* Sliding Sidebar */}
      <Animated.View style={[styles.sidebarContainer, { width: SIDEBAR_WIDTH, transform: [{ translateX: slideAnim }], backgroundColor: colors.sidebar, borderRightColor: colors.border }]}>

        {/* Brand Header */}
        <View style={[styles.brandHeader, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderBottomColor: colors.border }]}>
          <View style={styles.brandRow}>
            <Image source={APP_LOGO} style={[styles.sidebarLogo, { borderColor: colors.primary }]} resizeMode="cover" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.brandTitle, { color: colors.text }]}>NanoSafe</Text>
              <Text style={[styles.brandSubtitle, { color: colors.primary }]}>Biomedical Analyzer</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* User Profile Mini Banner */}
          <View style={[styles.userBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.avatarMini, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarLetter}>{(user?.username || 'R')[0].toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>{user?.username || 'Researcher'}</Text>
              <Text style={[styles.userRole, { color: colors.textMuted }]}>
                <Text style={{ color: '#22c55e' }}>● </Text>
                {(user?.role || 'user').charAt(0).toUpperCase() + (user?.role || 'user').slice(1)} · Online
              </Text>
            </View>
          </View>
        </View>

        {/* Navigation — sectioned exactly like the web sidebar */}
        <ScrollView style={styles.navScroll} contentContainerStyle={{ paddingVertical: 10 }}>
          {NAV_SECTIONS.map((section, sIdx) => (
            <View key={section.sectionKey}>
              {/* Divider between sections (except before first) */}
              {sIdx > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}

              <Text style={[styles.navSectionLabel, { color: isDark ? '#475569' : '#94a3b8' }]}>{section.sectionLabel}</Text>

              {section.items.map(({ key, translationKey, defaultLabel, icon: Icon, badge }) => {
                const isActive = currentScreen === key;
                const label = t(translationKey, defaultLabel);
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.navItem, isActive && { backgroundColor: colors.primaryLight, borderLeftWidth: 3, borderLeftColor: colors.primary }]}
                    onPress={() => {
                      onSelectScreen(key);
                      onClose();
                    }}
                  >
                    <Icon size={18} color={isActive ? colors.primary : colors.textSecondary} style={{ marginRight: 12 }} />
                    <Text style={[styles.navItemText, { color: isActive ? colors.primary : colors.textSecondary }, isActive && { fontWeight: '700' }]}>{label}</Text>
                    {badge && (
                      <View style={[styles.navBadge, { backgroundColor: colors.inputBg }, isActive && { backgroundColor: colors.primary }]}>
                        <Text style={[styles.navBadgeText, { color: colors.textMuted }, isActive && { color: '#fff' }]}>{badge}</Text>
                      </View>
                    )}
                    {isActive && <View style={[styles.activeIndicator, { backgroundColor: colors.primary }]} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>

        {/* Footer: Language + Sign Out */}
        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.sidebar }]}>
          <TouchableOpacity
            style={[styles.langSelectorBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => {
              onClose();
              setShowLanguageModal(true);
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Globe size={16} color={colors.primary} />
              <Text style={[styles.langSelectorText, { color: colors.text }]}>{currentLangObj?.flag} {currentLangObj?.native}</Text>
            </View>
            <Text style={[styles.langChangeTag, { color: colors.primary }]}>{t('changeLang', 'Change')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
            <LogOut size={18} color={colors.danger} style={{ marginRight: 10 }} />
            <Text style={styles.logoutText}>{t('logout', 'Sign Out')}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 100,
  },
  sidebarContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRightWidth: 1,
    zIndex: 101,
    display: 'flex',
    flexDirection: 'column',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 20,
  },
  brandHeader: {
    padding: spacing.md,
    paddingTop: 50,
    borderBottomWidth: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sidebarLogo: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  brandTitle: {
    fontSize: 18.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  brandSubtitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 6,
  },
  userBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    padding: 8,
    borderWidth: 1,
    marginTop: 4,
  },
  avatarMini: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarLetter: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16.5,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
  },
  userRole: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  navScroll: {
    flex: 1,
    paddingHorizontal: spacing.sm,
  },
  divider: {
    height: 1,
    marginVertical: 8,
    marginHorizontal: 4,
  },
  navSectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 6,
    marginBottom: 6,
    marginLeft: 10,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: borderRadius.md,
    marginBottom: 2,
  },
  navItemText: {
    fontSize: 15.5,
    fontWeight: '600',
    flex: 1,
  },
  navBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  navBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  activeIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    gap: 8,
  },
  langSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  langSelectorText: {
    fontSize: 15.5,
    fontWeight: '700',
  },
  langChangeTag: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  logoutText: {
    color: colors.danger,
    fontSize: 15.5,
    fontWeight: '700',
  },
});
