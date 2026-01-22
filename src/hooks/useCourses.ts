// src/hooks/useCourses.ts
import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, query, orderBy, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Course, Module, Lesson } from "@/types";
import { SyllabusModule } from "@/lib/schemas/courseSchemas";

// --- HOOK: Listar todos os cursos (Para o Dashboard) ---
export function useCourses() {
  return useQuery({
    queryKey: ['courses'],
    queryFn: async () => {
      const q = query(collection(db, "courses"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Course[];
    },
    staleTime: 1000 * 60 * 10, // 10 min cache
  });
}

/**
 * ⚡ HOOK OTIMIZADO: useCourseContent
 * Estratégia "Syllabus First": Tenta ler o JSON do documento pai.
 * Se não existir, faz o fallback para a leitura de subcoleções (N+1).
 */
export function useCourseContent(courseId: string) {
  return useQuery({
    queryKey: ['course', courseId, 'content'],
    queryFn: async () => {
      // 1. Busca APENAS o documento do curso (Leitura Única)
      const courseSnap = await getDoc(doc(db, "courses", courseId));
      
      if (!courseSnap.exists()) throw new Error("Curso não encontrado");
      
      const courseData = { id: courseSnap.id, ...courseSnap.data() } as Course;

      // 2. VERIFICAÇÃO DE SYLLABUS (A Otimização)
      // Se tiver syllabus preenchido, usamos ele e evitamos ler as subcoleções!
      if (courseData.syllabus && courseData.syllabus.length > 0) {
        console.log("⚡ [Cache] Usando Syllabus do Curso (1 leitura)");
        
        // Mapeia o formato SyllabusModule -> Module (Compatível com UI)
        const modulesFromSyllabus: Module[] = courseData.syllabus.map((syllMod: SyllabusModule, index: number) => ({
          id: syllMod.id,
          title: syllMod.title,
          order: index, // A ordem é a do array
          lessons: syllMod.lessons.map((syllLesson, lIndex) => ({
            id: syllLesson.id,
            title: syllLesson.title,
            duration: syllLesson.duration, // Já é number (segundos)
            order: lIndex,
            xpReward: 50, // Valor padrão pois syllabus é leve (pode ser ajustado no schema depois)
            videoUrl: "", // ⚠️ IMPORTANTE: O Player deve usar useLesson() para pegar a URL se ela não estiver aqui
            description: "",
            freePreview: syllLesson.freePreview
          } as Lesson))
        }));

        return { course: courseData, modules: modulesFromSyllabus };
      }

      // 3. FALLBACK (Modo Legado: N+1 Leituras)
      // Executa apenas se o curso não foi salvo com o novo sistema admin
      console.warn("🐢 [Legado] Syllabus não encontrado. Lendo subcoleções (lento)...");
      
      const modulesRef = collection(db, "courses", courseId, "modules");
      const modulesQuery = query(modulesRef, orderBy("order", "asc"));
      const modulesSnap = await getDocs(modulesQuery);

      const modulesWithLessons = await Promise.all(
        modulesSnap.docs.map(async (modDoc) => {
          const modData = modDoc.data();
          const lessonsRef = collection(db, "courses", courseId, "modules", modDoc.id, "lessons");
          const lessonsQuery = query(lessonsRef, orderBy("order", "asc"));
          const lessonsSnap = await getDocs(lessonsQuery);
          
          const lessons = lessonsSnap.docs.map(l => {
            const lData = l.data();
            // Compatibilidade de duração (se for string legado)
            const dur = typeof lData.duration === 'number' ? lData.duration : 0;
            
            return { 
              id: l.id, 
              ...lData,
              duration: dur 
            } as Lesson;
          });

          return {
            id: modDoc.id,
            title: modData.title,
            order: modData.order,
            lessons: lessons
          } as Module;
        })
      );
      
      // Ordenação extra de segurança
      modulesWithLessons.sort((a, b) => a.order - b.order);

      return { course: courseData, modules: modulesWithLessons };
    },
    enabled: !!courseId,
    staleTime: 1000 * 60 * 60, // 1 hora de cache (Estrutura muda pouco)
    refetchOnWindowFocus: false
  });
}

/**
 * 🎥 HOOK DE DETALHE (Lazy Loading)
 * Busca os dados pesados (Video URL, Descrição completa) de uma aula específica.
 * Usado pelo Player quando o Syllabus não fornece a URL.
 */
export function useLesson(courseId: string, moduleId: string | null, lessonId: string | undefined) {
  return useQuery({
    queryKey: ['lesson', courseId, moduleId, lessonId],
    queryFn: async () => {
      if (!moduleId || !lessonId) return null;
      
      const lessonRef = doc(db, "courses", courseId, "modules", moduleId, "lessons", lessonId);
      const lessonSnap = await getDoc(lessonRef);
      
      if (!lessonSnap.exists()) return null;
      
      const data = lessonSnap.data();
      // Retorna tipado com fallback de duração numérica
      return { 
        id: lessonSnap.id, 
        ...data,
        duration: typeof data.duration === 'number' ? data.duration : 0 
      } as Lesson;
    },
    enabled: !!courseId && !!moduleId && !!lessonId,
    staleTime: 1000 * 60 * 30, // 30 min
  });
}