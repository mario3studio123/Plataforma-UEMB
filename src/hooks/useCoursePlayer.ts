"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { doc, getDoc, collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { enrollStudent } from "@/services/enrollmentService";
import { finishLessonServerAction } from "@/app/actions/courseActions";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

/**
 * ============================================================================
 * TIPOS
 * ============================================================================
 */

export interface Lesson {
  id: string;
  title: string;
  videoUrl: string;
  order: number;
  xpReward: number;
  duration?: number; // em segundos
  durationFormatted?: string;
}

export interface Module {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
  hasQuiz?: boolean;
}

export type ContentType = "lesson" | "quiz";

export interface CoursePlayerState {
  loading: boolean;
  error: string | null;
  modules: Module[];
  activeLesson: Lesson | null;
  activeModuleId: string | null;
  activeContentType: ContentType;
  completedLessons: string[];
  completedQuizzes: string[];
  markingComplete: boolean;
  courseTitle?: string;
  progress: number;
}

/**
 * ============================================================================
 * HOOK: useCoursePlayer
 * ============================================================================
 * Hook robusto para gerenciar o estado do player de curso.
 * Carrega módulos, aulas, progresso do aluno e gerencia navegação.
 */
export function useCoursePlayer(courseId: string) {
  const { user } = useAuth();
  const { addToast } = useToast();

  // Estados principais
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [completedQuizzes, setCompletedQuizzes] = useState<string[]>([]);
  const [courseTitle, setCourseTitle] = useState<string>("");
  
  // Estados de navegação
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [activeContentType, setActiveContentType] = useState<ContentType>("lesson");
  const [markingComplete, setMarkingComplete] = useState(false);

  // Ref para controlar se já carregou (evita double fetch no StrictMode)
  const hasLoadedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * ============================================================================
   * EFEITO: Carregamento Inicial de Dados
   * ============================================================================
   */
  useEffect(() => {
    // Não carrega se não tiver courseId ou user
    if (!courseId || !user) {
      setLoading(false);
      return;
    }

    // Evita carregamento duplicado
    if (hasLoadedRef.current) {
      return;
    }

    // Cria abort controller para cancelar se o componente desmontar
    abortControllerRef.current = new AbortController();

    const loadCourseData = async () => {
      hasLoadedRef.current = true;
      setLoading(true);
      setError(null);

      try {
        // ========================================
        // 1. CARREGAR DADOS DO CURSO (Syllabus)
        // ========================================
        const courseRef = doc(db, "courses", courseId);
        const courseSnap = await getDoc(courseRef);

        if (!courseSnap.exists()) {
          throw new Error("Curso não encontrado");
        }

        const courseData = courseSnap.data();
        setCourseTitle(courseData.title || "");

        // Usa Syllabus cacheado se disponível (mais performático)
        let loadedModules: Module[] = [];

        if (courseData.syllabus && Array.isArray(courseData.syllabus)) {
          // Carrega do Syllabus (dados já agregados)
          loadedModules = await loadFromSyllabus(courseId, courseData.syllabus);
        } else {
          // Fallback: carrega da estrutura completa
          loadedModules = await loadFromFirestore(courseId);
        }

        // Ordena módulos por ordem
        loadedModules.sort((a, b) => a.order - b.order);

        // ========================================
        // 2. CARREGAR PROGRESSO DO ALUNO (Enrollment)
        // ========================================
        const enrollmentId = `${user.uid}_${courseId}`;
        const enrollmentRef = doc(db, "enrollments", enrollmentId);
        const enrollmentSnap = await getDoc(enrollmentRef);

        let userCompletedLessons: string[] = [];
        let userCompletedQuizzes: string[] = [];

        if (enrollmentSnap.exists()) {
          const enrollmentData = enrollmentSnap.data();
          userCompletedLessons = enrollmentData.completedLessons || [];
          userCompletedQuizzes = enrollmentData.completedQuizzes || [];
        } else {
          // Auto-matrícula se não estiver matriculado
          try {
            await enrollStudent(user.uid, courseId);
          } catch (enrollError) {
            console.warn("Auto-matrícula falhou (pode já existir):", enrollError);
          }
        }

        // ========================================
        // 3. DEFINIR ESTADO INICIAL
        // ========================================
        setModules(loadedModules);
        setCompletedLessons(userCompletedLessons);
        setCompletedQuizzes(userCompletedQuizzes);

        // Define primeiro módulo/aula não completada ou a primeira
        const initialState = findInitialPosition(
          loadedModules,
          userCompletedLessons,
          userCompletedQuizzes
        );

        setActiveModuleId(initialState.moduleId);
        setActiveLesson(initialState.lesson);
        setActiveContentType(initialState.contentType);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Erro ao carregar curso";
        console.error("Erro ao carregar curso:", err);
        setError(errorMessage);
        addToast(errorMessage, "error");
      } finally {
        setLoading(false);
      }
    };

    loadCourseData();

    // Cleanup
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [courseId, user, addToast]);

  /**
   * ============================================================================
   * HELPER: Carrega módulos do Syllabus (performático)
   * ============================================================================
   */
  async function loadFromSyllabus(
    courseId: string,
    syllabus: Array<{ id: string; title: string; lessons: Array<{ id: string; title: string; duration?: number }> }>
  ): Promise<Module[]> {
    const modules: Module[] = [];

    for (let i = 0; i < syllabus.length; i++) {
      const syllabusModule = syllabus[i];
      
      // Busca dados completos das aulas (precisamos do videoUrl que não está no syllabus)
      const lessonsRef = collection(db, "courses", courseId, "modules", syllabusModule.id, "lessons");
      const lessonsQuery = query(lessonsRef, orderBy("order", "asc"));
      const lessonsSnap = await getDocs(lessonsQuery);

      const lessons: Lesson[] = lessonsSnap.docs.map((lessonDoc, idx) => {
        const data = lessonDoc.data();
        return {
          id: lessonDoc.id,
          title: data.title || `Aula ${idx + 1}`,
          videoUrl: data.videoUrl || "",
          order: data.order ?? idx,
          xpReward: data.xpReward ?? 10,
          duration: data.duration,
          durationFormatted: data.durationFormatted,
        };
      });

      // Verifica se o módulo tem quiz (verifica se existe a subcollection questions)
      const questionsRef = collection(db, "courses", courseId, "modules", syllabusModule.id, "questions");
      const questionsSnap = await getDocs(questionsRef);
      const hasQuiz = !questionsSnap.empty;

      modules.push({
        id: syllabusModule.id,
        title: syllabusModule.title,
        order: i,
        lessons,
        hasQuiz,
      });
    }

    return modules;
  }

  /**
   * ============================================================================
   * HELPER: Carrega módulos diretamente do Firestore (fallback)
   * ============================================================================
   */
  async function loadFromFirestore(courseId: string): Promise<Module[]> {
    const modulesRef = collection(db, "courses", courseId, "modules");
    const modulesQuery = query(modulesRef, orderBy("order", "asc"));
    const modulesSnap = await getDocs(modulesQuery);

    const modules: Module[] = [];

    for (const moduleDoc of modulesSnap.docs) {
      const moduleData = moduleDoc.data();

      // Carrega aulas do módulo
      const lessonsRef = collection(db, "courses", courseId, "modules", moduleDoc.id, "lessons");
      const lessonsQuery = query(lessonsRef, orderBy("order", "asc"));
      const lessonsSnap = await getDocs(lessonsQuery);

      const lessons: Lesson[] = lessonsSnap.docs.map((lessonDoc, idx) => {
        const data = lessonDoc.data();
        return {
          id: lessonDoc.id,
          title: data.title || `Aula ${idx + 1}`,
          videoUrl: data.videoUrl || "",
          order: data.order ?? idx,
          xpReward: data.xpReward ?? 10,
          duration: data.duration,
          durationFormatted: data.durationFormatted,
        };
      });

      // Verifica se tem quiz
      const questionsRef = collection(db, "courses", courseId, "modules", moduleDoc.id, "questions");
      const questionsSnap = await getDocs(questionsRef);
      const hasQuiz = !questionsSnap.empty;

      modules.push({
        id: moduleDoc.id,
        title: moduleData.title || `Módulo ${modules.length + 1}`,
        order: moduleData.order ?? modules.length,
        lessons,
        hasQuiz,
      });
    }

    return modules;
  }

  /**
   * ============================================================================
   * HELPER: Encontra posição inicial (continuar de onde parou)
   * ============================================================================
   */
  function findInitialPosition(
    modules: Module[],
    completedLessons: string[],
    completedQuizzes: string[]
  ): { moduleId: string | null; lesson: Lesson | null; contentType: ContentType } {
    if (modules.length === 0) {
      return { moduleId: null, lesson: null, contentType: "lesson" };
    }

    // Percorre módulos procurando o primeiro item não completado
    for (const module of modules) {
      // Verifica aulas do módulo
      for (const lesson of module.lessons) {
        if (!completedLessons.includes(lesson.id)) {
          return {
            moduleId: module.id,
            lesson,
            contentType: "lesson",
          };
        }
      }

      // Se todas as aulas foram completadas, verifica quiz
      if (module.hasQuiz && !completedQuizzes.includes(module.id)) {
        return {
          moduleId: module.id,
          lesson: module.lessons[module.lessons.length - 1] || null,
          contentType: "quiz",
        };
      }
    }

    // Se tudo foi completado, volta pro início
    const firstModule = modules[0];
    return {
      moduleId: firstModule.id,
      lesson: firstModule.lessons[0] || null,
      contentType: "lesson",
    };
  }

  /**
   * ============================================================================
   * COMPUTED: Cálculo de progresso
   * ============================================================================
   */
  const progress = useMemo(() => {
    if (modules.length === 0) return 0;

    let totalItems = 0;
    let completedItems = 0;

    for (const module of modules) {
      // Conta aulas
      totalItems += module.lessons.length;
      completedItems += module.lessons.filter(l => completedLessons.includes(l.id)).length;

      // Conta quiz se existir
      if (module.hasQuiz) {
        totalItems += 1;
        if (completedQuizzes.includes(module.id)) {
          completedItems += 1;
        }
      }
    }

    if (totalItems === 0) return 0;
    return Math.round((completedItems / totalItems) * 100);
  }, [modules, completedLessons, completedQuizzes]);

  /**
   * ============================================================================
   * COMPUTED: Verifica se existe próximo passo
   * ============================================================================
   */
  const hasNextStep = useMemo(() => {
    if (!activeModuleId || !activeLesson || modules.length === 0) return false;

    const currentModIndex = modules.findIndex(m => m.id === activeModuleId);
    if (currentModIndex === -1) return false;
    
    const currentMod = modules[currentModIndex];
    const currentLessonIndex = currentMod.lessons.findIndex(l => l.id === activeLesson.id);

    // Tem próxima aula neste módulo?
    if (currentLessonIndex < currentMod.lessons.length - 1) return true;

    // Se é lição e o módulo tem quiz, vai pro quiz
    if (activeContentType === 'lesson' && currentMod.hasQuiz) return true;

    // Se acabou o módulo/quiz, tem próximo módulo?
    if (currentModIndex < modules.length - 1) return true;

    // Se chegou aqui, é o fim absoluto
    return false;
  }, [modules, activeModuleId, activeLesson, activeContentType]);

  /**
   * ============================================================================
   * ACTION: Completar Aula
   * ============================================================================
   */
  const completeLesson = useCallback(async (lesson: Lesson, moduleId: string) => {
    if (!user || completedLessons.includes(lesson.id)) return;

    setMarkingComplete(true);
    try {
      const token = await user.getIdToken();
      const result = await finishLessonServerAction(token, courseId, moduleId, lesson.id);

      if (result.success) {
        setCompletedLessons(prev => [...prev, lesson.id]);
        if (result.leveledUp) {
          addToast(`🎉 PARABÉNS! Você subiu para o Nível ${result.newLevel}!`, "success");
        } else {
          addToast(`Aula concluída! +${result.xpEarned} XP`, "success");
        }
      }
    } catch (err) {
      console.error("Erro ao completar aula:", err);
      addToast("Erro ao salvar progresso.", "error");
    } finally {
      setMarkingComplete(false);
    }
  }, [user, courseId, completedLessons, addToast]);

  /**
   * ============================================================================
   * ACTION: Navegar para Próximo
   * ============================================================================
   */
  const navigateToNext = useCallback(() => {
    // Se não tem próximo passo, não navega
    if (!hasNextStep) return;
    if (!activeModuleId || !activeLesson) return;

    const currentModIndex = modules.findIndex(m => m.id === activeModuleId);
    if (currentModIndex === -1) return;
    
    const currentMod = modules[currentModIndex];
    const currentLessonIndex = currentMod.lessons.findIndex(l => l.id === activeLesson.id);

    // 1. Próxima aula do mesmo módulo
    if (currentLessonIndex < currentMod.lessons.length - 1) {
      setActiveLesson(currentMod.lessons[currentLessonIndex + 1]);
      return;
    }

    // 2. Ir para o Quiz (se o módulo tem quiz)
    if (activeContentType === 'lesson' && currentMod.hasQuiz) {
      setActiveContentType('quiz');
      return;
    }

    // 3. Próximo Módulo
    if (currentModIndex < modules.length - 1) {
      const nextMod = modules[currentModIndex + 1];
      setActiveModuleId(nextMod.id);
      if (nextMod.lessons.length > 0) {
        setActiveLesson(nextMod.lessons[0]);
        setActiveContentType('lesson');
      }
    }
  }, [hasNextStep, activeModuleId, activeLesson, activeContentType, modules]);

  /**
   * ============================================================================
   * ACTION: Selecionar Aula Específica
   * ============================================================================
   */
  const selectLesson = useCallback((moduleId: string, lesson: Lesson) => {
    setActiveModuleId(moduleId);
    setActiveLesson(lesson);
    setActiveContentType('lesson');
  }, []);

  /**
   * ============================================================================
   * ACTION: Selecionar Quiz do Módulo
   * ============================================================================
   */
  const selectQuiz = useCallback((moduleId: string) => {
    const module = modules.find(m => m.id === moduleId);
    if (module && module.hasQuiz) {
      setActiveModuleId(moduleId);
      // Mantém a última aula como referência
      if (module.lessons.length > 0) {
        setActiveLesson(module.lessons[module.lessons.length - 1]);
      }
      setActiveContentType('quiz');
    }
  }, [modules]);

  /**
   * ============================================================================
   * ACTION: Marcar Quiz como Completado
   * ============================================================================
   */
  const markQuizCompleted = useCallback((moduleId: string) => {
    setCompletedQuizzes(prev => {
      if (prev.includes(moduleId)) return prev;
      return [...prev, moduleId];
    });
  }, []);

  /**
   * ============================================================================
   * ACTION: Recarregar Dados
   * ============================================================================
   */
  const reload = useCallback(() => {
    hasLoadedRef.current = false;
    setLoading(true);
    // O useEffect vai disparar novamente
  }, []);

  /**
   * ============================================================================
   * RETURN
   * ============================================================================
   */
  return {
    // Estados
    loading,
    error,
    modules,
    courseTitle,
    progress,
    
    // Navegação atual
    activeLesson,
    activeModuleId,
    activeContentType,
    
    // Progresso do aluno
    completedLessons,
    completedQuizzes,
    
    // Estados de UI
    markingComplete,
    hasNextStep,
    
    // Setters (para compatibilidade)
    setActiveLesson,
    setActiveModuleId,
    setActiveContentType,
    setCompletedQuizzes,
    
    // Actions
    completeLesson,
    navigateToNext,
    selectLesson,
    selectQuiz,
    markQuizCompleted,
    reload,
  };
}