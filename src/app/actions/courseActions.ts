"use server";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";

/**
 * Registra a conclusão da aula e atribui XP de forma segura.
 */
export async function finishLessonServerAction(token: string, courseId: string, lessonId: string, xpReward: number) {
  try {
    // 1. Validação de Segurança: Verifica quem é o usuário através do Token
    // Isso garante que ninguém chame a função se passando por outro ID.
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    const enrollmentRef = adminDb.collection("enrollments").doc(`${userId}_${courseId}`);
    const userRef = adminDb.collection("users").doc(userId);

    let leveledUp = false;
    let newLevel = 1;

    // 2. Executa tudo numa Transação (Atomicidade)
    // Se falhar em qualquer parte, cancela tudo (evita dar XP se a aula não marcar como feita)
    await adminDb.runTransaction(async (transaction) => {
      const enrollmentDoc = await transaction.get(enrollmentRef);
      const userDoc = await transaction.get(userRef);

      if (!enrollmentDoc.exists) {
        throw new Error("Matrícula não encontrada.");
      }

      const enrollmentData = enrollmentDoc.data();
      const completedLessons = enrollmentData?.completedLessons || [];

      // Verifica se já completou essa aula para evitar XP infinito
      if (completedLessons.includes(lessonId)) {
        return { message: "Aula já concluída anteriormente.", alreadyDone: true };
      }

      // --- Atualiza Matrícula ---
      transaction.update(enrollmentRef, {
        completedLessons: FieldValue.arrayUnion(lessonId),
        lastAccess: FieldValue.serverTimestamp(),
        // Opcional: Aqui você poderia recalcular a % de progresso exata se buscasse o total de aulas
      });

      // --- Atualiza XP do Usuário ---
      const currentXp = userDoc.data()?.xp || 0;
      const currentLevel = userDoc.data()?.level || 1;
      const newXp = currentXp + xpReward;

      // Lógica Simples de Nível: A cada 1000 XP sobe 1 nível
      // (Você pode sofisticar essa fórmula depois)
      const calculatedLevel = Math.floor(newXp / 1000) + 1;

      if (calculatedLevel > currentLevel) {
        leveledUp = true;
        newLevel = calculatedLevel;
      }

      transaction.update(userRef, {
        xp: newXp,
        level: calculatedLevel // Atualiza o nível automaticamente
      });
    });

    // Revalida o cache da rota para atualizar a UI imediatamente
    revalidatePath(`/dashboard/courses/${courseId}/learn`);

    return { 
      success: true, 
      leveledUp, 
      newLevel,
      message: leveledUp ? `Parabéns! Você subiu para o Nível ${newLevel}!` : `Aula concluída! +${xpReward} XP`
    };

  } catch (error) {
    console.error("Erro na Server Action:", error);
    return { success: false, message: "Erro ao processar conclusão." };
  }
}