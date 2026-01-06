"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import styles from "./page.module.css";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar"; // <--- 1. Importar a TopBar
import { SidebarProvider } from "@/context/SidebarContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.spinner}></div>
        <p>Carregando seu universo...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <SidebarProvider> {/* <--- Envolva tudo aqui */}
      <div className={styles.dashboardContainer}>
        <Sidebar />

        <div className={styles.mainContent}>
          <div className={styles.topBarContainer}>
             <TopBar />
          </div>

          <div className={styles.pageScroll}>
             {children}
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}