// src/app/dashboard/courses/[id]/learn/page.tsx
"use client";

import { useEffect, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query"; // <--- 1. IMPORTAR ISTO
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

// Hooks e Store
import { useCourseContent, useLesson } from "@/hooks/useCourses";
import { useEnrollment, useCompleteLesson } from "@/hooks/useProgress";
import { usePlayerStore } from "@/stores/usePlayerStore";
import { formatDuration } from "@/utils/formatters";
import { useAuth } from "@/context/AuthContext"; // Para pegar o ID do usuário

export default function CoursePlayerPage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient(); // <--- 2. INICIALIZAR O CLIENTE
  const { user } = useAuth();
  
  const courseId = id as string;
  const { isExpanded } = useSidebar();
  const { addToast } = useToast();
  
  // Dados & Hooks Globais
  const { data: contentData, isLoading: loadingContent } = useCourseContent(courseId);
  const { data: enrollment } = useEnrollment(courseId);
  const { mutate: completeLesson, isPending: markingComplete } = useCompleteLesson();

  // Store Global do Player
  const { 
    activeLesson, activeModuleId, contentType, 
    initialize, setActiveLesson, openQuiz, reset 
  } = usePlayerStore();

  const containerRef = useRef<HTMLDivElement>(null);

  // --- LAZY LOADING INTELIGENTE ---
  const shouldFetchDetails = activeLesson && !activeLesson.videoUrl;
  
  const { data: lessonDetails, isLoading: loadingDetails } = useLesson(
    courseId, 
    activeModuleId, 
    shouldFetchDetails ? activeLesson.id : undefined
  );

  const currentVideoUrl = activeLesson?.videoUrl || lessonDetails?.videoUrl;
  const currentDescription = lessonDetails?.description || activeLesson?.description;

  const savedProgress = activeLesson && enrollment?.progressData?.[activeLesson.id]?.secondsWatched 
    ? enrollment.progressData[activeLesson.id].secondsWatched 
    : 0;

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

  // --- Efeitos ---
  useEffect(() => {
    if (contentData && !activeLesson && contentType === 'lesson') {
      const firstMod = contentData.modules[0];
      if (firstMod?.lessons[0]) {
        initialize(courseId, firstMod, firstMod.lessons[0]);
      }
    }
    return () => { reset(); }
  }, [contentData, courseId, initialize, reset]);

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
         // Nota: O useCompleteLesson já faz a invalidação automática, por isso não precisa aqui
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

  // --- 🔥 AQUI ESTÁ A CORREÇÃO 🔥 ---
  
  // 1. Quando passar na prova, atualizamos os dados IMEDIATAMENTE
  const handleQuizPass = async () => {
      // Invalida o cache da matrícula -> Atualiza Sidebar (Check verde e barra de progresso)
      await queryClient.invalidateQueries({ queryKey: ['enrollment', user?.uid, courseId] });
      
      // Invalida o cache do perfil -> Atualiza TopBar (XP e Nível)
      // Nota: A key depende de como você configurou no AuthContext, mas geralmente 'userProfile' é seguro se usar custom hook
      // Se o AuthContext usa onSnapshot (tempo real), ele atualiza sozinho. 
      // Mas se o TopBar usar dados cacheados, forçamos aqui:
      await queryClient.invalidateQueries({ queryKey: ['userProfile'] });
  };

  // 2. Quando fechar (Continuar Jornada), decidimos para onde ir
  const handleQuizClose = () => {
      // Opção A: Voltar para a biblioteca
      router.push('/dashboard/courses');
      
      // Opção B: Se quiser apenas fechar o player e mostrar a lista de aulas atualizada:
      // reset(); 
  };

  // --- Renderização ---

  if (loadingContent) return <div className={styles.loading}>Carregando estrutura...</div>;
  if (!contentData) return <div className={styles.emptyState}>Conteúdo não disponível.</div>;

  return (
    <div className={styles.pageContainer} ref={containerRef}>
      <section className={styles.topSection}>
        <div className={styles.playerWrapper}>
          {contentType === 'quiz' && activeModuleId ? (
            <QuizPlayer 
              courseId={courseId} 
              moduleId={activeModuleId} 
              onPass={handleQuizPass} // <--- Passamos a nova função de refresh
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
             completedQuizzes={enrollment?.completedQuizzes || []} // Isso agora virá atualizado!
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
                   : "Concluir Aula"
                 }
               </button>
            </div>
            <div className={styles.divider} />
            <div className={styles.descriptionBox}>
                <p>{currentDescription || "Sem descrição disponível para esta aula."}</p>
            </div>
        </section>
      )}
    </div>
  );
}