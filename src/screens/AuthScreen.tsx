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
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { theme, space, gradients } from '../theme';
import { useAuth } from '../lib/AuthContext';
import Button from '../components/Button';
import Field from '../components/Field';
import type { RootStackParamList } from '../navigation';

type Mode = 'signIn' | 'signUp';

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
        <Text style={styles.title}>{mode === 'signIn' ? 'Welcome back' : 'Create an account'}</Text>
        <Text style={styles.subtitle}>
          {mode === 'signIn'
            ? 'Sign in to pick up your routines and history.'
            : 'Your routines and history sync across your devices.'}
        </Text>

        <View style={styles.form}>
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
          />

          <Field
            label="PASSWORD"
            secure
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType={mode === 'signIn' ? 'password' : 'newPassword'}
            onSubmitEditing={submit}
            returnKeyType="go"
          />

          {error && <Text style={styles.error}>{error}</Text>}
          {notice && <Text style={styles.notice}>{notice}</Text>}

          <Button
            label={mode === 'signIn' ? 'Sign in' : 'Create account'}
            onPress={submit}
            busy={busy}
            disabled={!canSubmit}
            style={styles.submit}
          />

          {mode === 'signIn' && (
            <Pressable
              onPress={() => navigation.navigate('ForgotPassword')}
              style={styles.switch}
              hitSlop={8}
            >
              <Text style={styles.forgotText}>Forgot your password?</Text>
            </Pressable>
          )}

          <Pressable onPress={switchMode} style={styles.switch} hitSlop={8}>
            <Text style={styles.switchText}>
              {mode === 'signIn' ? "No account yet? Create one" : 'Already have an account? Sign in'}
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
  forgotText: {
    color: theme.textDim,
    fontSize: 14,
    fontWeight: '600',
  },
});
