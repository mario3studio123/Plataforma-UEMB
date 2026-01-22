import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc, arrayUnion, increment, serverTimestamp } from "firebase/firestore";

/**
 * Cria a matrícula do aluno em um curso se não existir.
 * Retorna o ID da matrícula.
 */
export async function enrollStudent(userId: string, courseId: string) {
  const enrollmentId = `${userId}_${courseId}`; // ID composto único
  const enrollmentRef = doc(db, "enrollments", enrollmentId);
  const enrollmentSnap = await getDoc(enrollmentRef);

  if (enrollmentSnap.exists()) {
    return enrollmentId; // Já está matriculado
  }

  // Cria nova matrícula
  await setDoc(enrollmentRef, {
    userId,
    courseId,
    progress: 0, // Porcentagem 0-100
    completedLessons: [], // Array de IDs das aulas concluídas
    lastAccess: serverTimestamp(),
    status: "active" // active, completed
  });

  return enrollmentId;
}