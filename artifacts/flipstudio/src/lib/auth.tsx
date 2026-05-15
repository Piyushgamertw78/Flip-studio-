import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
  import { supabase, isSupabaseConfigured } from "./supabase";

  export interface User {
    id: string;
    username: string;
    email: string;
    avatar: string;
  }

  interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    signup: (username: string, email: string, password: string) => Promise<void>;
    logout: () => void;
  }

  const AuthContext = createContext<AuthContextType | null>(null);

  const STORAGE_KEY = "flipstudio_user";

  function makeAvatarUrl(seed: string) {
    return `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(seed)}`;
  }

  function localLogin(email: string, password: string): User | null {
    const stored = localStorage.getItem("flipstudio_accounts");
    const accounts: Record<string, { password: string; user: User }> = stored ? JSON.parse(stored) : {};
    const acc = accounts[email.toLowerCase()];
    if (!acc || acc.password !== password) return null;
    return acc.user;
  }

  function localSignup(username: string, email: string, password: string): User {
    const stored = localStorage.getItem("flipstudio_accounts");
    const accounts: Record<string, { password: string; user: User }> = stored ? JSON.parse(stored) : {};
    const key = email.toLowerCase();
    if (accounts[key]) throw new Error("Email already registered");
    const user: User = {
      id: crypto.randomUUID(),
      username,
      email,
      avatar: makeAvatarUrl(username),
    };
    accounts[key] = { password, user };
    localStorage.setItem("flipstudio_accounts", JSON.stringify(accounts));
    return user;
  }

  export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
      const checkUser = async () => {
        if (isSupabaseConfigured) {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
              const userData: User = {
                id: session.user.id,
                username: session.user.user_metadata["username"] as string || session.user.email?.split("@")[0] || "user",
                email: session.user.email || "",
                avatar: session.user.user_metadata["avatar"] as string || makeAvatarUrl(session.user.id),
              };
              setUser(userData);
              localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
              setIsLoading(false);
              return;
            }
          } catch {
            // fall through to local storage
          }
        }
        // Offline / demo mode
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          try { setUser(JSON.parse(stored) as User); } catch { localStorage.removeItem(STORAGE_KEY); }
        }
        setIsLoading(false);
      };

      checkUser();

      if (isSupabaseConfigured) {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          if (session?.user) {
            const userData: User = {
              id: session.user.id,
              username: session.user.user_metadata["username"] as string || session.user.email?.split("@")[0] || "user",
              email: session.user.email || "",
              avatar: session.user.user_metadata["avatar"] as string || makeAvatarUrl(session.user.id),
            };
            setUser(userData);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
          } else {
            setUser(null);
            localStorage.removeItem(STORAGE_KEY);
          }
        });
        return () => subscription.unsubscribe();
      }
    }, []);

    const login = async (email: string, password: string) => {
      if (isSupabaseConfigured) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return;
      }
      // Offline login
      const u = localLogin(email, password);
      if (!u) throw new Error("Invalid email or password");
      setUser(u);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    };

    const signup = async (username: string, email: string, password: string) => {
      if (isSupabaseConfigured) {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { username, avatar: makeAvatarUrl(username) } },
        });
        if (error) throw error;
        return;
      }
      // Offline signup
      const u = localSignup(username, email, password);
      setUser(u);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    };

    const logout = async () => {
      if (isSupabaseConfigured) {
        try { await supabase.auth.signOut(); } catch { /* ignore */ }
      }
      setUser(null);
      localStorage.removeItem(STORAGE_KEY);
    };

    return <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>{children}</AuthContext.Provider>;
  }

  export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
  }
  