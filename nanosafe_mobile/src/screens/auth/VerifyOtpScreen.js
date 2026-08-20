import React, { useState, useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { ThemeContext } from '../../context/ThemeContext';
import { AuthContext } from '../../context/AuthContext';
import { LanguageContext } from '../../context/LanguageContext';
import { KeyRound, CheckCircle } from 'lucide-react-native';

export default function VerifyOtpScreen({ route, navigation }) {
  const { email } = route.params || {};
  const { colors, isDark } = useContext(ThemeContext);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const { verifyOtp } = useContext(AuthContext);

  const handleVerify = async () => {
    if (!otp || otp.length < 6) {
      setError('Please enter a 6-digit OTP code.');
      return;
    }

    setError(null);
    setLoading(true);
    const res = await verifyOtp(email, otp);
    setLoading(false);

    if (!res.success) {
      setError(res.error);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
          <KeyRound size={36} color={colors.primary} />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>Email Verification</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Enter the 6-digit OTP code sent to {'\n'}
          <Text style={[styles.emailText, { color: colors.primary }]}>{email || 'your email'}</Text>
        </Text>

        {error && (
          <View style={[styles.errorBox, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}>
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          </View>
        )}

        <View style={styles.inputGroup}>
          <TextInput
            style={[styles.otpInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.primary }]}
            placeholder="000000"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            maxLength={6}
            value={otp}
            onChangeText={setOtp}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={handleVerify}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <CheckCircle size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.buttonText}>Verify & Login</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.md,
  },
  card: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 25,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16.5,
    textAlign: 'center',
    marginVertical: spacing.sm,
    lineHeight: 22,
  },
  emailText: {
    fontWeight: '600',
  },
  errorBox: {
    width: '100%',
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginVertical: spacing.sm,
  },
  errorText: {
    fontSize: 16.5,
    textAlign: 'center',
  },
  inputGroup: {
    width: '100%',
    marginVertical: spacing.md,
  },
  otpInput: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    fontSize: 31,
    fontWeight: 'bold',
    letterSpacing: 8,
    textAlign: 'center',
    paddingVertical: 12,
  },
  button: {
    width: '100%',
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18.5,
    fontWeight: '600',
  },
});
