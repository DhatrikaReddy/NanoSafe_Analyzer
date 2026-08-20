import React, { useState, useEffect, useContext } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Image, Modal, Platform, KeyboardAvoidingView, Switch
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { colors as staticColors, spacing, borderRadius } from '../../theme/colors';
import { ThemeContext } from '../../context/ThemeContext';
import { AuthContext } from '../../context/AuthContext';
import { LanguageContext, SUPPORTED_LANGUAGES } from '../../context/LanguageContext';
import apiClient from '../../api/client';
import {
  User, LogOut, Lock, Shield, ChevronRight, ChevronDown, CheckCircle2,
  Camera, Mail, Building, Award, Edit3, X, Check, Sparkles,
  FlaskConical, Users, Activity, FileText, UploadCloud, MapPin, Globe,
  Calendar, Phone, Quote, Briefcase, Plus, Trash2, Moon, Sun, Palette
} from 'lucide-react-native';

const AVATAR_STORAGE_KEY = 'nanosafe_user_avatar_uri';

const SALUTATIONS = ['Dr.', 'Prof.', 'Ms.', 'Mr.', 'Researcher'];
const PRONOUNS = ['She / Her', 'He / Him', 'They / Them', 'Prefer not to say'];
const LANGUAGES = ['English', 'Hindi', 'Telugu', 'Spanish', 'French', 'German'];

export default function ProfileScreen() {
  const { user, logout } = useContext(AuthContext);
  const { t, currentLang, changeLanguage } = useContext(LanguageContext);
  const { isDark, colors: themeColors, toggleTheme } = useContext(ThemeContext);
  const [profile, setProfile] = useState({
    username: user?.username || '',
    email: user?.email || '',
    fullName: '',
    titleSalutation: '',
    genderPronouns: '',
    dateOfBirth: '',
    secondaryEmail: '',
    officeAddress: '',
    cityState: '',
    country: '',
    preferredLanguage: '',
    bio: '',
    institution: '',
    department: '',
    researchRole: '',
    isVerified: true,
    totalParticipants: 0,
    totalAssays: 0,
    passRate: 100.0,
  });

  const [avatarUri, setAvatarUri] = useState(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ ...profile });
  const [activeDropdown, setActiveDropdown] = useState(null); // 'title' | 'pronouns' | 'lang'
  const [savingProfile, setSavingProfile] = useState(false);

  const [showChangePwd, setShowChangePwd] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);

  useEffect(() => {
    loadSavedAvatar();
    fetchProfileData();
  }, []);

  const loadSavedAvatar = async () => {
    try {
      const saved = await AsyncStorage.getItem(AVATAR_STORAGE_KEY);
      if (saved) setAvatarUri(saved);
    } catch (e) {
      console.log('Failed to load avatar:', e);
    }
  };

  const saveAvatar = async (uri) => {
    try {
      setAvatarUri(uri);
      await AsyncStorage.setItem(AVATAR_STORAGE_KEY, uri);
      setShowPhotoModal(false);
      Alert.alert('Photo Updated', 'Your profile photo has been updated.');
    } catch (e) {
      Alert.alert('Error', 'Failed to save photo.');
    }
  };

  const handleRemovePhoto = async () => {
    try {
      setAvatarUri(null);
      await AsyncStorage.removeItem(AVATAR_STORAGE_KEY);
      setShowPhotoModal(false);
      Alert.alert('Photo Removed', 'Your profile photo has been removed.');
    } catch (e) {
      console.log('Error removing photo:', e);
    }
  };

  const fetchProfileData = async () => {
    try {
      const res = await apiClient.get('/auth/profile');
      if (res.data?.profile) {
        setProfile(res.data.profile);
      }
    } catch (e) {
      console.log('Error fetching user profile:', e);
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Denied', 'Please allow gallery access in device settings.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        saveAvatar(result.assets[0].uri);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not open gallery: ' + e.message);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Denied', 'Please allow camera access in device settings.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        saveAvatar(result.assets[0].uri);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not open camera: ' + e.message);
    }
  };

  const openEditProfile = () => {
    setEditForm({ ...profile });
    setActiveDropdown(null);
    setShowEditModal(true);
  };

  const handleSaveProfile = async () => {
    try {
      setSavingProfile(true);
      const res = await apiClient.put('/auth/profile', editForm);
      if (res.data?.profile) {
        setProfile(prev => ({ ...prev, ...res.data.profile }));
      }
      setShowEditModal(false);
      Alert.alert('Success', 'Your profile details have been saved.');
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPwd || !newPwd || !confirmPwd) {
      Alert.alert('Validation', 'All password fields are required.');
      return;
    }
    if (newPwd !== confirmPwd) {
      Alert.alert('Mismatch', 'New password and confirmation do not match.');
      return;
    }
    if (newPwd.length < 8) {
      Alert.alert('Too Short', 'Password must be at least 8 characters long.');
      return;
    }
    try {
      setPwdLoading(true);
      await apiClient.post('/auth/change-password', {
        current_password: currentPwd,
        new_password: newPwd,
      });
      Alert.alert('Success', 'Your password was changed successfully.');
      setShowChangePwd(false);
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to change password.');
    } finally {
      setPwdLoading(false);
    }
  };

  // Helper for displaying entered values or clean placeholder
  const renderValue = (val, placeholder = '—') => {
    if (!val || !val.trim()) {
      return <Text style={[styles.notSetText, { color: themeColors.textMuted }]}>{placeholder}</Text>;
    }
    return <Text style={[styles.infoValue, { color: themeColors.text }]}>{val}</Text>;
  };

  const displayName = [profile.titleSalutation, profile.fullName || profile.username].filter(Boolean).join(' ');

  return (
    <ScrollView style={[styles.container, { backgroundColor: themeColors.background }]} contentContainerStyle={styles.content}>
      {/* 1. Profile Hero Section with Photo Upload */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarContainer}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={[styles.avatarImage, { borderColor: themeColors.primary }]} />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: themeColors.card, borderColor: themeColors.primary }]}>
              <User size={46} color={themeColors.primary} />
            </View>
          )}

          {/* Camera Upload Badge */}
          <TouchableOpacity
            style={[styles.cameraBadge, { backgroundColor: themeColors.primary, borderColor: themeColors.background }]}
            onPress={() => setShowPhotoModal(true)}
            activeOpacity={0.8}
          >
            <Camera size={14} color="#fff" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => setShowPhotoModal(true)}>
          <Text style={[styles.changePhotoText, { color: themeColors.primary }]}>{avatarUri ? t('changePhoto', '📷 Change Photo') : t('uploadPhoto', '+ Upload Photo')}</Text>
        </TouchableOpacity>

        <Text style={[styles.userName, { color: themeColors.text }]}>{displayName || user?.username || 'Researcher'}</Text>
        
        {(profile.researchRole || profile.institution) ? (
          <Text style={[styles.userRoleText, { color: themeColors.textSecondary }]}>
            {[profile.researchRole, profile.institution].filter(Boolean).join(' • ')}
          </Text>
        ) : (
          <TouchableOpacity onPress={openEditProfile}>
            <Text style={[styles.addRolePrompt, { color: themeColors.primary }]}>+ Add Research Role & Institution</Text>
          </TouchableOpacity>
        )}

        <View style={[styles.statusBadge, { backgroundColor: themeColors.safeBg, borderColor: themeColors.safeBorder }]}>
          <CheckCircle2 size={13} color={themeColors.safe} />
          <Text style={[styles.statusBadgeText, { color: themeColors.safe }]}>Verified Researcher Account</Text>
        </View>
      </View>

      {/* 2. Research Impact Statistics */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: themeColors.card, borderColor: themeColors.border, borderLeftColor: themeColors.primary, borderLeftWidth: 3 }]}>
          <Users size={16} color={themeColors.primary} />
          <Text style={[styles.statVal, { color: themeColors.text }]}>{profile.totalParticipants || 0}</Text>
          <Text style={[styles.statLabel, { color: themeColors.textMuted }]}>Patients</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: themeColors.card, borderColor: themeColors.border, borderLeftColor: themeColors.safe, borderLeftWidth: 3 }]}>
          <FlaskConical size={16} color={themeColors.safe} />
          <Text style={[styles.statVal, { color: themeColors.safe }]}>{profile.totalAssays || 0}</Text>
          <Text style={[styles.statLabel, { color: themeColors.textMuted }]}>Assays</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: themeColors.card, borderColor: themeColors.border, borderLeftColor: themeColors.moderate, borderLeftWidth: 3 }]}>
          <Award size={16} color={themeColors.moderate} />
          <Text style={[styles.statVal, { color: themeColors.moderate }]}>{profile.passRate || 100}%</Text>
          <Text style={[styles.statLabel, { color: themeColors.textMuted }]}>ISO Pass</Text>
        </View>
      </View>

      {/* 3. Identity & Personal Details Card */}
      <View style={[styles.section, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeader, { color: themeColors.primary }]}>{t('identityDetails', '👤 Identity & Personal Details')}</Text>
          <TouchableOpacity style={[styles.editProfileBtn, { backgroundColor: themeColors.primaryLight, borderColor: themeColors.primary }]} onPress={openEditProfile}>
            <Edit3 size={13} color={themeColors.primary} />
            <Text style={[styles.editProfileBtnText, { color: themeColors.primary }]}>Edit</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.infoRow, { borderBottomColor: themeColors.border }]}>
          <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>Title / Salutation</Text>
          {renderValue(profile.titleSalutation, 'Not set')}
        </View>

        <View style={[styles.infoRow, { borderBottomColor: themeColors.border }]}>
          <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>Full Legal Name</Text>
          {renderValue(profile.fullName, 'Not set')}
        </View>

        <View style={[styles.infoRow, { borderBottomColor: themeColors.border }]}>
          <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>Gender / Pronouns</Text>
          {renderValue(profile.genderPronouns, 'Not set')}
        </View>

        <View style={[styles.infoRow, { borderBottomColor: themeColors.border }]}>
          <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>Date of Birth / Age</Text>
          {renderValue(profile.dateOfBirth, 'Not set')}
        </View>
      </View>

      {/* 4. Contact & Lab Location Card */}
      <View style={[styles.section, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
        <Text style={[styles.sectionHeader, { color: themeColors.primary }]}>{t('contactLocation', '📞 Contact & Location')}</Text>

        <View style={[styles.infoRow, { borderBottomColor: themeColors.border }]}>
          <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>Primary Email</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.infoValue, { color: themeColors.text }]}>{profile.email || user?.email || '—'}</Text>
            <View style={[styles.verifiedPill, { backgroundColor: themeColors.safeBg }]}>
              <CheckCircle2 size={10} color={themeColors.safe} />
              <Text style={[styles.verifiedPillText, { color: themeColors.safe }]}>Verified</Text>
            </View>
          </View>
        </View>

        <View style={[styles.infoRow, { borderBottomColor: themeColors.border }]}>
          <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>Alternative / Secondary Email</Text>
          {renderValue(profile.secondaryEmail, 'Not set')}
        </View>

        <View style={[styles.infoRow, { borderBottomColor: themeColors.border }]}>
          <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>Office / Lab Address</Text>
          {renderValue(profile.officeAddress, 'Not set')}
        </View>

        <View style={[styles.infoRow, { borderBottomColor: themeColors.border }]}>
          <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>City & State</Text>
          {profile.cityState ? (
            <Text style={[styles.infoValue, { color: themeColors.text }]}>📍 {profile.cityState}</Text>
          ) : (
            <Text style={[styles.notSetText, { color: themeColors.textMuted }]}>Not set</Text>
          )}
        </View>

        <View style={[styles.infoRow, { borderBottomColor: themeColors.border }]}>
          <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>Country</Text>
          {profile.country ? (
            <Text style={[styles.infoValue, { color: themeColors.text }]}>🌐 {profile.country}</Text>
          ) : (
            <Text style={[styles.notSetText, { color: themeColors.textMuted }]}>Not set</Text>
          )}
        </View>

        <View style={[styles.infoRow, { borderBottomColor: themeColors.border }]}>
          <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>Preferred Language</Text>
          {renderValue(profile.preferredLanguage, 'Not set')}
        </View>
      </View>

      {/* 5. Organization & Research Focus */}
      <View style={[styles.section, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
        <Text style={[styles.sectionHeader, { color: themeColors.primary }]}>{t('labAffiliation', '🔬 Laboratory & Affiliation')}</Text>

        <View style={[styles.infoRow, { borderBottomColor: themeColors.border }]}>
          <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>Institution / Lab</Text>
          {renderValue(profile.institution, 'Not set')}
        </View>

        <View style={[styles.infoRow, { borderBottomColor: themeColors.border }]}>
          <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>Department / Division</Text>
          {renderValue(profile.department, 'Not set')}
        </View>

        <View style={[styles.infoRow, { borderBottomColor: themeColors.border }]}>
          <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>Research Role / Title</Text>
          {renderValue(profile.researchRole, 'Not set')}
        </View>

        <View style={[styles.infoRow, { borderBottomColor: themeColors.border }]}>
          <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>Regulatory Standard</Text>
          <Text style={[styles.infoValue, { color: themeColors.text }]}>ISO 10993-5 (Cytotoxicity)</Text>
        </View>
      </View>

      {/* 6. Personal Bio / About Me Card */}
      <View style={[styles.section, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
        <Text style={[styles.sectionHeader, { color: themeColors.primary }]}>{t('personalBio', '📝 Personal Bio / About Me')}</Text>
        <View style={[styles.bioBox, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
          {profile.bio ? (
            <>
              <Quote size={16} color={themeColors.primary} style={{ marginBottom: 4 }} />
              <Text style={[styles.bioText, { color: themeColors.text }]}>{profile.bio}</Text>
            </>
          ) : (
            <TouchableOpacity onPress={openEditProfile} style={{ paddingVertical: 4 }}>
              <Text style={[styles.emptyBioText, { color: themeColors.textMuted }]}>+ No personal bio added yet. Tap Edit to enter your research background.</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 7. Security & Passwords */}
      <View style={[styles.section, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setShowChangePwd(!showChangePwd)}
        >
          <Lock size={18} color={themeColors.primary} style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuTitle, { color: themeColors.text }]}>{t('changePassword', 'Change Password')}</Text>
            <Text style={[styles.menuSub, { color: themeColors.textMuted }]}>Update your authentication credentials</Text>
          </View>
          <ChevronRight
            size={18}
            color={themeColors.textMuted}
            style={{ transform: [{ rotate: showChangePwd ? '90deg' : '0deg' }] }}
          />
        </TouchableOpacity>

        {showChangePwd && (
          <View style={[styles.pwdForm, { borderTopColor: themeColors.border }]}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>Current Password</Text>
              <TextInput
                style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.text }]}
                secureTextEntry
                value={currentPwd}
                onChangeText={setCurrentPwd}
                placeholder="Enter current password"
                placeholderTextColor={themeColors.textMuted}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>New Password</Text>
              <TextInput
                style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.text }]}
                secureTextEntry
                value={newPwd}
                onChangeText={setNewPwd}
                placeholder="At least 8 characters"
                placeholderTextColor={themeColors.textMuted}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>Confirm New Password</Text>
              <TextInput
                style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.text }]}
                secureTextEntry
                value={confirmPwd}
                onChangeText={setConfirmPwd}
                placeholder="Re-enter new password"
                placeholderTextColor={themeColors.textMuted}
              />
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: themeColors.primary }]}
              onPress={handleChangePassword}
              disabled={pwdLoading}
            >
              {pwdLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Update Password</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 9. Sign Out Button */}
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <LogOut size={18} color={themeColors.danger} style={{ marginRight: 8 }} />
        <Text style={[styles.logoutText, { color: themeColors.danger }]}>{t('logout', 'Sign Out')}</Text>
      </TouchableOpacity>

      {/* Photo Options Modal */}
      <Modal visible={showPhotoModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>Profile Photo</Text>
              <TouchableOpacity onPress={() => setShowPhotoModal(false)}>
                <X size={20} color={themeColors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.photoOptionsList}>
              <TouchableOpacity style={[styles.photoOptionBtn, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]} onPress={handleTakePhoto}>
                <Camera size={20} color={themeColors.primary} />
                <Text style={[styles.photoOptionText, { color: themeColors.text }]}>Take Photo with Camera</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.photoOptionBtn, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]} onPress={handlePickFromGallery}>
                <UploadCloud size={20} color={themeColors.primary} />
                <Text style={[styles.photoOptionText, { color: themeColors.text }]}>Choose from Gallery</Text>
              </TouchableOpacity>

              {avatarUri && (
                <TouchableOpacity style={[styles.photoOptionBtn, { backgroundColor: themeColors.inputBg, borderColor: themeColors.danger + '55' }]} onPress={handleRemovePhoto}>
                  <Trash2 size={20} color={themeColors.danger} />
                  <Text style={[styles.photoOptionText, { color: themeColors.danger }]}>Remove Photo</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: themeColors.inputBg }]} onPress={() => setShowPhotoModal(false)}>
              <Text style={[styles.cancelBtnText, { color: themeColors.textSecondary }]}>{t('cancel', 'Cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Profile Details Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: themeColors.card, borderColor: themeColors.border, maxHeight: '90%' }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: themeColors.text }]}>Edit Researcher Profile</Text>
                <TouchableOpacity onPress={() => setShowEditModal(false)}>
                  <X size={20} color={themeColors.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                {/* 1. Title Salutation */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>Title / Salutation</Text>
                  <TouchableOpacity
                    style={[styles.dropdownBtn, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }, activeDropdown === 'title' && { borderColor: themeColors.primary }]}
                    onPress={() => setActiveDropdown(prev => prev === 'title' ? null : 'title')}
                  >
                    <Text style={[styles.dropdownBtnText, { color: editForm.titleSalutation ? themeColors.text : themeColors.textMuted }]}>
                      {editForm.titleSalutation || 'Select Title (e.g. Dr., Prof., Ms., Mr.)'}
                    </Text>
                    <ChevronDown size={16} color={themeColors.primary} />
                  </TouchableOpacity>

                  {activeDropdown === 'title' && (
                    <View style={[styles.dropdownMenu, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
                      {SALUTATIONS.map(sal => (
                        <TouchableOpacity
                          key={sal}
                          style={[styles.dropdownItem, { borderBottomColor: themeColors.border }, editForm.titleSalutation === sal && { backgroundColor: themeColors.primaryLight }]}
                          onPress={() => {
                            setEditForm({ ...editForm, titleSalutation: sal });
                            setActiveDropdown(null);
                          }}
                        >
                          <Text style={[styles.dropdownItemText, { color: editForm.titleSalutation === sal ? themeColors.primary : themeColors.textSecondary }]}>{sal}</Text>
                          {editForm.titleSalutation === sal && <Check size={14} color={themeColors.primary} />}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* 2. Full Legal Name */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>Full Legal Name</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.text }]}
                    value={editForm.fullName}
                    onChangeText={(v) => setEditForm({ ...editForm, fullName: v })}
                    placeholder="Enter your full name"
                    placeholderTextColor={themeColors.textMuted}
                  />
                </View>

                {/* 3. Gender / Pronouns Dropdown */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>Gender / Pronouns</Text>
                  <TouchableOpacity
                    style={[styles.dropdownBtn, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }, activeDropdown === 'pronouns' && { borderColor: themeColors.primary }]}
                    onPress={() => setActiveDropdown(prev => prev === 'pronouns' ? null : 'pronouns')}
                  >
                    <Text style={[styles.dropdownBtnText, { color: editForm.genderPronouns ? themeColors.text : themeColors.textMuted }]}>
                      {editForm.genderPronouns || 'Select Pronouns (e.g. She / Her)'}
                    </Text>
                    <ChevronDown size={16} color={themeColors.primary} />
                  </TouchableOpacity>

                  {activeDropdown === 'pronouns' && (
                    <View style={[styles.dropdownMenu, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
                      {PRONOUNS.map(pro => (
                        <TouchableOpacity
                          key={pro}
                          style={[styles.dropdownItem, { borderBottomColor: themeColors.border }, editForm.genderPronouns === pro && { backgroundColor: themeColors.primaryLight }]}
                          onPress={() => {
                            setEditForm({ ...editForm, genderPronouns: pro });
                            setActiveDropdown(null);
                          }}
                        >
                          <Text style={[styles.dropdownItemText, { color: editForm.genderPronouns === pro ? themeColors.primary : themeColors.textSecondary }]}>{pro}</Text>
                          {editForm.genderPronouns === pro && <Check size={14} color={themeColors.primary} />}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* 4. Date of Birth */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>Date of Birth / Age</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.text }]}
                    value={editForm.dateOfBirth}
                    onChangeText={(v) => setEditForm({ ...editForm, dateOfBirth: v })}
                    placeholder="e.g. 14 June 1994 or 30 yrs"
                    placeholderTextColor={themeColors.textMuted}
                  />
                </View>

                {/* 5. Secondary / Alternative Email */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>Alternative / Secondary Email</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.text }]}
                    value={editForm.secondaryEmail}
                    onChangeText={(v) => setEditForm({ ...editForm, secondaryEmail: v })}
                    placeholder="Enter secondary email"
                    placeholderTextColor={themeColors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                {/* 6. Office / Lab Address */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>Office / Lab Address</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.text }]}
                    value={editForm.officeAddress}
                    onChangeText={(v) => setEditForm({ ...editForm, officeAddress: v })}
                    placeholder="Enter room number, building, or lab address"
                    placeholderTextColor={themeColors.textMuted}
                  />
                </View>

                {/* 7. City & State */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>City & State</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.text }]}
                    value={editForm.cityState}
                    onChangeText={(v) => setEditForm({ ...editForm, cityState: v })}
                    placeholder="Enter city and state"
                    placeholderTextColor={themeColors.textMuted}
                  />
                </View>

                {/* 8. Country */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>Country</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.text }]}
                    value={editForm.country}
                    onChangeText={(v) => setEditForm({ ...editForm, country: v })}
                    placeholder="Enter country name"
                    placeholderTextColor={themeColors.textMuted}
                  />
                </View>

                {/* 9. Preferred Language Dropdown */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>Preferred Language</Text>
                  <TouchableOpacity
                    style={[styles.dropdownBtn, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }, activeDropdown === 'lang' && { borderColor: themeColors.primary }]}
                    onPress={() => setActiveDropdown(prev => prev === 'lang' ? null : 'lang')}
                  >
                    <Text style={[styles.dropdownBtnText, { color: editForm.preferredLanguage ? themeColors.text : themeColors.textMuted }]}>
                      {editForm.preferredLanguage || 'Select Language'}
                    </Text>
                    <ChevronDown size={16} color={themeColors.primary} />
                  </TouchableOpacity>

                  {activeDropdown === 'lang' && (
                    <View style={[styles.dropdownMenu, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
                      {SUPPORTED_LANGUAGES.map(lang => (
                        <TouchableOpacity
                          key={lang.code}
                          style={[styles.dropdownItem, { borderBottomColor: themeColors.border }, (editForm.preferredLanguage === lang.name || editForm.preferredLanguage === lang.code) && { backgroundColor: themeColors.primaryLight }]}
                          onPress={() => {
                            setEditForm({ ...editForm, preferredLanguage: lang.name });
                            changeLanguage(lang.code);
                            setActiveDropdown(null);
                          }}
                        >
                          <Text style={[styles.dropdownItemText, { color: (editForm.preferredLanguage === lang.name || editForm.preferredLanguage === lang.code) ? themeColors.primary : themeColors.textSecondary }]}>
                            {lang.flag} {lang.native} ({lang.name})
                          </Text>
                          {(editForm.preferredLanguage === lang.name || editForm.preferredLanguage === lang.code) && <Check size={14} color={themeColors.primary} />}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* 10. Institution */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>Institution / Organization</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.text }]}
                    value={editForm.institution}
                    onChangeText={(v) => setEditForm({ ...editForm, institution: v })}
                    placeholder="Enter university, lab, or company name"
                    placeholderTextColor={themeColors.textMuted}
                  />
                </View>

                {/* 11. Department */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>Department / Division</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.text }]}
                    value={editForm.department}
                    onChangeText={(v) => setEditForm({ ...editForm, department: v })}
                    placeholder="Enter department or research division"
                    placeholderTextColor={themeColors.textMuted}
                  />
                </View>

                {/* 12. Research Role */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>Research Role / Title</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.text }]}
                    value={editForm.researchRole}
                    onChangeText={(v) => setEditForm({ ...editForm, researchRole: v })}
                    placeholder="e.g. Principal Investigator, PhD Researcher"
                    placeholderTextColor={themeColors.textMuted}
                  />
                </View>

                {/* 13. Personal Bio */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>Personal Bio / About Me</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.text, height: 75, textAlignVertical: 'top' }]}
                    value={editForm.bio}
                    onChangeText={(v) => setEditForm({ ...editForm, bio: v })}
                    placeholder="Write a brief description of yourself and research focus..."
                    placeholderTextColor={themeColors.textMuted}
                    multiline
                  />
                </View>
              </ScrollView>

              <View style={styles.modalBtnRow}>
                <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: themeColors.inputBg }]} onPress={() => setShowEditModal(false)}>
                  <Text style={[styles.cancelBtnText, { color: themeColors.textSecondary }]}>{t('cancel', 'Cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveBtn, { backgroundColor: themeColors.primary }]} onPress={handleSaveProfile} disabled={savingProfile}>
                  {savingProfile ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{t('save', 'Save Profile')}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 40 },

  // ── Theme Toggle ──────────────────────────────────────────
  themeCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, padding: 14,
    borderWidth: 1, marginBottom: 12,
  },
  themeIconBadge: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
  },
  themeLabel: { fontSize: 14, fontWeight: '700' },
  themeSub: { fontSize: 12, marginTop: 2 },
  themeChipsRow: { flexDirection: 'row', gap: 10 },
  themeChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 9, borderRadius: 8, borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  themeChipActive: { backgroundColor: 'rgba(20,184,166,0.08)' },
  themeChipText: { fontSize: 13, fontWeight: '700' },
  
  // Hero Header
  profileHeader: { alignItems: 'center', marginVertical: spacing.md },
  avatarContainer: { position: 'relative', marginBottom: 8 },
  avatarImage: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 3,
  },
  avatarFallback: {
    width: 96, height: 96, borderRadius: 48,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3,
  },
  cameraBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 32, height: 32,
    borderRadius: 16, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2.5,
  },
  changePhotoText: { fontSize: 14.5, fontWeight: '700', marginBottom: 8 },
  userName: { fontSize: 23, fontWeight: '800', marginBottom: 2 },
  userRoleText: { fontSize: 15, textAlign: 'center', marginBottom: 8 },
  addRolePrompt: { fontSize: 14.5, fontWeight: '700', marginBottom: 8 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1,
  },
  statusBadgeText: { fontSize: 13.5, fontWeight: '700' },

  // Stats Row
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statCard: {
    flex: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 6,
    alignItems: 'center', borderWidth: 1,
  },
  statVal: { fontSize: 19, fontWeight: '800', marginVertical: 2 },
  statLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase' },

  // Sections
  section: {
    borderRadius: 14, padding: 14,
    borderWidth: 1, marginBottom: 14
  },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionHeader: { fontSize: 15.5, fontWeight: '800', textTransform: 'uppercase' },
  editProfileBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, borderWidth: 1,
  },
  editProfileBtnText: { fontSize: 14, fontWeight: '800' },

  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1,
  },
  infoLabel: { fontSize: 15, fontWeight: '600' },
  infoValue: { fontSize: 15, fontWeight: '700', maxWidth: '60%', textAlign: 'right' },
  notSetText: { fontSize: 14.5, fontStyle: 'italic' },
  verifiedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4
  },
  verifiedPillText: { fontSize: 12, fontWeight: '800' },

  // Bio Box
  bioBox: {
    borderRadius: 10, padding: 12,
    borderWidth: 1, marginTop: 4
  },
  bioText: { fontSize: 15, lineHeight: 21, fontStyle: 'italic' },
  emptyBioText: { fontSize: 14.5, fontStyle: 'italic' },

  // Dropdown Selectors inside Modal
  dropdownBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, marginTop: 4
  },
  dropdownBtnText: { fontSize: 15.5, fontWeight: '600' },
  dropdownMenu: {
    borderWidth: 1, borderRadius: 8, marginTop: 4, overflow: 'hidden'
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1,
  },
  dropdownItemText: { fontSize: 15, fontWeight: '600' },

  // Menu items & Passwords
  menuItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8
  },
  menuTitle: { fontSize: 15.5, fontWeight: '700' },
  menuSub: { fontSize: 13.5, marginTop: 1 },
  pwdForm: { marginTop: 10, paddingTop: 10, borderTopWidth: 1 },
  inputGroup: { marginBottom: 12 },
  inputLabel: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  input: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 15.5
  },
  saveBtn: {
    borderRadius: 8, paddingVertical: 10,
    alignItems: 'center', marginTop: 4, flex: 1
  },
  saveBtnText: { color: '#fff', fontSize: 15.5, fontWeight: '800' },

  // Logout
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 12, paddingVertical: 12, marginTop: 4
  },
  logoutText: { fontSize: 16, fontWeight: '800' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 18, borderWidth: 1,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 18.5, fontWeight: '800' },
  photoOptionsList: { gap: 10, marginBottom: 14 },
  photoOptionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 10, padding: 14, borderWidth: 1,
  },
  photoOptionText: { fontSize: 15.5, fontWeight: '700' },
  cancelBtn: {
    borderRadius: 8, paddingVertical: 10,
    alignItems: 'center', flex: 1, marginRight: 8
  },
  cancelBtnText: { fontSize: 15.5, fontWeight: '700' },
  modalBtnRow: { flexDirection: 'row', marginTop: 14 }
});
