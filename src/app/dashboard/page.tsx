"use client";

import { useRef } from "react";
import styles from "./layout.module.css";
import { useSidebar } from "@/context/SidebarContext";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import HeroSection from "@/components/Dashboard/HeroSection";
import CoursesCarousel from "@/components/Dashboard/CoursesCarousel";
import TopBar from "@/components/TopBar";
import { useDashboardData } from "@/hooks/useDashboardData";
import { PageErrorBoundary } from "@/components/ErrorBoundary";

gsap.registerPlugin(useGSAP);

/**
 * Conteúdo principal do Dashboard
 */
function DashboardContent() {
  const { isExpanded } = useSidebar();
  
  const { featured, courses, lastActiveCourse, loading, error } = useDashboardData();

  // Se houver erro, deixa o Error Boundary capturar
  if (error) {
    throw error;
  }

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

/**
 * Export Default com Error Boundary
 */
export default function DashboardHome() {
  return (
    <PageErrorBoundary message="Ocorreu um erro ao carregar o dashboard. Por favor, tente novamente.">
      <DashboardContent />
    </PageErrorBoundary>
  );
}