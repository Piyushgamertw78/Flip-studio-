import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
  import { supabase, SUPABASE_ENABLED } from "@/lib/supabase";

  export interface User {
    id: string;
    username: string;
    email: string;
    avatar?: string;
    bio?: string;
    createdAt?: string;
  }

  interface AuthCtx {
    user: User | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, username: string, password: string) => Promise<void>;
    loginWithGoogle: (email?: string, displayName?: string) => Promise<void>;
    logout: () => void;
    updateProfile: (data: Partial<Pick<User, "username" | "bio" | "avatar">>) => void;
    hasAnyAccount: () => boolean;
    deleteAccount: () => void;
  }

  const AuthContext = createContext<AuthCtx | null>(null);

  const LOCAL_KEY   = "flipstudio_accounts";
  const SESSION_KEY = "flipstudio_session";

  interface LocalAccount {
    id: string;
    username: string;
    email: string;
    password: string;
    avatar?: string;
    bio?: string;
    createdAt: string;
  }

  function getLocalAccounts(): LocalAccount[] {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]") as LocalAccount[]; }
    catch { return []; }
  }
  function saveLocalAccounts(accounts: LocalAccount[]) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(accounts));
  }
  function getLocalSession(): User | null {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as User | null; }
    catch { return null; }
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
          } else { setUser(null); }
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
        setUser(getLocalSession());
        setIsLoading(false);
      }
    }, []);

    const login = useCallback(async (email: string, password: string) => {
      if (SUPABASE_ENABLED) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
      } else {
        const accounts = getLocalAccounts();
        const account = accounts.find(a => a.email.toLowerCase() === email.toLowerCase() && a.password === password);
        if (!account) {
          if (accounts.length === 0) throw new Error("No accounts found. Please sign up first.");
          throw new Error("Invalid email or password.");
        }
        const u: User = { id: account.id, username: account.username, email: account.email, avatar: account.avatar, bio: account.bio, createdAt: account.createdAt };
        saveLocalSession(u); setUser(u);
      }
    }, []);

    const register = useCallback(async (email: string, username: string, password: string) => {
      if (SUPABASE_ENABLED) {
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { username, display_name: username } } });
        if (error) throw new Error(error.message);
      } else {
        const accounts = getLocalAccounts();
        if (accounts.find(a => a.email.toLowerCase() === email.toLowerCase())) throw new Error("An account with this email already exists.");
        if (accounts.find(a => a.username.toLowerCase() === username.toLowerCase())) throw new Error("Username already taken.");
        if (password.length < 4) throw new Error("Password must be at least 4 characters.");
        const newAccount: LocalAccount = { id: crypto.randomUUID(), username: username.trim(), email: email.toLowerCase().trim(), password, createdAt: new Date().toISOString() };
        accounts.push(newAccount);
        saveLocalAccounts(accounts);
        const u: User = { id: newAccount.id, username: newAccount.username, email: newAccount.email, createdAt: newAccount.createdAt };
        saveLocalSession(u); setUser(u);
      }
    }, []);

    const loginWithGoogle = useCallback(async (email?: string, displayName?: string) => {
      if (SUPABASE_ENABLED) {
        const { error } = await supabase.auth.signInWithOAuth({ provider: "google" });
        if (error) throw new Error(error.message);
      } else {
        const finalEmail = email?.trim().toLowerCase() || `google_${crypto.randomUUID().slice(0, 8)}@gmail.com`;
        const emailPrefix = finalEmail.split("@")[0] ?? "user";
        const finalName  = displayName?.trim() || (emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1).replace(/[._]/g, " ")) || "Google User";
        const accounts = getLocalAccounts();
        let account = accounts.find(a => a.email === finalEmail);
        if (!account) {
          account = {
            id: crypto.randomUUID(),
            username: finalName.replace(/\s+/g, "_").substring(0, 20),
            email: finalEmail,
            password: `google_oauth_${crypto.randomUUID()}`,
            avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(finalEmail)}`,
            createdAt: new Date().toISOString(),
          };
          accounts.push(account);
          saveLocalAccounts(accounts);
        }
        const u: User = { id: account.id, username: account.username, email: account.email, avatar: account.avatar, createdAt: account.createdAt };
        saveLocalSession(u); setUser(u);
      }
    }, []);

    const logout = useCallback(() => {
      if (SUPABASE_ENABLED) { void supabase.auth.signOut(); }
      saveLocalSession(null); setUser(null);
    }, []);

    const updateProfile = useCallback((data: Partial<Pick<User, "username" | "bio" | "avatar">>) => {
      setUser(prev => {
        if (!prev) return prev;
        const updated = { ...prev, ...data };
        saveLocalSession(updated);
        const accounts = getLocalAccounts();
        const idx = accounts.findIndex(a => a.id === prev.id);
        if (idx !== -1) { accounts[idx] = { ...accounts[idx]!, ...data }; saveLocalAccounts(accounts); }
        return updated;
      });
    }, []);

    const hasAnyAccount = useCallback((): boolean => {
      if (SUPABASE_ENABLED) return true;
      return getLocalAccounts().length > 0;
    }, []);

    const deleteAccount = useCallback(() => {
      if (!user) return;
      saveLocalAccounts(getLocalAccounts().filter(a => a.id !== user.id));
      saveLocalSession(null); setUser(null);
    }, [user]);

    return (
      <AuthContext.Provider value={{ user, isLoading, login, register, loginWithGoogle, logout, updateProfile, hasAnyAccount, deleteAccount }}>
        {children}
      </AuthContext.Provider>
    );
  }

  export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
    return ctx;
  }
  