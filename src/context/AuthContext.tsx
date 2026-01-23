// src/context/AuthContext.tsx
"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { 
  onAuthStateChanged, 
  User, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  AuthError
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, onSnapshot, getDoc } from "firebase/firestore";
import { useRouter, usePathname } from "next/navigation";
import { UserProfile } from "@/types";
import { useToast } from "@/context/ToastContext";

/**
 * ============================================================================
 * GERENCIAMENTO DE COOKIES DE SESSÃO
 * ============================================================================
 */

const AUTH_COOKIE_NAME = 'auth-token';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 dias em segundos

/**
 * Seta o cookie de autenticação
 * Usado pelo middleware para verificar se o usuário está logado
 */
function setAuthCookie(token: string): void {
  // Cookie seguro com flags apropriadas
  document.cookie = `${AUTH_COOKIE_NAME}=${token}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax; ${window.location.protocol === 'https:' ? 'Secure;' : ''}`;
}

/**
 * Remove o cookie de autenticação
 */
function removeAuthCookie(): void {
  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax;`;
}

/**
 * ============================================================================
 * TIPOS E CONTEXTO
 * ============================================================================
 */

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (name: string, email: string, pass: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

/**
 * Helper para mensagens de erro amigáveis
 */
const getErrorMessage = (error: AuthError) => {
  switch (error.code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return "E-mail ou senha incorretos.";
    case 'auth/email-already-in-use':
      return "Este e-mail já está cadastrado.";
    case 'auth/too-many-requests':
      return "Muitas tentativas. Tente novamente mais tarde.";
    case 'auth/popup-closed-by-user':
      return "Login cancelado.";
    case 'auth/network-request-failed':
      return "Erro de conexão. Verifique sua internet.";
    default:
      return "Ocorreu um erro inesperado. Tente novamente.";
  }
};

/**
 * ============================================================================
 * PROVIDER
 * ============================================================================
 */

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  const router = useRouter();
  const pathname = usePathname();
  const { addToast } = useToast();

  /**
   * Atualiza o cookie com o token atual
   */
  const updateAuthCookie = useCallback(async (firebaseUser: User | null) => {
    if (firebaseUser) {
      try {
        const token = await firebaseUser.getIdToken();
        setAuthCookie(token);
      } catch (error) {
        console.error('Erro ao obter token:', error);
        removeAuthCookie();
      }
    } else {
      removeAuthCookie();
    }
  }, []);

  /**
   * Função para refresh manual do token (expõe para uso externo)
   */
  const refreshToken = useCallback(async (): Promise<string | null> => {
    if (!user) return null;
    
    try {
      const token = await user.getIdToken(true); // force refresh
      setAuthCookie(token);
      return token;
    } catch (error) {
      console.error('Erro ao renovar token:', error);
      return null;
    }
  }, [user]);

  /**
   * Função auxiliar para criar perfil padrão se não existir
   */
  const ensureUserProfile = useCallback(async (firebaseUser: User, name?: string) => {
    const userRef = doc(db, "users", firebaseUser.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      const newProfile: UserProfile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email!,
        name: name || firebaseUser.displayName || "Aluno",
        role: "student",
        avatarUrl: firebaseUser.photoURL || null,
        xp: 0,
        level: 1,
        createdAt: new Date().toISOString(),
        wallet: { coins: 0, totalCoinsEarned: 0 },
        stats: { lessonsCompleted: 0, quizzesCompleted: 0, certificatesEarned: 0, loginStreak: 0 }
      };
      await setDoc(userRef, newProfile);
    }
  }, []);

  /**
   * Listener principal de autenticação
   */
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      // Atualiza o cookie sempre que o estado de auth mudar
      await updateAuthCookie(currentUser);

      if (currentUser) {
        // Escuta o perfil em tempo real
        const userRef = doc(db, "users", currentUser.uid);
        const unsubscribeFirestore = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            ensureUserProfile(currentUser);
          }
          setLoading(false);
        }, (error) => {
          console.error("Erro ao carregar perfil:", error);
          setLoading(false);
        });

        return () => unsubscribeFirestore();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [updateAuthCookie, ensureUserProfile]);

  /**
   * Refresh automático do token a cada 50 minutos
   * (tokens do Firebase expiram em 1 hora)
   */
  useEffect(() => {
    if (!user) return;

    const refreshInterval = setInterval(async () => {
      await refreshToken();
    }, 50 * 60 * 1000); // 50 minutos

    return () => clearInterval(refreshInterval);
  }, [user, refreshToken]);

  /**
   * Proteção de Rotas no Cliente
   * (Complementa o middleware para melhor UX)
   */
  useEffect(() => {
    if (!loading) {
      const isPublicPage = pathname === "/" || pathname === "/login" || pathname === "/register";
      
      if (!user && !isPublicPage) {
        router.push("/");
      } else if (user && pathname === "/") {
        router.push("/dashboard");
      }
    }
  }, [user, loading, pathname, router]);

  /**
   * Login com email e senha
   */
  const login = async (email: string, pass: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, pass);
      // Seta o cookie imediatamente após login bem-sucedido
      const token = await result.user.getIdToken();
      setAuthCookie(token);
    } catch (error: unknown) {
      throw new Error(getErrorMessage(error as AuthError));
    }
  };

  /**
   * Login com Google
   */
  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // Garante que o perfil existe no Firestore
      await ensureUserProfile(result.user);
      
      // Seta o cookie
      const token = await result.user.getIdToken();
      setAuthCookie(token);
    } catch (error: unknown) {
      throw new Error(getErrorMessage(error as AuthError));
    }
  };

  /**
   * Registro de novo usuário
   */
  const register = async (name: string, email: string, pass: string) => {
    try {
      const { user: newUser } = await createUserWithEmailAndPassword(auth, email, pass);
      
      // Atualiza o nome no Auth do Firebase
      await updateProfile(newUser, { displayName: name });

      // Cria o perfil no Firestore
      const newProfile: UserProfile = {
        uid: newUser.uid,
        email,
        name,
        role: "student",
        avatarUrl: newUser.photoURL || null,
        xp: 0,
        level: 1,
        createdAt: new Date().toISOString(),
        wallet: {
          coins: 0,            
          totalCoinsEarned: 0 
        },
        stats: {
          lessonsCompleted: 0,
          quizzesCompleted: 0,
          certificatesEarned: 0,
          loginStreak: 0
        }
      };

      await setDoc(doc(db, "users", newUser.uid), newProfile);
      
      // Seta o cookie
      const token = await newUser.getIdToken();
      setAuthCookie(token);
      
    } catch (error) {
      console.error("Erro no registro:", error);
      throw error;
    }
  };

  /**
   * Reset de senha
   */
  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      addToast("E-mail de recuperação enviado!", "success");
    } catch (error: unknown) {
      throw new Error(getErrorMessage(error as AuthError));
    }
  };

  /**
   * Logout
   */
  const logout = async () => {
    // Remove o cookie ANTES do signOut para evitar race conditions
    removeAuthCookie();
    await signOut(auth);
    setProfile(null);
    router.push("/");
  };

  return (
    <AuthContext.Provider value={{ 
      user, profile, loading, 
      login, loginWithGoogle, register, resetPassword, logout, refreshToken
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);