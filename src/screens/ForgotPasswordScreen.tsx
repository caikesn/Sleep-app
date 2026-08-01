import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme, space, gradients } from '../theme';
import { useAuth } from '../lib/AuthContext';
import Button from '../components/Button';
import Field from '../components/Field';

type Stage = 'request' | 'reset';

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { sendRecoveryCode, completePasswordReset } = useAuth();

  const [stage, setStage] = useState<Stage>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canRequest = email.trim().length > 3 && !busy;
  const canReset = code.trim().length >= 6 && password.length >= 6 && !busy;

  async function requestCode() {
    if (!canRequest) return;
    setBusy(true);
    setError(null);
    setNotice(null);

    const { error } = await sendRecoveryCode(email);
    if (error) setError(error);
    else {
      setStage('reset');
      setNotice('If that address has an account, a 6-digit code is on its way.');
    }
    setBusy(false);
  }

  async function resetPassword() {
    if (!canReset) return;
    setBusy(true);
    setError(null);
    setNotice(null);

    // On success the session lands and the navigator swaps stacks, so there is
    // nothing to do here — this screen goes away with it.
    const { error } = await completePasswordReset(email, code, password);
    if (error) {
      setError(error);
      setBusy(false);
    }
  }

  const requesting = stage === 'request';

  return (
    <LinearGradient colors={gradients.screen} style={styles.root}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + space.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>NIGHT ROUTINE</Text>
        <Text style={styles.title}>
          {requesting ? 'Reset your password' : 'Choose a new password'}
        </Text>
        <Text style={styles.subtitle}>
          {requesting
            ? "Enter your email and we'll send you a 6-digit code."
            : `Enter the code sent to ${email.trim()} and pick a new password.`}
        </Text>

        <View style={styles.form}>
          {requesting ? (
            <Field
              label="EMAIL"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              inputMode="email"
              onSubmitEditing={requestCode}
              returnKeyType="go"
            />
          ) : (
            <>
              <Field
                label="6-DIGIT CODE"
                code
                value={code}
                onChangeText={(v) => setCode(v.replace(/[^0-9]/g, '').slice(0, 6))}
                placeholder="000000"
                keyboardType="number-pad"
                inputMode="numeric"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                maxLength={6}
              />

              <Field
                label="NEW PASSWORD"
                secure
                value={password}
                onChangeText={setPassword}
                placeholder="At least 6 characters"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                onSubmitEditing={resetPassword}
                returnKeyType="go"
              />
            </>
          )}

          {error && <Text style={styles.error}>{error}</Text>}
          {notice && <Text style={styles.notice}>{notice}</Text>}

          <Button
            label={requesting ? 'Send code' : 'Set new password'}
            onPress={requesting ? requestCode : resetPassword}
            busy={busy}
            disabled={!(requesting ? canRequest : canReset)}
            style={styles.submit}
          />

          <Pressable
            onPress={() => (requesting ? navigation.goBack() : setStage('request'))}
            style={styles.switch}
            hitSlop={8}
          >
            <Text style={styles.switchText}>
              {requesting ? 'Back to sign in' : 'Use a different email'}
            </Text>
          </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xl,
  },
  eyebrow: {
    color: theme.ember,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: space.sm,
  },
  title: {
    color: theme.text,
    fontSize: 34,
    fontWeight: '300',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: theme.textDim,
    fontSize: 15,
    marginTop: space.sm,
    lineHeight: 21,
  },
  form: {
    marginTop: space.xl,
  },
  error: {
    color: theme.danger,
    fontSize: 14,
    marginTop: space.md,
    lineHeight: 19,
  },
  notice: {
    color: theme.ember,
    fontSize: 14,
    marginTop: space.md,
    lineHeight: 19,
  },
  submit: {
    marginTop: space.xl,
  },
  switch: {
    alignSelf: 'center',
    marginTop: space.lg,
    padding: space.sm,
  },
  switchText: {
    color: theme.ember,
    fontSize: 14,
    fontWeight: '600',
  },
});
