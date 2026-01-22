// src/context/AuthContext.tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";
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

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (name: string, email: string, pass: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

// Helper para mensagens de erro amigáveis
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
    default:
      return "Ocorreu um erro inesperado. Tente novamente.";
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  const router = useRouter();
  const pathname = usePathname();
  const { addToast } = useToast();

  // Função auxiliar para criar perfil padrão se não existir
  const ensureUserProfile = async (firebaseUser: User, name?: string) => {
    const userRef = doc(db, "users", firebaseUser.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      // Cria o perfil se for um login novo (Google) ou registro falho anterior
      const newProfile: UserProfile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email!,
        name: name || firebaseUser.displayName || "Aluno",
        role: "student",
        avatarUrl: firebaseUser.photoURL || undefined,
        xp: 0,
        level: 1,
        createdAt: new Date().toISOString(),
        wallet: { coins: 0, totalCoinsEarned: 0 },
        stats: { lessonsCompleted: 0, quizzesCompleted: 0, certificatesEarned: 0, loginStreak: 0 }
      };
      await setDoc(userRef, newProfile);
    }
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        // Escuta o perfil em tempo real
        const userRef = doc(db, "users", currentUser.uid);
        const unsubscribeFirestore = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            // Se o usuário existe no Auth mas não no Firestore, cria agora (Auto-Fix)
            ensureUserProfile(currentUser);
          }
          setLoading(false);
        }, (error) => {
          console.error("Erro perfil:", error);
          setLoading(false);
        });

        return () => unsubscribeFirestore();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Proteção de Rotas Básica
  useEffect(() => {
    if (!loading) {
      const isPublicPage = pathname === "/";
      if (!user && !isPublicPage) {
        router.push("/");
      } else if (user && isPublicPage) {
        router.push("/dashboard");
      }
    }
  }, [user, loading, pathname, router]);

  const login = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // O useEffect cuidará do resto
    } catch (error: any) {
      throw new Error(getErrorMessage(error));
    }
  };

  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      // Garante que o perfil existe no Firestore
      await ensureUserProfile(res.user);
    } catch (error: any) {
      throw new Error(getErrorMessage(error));
    }
  };

  // ... imports

  const register = async (name: string, email: string, pass: string) => {
    try {
      const { user: newUser } = await createUserWithEmailAndPassword(auth, email, pass);
      
      // Atualiza o nome no Auth do Firebase (não no Firestore)
      await updateProfile(newUser, { displayName: name });

      // Preparando o objeto para o Firestore
      // CORREÇÃO AQUI: Garantimos que avatarUrl seja null se não existir
      const newProfile: UserProfile = {
        uid: newUser.uid,
        email,
        name,
        role: "student",
        avatarUrl: newUser.photoURL || null, // <--- O SEGREDO: Use '|| null'. Nunca deixe undefined.
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

      // Agora o setDoc vai funcionar porque null é um valor válido para JSON/Firestore
      await setDoc(doc(db, "users", newUser.uid), newProfile);
      
    } catch (error) {
      console.error("Erro no registro:", error);
      throw error;
    }
  };

// ... restante do código

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      addToast("E-mail de recuperação enviado!", "success");
    } catch (error: any) {
      throw new Error(getErrorMessage(error));
    }
  };

  const logout = async () => {
    await signOut(auth);
    setProfile(null);
    router.push("/");
  };

  return (
    <AuthContext.Provider value={{ 
      user, profile, loading, 
      login, loginWithGoogle, register, resetPassword, logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);