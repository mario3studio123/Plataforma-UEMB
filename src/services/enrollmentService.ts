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

/**
 * Marca uma aula como concluída e atribui XP ao usuário.
 * Essa função deve ser chamada quando o vídeo termina ou o quiz é passado.
 */
export async function completeLesson(userId: string, courseId: string, lessonId: string, xpReward: number = 50) {
  const enrollmentId = `${userId}_${courseId}`;
  const enrollmentRef = doc(db, "enrollments", enrollmentId);
  const userRef = doc(db, "users", userId);

  // 1. Atualiza a matrícula
  await updateDoc(enrollmentRef, {
    completedLessons: arrayUnion(lessonId),
    lastAccess: serverTimestamp()
    // Nota: O cálculo da % de progresso idealmente deve ser feito aqui 
    // sabendo o total de aulas, ou via Cloud Function.
  });

  // 2. Dá o XP para o usuário (Gamificação!)
  // O updateDoc é seguro e atômico com 'increment'
  await updateDoc(userRef, {
    xp: increment(xpReward)
  });
  
  // TODO: Verificar se subiu de nível (pode ser feito aqui ou no backend)
}