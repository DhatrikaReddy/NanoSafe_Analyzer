import React, { useContext } from 'react';
import {
  StyleSheet, Text, View, Modal, TouchableOpacity, ScrollView
} from 'react-native';
import { LanguageContext, SUPPORTED_LANGUAGES } from '../context/LanguageContext';
import { ThemeContext } from '../context/ThemeContext';
import { Globe, Check, X } from 'lucide-react-native';

export default function LanguageModal() {
  const { currentLang, changeLanguage, showLanguageModal, setShowLanguageModal, t } = useContext(LanguageContext);
  const { colors } = useContext(ThemeContext);

  return (
    <Modal visible={showLanguageModal} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Globe size={22} color={colors.primary} />
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('selectLang', 'Select App Language')}</Text>
            </View>
            <TouchableOpacity onPress={() => setShowLanguageModal(false)} style={styles.closeBtn}>
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isSelected = currentLang === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.langItem, { backgroundColor: colors.inputBg, borderColor: colors.border }, isSelected && { borderColor: colors.primary, backgroundColor: 'rgba(20,184,166,0.12)' }]}
                  onPress={() => changeLanguage(lang.code)}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Text style={styles.flagText}>{lang.flag}</Text>
                    <View>
                      <Text style={[styles.langName, { color: colors.textSecondary }, isSelected && { color: colors.primary, fontWeight: '800' }]}>
                        {lang.native}
                      </Text>
                      <Text style={[styles.langSubName, { color: colors.textMuted }]}>{lang.name}</Text>
                    </View>
                  </View>

                  {isSelected && (
                    <View style={[styles.checkCircle, { backgroundColor: colors.primary }]}>
                      <Check size={14} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.inputBg }]} onPress={() => setShowLanguageModal(false)}>
            <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>{t('cancel', 'Cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 18, borderWidth: 1
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 18.5, fontWeight: '800' },
  closeBtn: { padding: 4 },
  langItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1, marginBottom: 8
  },
  langItemActive: {},
  flagText: { fontSize: 26 },
  langName: { fontSize: 17, fontWeight: '700' },
  langNameActive: {},
  langSubName: { fontSize: 13.5, marginTop: 1 },
  checkCircle: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: '#0d9488',
    justifyContent: 'center', alignItems: 'center'
  },
  cancelBtn: {
    borderRadius: 10, paddingVertical: 12,
    alignItems: 'center', marginTop: 6
  },
  cancelBtnText: { fontSize: 15.5, fontWeight: '700' }
});
