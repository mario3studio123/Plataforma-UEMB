// src/app/dashboard/admin/courses/[id]/manage/page.tsx
"use client";

import { useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  Loader2, 
  LayoutList, 
  Video, 
  Clock 
} from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import styles from "./styles.module.css";
import { useSidebar } from "@/context/SidebarContext";

// Error Boundary
import { PageErrorBoundary } from "@/components/ErrorBoundary";

// Contexto (O Cérebro da Página)
import { CourseEditorProvider, useCourseEditor } from "@/context/admin/CourseEditorContext";

// Componentes Refatorados
import SortableModuleList from "@/components/Admin/CourseManager/SortableModuleList";
import LessonModal from "@/components/Admin/CourseManager/LessonModal";
import QuizEditor from "@/components/Admin/QuizEditor";
import PublishToggle from "@/components/Admin/CourseManager/PublishToggle";

// ============================================================================
// 1. WRAPPER PRINCIPAL (Injeta o Contexto e Error Boundary)
// ============================================================================
export default function ManageCoursePage() {
  const { id } = useParams();
  const courseId = id as string;

  return (
    <PageErrorBoundary message="Ocorreu um erro ao carregar o editor de curso. Por favor, tente novamente.">
      <CourseEditorProvider courseId={courseId}>
        <CourseManagerLayout />
      </CourseEditorProvider>
    </PageErrorBoundary>
  );
}

// ============================================================================
// 2. LAYOUT DO GERENCIADOR
// ============================================================================
function CourseManagerLayout() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const { isExpanded } = useSidebar();

  // Consumindo dados do Contexto (Sem prop drilling!)
  const { 
    course, 
    modules, 
    isLoading, 
    activeModal, 
    selectedModuleId, 
    selectedLesson,
    closeModals 
  } = useCourseEditor();

  // --- ANIMAÇÕES DE ENTRADA E LAYOUT ---
  
  // 1. Ajuste Responsivo da Sidebar
  useGSAP(() => {
    if (containerRef.current) {
      gsap.to(containerRef.current, {
        paddingLeft: isExpanded ? 380 : 140,
        duration: 0.5,
        ease: "power3.inOut"
      });
    }
  }, [isExpanded]);

  // 2. Entrada dos Elementos
  useGSAP(() => {
    if (!isLoading && containerRef.current) {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(".anim-hero", { y: 20, opacity: 0, duration: 0.8, stagger: 0.1 });
      tl.from(".anim-content", { y: 30, opacity: 0, duration: 0.6 }, "-=0.4");
    }
  }, [isLoading]);

  // --- RENDERIZAÇÃO ---

  if (isLoading) {
    return (
      <div className={styles.loadingScreen}>
        <Loader2 className={styles.spin} size={32} color="#CA8DFF"/> 
        <span>Carregando Editor...</span>
      </div>
    );
  }

  if (!course) {
    return (
        <div className={styles.loadingScreen}>
            <span style={{ color: '#ef4444' }}>Curso não encontrado ou acesso negado.</span>
            <button onClick={() => router.push('/dashboard/courses')} className={styles.backBtn}>
                Voltar para Dashboard
            </button>
        </div>
    );
  }

  return (
    <div className={styles.container} ref={containerRef}>
      
      {/* HEADER FLUTUANTE */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
            <button onClick={() => router.back()} className={styles.backBtn}>
                <ArrowLeft size={18} />
                <span>Voltar</span>
            </button>
            
            <div className={styles.dividerVertical} />
            
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff' }}>
                {course.title}
            </span>
        </div>
        
        <div className={styles.headerActions}>
          <PublishToggle courseId={course.id} isPublished={course.published} />
        </div>
      </header>

      {/* HERO SECTION (Resumo do Curso) */}
      <div className={`${styles.heroSection} anim-hero`}>
        <div className={styles.heroBackdrop}>
            <img src={course.coverUrl} alt="" />
            <div className={styles.heroOverlay} />
        </div>

        <div className={styles.heroContent}>
            <div className={`${styles.coverWrapper} anim-hero`}>
                <img src={course.coverUrl} alt="Capa" className={styles.coverImg} />
            </div>

            <div className={styles.infoWrapper}>
                <div className={`${styles.courseMetaTop} anim-hero`}>
                    <span className={styles.levelBadge}>{course.level}</span>
                    <span className={styles.idBadge}>#{course.id.substring(0,6)}</span>
                </div>
                
                <h1 className={`${styles.courseTitle} anim-hero`}>{course.title}</h1>
                
                <div className={`${styles.statsGrid} anim-hero`}>
                    <div className={styles.statItem}>
                        <LayoutList size={20} className={styles.statIcon} />
                        <div>
                            <strong>{modules.length}</strong>
                            <span>Módulos</span>
                        </div>
                    </div>
                    <div className={styles.statItem}>
                        <Video size={20} className={styles.statIcon} />
                        <div>
                            <strong>{course.totalLessons}</strong>
                            <span>Aulas</span>
                        </div>
                    </div>
                    <div className={styles.statItem}>
                        <Clock size={20} className={styles.statIcon} />
                        <div>
                            <strong>{course.totalDuration}</strong>
                            <span>Duração</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* ÁREA DE CONTEÚDO (Editor) */}
      <div className={`${styles.contentArea} anim-content`}>
        <div className={styles.contentHeader}>
            <div>
                <h2 className={styles.sectionTitle}>Estrutura do Curso</h2>
                <p className={styles.sectionSubtitle}>
                    Organize o conteúdo arrastando módulos e aulas. 
                    Clique nos textos para editar.
                </p>
            </div>
            {/* O botão "Novo Módulo" agora vive dentro do SortableModuleList para melhor UX */}
        </div>

        <div className={styles.modulesContainer}>
            {/* O componente inteligente que gerencia a lista */}
            <SortableModuleList />
        </div>
      </div>

      {/* MODAIS GLOBAIS (Controlados pelo Contexto) */}
      
      {/* Modal de Aula (Criação/Edição) */}
      {activeModal === 'lesson' && selectedModuleId && (
        <LessonModal 
          isOpen={true}
          onClose={closeModals}
          courseId={course.id}
          moduleId={selectedModuleId}
          lessonId={selectedLesson?.id}
          initialData={selectedLesson || undefined}
        />
      )}

      {/* Editor de Quiz */}
      {activeModal === 'quiz' && selectedModuleId && (
        <QuizEditor 
            courseId={course.id}
            moduleId={selectedModuleId}
            moduleTitle={modules.find(m => m.id === selectedModuleId)?.title || ""}
            onClose={closeModals}
        />
      )}
    </div>
  );
}