import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase, SUPABASE_ENABLED } from "@/lib/supabase";

interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
}

interface AuthCtx {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx | null>(null);

const LOCAL_KEY = "flipstudio_accounts";
const SESSION_KEY = "flipstudio_session";

interface LocalAccount { id: string; username: string; email: string; password: string; avatar?: string; }

function getLocalAccounts(): LocalAccount[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]") as LocalAccount[]; } catch { return []; }
}
function saveLocalAccounts(accounts: LocalAccount[]) { localStorage.setItem(LOCAL_KEY, JSON.stringify(accounts)); }
function getLocalSession(): User | null {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as User | null; } catch { return null; }
}
function saveLocalSession(user: User | null) {
  if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  else localStorage.removeItem(SESSION_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (SUPABASE_ENABLED) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
        if (session?.user) {
          const u = session.user;
          setUser({ id: u.id, username: u.user_metadata?.['username'] as string || u.email?.split('@')[0] || "User", email: u.email ?? "", avatar: u.user_metadata?.['avatar_url'] as string });
        } else {
          setUser(null);
        }
        setIsLoading(false);
      });
      supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user) {
          const u = data.session.user;
          setUser({ id: u.id, username: u.user_metadata?.['username'] as string || u.email?.split('@')[0] || "User", email: u.email ?? "", avatar: u.user_metadata?.['avatar_url'] as string });
        }
        setIsLoading(false);
      });
      return () => { subscription.unsubscribe(); };
    } else {
      // Offline mode
      const session = getLocalSession();
      setUser(session);
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    if (SUPABASE_ENABLED) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
    } else {
      const accounts = getLocalAccounts();
      const account = accounts.find(a => a.email === email && a.password === password);
      if (!account) throw new Error("Invalid email or password");
      const u: User = { id: account.id, username: account.username, email: account.email, avatar: account.avatar };
      saveLocalSession(u);
      setUser(u);
    }
  }, []);

  const register = useCallback(async (email: string, username: string, password: string) => {
    if (SUPABASE_ENABLED) {
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { username, display_name: username } } });
      if (error) throw new Error(error.message);
    } else {
      const accounts = getLocalAccounts();
      if (accounts.find(a => a.email === email)) throw new Error("An account with this email already exists");
      if (accounts.find(a => a.username === username)) throw new Error("Username already taken");
      const newAccount: LocalAccount = { id: crypto.randomUUID(), username, email, password };
      accounts.push(newAccount);
      saveLocalAccounts(accounts);
      const u: User = { id: newAccount.id, username, email };
      saveLocalSession(u);
      setUser(u);
    }
  }, []);

  const logout = useCallback(() => {
    if (SUPABASE_ENABLED) { void supabase.auth.signOut(); }
    saveLocalSession(null);
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
