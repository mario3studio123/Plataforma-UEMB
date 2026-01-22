"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { doc, getDoc, collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { enrollStudent } from "@/services/enrollmentService";
import { finishLessonServerAction } from "@/app/actions/courseActions";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

// Tipos
export type Lesson = { id: string; title: string; videoUrl: string; order: number; xpReward: number; duration?: string };
export type Module = { id: string; title: string; order: number; lessons: Lesson[] };
export type ContentType = "lesson" | "quiz";

export function useCoursePlayer(courseId: string) {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<Module[]>([]);
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [completedQuizzes, setCompletedQuizzes] = useState<string[]>([]);
  
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [activeContentType, setActiveContentType] = useState<ContentType>("lesson");
  const [markingComplete, setMarkingComplete] = useState(false);

  // ... (O useEffect de loadData permanece igual, omiti para brevidade) ...
  // MANTENHA O SEU useEffect "Carregar Dados" AQUI IGUAL AO ANTERIOR

  // 1. Lógica Determinística: Calcula se existe um "Próximo" passo real
  const hasNextStep = useMemo(() => {
    if (!activeModuleId || !activeLesson || modules.length === 0) return false;

    const currentModIndex = modules.findIndex(m => m.id === activeModuleId);
    if (currentModIndex === -1) return false;
    
    const currentMod = modules[currentModIndex];
    const currentLessonIndex = currentMod.lessons.findIndex(l => l.id === activeLesson.id);

    // Tem próxima aula neste módulo?
    if (currentLessonIndex < currentMod.lessons.length - 1) return true;

    // Se é lição, tem quiz (assumindo que o módulo tem quiz)?
    // Aqui você pode refinar checando se o módulo realmente tem quiz configurado
    if (activeContentType === 'lesson') return true; 

    // Se acabou o módulo/quiz, tem próximo módulo?
    if (activeContentType === 'quiz' && currentModIndex < modules.length - 1) return true;

    // Se chegou aqui, é o fim absoluto
    return false;
  }, [modules, activeModuleId, activeLesson, activeContentType]);


  // 2. Ação de Completar Aula (Estabilizada com useCallback)
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
    } catch (error) {
      console.error(error);
      addToast("Erro ao salvar progresso.", "error");
    } finally {
      setMarkingComplete(false);
    }
  }, [user, courseId, completedLessons, addToast]); // Dependências explícitas

  // 3. Navegação (Estabilizada e limpa)
  const navigateToNext = useCallback(() => {
    // Se não tem próximo passo (calculado no useMemo), nem tenta navegar.
    // Isso previne o Toast Loop na raiz.
    if (!hasNextStep) {
        // Opcional: Feedback visual de fim de curso apenas se o usuário clicar manualmente,
        // mas o player automático não deve cair aqui.
        return; 
    }

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

    // 2. Ir para o Quiz
    if (activeContentType === 'lesson') {
        setActiveContentType('quiz');
        return;
    }

    // 3. Próximo Módulo
    if (activeContentType === 'quiz') {
        if (currentModIndex < modules.length - 1) {
            const nextMod = modules[currentModIndex + 1];
            setActiveModuleId(nextMod.id);
            if (nextMod.lessons.length > 0) {
                setActiveLesson(nextMod.lessons[0]);
                setActiveContentType('lesson');
            }
        }
    }
  }, [hasNextStep, activeModuleId, activeLesson, activeContentType, modules]);

  return {
    loading,
    modules,
    activeLesson,
    activeModuleId,
    activeContentType,
    completedLessons,
    completedQuizzes,
    markingComplete,
    setActiveLesson,
    setActiveModuleId,
    setActiveContentType,
    completeLesson,
    navigateToNext,
    setCompletedQuizzes,
    hasNextStep // <--- Exportamos essa flag vital
  };
}