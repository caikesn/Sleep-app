import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { clearLocalCache } from '../storage';
import { clearSessionCache } from '../sessions';
import { clearRoutineCache } from '../routines';
import { clearOnboardingPending } from '../onboarding';

type AuthState = {
  session: Session | null;
  user: User | null;
  /** True until the persisted session has been read back from storage. */
  initializing: boolean;
  /**
   * True while a password reset is mid-flight. Verifying the code creates a
   * session, which would otherwise swap the navigator to the signed-in stack
   * and unmount the reset screen before the new password is saved.
   */
  recovering: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  sendRecoveryCode: (email: string) => Promise<{ error: string | null }>;
  completePasswordReset: (
    email: string,
    token: string,
    newPassword: string
  ) => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setInitializing(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      initializing,
      recovering,

      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        return { error: error?.message ?? null };
      },

      async signUp(email, password) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) return { error: error.message, needsConfirmation: false };
        // With email confirmation on, Supabase returns a user but no session.
        return { error: null, needsConfirmation: !data.session };
      },

      async signOut() {
        await supabase.auth.signOut();
        // Order matters: clear only after the session is gone, so nothing can
        // re-populate the cache from the outgoing user.
        await clearLocalCache();
        await clearSessionCache();
        await clearRoutineCache();
        // An unfinished walkthrough belongs to the account that was created, not
        // to the device — without this, the next person to sign in here gets it.
        await clearOnboardingPending();
      },

      async sendRecoveryCode(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
        return { error: error?.message ?? null };
      },

      async completePasswordReset(email, token, newPassword) {
        setRecovering(true);
        try {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            email: email.trim(),
            token: token.trim(),
            type: 'recovery',
          });
          if (verifyError) return { error: verifyError.message };

          const { error: updateError } = await supabase.auth.updateUser({
            password: newPassword,
          });
          if (updateError) {
            // The code is spent and a session exists, but the password is
            // unchanged. Drop back to signed-out so they retry from a clean slate.
            await supabase.auth.signOut();
            return { error: updateError.message };
          }
          return { error: null };
        } finally {
          setRecovering(false);
        }
      },
    }),
    [session, initializing, recovering]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider');
  return ctx;
}
