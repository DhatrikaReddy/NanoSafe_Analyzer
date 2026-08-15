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
import { AuthContext } from '../../context/AuthContext';
import { KeyRound, CheckCircle } from 'lucide-react-native';

export default function VerifyOtpScreen({ route, navigation }) {
  const { email } = route.params || {};
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
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <KeyRound size={36} color={colors.primaryLight} />
        </View>

        <Text style={styles.title}>Email Verification</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit OTP code sent to {'\n'}
          <Text style={styles.emailText}>{email || 'your email'}</Text>
        </Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.inputGroup}>
          <TextInput
            style={styles.otpInput}
            placeholder="000000"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            maxLength={6}
            value={otp}
            onChangeText={setOtp}
          />
        </View>

        <TouchableOpacity
          style={styles.button}
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
    backgroundColor: colors.background,
    justify: 'center',
    padding: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.inputBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginVertical: spacing.sm,
    lineHeight: 20,
  },
  emailText: {
    color: colors.primaryLight,
    fontWeight: '600',
  },
  errorBox: {
    width: '100%',
    backgroundColor: colors.dangerBg,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginVertical: spacing.sm,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    textAlign: 'center',
  },
  inputGroup: {
    width: '100%',
    marginVertical: spacing.md,
  },
  otpInput: {
    backgroundColor: colors.inputBg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    color: colors.text,
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 8,
    textAlign: 'center',
    paddingVertical: 12,
  },
  button: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
