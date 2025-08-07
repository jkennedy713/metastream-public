import React, { createContext, useContext, useEffect, useState } from 'react';
import { getCurrentUser, AuthUser, fetchAuthSession, fetchUserAttributes } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import { Navigate } from 'react-router-dom';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  profileName: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState<string | null>(null);

  useEffect(() => {
    checkAuthState();
    const unsubscribe = Hub.listen('auth', async ({ payload }) => {
      console.log('[Auth] Hub event:', payload.event);
      if (payload.event === 'signedIn' || payload.event === 'tokenRefresh') {
        try {
          await fetchAuthSession({ forceRefresh: true });
        } catch (e) {
          console.warn('[Auth] fetchAuthSession on event failed', e);
        }
        checkAuthState();
      }
      if (payload.event === 'signedOut') {
        setUser(null);
      }
    });
    return unsubscribe;
  }, []);

  const checkAuthState = async () => {
    try {
      const currentUser = await getCurrentUser();
      console.log('[Auth] current user', currentUser);
      setUser(currentUser);
      try {
        const attrs = await fetchUserAttributes();
        const composed =
          (attrs.name && attrs.name.trim()) ||
          ([attrs.given_name, attrs.family_name].filter(Boolean).join(' ').trim()) ||
          attrs.email ||
          currentUser.username;
        setProfileName(composed || null);
      } catch (e) {
        console.warn('[Auth] fetchUserAttributes failed', e);
        setProfileName(null);
      }
    } catch (error) {
      console.warn('[Auth] no current user', error);
      // Preserve existing user on transient errors
      setUser((prev) => prev ?? null);
      setProfileName(null);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      const { signOut } = await import('aws-amplify/auth');
      await signOut();
      setUser(null);
      setProfileName(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const value = {
    user,
    loading,
    profileName,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

interface RequireAuthProps {
  children: React.ReactNode;
}

export const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};