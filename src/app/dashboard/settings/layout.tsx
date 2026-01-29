"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import styles from "./layout.module.css"; // Vamos criar este CSS abaixo

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isRoot = pathname === "/dashboard/settings";

  return (
    <div className={styles.settingsContainer}>
      {/* Header Comum */}
      <div className={styles.header}>
        {!isRoot && (
          <button onClick={() => router.back()} className={styles.backBtn}>
            <ArrowLeft size={20} />
          </button>
        )}
        <div>
          <h1 className={styles.title}>Configurações</h1>
          <p className={styles.subtitle}>Gerencie suas preferências e o sistema</p>
        </div>
      </div>

      {/* Conteúdo (Hub ou Página Específica) */}
      <div className={styles.content}>
        {children}
      </div>
    </div>
  );
}