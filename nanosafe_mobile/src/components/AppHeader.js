import React, { useContext } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image } from 'react-native';
import { colors, spacing, borderRadius } from '../theme/colors';
import { ThemeContext } from '../context/ThemeContext';
import { ShieldCheck, Globe } from 'lucide-react-native';
import { LanguageContext } from '../context/LanguageContext';

const APP_LOGO = require('../assets/logo.png');

export default function AppHeader({ title, onOpenSidebar }) {
  const { currentLangObj, setShowLanguageModal } = useContext(LanguageContext);
  const { colors, isDark } = useContext(ThemeContext);

  return (
    <View style={[styles.headerWrapper, { backgroundColor: colors.sidebar, borderBottomColor: colors.border }]}>
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        {/* Left: 3-Bars + App Logo Icon Button */}
        <TouchableOpacity
          style={[styles.hamburgerBtn, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
          onPress={onOpenSidebar}
          activeOpacity={0.7}
          accessibilityLabel="Open Navigation Menu"
        >
          <Image source={APP_LOGO} style={styles.logoImage} resizeMode="cover" />
          <View style={styles.dashIcon}>
            <View style={[styles.dashLine, { backgroundColor: colors.primary, width: 14 }]} />
            <View style={[styles.dashLine, { backgroundColor: colors.primary, width: 9 }]} />
            <View style={[styles.dashLine, { backgroundColor: colors.primary, width: 14 }]} />
          </View>
        </TouchableOpacity>

        {/* Center: Title */}
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{title}</Text>

        {/* Right: Language Selector Pill */}
        <TouchableOpacity
          style={[styles.langBtn, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
          onPress={() => setShowLanguageModal(true)}
          activeOpacity={0.7}
        >
          <Globe size={14} color={colors.primary} />
          <Text style={[styles.langBtnText, { color: colors.primary }]}>{(currentLangObj?.code || 'EN').toUpperCase()}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrapper: {
    borderBottomWidth: 1,
    zIndex: 10,
  },
  header: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    justifyContent: 'space-between',
  },
  hamburgerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 8,
    gap: 6,
  },
  logoImage: {
    width: 26,
    height: 26,
    borderRadius: 6,
  },
  dashIcon: {
    justifyContent: 'center',
    gap: 3,
  },
  dashLine: {
    height: 2.2,
    borderRadius: 2,
  },
  title: {
    fontSize: 18.5,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 6,
  },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.2,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 10,
    gap: 5,
  },
  langBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
  },
});
