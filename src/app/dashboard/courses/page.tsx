"use client";

import { useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react"; 
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import styles from "./styles.module.css";
import { useAuth } from "@/context/AuthContext";
import { useSidebar } from "@/context/SidebarContext";
import { useCoursesLibrary } from "@/hooks/useCoursesLibrary";

// Componentes
import CoursesFilterBar from "@/components/Dashboard/CoursesFilterBar";
import CourseGrid from "@/components/Dashboard/CourseGrid";

export default function CoursesPage() {
  const { profile } = useAuth();
  const { isExpanded } = useSidebar();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null); // Ref para o botão flutuante

  // Hook de Dados
  const { 
    courses, 
    loading, 
    loadingMore, 
    hasMore, 
    loadMore, 
    search, 
    setSearch, 
    levelFilter, 
    setLevelFilter,
    isFiltering 
  } = useCoursesLibrary();

  const isAdmin = profile?.role === "admin" || profile?.role === "master";

  // Animação GSAP
  useGSAP(() => {
    if (containerRef.current) {
        // Animação do Padding (Sidebar)
        gsap.to(containerRef.current, {
            paddingLeft: isExpanded ? 440 : 180,
            duration: 0.5,
            ease: "power3.inOut"
        });
    }

    // Animação de Entrada do Botão Flutuante (Pop Up)
    if (fabRef.current) {
        gsap.fromTo(fabRef.current, 
            { scale: 0, opacity: 0, rotate: 90 },
            { scale: 1, opacity: 1, rotate: 0, duration: 0.6, ease: "back.out(1.7)", delay: 0.5 }
        );
    }
  }, [isExpanded]);

  const handleEdit = (e: React.MouseEvent, id: string) => {
    e.preventDefault(); 
    e.stopPropagation();
    router.push(`/dashboard/admin/courses/${id}/manage`);
  };

  return (
    <div className={styles.container} ref={containerRef}>
      
      {/* CABEÇALHO (Agora mais limpo, sem o botão) */}
      <div className={styles.header}>
        <div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 700, color: '#fff', letterSpacing: '-1px' }}>
              Biblioteca de Cursos
            </h1>
            <p className={styles.pageSubtitle} style={{ marginTop: '8px' }}>
              Explore todo o conhecimento da Universidade da Embalagem
            </p>
        </div>
      </div>

      {/* FILTROS */}
      <CoursesFilterBar 
        search={search}
        onSearchChange={setSearch}
        levelFilter={levelFilter}
        onLevelChange={setLevelFilter}
        isFiltering={isFiltering}
      />

      {/* GRADE DE CURSOS */}
      <CourseGrid 
        courses={courses}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        onLoadMore={loadMore}
        isAdmin={isAdmin}
        onEditCourse={handleEdit}
      />

      {/* BOTÃO FLUTUANTE (FAB) - Só renderiza se for Admin */}
      {isAdmin && (
        <Link href="/dashboard/admin/create-course">
          <button ref={fabRef} className={styles.floatingBtn}>
            <Plus size={24} strokeWidth={3} />
            <span>Novo Curso</span>
          </button>
        </Link>
      )}

    </div>
  );
}