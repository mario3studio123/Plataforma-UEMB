import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { finishLessonServerAction } from "@/app/actions/courseActions";
import { enrollStudent } from "@/services/enrollmentService";

// Hook para buscar dados da matrícula (Progresso)
export function useEnrollment(courseId: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['enrollment', user?.uid, courseId],
    queryFn: async () => {
      if (!user) return null;
      // Garante que está matriculado ou cria a matrícula se não existir
      await enrollStudent(user.uid, courseId);
      
      const ref = doc(db, "enrollments", `${user.uid}_${courseId}`);
      const snap = await getDoc(ref);
      return snap.exists() ? snap.data() : null;
    },
    enabled: !!user && !!courseId,
    staleTime: 1000 * 60 * 5, // Cache de 5 minutos
  });
}

// Hook Mutation para concluir aula (Abstrai a Server Action)
export function useCompleteLesson() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ courseId, moduleId, lessonId }: { courseId: string, moduleId: string, lessonId: string }) => {
       if (!user) throw new Error("Usuário não logado");
       const token = await user.getIdToken();
       return await finishLessonServerAction(token, courseId, moduleId, lessonId);
    },
    // Quando der sucesso, atualizamos o cache local para refletir na UI imediatamente
    onSuccess: (_, variables) => {
      // Invalida o cache de matrícula para forçar atualização do progresso visual
      queryClient.invalidateQueries({ queryKey: ['enrollment', user?.uid, variables.courseId] });
      
      // Também é bom invalidar o 'admin-course' se estiver sendo usado, ou perfil do usuário
      queryClient.invalidateQueries({ queryKey: ['userProfile', user?.uid] });
    }
  });
}