// src/hooks/admin/useCourseStructure.ts
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Module, Lesson } from "@/types";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { 
  reorderModulesAction, 
  reorderLessonsAction, 
} from "@/app/actions/admin/moduleActions";
import { transferLessonAction } from "@/app/actions/admin/lessonMoveAction";

// Tipo do dado que vem do hook useAdminCourseData
type CourseDataCache = {
  course: any;
  modules: Module[];
};

export function useCourseStructure(courseId: string) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const { user } = useAuth();
  const queryKey = ['admin-course', courseId];

  // Helper para atualizar o cache otimista
  const updateCache = useCallback((newModules: Module[]) => {
    queryClient.setQueryData<CourseDataCache>(queryKey, (old) => {
      if (!old) return old;
      return { ...old, modules: newModules };
    });
  }, [queryClient, queryKey]);

  /**
   * Move Módulos (Reordenação)
   */
  const moveModule = useCallback(async (newModulesOrder: Module[]) => {
    if (!user) return;
    
    // 1. Snapshot do estado anterior (para rollback)
    const previousData = queryClient.getQueryData<CourseDataCache>(queryKey);
    
    // 2. Atualização Otimista
    updateCache(newModulesOrder);

    try {
      const token = await user.getIdToken();
      // Prepara payload apenas com ID e nova ordem
      const items = newModulesOrder.map((m, index) => ({ id: m.id, newOrder: index }));
      
      const result = await reorderModulesAction(token, courseId, items);
      if (!result.success) throw new Error(result.message);

    } catch (error) {
      // 3. Rollback em caso de erro
      if (previousData) updateCache(previousData.modules);
      addToast("Erro ao mover módulo. As alterações foram desfeitas.", "error");
      console.error(error);
    }
  }, [user, courseId, queryClient, queryKey, updateCache, addToast]);

  /**
   * Move Aulas (Reordenação interna ou Transferência entre módulos)
   */
  const moveLesson = useCallback(async (
    activeLessonId: string,
    sourceModuleId: string,
    targetModuleId: string,
    newIndex: number,
    optimisticModules: Module[] // Passamos o estado já calculado visualmente pelo DndKit
  ) => {
    if (!user) return;

    // 1. Snapshot
    const previousData = queryClient.getQueryData<CourseDataCache>(queryKey);

    // 2. Atualização Otimista (A UI já recebeu via props, mas confirmamos no cache)
    updateCache(optimisticModules);

    try {
      const token = await user.getIdToken();

      // CASO A: Mesmo módulo (Reorder simples)
      if (sourceModuleId === targetModuleId) {
        const targetModule = optimisticModules.find(m => m.id === targetModuleId);
        if (!targetModule) return;

        const items = targetModule.lessons.map((l, index) => ({ id: l.id, newOrder: index }));
        const result = await reorderLessonsAction(token, courseId, targetModuleId, items);
        if (!result.success) throw new Error(result.message);
      
      } 
      // CASO B: Transferência entre módulos
      else {
        const result = await transferLessonAction(
          token, 
          courseId, 
          sourceModuleId, 
          targetModuleId, 
          activeLessonId, 
          newIndex
        );
        if (!result.success) throw new Error(result.message);
      }

    } catch (error) {
      // 3. Rollback
      if (previousData) updateCache(previousData.modules);
      addToast("Erro ao mover aula.", "error");
      console.error(error);
    }
  }, [user, courseId, queryClient, queryKey, updateCache, addToast]);

  return {
    moveModule,
    moveLesson
  };
}