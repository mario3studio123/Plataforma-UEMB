import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { finishLessonServerAction } from "@/app/actions/courseActions";
import { enrollStudent } from "@/services/enrollmentService";
import { useCallback, useEffect, useState } from "react";

/**
 * ============================================================================
 * TIPOS
 * ============================================================================
 */

/** Dados de progresso de um vídeo específico */
export interface VideoProgressData {
  secondsWatched: number;
  totalDuration: number;
  percentage?: number;
  isVirtuallyComplete?: boolean;
  lastUpdated?: Date;
}

/** Dados da matrícula do usuário em um curso */
export interface EnrollmentData {
  userId: string;
  courseId: string;
  progress: number;
  completedLessons: string[];
  completedQuizzes: string[];
  status: 'active' | 'completed' | 'paused';
  lastAccess?: Date;
  createdAt?: Date;
  /** Mapa de progresso de cada vídeo (lessonId -> VideoProgressData) */
  progressData?: Record<string, VideoProgressData>;
}

export interface CompleteLessonResult {
  success: boolean;
  xpEarned?: number;
  leveledUp?: boolean;
  newLevel?: number;
  message?: string;
}

export interface ProgressStats {
  totalLessons: number;
  completedLessons: number;
  totalQuizzes: number;
  completedQuizzes: number;
  progressPercent: number;
  isCompleted: boolean;
}

/**
 * ============================================================================
 * HOOK: useEnrollment
 * ============================================================================
 * Busca dados da matrícula do usuário em um curso.
 * Inclui auto-matrícula se necessário.
 */
export function useEnrollment(courseId: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['enrollment', user?.uid, courseId],
    queryFn: async (): Promise<EnrollmentData | null> => {
      if (!user || !courseId) return null;
      
      const enrollmentId = `${user.uid}_${courseId}`;
      const enrollmentRef = doc(db, "enrollments", enrollmentId);
      const snap = await getDoc(enrollmentRef);
      
      if (snap.exists()) {
        return snap.data() as EnrollmentData;
      }
      
      // Auto-matrícula se não existir
      try {
        await enrollStudent(user.uid, courseId);
        // Busca novamente após matrícula
        const newSnap = await getDoc(enrollmentRef);
        return newSnap.exists() ? (newSnap.data() as EnrollmentData) : null;
      } catch (error) {
        console.error("Erro na auto-matrícula:", error);
        return null;
      }
    },
    enabled: !!user && !!courseId,
    staleTime: 1000 * 60 * 5, // Cache de 5 minutos
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}

/**
 * ============================================================================
 * HOOK: useEnrollmentRealtime
 * ============================================================================
 * Versão com listener em tempo real para atualizações instantâneas.
 * Útil quando múltiplas abas/dispositivos podem atualizar o progresso.
 */
export function useEnrollmentRealtime(courseId: string) {
  const { user } = useAuth();
  const [enrollment, setEnrollment] = useState<EnrollmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !courseId) {
      setLoading(false);
      return;
    }

    const enrollmentId = `${user.uid}_${courseId}`;
    const enrollmentRef = doc(db, "enrollments", enrollmentId);

    const unsubscribe = onSnapshot(
      enrollmentRef,
      (snap) => {
        if (snap.exists()) {
          setEnrollment(snap.data() as EnrollmentData);
        } else {
          setEnrollment(null);
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Erro no listener de enrollment:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, courseId]);

  return { enrollment, loading, error };
}

/**
 * ============================================================================
 * HOOK: useCompleteLesson
 * ============================================================================
 * Mutation para marcar aula como concluída.
 * Inclui atualização otimista do cache.
 */
export function useCompleteLesson() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      courseId, 
      moduleId, 
      lessonId 
    }: { 
      courseId: string; 
      moduleId: string; 
      lessonId: string;
    }): Promise<CompleteLessonResult> => {
      if (!user) throw new Error("Usuário não logado");
      
      const token = await user.getIdToken();
      const result = await finishLessonServerAction(token, courseId, moduleId, lessonId);
      
      if (!result.success) {
        throw new Error(result.message || "Erro ao completar aula");
      }
      
      return result;
    },

    // Atualização otimista - atualiza UI antes da resposta do servidor
    onMutate: async ({ courseId, lessonId }) => {
      // Cancela queries em andamento
      await queryClient.cancelQueries({ 
        queryKey: ['enrollment', user?.uid, courseId] 
      });

      // Snapshot do estado anterior
      const previousEnrollment = queryClient.getQueryData<EnrollmentData>(
        ['enrollment', user?.uid, courseId]
      );

      // Atualiza otimisticamente
      if (previousEnrollment) {
        queryClient.setQueryData<EnrollmentData>(
          ['enrollment', user?.uid, courseId],
          {
            ...previousEnrollment,
            completedLessons: [...previousEnrollment.completedLessons, lessonId],
          }
        );
      }

      return { previousEnrollment };
    },

    // Se der erro, reverte para o estado anterior
    onError: (err, variables, context) => {
      if (context?.previousEnrollment) {
        queryClient.setQueryData(
          ['enrollment', user?.uid, variables.courseId],
          context.previousEnrollment
        );
      }
      console.error("Erro ao completar aula:", err);
    },

    // Após sucesso ou erro, invalida caches relacionados
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['enrollment', user?.uid, variables.courseId] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['userProfile', user?.uid] 
      });
    },
  });
}

/**
 * ============================================================================
 * HOOK: useProgressStats
 * ============================================================================
 * Calcula estatísticas de progresso baseado em enrollment e estrutura do curso.
 */
export function useProgressStats(
  courseId: string,
  totalLessons: number,
  totalQuizzes: number
): ProgressStats {
  const { data: enrollment } = useEnrollment(courseId);

  const completedLessons = enrollment?.completedLessons?.length || 0;
  const completedQuizzes = enrollment?.completedQuizzes?.length || 0;
  
  const totalItems = totalLessons + totalQuizzes;
  const completedItems = completedLessons + completedQuizzes;
  
  const progressPercent = totalItems > 0 
    ? Math.round((completedItems / totalItems) * 100) 
    : 0;

  return {
    totalLessons,
    completedLessons,
    totalQuizzes,
    completedQuizzes,
    progressPercent,
    isCompleted: progressPercent >= 100,
  };
}

/**
 * ============================================================================
 * HOOK: useProgressActions
 * ============================================================================
 * Hook combinado com todas as ações de progresso.
 */
export function useProgressActions(courseId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const completeLessonMutation = useCompleteLesson();

  const completeLesson = useCallback(
    async (moduleId: string, lessonId: string) => {
      return completeLessonMutation.mutateAsync({ courseId, moduleId, lessonId });
    },
    [courseId, completeLessonMutation]
  );

  const refreshProgress = useCallback(() => {
    if (user) {
      queryClient.invalidateQueries({ 
        queryKey: ['enrollment', user.uid, courseId] 
      });
    }
  }, [user, courseId, queryClient]);

  const isLessonCompleted = useCallback(
    (lessonId: string, completedLessons: string[]) => {
      return completedLessons.includes(lessonId);
    },
    []
  );

  const isQuizCompleted = useCallback(
    (moduleId: string, completedQuizzes: string[]) => {
      return completedQuizzes.includes(moduleId);
    },
    []
  );

  return {
    completeLesson,
    refreshProgress,
    isLessonCompleted,
    isQuizCompleted,
    isCompletingLesson: completeLessonMutation.isPending,
    completeLessonError: completeLessonMutation.error,
  };
}