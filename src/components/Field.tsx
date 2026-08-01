import React, { forwardRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, TextInputProps } from 'react-native';
import { theme, space, radius } from '../theme';

/**
 * Labelled text input. `secure` adds the Show/Hide control rather than leaving
 * each screen to position its own — the auth and reset screens had drifted into
 * two copies of the same absolutely-positioned button.
 */

type Props = TextInputProps & {
  label: string;
  secure?: boolean;
  /** Centred, wide-tracked treatment for one-time codes. */
  code?: boolean;
};

const Field = forwardRef<TextInput, Props>(function Field(
  { label, secure, code, style, ...rest },
  ref
) {
  const [reveal, setReveal] = useState(false);

  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <TextInput
          ref={ref}
          style={[styles.input, code && styles.code, secure && styles.secure, style]}
          placeholderTextColor={theme.textFaint}
          secureTextEntry={secure && !reveal}
          {...rest}
        />
        {secure && (
          <Pressable
            style={styles.reveal}
            onPress={() => setReveal((v) => !v)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={reveal ? 'Hide password' : 'Show password'}
          >
            <Text style={styles.revealText}>{reveal ? 'Hide' : 'Show'}</Text>
          </Pressable>
        )}
      </View>
    </>
  );
});

export default Field;

const styles = StyleSheet.create({
  label: {
    color: theme.textFaint,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: space.sm,
    marginTop: space.md,
  },
  row: {
    justifyContent: 'center',
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
  secure: {
    // Room for Show/Hide so long values don't run under it.
    paddingRight: 68,
  },
  code: {
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
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
});
