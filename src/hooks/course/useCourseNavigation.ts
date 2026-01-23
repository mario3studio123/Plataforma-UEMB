import { useMemo, useCallback } from "react";
import { Course, Module, Lesson } from "@/types"; // Ajuste conforme seus types
import { usePlayerStore } from "@/stores/usePlayerStore";

interface UseCourseNavigationProps {
  modules: Module[];
  activeModuleId: string | null;
  activeLessonId: string | undefined;
}

export function useCourseNavigation({ modules, activeModuleId, activeLessonId }: UseCourseNavigationProps) {
  const { setActiveLesson } = usePlayerStore();

  // 1. Encontra índices atuais (Memoized para performance)
  const navigationContext = useMemo(() => {
    if (!modules || !activeModuleId || !activeLessonId) return null;

    const modIndex = modules.findIndex((m) => m.id === activeModuleId);
    if (modIndex === -1) return null;

    const currentModule = modules[modIndex];
    const lessonIndex = currentModule.lessons.findIndex((l) => l.id === activeLessonId);
    
    return { modIndex, lessonIndex, currentModule };
  }, [modules, activeModuleId, activeLessonId]);

  // 2. Verifica se existe próximo passo
  const hasNextStep = useMemo(() => {
    if (!navigationContext) return false;
    const { modIndex, lessonIndex, currentModule } = navigationContext;

    // Cenário A: Tem próxima aula neste módulo?
    if (lessonIndex < currentModule.lessons.length - 1) return true;

    // Cenário B: Tem próximo módulo com aulas?
    if (modIndex < modules.length - 1) {
      const nextMod = modules[modIndex + 1];
      return nextMod.lessons.length > 0;
    }

    return false;
  }, [navigationContext, modules]);

  // 3. Executa a navegação
  const navigateToNext = useCallback(() => {
    if (!hasNextStep || !navigationContext) return;
    const { modIndex, lessonIndex, currentModule } = navigationContext;

    // Ir para próxima aula do mesmo módulo
    if (lessonIndex < currentModule.lessons.length - 1) {
      const nextLesson = currentModule.lessons[lessonIndex + 1];
      setActiveLesson(nextLesson, activeModuleId!);
      return;
    }

    // Ir para o próximo módulo
    if (modIndex < modules.length - 1) {
      const nextMod = modules[modIndex + 1];
      if (nextMod.lessons.length > 0) {
        setActiveLesson(nextMod.lessons[0], nextMod.id);
      }
    }
  }, [hasNextStep, navigationContext, modules, activeModuleId, setActiveLesson]);

  return { hasNextStep, navigateToNext };
}