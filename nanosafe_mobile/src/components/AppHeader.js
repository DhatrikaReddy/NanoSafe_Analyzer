import React, { useContext } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image } from 'react-native';
import { colors, spacing, borderRadius } from '../theme/colors';
import { ThemeContext } from '../context/ThemeContext';
import { Moon, Sun, Menu } from 'lucide-react-native';

const APP_LOGO = require('../assets/logo.png');

export default function AppHeader({ title, onOpenSidebar }) {
  const { colors, isDark, toggleTheme } = useContext(ThemeContext);

  return (
    <View style={[styles.headerWrapper, { backgroundColor: colors.sidebar, borderBottomColor: colors.border }]}>
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        {/* Left: Hamburger Menu Button */}
        <TouchableOpacity
          style={[styles.hamburgerBtn, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
          onPress={onOpenSidebar}
          activeOpacity={0.7}
          accessibilityLabel="Open Navigation Menu"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Menu size={22} color={colors.primary} />
          <Image source={APP_LOGO} style={styles.logoImage} resizeMode="cover" />
        </TouchableOpacity>

        {/* Center: Title */}
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{title}</Text>

        {/* Right: Theme Toggle (Dark / Light) — Mirrors Web Topbar */}
        <TouchableOpacity
          style={[styles.themeBtn, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
          onPress={toggleTheme}
          activeOpacity={0.7}
          accessibilityLabel="Toggle Dark / Light Theme"
        >
          {isDark ? (
            <Sun size={16} color={colors.primary} />
          ) : (
            <Moon size={16} color={colors.primary} />
          )}
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
  themeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    borderRadius: 20,
    width: 36,
    height: 36,
  },
});
