import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface User {
  id: string;
  username: string;
  email: string;
  avatar: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = "flipstudio_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setUser(JSON.parse(stored) as User);
      } catch {}
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, _password: string) => {
    await new Promise((r) => setTimeout(r, 800));
    const stored = localStorage.getItem(`flipstudio_account_${username}`);
    if (!stored) throw new Error("Account not found. Please sign up first.");
    const account = JSON.parse(stored) as User & { password: string };
    const newUser: User = { id: account.id, username: account.username, email: account.email, avatar: account.avatar };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
    setUser(newUser);
  };

  const signup = async (username: string, email: string, _password: string) => {
    await new Promise((r) => setTimeout(r, 800));
    const existing = localStorage.getItem(`flipstudio_account_${username}`);
    if (existing) throw new Error("Username already taken. Please choose another.");
    const newUser: User = {
      id: crypto.randomUUID(),
      username,
      email,
      avatar: `https://api.dicebear.com/7.x/thumbs/svg?seed=${username}`,
    };
    localStorage.setItem(`flipstudio_account_${username}`, JSON.stringify({ ...newUser, password: _password }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
