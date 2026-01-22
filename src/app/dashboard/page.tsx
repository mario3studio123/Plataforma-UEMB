"use client";

import { useRef } from "react";
import styles from "./layout.module.css"; // Note que estamos usando o CSS do module layout aqui para a page
import { useSidebar } from "@/context/SidebarContext";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

// Componentes
import HeroSection from "@/components/Dashboard/HeroSection";
import CoursesCarousel from "@/components/Dashboard/CoursesCarousel";
import TopBar from "@/components/TopBar"; // <--- 1. Importar aqui

// Hook de Dados
import { useDashboardData } from "@/hooks/useDashboardData";

gsap.registerPlugin(useGSAP);

export default function DashboardHome() {
  const { isExpanded } = useSidebar();
  
  // 1. Busca Dados
  const { featured, courses, lastActiveCourse, loading } = useDashboardData();

  const heroData = lastActiveCourse ? lastActiveCourse.course : featured;
  const heroMode = lastActiveCourse ? "resume" : "featured";
  const heroProgress = lastActiveCourse ? lastActiveCourse.progress : 0;

  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!containerRef.current) return;
    gsap.to(containerRef.current, {
        paddingLeft: 0, 
        duration: 0.5,
        ease: "power3.inOut"
    });
  }, [isExpanded]);

  return (
    <div className={styles.container} ref={containerRef}>
      
      {/* 2. ADICIONAR AQUI - Posição Absoluta para flutuar sobre o Hero */}
      <div className={styles.topBarWrapper}>
         <TopBar />
      </div>

      <HeroSection 
         course={heroData} 
         loading={loading} 
         mode={heroMode}
         progress={heroProgress}
      />

      <CoursesCarousel courses={courses} loading={loading} />

      {!loading && courses.length === 0 && (
         <div className={styles.emptyState}>Nenhum conteúdo disponível no momento.</div>
      )}

    </div>
  );
}