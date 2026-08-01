import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, space, radius } from '../theme';
import { useAuth } from '../lib/AuthContext';

type Mode = 'signIn' | 'signUp';

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const canSubmit = email.trim().length > 3 && password.length >= 6 && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    setNotice(null);

    if (mode === 'signIn') {
      const { error } = await signIn(email, password);
      if (error) setError(error);
    } else {
      const { error, needsConfirmation } = await signUp(email, password);
      if (error) setError(error);
      else if (needsConfirmation) {
        setNotice('Check your email for a confirmation link, then sign in.');
        setMode('signIn');
      }
    }
    setBusy(false);
  }

  function switchMode() {
    setMode((m) => (m === 'signIn' ? 'signUp' : 'signIn'));
    setError(null);
    setNotice(null);
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + space.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>NIGHT ROUTINE</Text>
        <Text style={styles.title}>{mode === 'signIn' ? 'Welcome back' : 'Create an account'}</Text>
        <Text style={styles.subtitle}>
          {mode === 'signIn'
            ? 'Sign in to pick up your routines and history.'
            : 'Your routines and history sync across your devices.'}
        </Text>

        <View style={styles.form}>
          <Text style={styles.fieldLabel}>EMAIL</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={theme.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            inputMode="email"
          />

          <Text style={styles.fieldLabel}>PASSWORD</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              placeholderTextColor={theme.textFaint}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType={mode === 'signIn' ? 'password' : 'newPassword'}
              onSubmitEditing={submit}
              returnKeyType="go"
            />
            <Pressable
              style={styles.reveal}
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            >
              <Text style={styles.revealText}>{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}
          {notice && <Text style={styles.notice}>{notice}</Text>}

          <Pressable
            style={[styles.submit, !canSubmit && styles.submitDisabled]}
            onPress={submit}
            disabled={!canSubmit}
          >
            {busy ? (
              <ActivityIndicator color="#1a0f08" />
            ) : (
              <Text style={styles.submitText}>{mode === 'signIn' ? 'Sign in' : 'Create account'}</Text>
            )}
          </Pressable>

          <Pressable onPress={switchMode} style={styles.switch} hitSlop={8}>
            <Text style={styles.switchText}>
              {mode === 'signIn' ? "No account yet? Create one" : 'Already have an account? Sign in'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.bg,
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
  fieldLabel: {
    color: theme.textFaint,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: space.sm,
    marginTop: space.md,
  },
  input: {
    backgroundColor: theme.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.cardBorder,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md - 2,
    color: theme.text,
    fontSize: 16,
  },
  passwordRow: {
    justifyContent: 'center',
  },
  passwordInput: {
    // Room for the Show/Hide control so long passwords don't run under it.
    paddingRight: 68,
  },
  reveal: {
    position: 'absolute',
    right: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  revealText: {
    color: theme.ember,
    fontSize: 13,
    fontWeight: '700',
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
    backgroundColor: theme.emberDeep,
    borderRadius: radius.lg,
    paddingVertical: space.md,
    alignItems: 'center',
    marginTop: space.xl,
    minHeight: 52,
    justifyContent: 'center',
  },
  submitDisabled: {
    opacity: 0.4,
  },
  submitText: {
    color: '#1a0f08',
    fontSize: 16,
    fontWeight: '700',
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
