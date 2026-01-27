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
        gsap.to(containerRef.current, {
            paddingLeft: isExpanded ? 440 : 180,
            duration: 0.5,
            ease: "power3.inOut"
        });
    }
  }, [isExpanded]);

  const handleEdit = (e: React.MouseEvent, id: string) => {
    e.preventDefault(); 
    e.stopPropagation();
    router.push(`/dashboard/admin/courses/${id}/manage`);
  };

  return (
    <div className={styles.container} ref={containerRef}>
      
      {/* CABEÇALHO */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Cursos UEMB</h1>
          <p className={styles.pageSubtitle}>
            Explore todo o conhecimento da Universidade da Embalagem
          </p>
        </div>

        {/* Botão Novo Curso - Só aparece para Admin */}
        {isAdmin && (
          <Link href="/dashboard/admin/create-course" className={styles.newCourseBtn}>
            <Plus size={20} strokeWidth={2.5} />
            <span>Novo curso</span>
          </Link>
        )}
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

    </div>
  );
}