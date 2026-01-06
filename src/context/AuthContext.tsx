"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { 
  onAuthStateChanged, 
  User, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile,
  signOut
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, onSnapshot, getDoc } from "firebase/firestore";
import { useRouter, usePathname } from "next/navigation";

// Definição do Perfil do Usuário
export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: "student" | "admin" | "master";
  xp: number;
  level: number;
  avatarUrl?: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;         // Objeto técnico do Firebase Auth
  profile: UserProfile | null; // Dados do Firestore (XP, Cargo, etc)
  loading: boolean;           // Carregando inicial
  login: (email: string, pass: string) => Promise<void>;
  register: (name: string, email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Escuta a autenticação técnica
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        // Se logou, escuta o documento do usuário no Firestore em tempo real
        const userRef = doc(db, "users", currentUser.uid);
        
        const unsubscribeFirestore = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            // Caso raro: User existe no Auth mas não no Firestore (fallback)
            console.error("Perfil não encontrado no Firestore");
            setProfile(null);
          }
          setLoading(false);
        }, (error) => {
          console.error("Erro ao buscar perfil:", error);
          setLoading(false);
        });

        return () => unsubscribeFirestore();
      } else {
        // Se deslogou, limpa tudo
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Proteção de Rotas Simplificada (Opcional, mas recomendada aqui ou no Layout)
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
    await signInWithEmailAndPassword(auth, email, pass);
    // O onAuthStateChanged vai lidar com o redirecionamento
  };

  const register = async (name: string, email: string, pass: string) => {
    try {
      // 1. Cria no Auth
      const { user: newUser } = await createUserWithEmailAndPassword(auth, email, pass);
      
      // 2. Atualiza Display Name
      await updateProfile(newUser, { displayName: name });

      // 3. Cria documento no Firestore
      const newProfile: UserProfile = {
        uid: newUser.uid,
        email,
        name,
        role: "student",
        xp: 0,
        level: 1,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, "users", newUser.uid), newProfile);
      
      // Não precisa forçar redirecionamento aqui, o useEffect fará isso
    } catch (error) {
      console.error("Erro no registro:", error);
      throw error;
    }
  };

  const logout = async () => {
    await signOut(auth);
    setProfile(null);
    router.push("/");
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);