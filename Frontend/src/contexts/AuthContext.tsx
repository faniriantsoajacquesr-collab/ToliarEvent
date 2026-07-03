import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { resolveAppEntryPath, type OrganizationStatus } from '../utils/appRouting';

export interface User {
  id: string;
  email: string;
  created_at: string;
  email_confirmed_at?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  role?: string;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasProfile: boolean;
  hasOrganization: boolean;
  organizationStatus: OrganizationStatus;
  organizationName: string | null;
  error: string | null;
  isAuthModalOpen: boolean;
  authModalMode: 'login' | 'signup';
  setAuthModalOpen: (isOpen: boolean, mode?: 'login' | 'signup') => void;
  login: (email: string, password: string) => Promise<string>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkProfileCompletion: (token?: string) => Promise<{
    hasProfile: boolean;
    hasOrganization: boolean;
    organizationStatus: OrganizationStatus;
    organizationName: string | null;
  }>;
  getAppEntryPath: () => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const [hasOrganization, setHasOrganization] = useState(false);
  const [organizationStatus, setOrganizationStatus] = useState<OrganizationStatus>(null);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');

  // Initialiser depuis localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedUser = localStorage.getItem('user');
        const storedAccessToken = localStorage.getItem('access_token');
        const storedRefreshToken = localStorage.getItem('refresh_token');

        if (storedUser && storedAccessToken) {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          setSession({
            access_token: storedAccessToken,
            refresh_token: storedRefreshToken || '',
            expires_in: 3600,
          });

          // Vérifier si le profil est complété localement
          // Toujours vérifier l'état complet depuis le serveur pour garantir la synchronisation (Profil + Organisation)
          try {
            const res = await fetch('http://localhost:5000/api/auth/check-profile', {
              method: 'GET',
              headers: { 'Authorization': `Bearer ${storedAccessToken}` },
            });
            const data = await res.json();
            if (data.success) {
              setHasProfile(data.hasProfile);
              setHasOrganization(data.hasOrganization);
              setOrganizationStatus(data.organizationStatus || null);
              setOrganizationName(data.organizationName || null);
              
              if (data.profile || data.role) {
                const merged = { ...parsedUser, ...data.profile, role: data.role || parsedUser.role };
                setUser(merged);
                localStorage.setItem('user', JSON.stringify(merged));
              }
            } else {
              setUser(null);
              setSession(null);
              setHasProfile(false);
              setHasOrganization(false);
              setOrganizationStatus(null);
              setOrganizationName(null);
              localStorage.removeItem('access_token');
              localStorage.removeItem('refresh_token');
              localStorage.removeItem('user');
            }
          } catch (err) {
            console.error('Erreur synchro initiale:', err);
            setUser(null);
            setSession(null);
            setHasProfile(false);
            setHasOrganization(false);
            setOrganizationStatus(null);
            setOrganizationName(null);
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('user');
          }
        }
      } catch (err) {
        console.error('Erreur initialisation auth:', err);
        localStorage.clear();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const setAuthModalOpen = (isOpen: boolean, mode: 'login' | 'signup' = 'login') => {
    setIsAuthModalOpen(isOpen);
    setAuthModalMode(mode);
  };

  const login = async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Erreur de connexion');
      }

      const newSession: Session = {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
      };

      setUser(data.user);
      setSession(newSession);

      // Stocker dans localStorage
      localStorage.setItem('access_token', newSession.access_token);
      localStorage.setItem('refresh_token', newSession.refresh_token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // ÉTAPE CRUCIALE : Vérifier l'état complet (Profil + Organisation) immédiatement après le login
      const result = await checkProfileCompletion(newSession.access_token);
      return resolveAppEntryPath({
        hasProfile: result.hasProfile,
        hasOrganization: result.hasOrganization,
        organizationStatus: result.organizationStatus,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur de connexion';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Erreur lors de l\'inscription');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur d\'inscription';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setError(null);
    setIsLoading(true);

    try {
      await fetch('http://localhost:5000/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      setUser(null);
      setSession(null);
      setHasProfile(false);
      setHasOrganization(false);
      setOrganizationStatus(null);
      setOrganizationName(null);

      // Nettoyer localStorage
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
    } catch (err) {
      console.error('Erreur logout:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const checkProfileCompletion = async (token?: string): Promise<{
    hasProfile: boolean;
    hasOrganization: boolean;
    organizationStatus: OrganizationStatus;
    organizationName: string | null;
  }> => {
    const accessToken = token || session?.access_token;
    if (!accessToken) {
      return { hasProfile: false, hasOrganization: false, organizationStatus: null, organizationName: null };
    }

    try {
      const response = await fetch('http://localhost:5000/api/auth/check-profile', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        const status = (data.organizationStatus || null) as OrganizationStatus;
        const name = data.organizationName || null;
        setHasProfile(data.hasProfile);
        setHasOrganization(data.hasOrganization);
        setOrganizationStatus(status);
        setOrganizationName(name);
        if (data.profile || data.role) {
          const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
          const merged = { ...currentUser, ...data.profile, role: data.role || currentUser.role };
          setUser(merged);
          localStorage.setItem('user', JSON.stringify(merged));
        }
        return {
          hasProfile: data.hasProfile,
          hasOrganization: data.hasOrganization,
          organizationStatus: status,
          organizationName: name,
        };
      }

      setHasProfile(false);
      setHasOrganization(false);
      setOrganizationStatus(null);
      setOrganizationName(null);
      return { hasProfile: false, hasOrganization: false, organizationStatus: null, organizationName: null };
    } catch (err) {
      console.error('Erreur vérification profil:', err);
      return { hasProfile: false, hasOrganization: false, organizationStatus: null, organizationName: null };
    }
  };

  const getAppEntryPath = () => resolveAppEntryPath({ hasProfile, hasOrganization, organizationStatus });

  const value: AuthContextType = {
    user,
    session,
    isLoading,
    isAuthenticated: !!user && !!session,
    hasProfile,
    hasOrganization,
    organizationStatus,
    organizationName,
    error,
    isAuthModalOpen,
    authModalMode,
    setAuthModalOpen,
    login,
    signup,
    logout,
    checkProfileCompletion,
    getAppEntryPath,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return context;
};
