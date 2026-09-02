import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthResult, AuthUser } from '@clippster/shared-types';
import { authApi, setUnauthorizedHandler } from '@/services/api';
import { clearPlanSelectionState } from '@/services/planSelection';
import {
  clearAuthSession,
  getStoredProvider,
  getStoredToken,
  getStoredUser,
  saveAuthSession,
  type AuthProviderType,
} from '@/services/authStorage';
import { startGoogleAuth } from '@/services/googleAuth';
import { setCurrentUserId } from '@/services/database';

interface AuthContextValue {
  isAuthenticated: boolean;
  authChecked: boolean;
  user: AuthUser | null;
  token: string | null;
  authProvider: AuthProviderType | null;
  loading: boolean;
  error: string | null;
  pendingVerificationEmail: string | null;
  loginWithEmail: (email: string, password: string) => Promise<AuthResult>;
  registerWithEmail: (email: string, password: string) => Promise<AuthResult>;
  verifyEmailOtp: (email: string, otp: string) => Promise<AuthResult>;
  resendVerificationEmail: (email: string) => Promise<AuthResult>;
  authenticateWithGoogle: () => Promise<AuthResult>;
  completeGoogleSession: (token: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  clearPendingVerification: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authProvider, setAuthProvider] = useState<AuthProviderType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);

  const applySession = useCallback(
    async (nextUser: AuthUser, nextToken: string, provider: AuthProviderType) => {
      await saveAuthSession(nextToken, nextUser, provider);
      setUser(nextUser);
      setToken(nextToken);
      setAuthProvider(provider);
      setIsAuthenticated(true);
      setError(null);
      setCurrentUserId(String(nextUser.id));
      void import('@/services/orgAssetCache').then(({ syncUserOrganizationAssets }) =>
        syncUserOrganizationAssets(),
      );
    },
    [],
  );

  const logout = useCallback(async () => {
    await clearAuthSession();
    await clearPlanSelectionState();
    setUser(null);
    setToken(null);
    setAuthProvider(null);
    setIsAuthenticated(false);
    setError(null);
    setPendingVerificationEmail(null);
    setCurrentUserId(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void logout();
    });
  }, [logout]);

  const boot = useCallback(async () => {
    const storedToken = await getStoredToken();
    if (!storedToken) {
      setAuthChecked(true);
      return;
    }

    try {
      const data = await authApi.me();
      if (data.success && data.user) {
        const provider = (await getStoredProvider()) ?? 'email';
        const storedUser = (await getStoredUser()) ?? data.user;
        await applySession({ ...storedUser, ...data.user }, storedToken, provider);
      } else {
        await logout();
      }
    } catch {
      await logout();
    } finally {
      setAuthChecked(true);
    }
  }, [applySession, logout]);

  useEffect(() => {
    void boot();
  }, [boot]);

  const loginWithEmail = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      setLoading(true);
      setError(null);
      try {
        const data = await authApi.login(email, password);
        if (data.success && data.token && data.user) {
          await applySession(data.user, data.token, 'email');
          return { success: true, user: data.user };
        }
        if (data.code === 'EMAIL_NOT_VERIFIED') {
          setPendingVerificationEmail(email);
          return { success: false, needsVerification: true, error: data.error };
        }
        setError(data.error ?? 'Login failed');
        return { success: false, error: data.error };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Login failed';
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [applySession],
  );

  const registerWithEmail = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    setLoading(true);
    setError(null);
    try {
      const data = await authApi.register(email, password);
      if (data.success) {
        setPendingVerificationEmail(email);
        return { success: true, message: data.message };
      }
      setError(data.error ?? 'Registration failed');
      return { success: false, error: data.error };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyEmailOtp = useCallback(
    async (email: string, otp: string): Promise<AuthResult> => {
      setLoading(true);
      setError(null);
      try {
        const data = await authApi.verifyOtp(email, otp);
        if (data.success && data.token && data.user) {
          await applySession(data.user, data.token, 'email');
          setPendingVerificationEmail(null);
          return { success: true, user: data.user };
        }
        setError(data.error ?? 'Verification failed');
        return { success: false, error: data.error };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Verification failed';
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [applySession],
  );

  const resendVerificationEmail = useCallback(async (email: string): Promise<AuthResult> => {
    setLoading(true);
    try {
      const data = await authApi.resendVerification(email);
      return data.success
        ? { success: true, message: data.message }
        : { success: false, error: data.error };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resend verification';
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, []);

  const authenticateWithGoogle = useCallback(async (): Promise<AuthResult> => {
    // Do not setState before startGoogleAuth — browsers block the auth session
    // if window.open / ASWebAuthenticationSession is delayed past the user gesture.
    try {
      const result = await startGoogleAuth();
      setLoading(true);
      if (result.success && result.token && result.user) {
        await applySession(result.user, result.token, 'google');
      } else if (result.error) {
        setError(result.error);
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google sign-in failed';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [applySession]);

  const completeGoogleSession = useCallback(
    async (nextToken: string, nextUser: AuthUser) => {
      await applySession(nextUser, nextToken, 'google');
    },
    [applySession],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      authChecked,
      user,
      token,
      authProvider,
      loading,
      error,
      pendingVerificationEmail,
      loginWithEmail,
      registerWithEmail,
      verifyEmailOtp,
      resendVerificationEmail,
      authenticateWithGoogle,
      completeGoogleSession,
      logout,
      clearError: () => setError(null),
      clearPendingVerification: () => setPendingVerificationEmail(null),
    }),
    [
      isAuthenticated,
      authChecked,
      user,
      token,
      authProvider,
      loading,
      error,
      pendingVerificationEmail,
      loginWithEmail,
      registerWithEmail,
      verifyEmailOtp,
      resendVerificationEmail,
      authenticateWithGoogle,
      completeGoogleSession,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
