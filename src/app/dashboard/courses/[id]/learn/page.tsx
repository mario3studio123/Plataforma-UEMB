// src/app/dashboard/courses/[id]/learn/page.tsx
"use client";

import { useEffect, useRef, useMemo, useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useSidebar } from "@/context/SidebarContext";
import { useToast } from "@/context/ToastContext";
import { Heart, Loader2, PlayCircle, ArrowRight, Award } from "lucide-react";
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

// Actions
import { toggleLessonLikeAction, getLessonLikesAction } from "@/app/actions/likeActions";
import { issueCertificateAction } from "@/app/actions/certificateActions";

/**
 * ============================================================================
 * HOOK: useLessonLikes
 * ============================================================================
 */
function useLessonLikes(courseId: string, moduleId: string | null, lessonId: string | undefined) {
  const { user } = useAuth();
  const [likes, setLikes] = useState({ count: 0, liked: false, loading: true });

  // Buscar likes ao montar ou trocar de aula
  useEffect(() => {
    async function fetchLikes() {
      if (!user || !moduleId || !lessonId) {
        setLikes({ count: 0, liked: false, loading: false });
        return;
      }

      try {
        const token = await user.getIdToken();
        const result = await getLessonLikesAction(token, courseId, moduleId, lessonId);
        
        if (result.success) {
          setLikes({
            count: result.data.totalLikes,
            liked: result.data.userLiked,
            loading: false
          });
        }
      } catch (error) {
        console.error("Erro ao buscar likes:", error);
        setLikes(prev => ({ ...prev, loading: false }));
      }
    }

    setLikes(prev => ({ ...prev, loading: true }));
    fetchLikes();
  }, [user, courseId, moduleId, lessonId]);

  // Toggle like
  const toggleLike = useCallback(async () => {
    if (!user || !moduleId || !lessonId) return;

    // Optimistic update
    setLikes(prev => ({
      ...prev,
      liked: !prev.liked,
      count: prev.liked ? prev.count - 1 : prev.count + 1
    }));

    try {
      const token = await user.getIdToken();
      const result = await toggleLessonLikeAction(token, courseId, moduleId, lessonId);
      
      if (result.success) {
        setLikes({
          count: result.data.totalLikes,
          liked: result.data.liked,
          loading: false
        });
      }
    } catch (error) {
      // Revert on error
      setLikes(prev => ({
        ...prev,
        liked: !prev.liked,
        count: prev.liked ? prev.count + 1 : prev.count - 1
      }));
    }
  }, [user, courseId, moduleId, lessonId]);

  return { ...likes, toggleLike };
}

/**
 * ============================================================================
 * FORMATADOR DE LIKES
 * ============================================================================
 */
function formatLikeCount(count: number): string {
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1).replace('.0', '') + 'M';
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace('.0', '') + 'k';
  }
  return count.toString();
}

/**
 * ============================================================================
 * COMPONENTE PRINCIPAL
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

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const infoCardRef = useRef<HTMLDivElement>(null);
  const descBoxRef = useRef<HTMLDivElement>(null);
  const hasInitializedRef = useRef(false);
  const resetRef = useRef<() => void>(() => {});

  // Dados
  const { data: contentData, isLoading: loadingContent, error: contentError } = useCourseContent(courseId);
  const { data: enrollment } = useEnrollment(courseId);
  const { mutate: completeLesson, isPending: markingComplete } = useCompleteLesson();

  // Store do Player
  const {
    activeLesson,
    activeModuleId,
    contentType,
    initialize,
    setActiveLesson,
    openQuiz,
    reset
  } = usePlayerStore();

  resetRef.current = reset;

  // Estado de certificado
  const [emittingCert, setEmittingCert] = useState(false);

  // Likes
  const { count: likeCount, liked: userLiked, loading: likesLoading, toggleLike } = useLessonLikes(
    courseId,
    activeModuleId,
    activeLesson?.id
  );

  // Lazy loading de detalhes da aula
  const shouldFetchDetails = activeLesson && !activeLesson.videoUrl;
  const { data: lessonDetails, isLoading: loadingDetails } = useLesson(
    courseId,
    activeModuleId,
    shouldFetchDetails ? activeLesson.id : undefined
  );

  const currentVideoUrl = activeLesson?.videoUrl || lessonDetails?.videoUrl;
  const currentDescription = lessonDetails?.description || activeLesson?.description;

  // Progresso salvo do vídeo
  const savedProgress = (() => {
    if (!activeLesson?.id || !enrollment?.progressData) return 0;
    const lessonProgress = enrollment.progressData[activeLesson.id];
    return lessonProgress?.secondsWatched ?? 0;
  })();

  // Verifica se o curso está completo
  const totalLessons = useMemo(() => {
    if (!contentData) return 0;
    return contentData.modules.reduce((acc, mod) => acc + mod.lessons.length, 0);
  }, [contentData]);

  const completedLessonsCount = enrollment?.completedLessons?.length || 0;
  const isCourseCompleted = totalLessons > 0 && completedLessonsCount >= totalLessons;

  // Progresso da aula atual
  const currentLessonProgress = useMemo(() => {
    if (!activeLesson?.id || !enrollment?.progressData) return 0;
    const progress = enrollment.progressData[activeLesson.id];
    if (!progress || !progress.totalDuration) return 0;
    return Math.min((progress.secondsWatched / progress.totalDuration) * 100, 100);
  }, [activeLesson, enrollment]);

  // Navegação
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

  // Inicialização
  useEffect(() => {
    if (contentData && !hasInitializedRef.current && !activeLesson) {
      const firstMod = contentData.modules[0];
      if (firstMod?.lessons[0]) {
        hasInitializedRef.current = true;
        initialize(courseId, firstMod, firstMod.lessons[0]);
      }
    }
  }, [contentData, courseId, initialize, activeLesson]);

  // Cleanup
  useEffect(() => {
    return () => {
      hasInitializedRef.current = false;
      resetRef.current();
    };
  }, []);

  // Animação do layout
  const paddingValue = isExpanded ? 430 : 200;
useGSAP(() => {
    if (containerRef.current) {
      gsap.to(containerRef.current, {
        paddingLeft: isExpanded ? 430 : 200,
        duration: 0.5,
        ease: "power3.inOut",
        // 'overwrite: "auto"' garante que novas animações cancelem as antigas 
        // se o usuário clicar rápido
        overwrite: "auto" 
      });
    }
  }, [isExpanded]);

  // Animação dos cards de info
  useGSAP(() => {
    if (infoCardRef.current && activeLesson && contentType === 'lesson') {
      gsap.fromTo(infoCardRef.current,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", delay: 0.1 }
      );
    }
    if (descBoxRef.current && activeLesson && contentType === 'lesson') {
      gsap.fromTo(descBoxRef.current,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", delay: 0.2 }
      );
    }
  }, [activeLesson, contentType]);

  // Handlers
  const handleComplete = () => {
    if (!activeLesson || !activeModuleId) return;
    completeLesson({ courseId, moduleId: activeModuleId, lessonId: activeLesson.id }, {
      onSuccess: (res) => {
        if (res.success) {
          addToast(
            res.leveledUp ? `SUBIU DE NÍVEL! Lvl ${res.newLevel}` : `Aula concluída! +${res.xpEarned} XP`,
            "success"
          );
        }
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

  const handleQuizPass = async () => {
    await queryClient.invalidateQueries({ queryKey: ['enrollment', user?.uid, courseId] });
    await queryClient.invalidateQueries({ queryKey: ['userProfile'] });
  };

  const handleQuizClose = () => {
    router.push('/dashboard/courses');
  };

  const handleIssueCertificate = async () => {
    if (!user) return;
    setEmittingCert(true);
    try {
      const token = await user.getIdToken();
      const res = await issueCertificateAction(token, courseId);

      if (res.success) {
        addToast(res.isNew ? "Certificado emitido!" : "Abrindo certificado...", "success");
        router.push("/dashboard/certificates");
      } else {
        addToast(res.message || "Erro ao emitir.", "error");
      }
    } catch (e) {
      addToast("Erro de conexão.", "error");
    } finally {
      setEmittingCert(false);
    }
  };

  // Data formatada
  const formattedDate = useMemo(() => {
    const date = new Date();
    return date.toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }, []);

  // Renderização - Estados
  if (loadingContent) {
    return (
      <div className={styles.loading}>
        <Loader2 className={styles.spin} size={40} />
        <p>Carregando curso...</p>
      </div>
    );
  }

  if (contentError) {
    throw contentError;
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
      
      {/* GRID DE CONTEÚDO */}
      {/* Configuração do Grid (styles.module.css):
          - Colunas: 1fr (Esquerda) | 340px (Direita Fixa)
          - Linhas: Auto
      */}
      <div className={styles.contentGrid}>
        
        {/* 1. PLAYER DE VÍDEO 
            Posição: Coluna 1, Linha 1 
        */}
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
                <Loader2 className={styles.spin} size={40} color="#CA8DFF" />
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

        {/* 2. SIDEBAR 
            Posição: Coluna 2, Linhas 1 até 2 (span 2)
            Isso garante que ela tenha a altura combinada do Vídeo + Card de Info
        */}
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

        {/* 3. CARD DE INFORMAÇÕES
            Posição: Coluna 1, Linha 2
            Fica logo abaixo do vídeo
        */}
        {activeLesson && contentType === 'lesson' && (
          <div className={styles.lessonInfoCard} ref={infoCardRef}>
              {/* Thumbnail */}
              <div className={styles.lessonThumbnail}>
                <div className={styles.thumbnailPlaceholder}>
                  <PlayCircle size={36} />
                </div>
              </div>

              {/* Info Principal */}
              <div className={styles.lessonMainInfo}>
                <span className={styles.lessonLabel}>Aula</span>
                <h2 className={styles.lessonTitle}>{activeLesson.title}</h2>
                <p className={styles.lessonSubtitle}>
                  {currentDescription?.substring(0, 60) || "Conteúdo da aula"}
                  {currentDescription && currentDescription.length > 60 ? "..." : ""}
                </p>
                <div className={styles.lessonMeta}>
                  <span className={styles.lessonDate}>{formattedDate}</span>
                  <span className={styles.platformBadge}>Uemb</span>
                </div>
              </div>

              {/* Stats: Likes e XP */}
              <div className={styles.lessonStats}>
                <button
                  className={`${styles.likeButton} ${userLiked ? styles.liked : ''}`}
                  onClick={toggleLike}
                  disabled={likesLoading}
                >
                  <Heart
                    size={22}
                    className={styles.likeIcon}
                    fill={userLiked ? "#ff5252" : "none"}
                  />
                  <span className={styles.likeCount}>{formatLikeCount(likeCount)}</span>
                </button>
                <span className={styles.xpDisplay}>{activeLesson.xpReward} xp</span>
              </div>

              {/* Barra de Progresso */}
              <div className={styles.lessonProgressBar}>
                <div
                  className={styles.lessonProgressFill}
                  style={{ width: `${currentLessonProgress}%` }}
                />
              </div>
          </div>
        )}

        {/* 4. CAIXA DE DESCRIÇÃO
            Posição: Coluna 1 até o final (-1), Linha 3
            Fica abaixo de tudo, ocupando a largura total (Full Width)
        */}
        {activeLesson && contentType === 'lesson' && (
          <div className={styles.descriptionBox} ref={descBoxRef}>
              <p className={styles.descriptionText}>
                {currentDescription || "Esta aula faz parte do seu aprendizado na plataforma UEMB. Continue assistindo para ganhar XP e desbloquear novas conquistas."}
              </p>

              {isCourseCompleted && (
                <button
                  className={styles.certificateButton}
                  onClick={handleIssueCertificate}
                  disabled={emittingCert}
                >
                  {emittingCert ? (
                    <>
                      <Loader2 className={styles.spin} size={18} />
                      Emitindo...
                    </>
                  ) : (
                    <>
                      <span>Emitir certificado</span>
                      <div className={styles.certificateButtonIcon}>
                        <ArrowRight size={18} />
                      </div>
                    </>
                  )}
                </button>
              )}
          </div>
        )}

      </div>
    </div>
  );
}

/**
 * ============================================================================
 * EXPORT COM ERROR BOUNDARY
 * ============================================================================
 */
export default function CoursePlayerPage() {
  return (
    <PageErrorBoundary message="Ocorreu um erro ao carregar o player do curso.">
      <CoursePlayerContent />
    </PageErrorBoundary>
  );
}