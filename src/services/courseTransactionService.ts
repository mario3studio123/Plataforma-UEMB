import { db } from "@/lib/firebase";
import { runTransaction, doc, collection, serverTimestamp, increment } from "firebase/firestore";
import { LessonInput } from "@/lib/schemas/courseSchemas";

export const CourseTransactionService = {
  
  /**
   * Adiciona uma aula e atualiza os contadores do curso (Aulas e Duração)
   */
  async addLesson(courseId: string, moduleId: string, lessonData: LessonInput) {
    return await runTransaction(db, async (transaction) => {
      // Refs
      const courseRef = doc(db, "courses", courseId);
      const moduleRef = doc(db, "courses", courseId, "modules", moduleId);
      const lessonRef = doc(collection(moduleRef, "lessons")); // Novo ID automático

      // 1. Verifica se curso e módulo existem
      const courseSnap = await transaction.get(courseRef);
      if (!courseSnap.exists()) throw new Error("Curso não encontrado");

      // 2. Prepara dados da aula
      const newLesson = {
        ...lessonData,
        id: lessonRef.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // 3. OPERAÇÕES ATÔMICAS
      
      // A. Cria a aula
      transaction.set(lessonRef, newLesson);

      // B. Atualiza Curso:
      // - Incrementa contador de aulas
      // - Incrementa duração total (em SEGUNDOS)
      transaction.update(courseRef, {
        totalLessons: increment(1),
        // IMPORTANTE: Agora totalDuration no banco deve ser NUMBER (segundos), não string
        totalDurationSeconds: increment(lessonData.duration) 
      });
    });
  },

  /**
   * Atualiza uma aula. Se a duração mudar, ajusta o total do curso.
   */
  async updateLesson(courseId: string, moduleId: string, lessonId: string, newData: LessonInput, oldDuration: number) {
    return await runTransaction(db, async (transaction) => {
      const courseRef = doc(db, "courses", courseId);
      const lessonRef = doc(db, "courses", courseId, "modules", moduleId, "lessons", lessonId);

      // Diferença de tempo (Nova - Velha)
      // Ex: Era 100s, virou 120s. Diff = +20s.
      // Ex: Era 100s, virou 90s. Diff = -10s.
      const durationDiff = newData.duration - oldDuration;

      transaction.update(lessonRef, {
        ...newData,
        updatedAt: serverTimestamp()
      });

      // Só toca no curso se houve mudança de tempo
      if (durationDiff !== 0) {
        transaction.update(courseRef, {
          totalDurationSeconds: increment(durationDiff)
        });
      }
    });
  }
};