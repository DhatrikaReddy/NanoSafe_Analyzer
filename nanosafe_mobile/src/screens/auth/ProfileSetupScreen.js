import React, { useState, useContext } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Image, Modal, Platform,
  KeyboardAvoidingView, SafeAreaView, StatusBar
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { ThemeContext } from '../../context/ThemeContext';
import { AuthContext } from '../../context/AuthContext';
import { LanguageContext, SUPPORTED_LANGUAGES } from '../../context/LanguageContext';
import apiClient from '../../api/client';
import {
  User, ChevronDown, Check, Camera, UploadCloud, X,
  Sparkles, Trash2
} from 'lucide-react-native';

const AVATAR_STORAGE_KEY = 'nanosafe_user_avatar_uri';

const SALUTATIONS = ['Dr.', 'Prof.', 'Ms.', 'Mr.', 'Researcher'];
const PRONOUNS = ['She / Her', 'He / Him', 'They / Them', 'Prefer not to say'];
const LANGUAGES = ['English', 'Hindi', 'Telugu', 'Spanish', 'French', 'German'];

export default function ProfileSetupScreen() {
  const { user, completeProfileSetup } = useContext(AuthContext);
  const { t, changeLanguage } = useContext(LanguageContext);
  const { colors, isDark } = useContext(ThemeContext);

  // Mandatory fields
  const [titleSalutation, setTitleSalutation] = useState('');
  const [fullName, setFullName] = useState('');
  const [institution, setInstitution] = useState('');
  const [researchRole, setResearchRole] = useState('');

  // Optional fields
  const [genderPronouns, setGenderPronouns] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [secondaryEmail, setSecondaryEmail] = useState('');
  const [officeAddress, setOfficeAddress] = useState('');
  const [cityState, setCityState] = useState('');
  const [country, setCountry] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('English');
  const [department, setDepartment] = useState('');
  const [bio, setBio] = useState('');

  // Photo
  const [avatarUri, setAvatarUri] = useState(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  // Active Dropdowns
  const [activeDropdown, setActiveDropdown] = useState(null); // 'title' | 'pronouns' | 'lang'
  const [submitting, setSubmitting] = useState(false);

  const handlePickFromGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Denied', 'Please enable photo library access in your device settings.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        setAvatarUri(result.assets[0].uri);
        await AsyncStorage.setItem(AVATAR_STORAGE_KEY, result.assets[0].uri);
        setShowPhotoModal(false);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not open gallery: ' + e.message);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Denied', 'Please enable camera access in settings.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        setAvatarUri(result.assets[0].uri);
        await AsyncStorage.setItem(AVATAR_STORAGE_KEY, result.assets[0].uri);
        setShowPhotoModal(false);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not open camera: ' + e.message);
    }
  };

  const handleRemovePhoto = async () => {
    try {
      setAvatarUri(null);
      await AsyncStorage.removeItem(AVATAR_STORAGE_KEY);
      setShowPhotoModal(false);
    } catch (e) {
      console.log('Error removing photo:', e);
    }
  };

  const handleSubmit = async () => {
    // Mandatory Validations
    if (!titleSalutation.trim()) {
      Alert.alert('Required Field', 'Please select your Title / Salutation (e.g. Dr., Prof., Ms., Mr.).');
      return;
    }
    if (!fullName.trim()) {
      Alert.alert('Required Field', 'Please enter your Full Legal Name.');
      return;
    }
    if (!institution.trim()) {
      Alert.alert('Required Field', 'Please enter your Institution or Laboratory name.');
      return;
    }
    if (!researchRole.trim()) {
      Alert.alert('Required Field', 'Please enter your Research Role / Title (e.g. Principal Investigator, Clinical Lead).');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        titleSalutation,
        fullName: fullName.trim(),
        institution: institution.trim(),
        researchRole: researchRole.trim(),
        genderPronouns,
        dateOfBirth: dateOfBirth.trim(),
        secondaryEmail: secondaryEmail.trim().toLowerCase(),
        officeAddress: officeAddress.trim(),
        cityState: cityState.trim(),
        country: country.trim(),
        preferredLanguage,
        department: department.trim(),
        bio: bio.trim(),
      };

      await apiClient.put('/auth/profile', payload);

      // Mark complete in context & storage
      await completeProfileSetup({
        fullName: payload.fullName,
        role: payload.researchRole,
        institution: payload.institution,
      });

      Alert.alert(
        `Welcome, ${titleSalutation} ${fullName}!`,
        'Your researcher profile is ready. You can now enroll clinical study patients or run preclinical material screening experiments.'
      );
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to save researcher profile.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={[styles.container, { backgroundColor: colors.background }]}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Sparkles size={28} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{t('researcherProfile', 'Researcher Profile')}</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              Welcome, <Text style={{ color: colors.primary, fontWeight: '700' }}>{user?.username || 'Researcher'}</Text>! Please enter your details to initialize your workspace.
            </Text>
          </View>

          {/* Photo Upload Section */}
          <View style={[styles.photoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.avatarWrap}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: colors.inputBg }]}>
                  <User size={36} color={colors.primary} />
                </View>
              )}
              <TouchableOpacity style={styles.cameraBtn} onPress={() => setShowPhotoModal(true)}>
                <Camera size={13} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.photoTitle, { color: colors.text }]}>Profile Photo <Text style={[styles.optBadge, { color: colors.textMuted }]}>(Optional)</Text></Text>
              <Text style={[styles.photoSub, { color: colors.textMuted }]}>Upload a photo from your gallery or take a picture.</Text>
              <TouchableOpacity onPress={() => setShowPhotoModal(true)}>
                <Text style={[styles.photoBtnText, { color: colors.primary }]}>{avatarUri ? '📷 Change Photo' : '+ Upload Photo'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ================================================================= */}
          {/* SECTION 1: MANDATORY INFORMATION */}
          {/* ================================================================= */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeaderRow}>
              <Text style={[styles.cardHeader, { color: colors.text }]}>{t('mandatoryInfo', '🔴 Mandatory Information')}</Text>
              <Text style={[styles.cardHeaderSub, { color: colors.primary }]}>Required to proceed</Text>
            </View>

            {/* 1. Title Dropdown */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Title / Salutation <Text style={styles.reqStar}>*</Text>
              </Text>
              <TouchableOpacity
                style={[styles.dropdownBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }, activeDropdown === 'title' && { borderColor: colors.primary }]}
                onPress={() => setActiveDropdown(prev => prev === 'title' ? null : 'title')}
              >
                <Text style={[styles.dropdownBtnText, { color: colors.text }, !titleSalutation && { color: colors.textMuted }]}>
                  {titleSalutation || 'Select Title (e.g. Dr., Prof., Ms., Mr.)'}
                </Text>
                <ChevronDown size={16} color={colors.primary} />
              </TouchableOpacity>

              {activeDropdown === 'title' && (
                <View style={[styles.dropdownMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {SALUTATIONS.map(sal => (
                    <TouchableOpacity
                      key={sal}
                      style={[styles.dropdownItem, { borderBottomColor: colors.border }, titleSalutation === sal && styles.dropdownItemActive]}
                      onPress={() => {
                        setTitleSalutation(sal);
                        setActiveDropdown(null);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, { color: colors.textSecondary }, titleSalutation === sal && { color: colors.primary, fontWeight: '800' }]}>{sal}</Text>
                      {titleSalutation === sal && <Check size={14} color={colors.primary} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* 2. Full Legal Name */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Full Legal Name <Text style={styles.reqStar}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter your full legal name"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* 3. Institution / Organization */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Institution / Organization <Text style={styles.reqStar}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={institution}
                onChangeText={setInstitution}
                placeholder="e.g. NanoBio Clinical Research Institute"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* 4. Research Role / Title */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Research Role / Title <Text style={styles.reqStar}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={researchRole}
                onChangeText={setResearchRole}
                placeholder="e.g. Principal Investigator, Clinical Lead, PhD"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>

          {/* ================================================================= */}
          {/* SECTION 2: OPTIONAL INFORMATION */}
          {/* ================================================================= */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeaderRow}>
              <Text style={[styles.cardHeader, { color: colors.text }]}>{t('optionalInfo', '⚪ Optional Information')}</Text>
              <Text style={[styles.cardHeaderSub, { color: colors.primary }]}>Can fill now or update later</Text>
            </View>

            {/* Gender / Pronouns Dropdown */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Gender / Pronouns</Text>
              <TouchableOpacity
                style={[styles.dropdownBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }, activeDropdown === 'pronouns' && { borderColor: colors.primary }]}
                onPress={() => setActiveDropdown(prev => prev === 'pronouns' ? null : 'pronouns')}
              >
                <Text style={[styles.dropdownBtnText, { color: colors.text }, !genderPronouns && { color: colors.textMuted }]}>
                  {genderPronouns || 'Select Pronouns (e.g. She / Her)'}
                </Text>
                <ChevronDown size={16} color={colors.primary} />
              </TouchableOpacity>

              {activeDropdown === 'pronouns' && (
                <View style={[styles.dropdownMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {PRONOUNS.map(pro => (
                    <TouchableOpacity
                      key={pro}
                      style={[styles.dropdownItem, { borderBottomColor: colors.border }, genderPronouns === pro && styles.dropdownItemActive]}
                      onPress={() => {
                        setGenderPronouns(pro);
                        setActiveDropdown(null);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, { color: colors.textSecondary }, genderPronouns === pro && { color: colors.primary, fontWeight: '800' }]}>{pro}</Text>
                      {genderPronouns === pro && <Check size={14} color={colors.primary} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Date of Birth */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Date of Birth / Age</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={dateOfBirth}
                onChangeText={setDateOfBirth}
                placeholder="e.g. 14 June 1994 or 30 yrs"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Secondary Email */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Alternative / Secondary Email</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={secondaryEmail}
                onChangeText={setSecondaryEmail}
                placeholder="Enter secondary email address"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Department */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Department / Division</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={department}
                onChangeText={setDepartment}
                placeholder="e.g. Biomaterials & Nanotoxicology"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Office Address */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Office / Lab Address</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={officeAddress}
                onChangeText={setOfficeAddress}
                placeholder="e.g. Room 402, Bio-Engineering Wing, Block B"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* City & State */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>City & State</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={cityState}
                onChangeText={setCityState}
                placeholder="e.g. Hyderabad, Telangana"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Country */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Country</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={country}
                onChangeText={setCountry}
                placeholder="e.g. India"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Preferred Language Dropdown */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Preferred Language</Text>
              <TouchableOpacity
                style={[styles.dropdownBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }, activeDropdown === 'lang' && { borderColor: colors.primary }]}
                onPress={() => setActiveDropdown(prev => prev === 'lang' ? null : 'lang')}
              >
                <Text style={[styles.dropdownBtnText, { color: colors.text }, !preferredLanguage && { color: colors.textMuted }]}>
                  {preferredLanguage || 'Select Language'}
                </Text>
                <ChevronDown size={16} color={colors.primary} />
              </TouchableOpacity>

              {activeDropdown === 'lang' && (
                <View style={[styles.dropdownMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {SUPPORTED_LANGUAGES.map(lang => (
                    <TouchableOpacity
                      key={lang.code}
                      style={[styles.dropdownItem, { borderBottomColor: colors.border }, (preferredLanguage === lang.name || preferredLanguage === lang.code) && styles.dropdownItemActive]}
                      onPress={() => {
                        setPreferredLanguage(lang.name);
                        changeLanguage(lang.code);
                        setActiveDropdown(null);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, { color: colors.textSecondary }, (preferredLanguage === lang.name || preferredLanguage === lang.code) && { color: colors.primary, fontWeight: '800' }]}>
                        {lang.flag} {lang.native} ({lang.name})
                      </Text>
                      {(preferredLanguage === lang.name || preferredLanguage === lang.code) && <Check size={14} color={colors.primary} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Personal Bio */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Personal Bio / Research Focus</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text, height: 75, textAlignVertical: 'top' }]}
                value={bio}
                onChangeText={setBio}
                placeholder="Write a brief 2-3 line summary of your research focus..."
                placeholderTextColor={colors.textMuted}
                multiline
              />
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: colors.primary }]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>{t('saveProfile', '✨ Save Researcher Profile & Enter Workspace')}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ========================================================================= */}
      {/* PHOTO UPLOAD OPTIONS MODAL */}
      {/* ========================================================================= */}
      <Modal visible={showPhotoModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Profile Photo</Text>
              <TouchableOpacity onPress={() => setShowPhotoModal(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.photoOptionsList}>
              <TouchableOpacity style={[styles.photoOptionBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]} onPress={handlePickFromGallery}>
                <UploadCloud size={20} color={colors.primary} />
                <Text style={[styles.photoOptionText, { color: colors.text }]}>{t('chooseGallery', 'Choose from Gallery')}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.photoOptionBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]} onPress={handleTakePhoto}>
                <Camera size={20} color={colors.safe} />
                <Text style={[styles.photoOptionText, { color: colors.text }]}>{t('takePhoto', 'Take Camera Photo')}</Text>
              </TouchableOpacity>

              {avatarUri && (
                <TouchableOpacity style={[styles.photoOptionBtn, { backgroundColor: colors.inputBg, borderColor: 'rgba(239,68,68,0.3)' }]} onPress={handleRemovePhoto}>
                  <Trash2 size={20} color={colors.danger} />
                  <Text style={[styles.photoOptionText, { color: colors.danger }]}>{t('removePhoto', 'Remove Photo')}</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.inputBg }]} onPress={() => setShowPhotoModal(false)}>
              <Text style={[styles.cancelBtnText, { color: colors.textMuted }]}>{t('cancel', 'Cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 40 },

  header: { alignItems: 'center', marginVertical: spacing.md },
  iconCircle: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(20,184,166,0.12)',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: colors.primaryLight + '55',
    marginBottom: 10
  },
  title: { fontSize: 21, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 13, textAlign: 'center', paddingHorizontal: 12, lineHeight: 18 },

  photoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 14, padding: 14,
    borderWidth: 1, marginBottom: 14
  },
  avatarWrap: { position: 'relative' },
  avatarImg: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: colors.primaryLight },
  avatarPlaceholder: {
    width: 64, height: 64, borderRadius: 32,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.primaryLight + '66'
  },
  cameraBtn: {
    position: 'absolute', bottom: -2, right: -2, backgroundColor: colors.primary,
    width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2,
  },
  photoTitle: { fontSize: 13.5, fontWeight: '700', marginBottom: 2 },
  optBadge: { fontSize: 11, fontWeight: '500' },
  photoSub: { fontSize: 11.5, marginBottom: 4 },
  photoBtnText: { fontSize: 12, fontWeight: '700' },

  card: {
    borderRadius: 14, padding: 14,
    borderWidth: 1, marginBottom: 14
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardHeader: { fontSize: 13.5, fontWeight: '800' },
  cardHeaderSub: { fontSize: 11, fontWeight: '600' },

  inputGroup: { marginBottom: 12 },
  inputLabel: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  reqStar: { color: colors.danger, fontWeight: '800' },
  input: {
    borderWidth: 1,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 13
  },

  dropdownBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9
  },
  dropdownBtnOpen: { borderColor: colors.primaryLight },
  dropdownBtnText: { fontSize: 13, fontWeight: '600' },
  dropdownMenu: {
    borderWidth: 1,
    borderRadius: 8, marginTop: 4, overflow: 'hidden'
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1
  },
  dropdownItemActive: { backgroundColor: 'rgba(20,184,166,0.12)' },
  dropdownItemText: { fontSize: 12.5, fontWeight: '600' },
  dropdownItemTextActive: { fontWeight: '800' },

  submitBtn: {
    borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: 6,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4
  },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 18, borderWidth: 1
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 16, fontWeight: '800' },
  photoOptionsList: { gap: 10, marginBottom: 14 },
  photoOptionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 10, padding: 14,
    borderWidth: 1
  },
  photoOptionText: { fontSize: 13, fontWeight: '700' },
  cancelBtn: {
    borderRadius: 8, paddingVertical: 11,
    alignItems: 'center', marginTop: 4
  },
  cancelBtnText: { fontSize: 13, fontWeight: '700' }
});
