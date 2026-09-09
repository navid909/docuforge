'use client';

import { useState, useEffect, createContext, useContext } from 'react';

interface Account {
  email: string;
  token: string;
  premium: boolean;
}

interface AuthContextValue {
  account: Account | null;
  loading: boolean;
  login: (email: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('docuforge_account');
      if (raw) setAccount(JSON.parse(raw));
    } catch {
      setAccount(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (email: string) => {
    const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
    const emailTrim = email.trim().toLowerCase();
    const loginRes = await fetch(`${BACKEND}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailTrim }),
    });
    if (loginRes.ok) {
      const data = await loginRes.json();
      const account = { email: emailTrim, token: data.token, premium: !!data.premium };
      setAccount(account);
      localStorage.setItem('docuforge_account', JSON.stringify(account));
      return;
    }
    const signupRes = await fetch(`${BACKEND}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailTrim }),
    });
    const data = await signupRes.json();
    if (!signupRes.ok) throw new Error(data.error || 'Signup failed');
    const account = { email: emailTrim, token: data.token, premium: !!data.premium };
    setAccount(account);
    localStorage.setItem('docuforge_account', JSON.stringify(account));
  };

  const logout = () => {
    setAccount(null);
    localStorage.removeItem('docuforge_account');
  };

  return (
    <AuthContext.Provider value={{ account, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
