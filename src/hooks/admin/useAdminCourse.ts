// src/hooks/admin/useAdminCourse.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  collection, doc, getDoc, getDocs, addDoc, 
  query, orderBy, serverTimestamp 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Module, Lesson, Course } from "@/types";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";

// Server Actions
import { upsertLessonAction, deleteLessonAction } from "@/app/actions/admin/lessonManagementActions";
import { updateModuleAction, deleteModuleAction } from "@/app/actions/admin/moduleActions";
import { LessonInput } from "@/lib/schemas/courseSchemas";

// ============================================================================
// 📡 HOOK DE LEITURA (FETCH)
// ============================================================================

export function useAdminCourseData(courseId: string) {
  return useQuery({
    queryKey: ['admin-course', courseId],
    queryFn: async () => {
      // 1. Busca Dados do Curso
      const courseSnap = await getDoc(doc(db, "courses", courseId));
      if (!courseSnap.exists()) throw new Error("Curso não encontrado");
      
      const courseData = { id: courseSnap.id, ...courseSnap.data() } as Course;

      // 2. Busca Módulos (Ordenados)
      const modulesQuery = query(collection(db, "courses", courseId, "modules"), orderBy("order", "asc"));
      const modulesSnap = await getDocs(modulesQuery);

      // 3. Busca Aulas em Paralelo (Estratégia para evitar Waterfall requests)
      const modulesWithLessons = await Promise.all(
        modulesSnap.docs.map(async (modDoc) => {
          const lessonsQuery = query(
            collection(db, "courses", courseId, "modules", modDoc.id, "lessons"), 
            orderBy("order", "asc")
          );
          const lessonsSnap = await getDocs(lessonsQuery);
          const lessons = lessonsSnap.docs.map(l => ({ id: l.id, ...l.data() } as Lesson));

          return {
            id: modDoc.id,
            ...modDoc.data(),
            lessons
          } as Module;
        })
      );

      return { course: courseData, modules: modulesWithLessons };
    },
    enabled: !!courseId,
    // Cache de 5 minutos, mas invalidado automaticamente nas mutações
    staleTime: 1000 * 60 * 5, 
    refetchOnWindowFocus: false
  });
}

// ============================================================================
// ⚡ HOOK DE ESCRITA (MUTATIONS)
// ============================================================================

export function useAdminCourseMutations(courseId: string) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const { user } = useAuth();

  // Helper para forçar recarregamento dos dados
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-course', courseId] });

  // 1. CRIAR MÓDULO (Client-Side para agilidade, pois não requer validação complexa)
  const createModule = useMutation({
    mutationFn: async ({ title, order }: { title: string, order: number }) => {
      return addDoc(collection(db, "courses", courseId, "modules"), {
        title,
        order,
        createdAt: serverTimestamp()
      });
    },
    onSuccess: () => {
      addToast("Módulo criado com sucesso!", "success");
      invalidate();
    },
    onError: () => addToast("Erro ao criar módulo.", "error")
  });

  // 2. ATUALIZAR MÓDULO (Novo - Server Action)
  const updateModule = useMutation({
    mutationFn: async ({ moduleId, title }: { moduleId: string, title: string }) => {
      if (!user) throw new Error("Sessão expirada.");
      const token = await user.getIdToken();
      
      const result = await updateModuleAction(token, courseId, moduleId, { title });
      if (!result.success) throw new Error(result.message);
    },
    onSuccess: () => {
      addToast("Módulo atualizado.", "success");
      invalidate();
    },
    onError: (err: any) => addToast(err.message || "Erro ao atualizar.", "error")
  });

  // 3. DELETAR MÓDULO (Server Action - Importante para Deep Clean dos vídeos)
  const deleteModule = useMutation({
    mutationFn: async (moduleId: string) => {
      if (!user) throw new Error("Sessão expirada.");
      const token = await user.getIdToken();

      const result = await deleteModuleAction(token, courseId, moduleId);
      if (!result.success) throw new Error(result.message);
    },
    onSuccess: () => {
      addToast("Módulo e conteúdo removidos.", "success");
      invalidate();
    },
    onError: (err: any) => addToast(err.message || "Erro ao deletar módulo.", "error")
  });

  // 4. CRIAR/EDITAR AULA (Server Action)
  const upsertLesson = useMutation({
    mutationFn: async ({ moduleId, lesson, isEdit }: { moduleId: string, lesson: Partial<Lesson>, isEdit: boolean }) => {
      if (!user) throw new Error("Sessão expirada.");
      const token = await user.getIdToken();

      const { id, ...lessonData } = lesson;
      // Casting para garantir que o Zod receba os dados corretos
      const payload = lessonData as LessonInput;

      const result = await upsertLessonAction(
        token, 
        courseId, 
        moduleId, 
        isEdit ? id : undefined, 
        payload
      );

      if (!result.success) throw new Error(result.message);
      return result;
    },
    onSuccess: (_, variables) => {
      addToast(variables.isEdit ? "Aula salva!" : "Aula criada!", "success");
      invalidate();
    },
    onError: (err: any) => {
      console.error("Erro upsertLesson:", err);
      addToast(`Erro: ${err.message}`, "error");
    }
  });

  // 5. DELETAR AULA (Server Action)
  const deleteLesson = useMutation({
    mutationFn: async ({ moduleId, lessonId }: { moduleId: string, lessonId: string }) => {
      if (!user) throw new Error("Sessão expirada.");
      const token = await user.getIdToken();

      const result = await deleteLessonAction(token, courseId, moduleId, lessonId);
      if (!result.success) throw new Error(result.message);
    },
    onSuccess: () => {
      addToast("Aula removida.", "success");
      invalidate();
    },
    onError: (err: any) => addToast(err.message || "Erro ao remover aula.", "error")
  });

  return { 
    createModule, 
    updateModule, 
    deleteModule, 
    upsertLesson, 
    deleteLesson 
  };
}