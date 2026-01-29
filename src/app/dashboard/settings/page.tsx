"use client";

import { useRouter } from "next/navigation";
import { User, Shield, Award, Lock, Palette, CreditCard } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import styles from "./page.module.css";

// Definição das Opções
const settingsOptions = [
  // Área Comum (Todos)
  {
    id: "profile",
    title: "Meu Perfil",
    description: "Gerencie seus dados pessoais, foto e senha.",
    icon: User,
    href: "/dashboard/settings/profile",
    role: "all",
    color: "#3b82f6" // Azul
  },
  // Área Admin (Só Admins/Master)
  {
    id: "certificates",
    title: "Templates de Certificado",
    description: "Crie e edite os modelos visuais dos certificados.",
    icon: Award,
    href: "/dashboard/settings/certificates", // Nova rota
    role: "admin",
    color: "#CA8DFF" // Roxo da marca
  },
  {
    id: "access",
    title: "Controle de Acesso",
    description: "Gerencie usuários e permissões da plataforma.",
    icon: Shield,
    href: "/dashboard/settings/access",
    role: "master", // Só Master
    color: "#ef4444" // Vermelho
  },
  // Exemplo futuro
  {
    id: "billing",
    title: "Assinatura",
    description: "Gerencie o plano da universidade.",
    icon: CreditCard,
    href: "/dashboard/settings/billing",
    role: "master",
    color: "#10b981" // Verde
  }
];

export default function SettingsHub() {
  const router = useRouter();
  const { profile } = useAuth();

  if (!profile) return null;

  // Filtra opções baseadas no cargo
  const visibleOptions = settingsOptions.filter(option => {
    if (option.role === "all") return true;
    if (option.role === "admin") return ["admin", "master"].includes(profile.role);
    if (option.role === "master") return profile.role === "master";
    return false;
  });

  return (
    <div className={styles.grid}>
      {visibleOptions.map((option) => (
        <div 
          key={option.id} 
          className={styles.card}
          onClick={() => router.push(option.href)}
        >
          <div className={styles.iconWrapper} style={{ backgroundColor: `${option.color}20`, color: option.color }}>
            <option.icon size={28} />
          </div>
          <div className={styles.cardContent}>
            <h3>{option.title}</h3>
            <p>{option.description}</p>
          </div>
          {/* Efeito visual de hover */}
          <div className={styles.cardHoverOverlay} style={{ background: option.color }} />
        </div>
      ))}
    </div>
  );
}