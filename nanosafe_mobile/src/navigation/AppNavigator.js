import React, { useState, useEffect, useContext } from 'react';
import {
  View, StyleSheet, SafeAreaView, StatusBar, ActivityIndicator,
  Platform, TouchableOpacity, Text, BackHandler
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ThemeProvider, ThemeContext } from '../context/ThemeContext';
import { LanguageContext } from '../context/LanguageContext';
import { AuthContext } from '../context/AuthContext';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import VerifyOtpScreen from '../screens/auth/VerifyOtpScreen';

// Main Screens
import DashboardScreen from '../screens/main/DashboardScreen';
import NewAnalysisScreen from '../screens/main/NewAnalysisScreen';
import HistoryScreen from '../screens/main/HistoryScreen';
import CompareScreen from '../screens/main/CompareScreen';
import ParticipantsScreen from '../screens/main/ParticipantsScreen';
import ClinicalGuideScreen from '../screens/main/ClinicalGuideScreen';
import SimulatorScreen from '../screens/main/SimulatorScreen';
import SamplesScreen from '../screens/main/SamplesScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import SettingsScreen from '../screens/main/SettingsScreen';
import ProfileSetupScreen from '../screens/auth/ProfileSetupScreen';

// Navigation Components
import AppHeader from '../components/AppHeader';
import SidebarDrawer, { NAV_ITEMS } from './SidebarDrawer';

const AuthStack = createNativeStackNavigator();

function AuthNavigator() {
  const { colors } = useContext(ThemeContext);
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="VerifyOtp" component={VerifyOtpScreen} />
    </AuthStack.Navigator>
  );
}

const SCREEN_COMPONENTS = {
  // LABORATORY EXPERIMENTS
  Dashboard:     { component: DashboardScreen,    titleKey: 'dashboard',     defaultTitle: 'Command Center' },
  NewAnalysis:   { component: NewAnalysisScreen,  titleKey: 'newAnalysis',   defaultTitle: 'New Experiment' },
  History:       { component: HistoryScreen,      titleKey: 'history',       defaultTitle: 'Experiment History' },
  Compare:       { component: CompareScreen,      titleKey: 'compare',       defaultTitle: 'Multi-Experiment Compare' },
  // SIMULATION & CLINICAL
  Participants:  { component: ParticipantsScreen, titleKey: 'patients',      defaultTitle: 'Study Participants' },
  Samples:       { component: SamplesScreen,      titleKey: 'samples',       defaultTitle: 'Biological Samples' },
  ClinicalGuide: { component: ClinicalGuideScreen,titleKey: 'isoGuide',      defaultTitle: 'Clinical Standards Hub' },
  Simulator:     { component: SimulatorScreen,    titleKey: 'simulator',     defaultTitle: 'Dose Simulator' },
  // SYSTEM & SETTINGS
  Profile:       { component: ProfileScreen,      titleKey: 'profile',       defaultTitle: 'Researcher Profile' },
  Settings:      { component: SettingsScreen,     titleKey: 'settings',      defaultTitle: 'Settings & Config' },
};

function MainSidebarLayout() {
  const { user, logout } = useContext(AuthContext);
  const { t } = useContext(LanguageContext);
  const { colors, isDark } = useContext(ThemeContext);
  const [currentScreen, setCurrentScreen] = useState('Dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Android Hardware Back Button Handling
  useEffect(() => {
    const onBackPress = () => {
      if (isSidebarOpen) {
        setIsSidebarOpen(false);
        return true;
      }
      if (currentScreen !== 'Dashboard') {
        setCurrentScreen('Dashboard');
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [isSidebarOpen, currentScreen]);

  const CurrentScreenConfig = SCREEN_COMPONENTS[currentScreen] || SCREEN_COMPONENTS.Dashboard;
  const ScreenComponent = CurrentScreenConfig.component;

  const navigationShim = {
    navigate: (screenKey, params) => {
      if (SCREEN_COMPONENTS[screenKey]) setCurrentScreen(screenKey);
    },
    goBack: () => setCurrentScreen('Dashboard'),
    addListener: (event, callback) => {
      if (typeof callback === 'function' && event === 'focus') {
        try { callback(); } catch (e) {}
      }
      return () => {};
    },
    removeListener: () => {},
    isFocused: () => true,
    setParams: () => {},
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.sidebar }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.sidebar}
        translucent={false}
      />

      {/* Top Header */}
      <AppHeader
        title={t(CurrentScreenConfig.titleKey, CurrentScreenConfig.defaultTitle)}
        onOpenSidebar={() => setIsSidebarOpen(true)}
        user={user}
      />

      {/* Active Screen */}
      <View style={[styles.screenContainer, { backgroundColor: colors.background }]}>
        <ScreenComponent navigation={navigationShim} />
      </View>

      {/* Sliding Sidebar Drawer */}
      <SidebarDrawer
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        currentScreen={currentScreen}
        onSelectScreen={(screenKey) => setCurrentScreen(screenKey)}
        user={user}
        onLogout={logout}
      />
    </SafeAreaView>
  );
}

function AppContent() {
  const { user, token, isLoading } = useContext(AuthContext);
  const { colors } = useContext(ThemeContext);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!token) {
    return (
      <NavigationContainer>
        <AuthNavigator />
      </NavigationContainer>
    );
  }

  if (user && !user.isProfileCompleted) {
    return <ProfileSetupScreen />;
  }

  return <MainSidebarLayout />;
}

export default function AppNavigator() {
  return <AppContent />;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0,
  },
  screenContainer: {
    flex: 1,
  },
});
