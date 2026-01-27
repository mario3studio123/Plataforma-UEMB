// src/app/dashboard/courses/[id]/learn/page.tsx
"use client";

import { useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useSidebar } from "@/context/SidebarContext";
import { useToast } from "@/context/ToastContext";
import { CheckCircle, Loader2 } from "lucide-react";
import styles from "./styles.module.css";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

// Componentes
import VideoPlayer from "@/components/Course/VideoPlayer";
import QuizPlayer from "@/components/Course/QuizPlayer";
import CourseSidebar from "@/components/Course/CourseSidebar";
import { PageErrorBoundary } from "@/components/ErrorBoundary";

// Hooks e Store
import { useCourseContent, useLesson } from "@/hooks/useCourses";
import { useEnrollment, useCompleteLesson } from "@/hooks/useProgress";
import { usePlayerStore } from "@/stores/usePlayerStore";
import { formatDuration } from "@/utils/formatters";
import { useAuth } from "@/context/AuthContext";

/**
 * ============================================================================
 * COMPONENTE PRINCIPAL DA PÁGINA
 * ============================================================================
 */
function CoursePlayerContent() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const courseId = id as string;
  const { isExpanded } = useSidebar();
  const { addToast } = useToast();
  
  // Dados & Hooks Globais
  const { data: contentData, isLoading: loadingContent, error: contentError } = useCourseContent(courseId);
  const { data: enrollment } = useEnrollment(courseId);
  const { mutate: completeLesson, isPending: markingComplete } = useCompleteLesson();

  // Store Global do Player
  const { 
    activeLesson, activeModuleId, contentType, 
    initialize, setActiveLesson, openQuiz, reset 
  } = usePlayerStore();

  const containerRef = useRef<HTMLDivElement>(null);
  
  // Ref para controlar se já inicializou (evita re-inicialização)
  const hasInitializedRef = useRef(false);
  // Ref para o reset (evita que o reset entre nas dependências do useEffect)
  const resetRef = useRef(reset);
  resetRef.current = reset;

  // --- LAZY LOADING INTELIGENTE ---
  const shouldFetchDetails = activeLesson && !activeLesson.videoUrl;
  
  const { data: lessonDetails, isLoading: loadingDetails } = useLesson(
    courseId, 
    activeModuleId, 
    shouldFetchDetails ? activeLesson.id : undefined
  );

  const currentVideoUrl = activeLesson?.videoUrl || lessonDetails?.videoUrl;
  const currentDescription = lessonDetails?.description || activeLesson?.description;

  // Progresso salvo do vídeo (com acesso seguro ao tipo)
  const savedProgress = (() => {
    if (!activeLesson?.id || !enrollment?.progressData) return 0;
    const lessonProgress = enrollment.progressData[activeLesson.id];
    return lessonProgress?.secondsWatched ?? 0;
  })();

  // --- LÓGICA DE NAVEGAÇÃO ---
  const hasNextStep = useMemo(() => {
    if (!contentData || !activeModuleId || !activeLesson) return false;
    const currentModIndex = contentData.modules.findIndex(m => m.id === activeModuleId);
    if (currentModIndex === -1) return false;
    const currentMod = contentData.modules[currentModIndex];
    const currentLessonIndex = currentMod.lessons.findIndex(l => l.id === activeLesson.id);

    if (currentLessonIndex < currentMod.lessons.length - 1) return true;
    if (currentModIndex < contentData.modules.length - 1) {
       const nextMod = contentData.modules[currentModIndex + 1];
       return nextMod.lessons.length > 0; 
    }
    return false;
  }, [contentData, activeModuleId, activeLesson]);

  // --- EFEITO: Inicialização (apenas uma vez quando os dados carregam) ---
  useEffect(() => {
    // Só inicializa se:
    // 1. Temos dados do conteúdo
    // 2. Ainda não inicializou
    // 3. Não tem aula ativa (store está limpo)
    if (contentData && !hasInitializedRef.current && !activeLesson) {
      const firstMod = contentData.modules[0];
      if (firstMod?.lessons[0]) {
        hasInitializedRef.current = true;
        initialize(courseId, firstMod, firstMod.lessons[0]);
      }
    }
  }, [contentData, courseId, initialize, activeLesson]);

  // --- EFEITO: Cleanup apenas na desmontagem real do componente ---
  useEffect(() => {
    // Este efeito só tem o cleanup, sem lógica no corpo
    // Isso garante que o reset só é chamado quando o componente desmonta
    return () => {
      hasInitializedRef.current = false;
      resetRef.current();
    };
  }, []); // Array vazio = só executa na montagem/desmontagem

  // Animação Layout
  const paddingValue = isExpanded ? 430 : 180;
  useGSAP(() => {
    if (containerRef.current) {
      gsap.to(containerRef.current, {
        paddingLeft: paddingValue,
        duration: 0.5,
        ease: "power3.inOut",
        overwrite: "auto"
      });
    }
  }, [isExpanded]);

  // --- Handlers ---

  const handleComplete = () => {
    if (!activeLesson || !activeModuleId) return;
    completeLesson({ courseId, moduleId: activeModuleId, lessonId: activeLesson.id }, {
      onSuccess: (res) => {
         if (res.success) addToast(res.leveledUp ? `SUBIU DE NÍVEL! Lvl ${res.newLevel}` : `Aula concluída! +${res.xpEarned} XP`, "success");
      },
      onError: (error) => {
         addToast("Erro ao salvar progresso. Tente novamente.", "error");
         console.error("Erro ao completar aula:", error);
      }
    });
  };

  const navigateToNext = () => {
      if (!hasNextStep || !contentData || !activeModuleId || !activeLesson) return;
      const currentModIndex = contentData.modules.findIndex(m => m.id === activeModuleId);
      const currentMod = contentData.modules[currentModIndex];
      const currentLessonIndex = currentMod.lessons.findIndex(l => l.id === activeLesson.id);

      if (currentLessonIndex < currentMod.lessons.length - 1) {
          const nextLesson = currentMod.lessons[currentLessonIndex + 1];
          setActiveLesson(nextLesson, activeModuleId);
          return;
      }
      if (currentModIndex < contentData.modules.length - 1) {
          const nextMod = contentData.modules[currentModIndex + 1];
          if (nextMod.lessons.length > 0) {
              setActiveLesson(nextMod.lessons[0], nextMod.id);
          }
      }
  };

  // Quando passar na prova, atualizamos os dados IMEDIATAMENTE
  const handleQuizPass = async () => {
      await queryClient.invalidateQueries({ queryKey: ['enrollment', user?.uid, courseId] });
      await queryClient.invalidateQueries({ queryKey: ['userProfile'] });
  };

  // Quando fechar (Continuar Jornada), decidimos para onde ir
  const handleQuizClose = () => {
      router.push('/dashboard/courses');
  };

  // --- Renderização ---

  if (loadingContent) {
    return (
      <div className={styles.loading}>
        <Loader2 className={styles.spin} size={40} />
        <p>Carregando curso...</p>
      </div>
    );
  }

  if (contentError) {
    throw contentError; // Deixa o Error Boundary capturar
  }

  if (!contentData) {
    return (
      <div className={styles.emptyState}>
        <p>Conteúdo não disponível.</p>
        <button onClick={() => router.push('/dashboard/courses')} className={styles.backBtn}>
          Voltar para Cursos
        </button>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer} ref={containerRef}>
      <section className={styles.topSection}>
        <div className={styles.playerWrapper}>
          {contentType === 'quiz' && activeModuleId ? (
            <QuizPlayer 
              courseId={courseId} 
              moduleId={activeModuleId} 
              onPass={handleQuizPass}
              onClose={handleQuizClose}
            />
          ) : activeLesson ? (
            (!currentVideoUrl && loadingDetails) ? (
                <div className={styles.videoLoading}>
                    <Loader2 className={styles.spin} size={40} color="#CA8DFF"/>
                    <p>Carregando vídeo...</p>
                </div>
            ) : (
                <VideoPlayer 
                  key={activeLesson.id}
                  src={currentVideoUrl || ""}
                  courseId={courseId}
                  lessonId={activeLesson.id}
                  initialTime={savedProgress}
                  onComplete={handleComplete}
                  onNext={navigateToNext}
                  autoPlayNext={hasNextStep}
                />
            )
          ) : null}
        </div>

        <aside className={styles.sidebarWrapper}>
           <CourseSidebar 
             courseId={courseId}
             modules={contentData.modules}
             activeLessonId={activeLesson?.id}
             activeModuleId={activeModuleId}
             contentType={contentType}
             completedLessons={enrollment?.completedLessons || []}
             completedQuizzes={enrollment?.completedQuizzes || []}
             onSelectLesson={(lesson, modId) => setActiveLesson(lesson, modId)}
             onSelectQuiz={(modId) => openQuiz(modId)}
           />
        </aside>
      </section>

      {activeLesson && contentType === 'lesson' && (
        <section className={styles.infoSection}>
            <div className={styles.infoHeader}>
               <div className={styles.titleGroup}>
                  <h1 className={styles.lessonTitle}>{activeLesson.title}</h1>
                  <div className={styles.descriptionBox}>
                    <p>{currentDescription || "Sem descrição disponível para esta aula."}</p>
                  </div>
                  <div className={styles.badges}>
                      <span className={styles.badge}> 
                        {typeof activeLesson.duration === 'number' 
                            ? formatDuration(activeLesson.duration) 
                            : activeLesson.duration || "00:00"}
                      </span>
                      <span className={`${styles.badge} ${styles.xpBadge}`}>+{activeLesson.xpReward} XP</span>
                  </div>
               </div>

               <button 
                 onClick={handleComplete}
                 disabled={enrollment?.completedLessons.includes(activeLesson.id) || markingComplete}
                 className={`${styles.actionBtn} ${enrollment?.completedLessons.includes(activeLesson.id) ? styles.done : ''}`}
               >
                 {enrollment?.completedLessons.includes(activeLesson.id) 
                   ? <><CheckCircle size={18} /> Concluída</> 
                   : markingComplete ? "Salvando..." : "Concluir Aula"
                 }
               </button>
            </div>
            <div className={styles.divider} />
        </section>
      )}
    </div>
  );
}

/**
 * ============================================================================
 * EXPORT DEFAULT COM ERROR BOUNDARY
 * ============================================================================
 */
export default function CoursePlayerPage() {
  return (
    <PageErrorBoundary message="Ocorreu um erro ao carregar o player do curso. Por favor, tente novamente.">
      <CoursePlayerContent />
    </PageErrorBoundary>
  );
}