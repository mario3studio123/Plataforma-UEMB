// src/app/actions/courseActions.ts
"use server";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { calculateLevel, calculateCoinReward, GAME_CONFIG } from "@/lib/gameRules";

export async function finishLessonServerAction(token: string, courseId: string, moduleId: string, lessonId: string) {
  try {
    // 1. Validação de Token
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // 2. Referências
    const courseRef = adminDb.collection("courses").doc(courseId);
    const enrollmentRef = adminDb.collection("enrollments").doc(`${userId}_${courseId}`);
    const userRef = adminDb.collection("users").doc(userId);
    const lessonRef = courseRef.collection("modules").doc(moduleId).collection("lessons").doc(lessonId);

    // 3. Transação Atômica
    const result = await adminDb.runTransaction(async (t) => {
      // Leituras (DEVEM vir antes das escritas)
      const lessonDoc = await t.get(lessonRef);
      const userDoc = await t.get(userRef);
      const courseDoc = await t.get(courseRef);
      let enrollmentDoc = await t.get(enrollmentRef); // Note o 'let'

      if (!lessonDoc.exists) throw new Error("Aula não encontrada.");
      
      // --- CORREÇÃO DE OURO: AUTO-MATRÍCULA (Server-Side) ---
      let enrollmentData = enrollmentDoc.data();

      if (!enrollmentDoc.exists) {
        // Se a matrícula não existe, preparamos o objeto inicial
        const initialEnrollmentData = {
            userId,
            courseId,
            progress: 0,
            completedLessons: [],
            completedQuizzes: [],
            status: "active",
            lastAccess: FieldValue.serverTimestamp(),
            createdAt: FieldValue.serverTimestamp()
        };
        
        // Criamos dentro da transação para garantir existência
        t.set(enrollmentRef, initialEnrollmentData);
        
        // Atualizamos a variável local para o código abaixo usar
        enrollmentData = initialEnrollmentData; 
      }
      // -------------------------------------------------------

      const userData = userDoc.data();
      if (!userData) throw new Error("Usuário não encontrado.");

      const completedLessons = enrollmentData?.completedLessons || [];

      // A. Evita processar se já completou
      if (completedLessons.includes(lessonId)) {
        return { success: false, reason: "already_completed" };
      }

      // B. Dados para Recompensa e Progresso
      const lessonData = lessonDoc.data();
      const courseData = courseDoc.data();
      const xpReward = lessonData?.xpReward || GAME_CONFIG.REWARDS.BASE_LESSON_XP;
      
      const newCompletedList = [...completedLessons, lessonId];
      const totalLessons = courseData?.totalLessons || 1; // Evita divisão por zero
      const newProgress = Math.min(Math.round((newCompletedList.length / totalLessons) * 100), 100);

      // C. Atualiza Matrícula (Com merge true para segurança)
      t.set(enrollmentRef, {
        completedLessons: FieldValue.arrayUnion(lessonId),
        lastAccess: FieldValue.serverTimestamp(),
        progress: newProgress,
        status: newProgress === 100 ? "completed" : "active",
        completedAt: newProgress === 100 ? FieldValue.serverTimestamp() : null
      }, { merge: true });

      // D. Lógica de Nível e Moedas
      const currentXp = userData.xp || 0;
      const currentLevel = userData.level || 1;

      const newXp = currentXp + xpReward;
      const newLevel = calculateLevel(newXp);
      const leveledUp = newLevel > currentLevel;

      let coinsEarned = 0;

      if (leveledUp) {
        coinsEarned = calculateCoinReward(newLevel);
        
        const coinHistoryRef = adminDb.collection("coin_history").doc();
        t.set(coinHistoryRef, {
            userId,
            amount: coinsEarned,
            type: 'level_up',
            description: `Recompensa por alcançar o Nível ${newLevel}`,
            createdAt: FieldValue.serverTimestamp(),
            metadata: { levelReached: newLevel }
        });
      }

      // Atualiza Usuário
      t.update(userRef, {
        xp: newXp,
        level: newLevel,
        "stats.lessonsCompleted": FieldValue.increment(1),
        ...(leveledUp ? {
            "wallet.coins": FieldValue.increment(coinsEarned),
            "wallet.totalCoinsEarned": FieldValue.increment(coinsEarned)
        } : {})
      });

      // E. Histórico de XP
      const xpHistoryRef = adminDb.collection("xp_history").doc();
      t.set(xpHistoryRef, {
        userId,
        action: "lesson_completed",
        description: `Conclusão: ${lessonData?.title || 'Aula'}`,
        xpAmount: xpReward,
        createdAt: FieldValue.serverTimestamp(),
        metadata: { courseId, lessonId }
      });

      return { success: true, leveledUp, newLevel, xpReward, coinsEarned };
    });

    if (!result.success && result.reason === "already_completed") {
      return { success: false, message: "Aula já concluída." };
    }

    revalidatePath(`/dashboard/courses/${courseId}/learn`);
    revalidatePath(`/dashboard`); 

    // CORREÇÃO AQUI: Use 'result.xpReward' em vez de 'result.xpEarned'
    let message = `Aula concluída! +${result.xpReward} XP`; 
    
    if (result.leveledUp) {
        // Certifique-se que coinsEarned está sendo retornado na transação lá em cima
        message = `SUBIU DE NÍVEL! Lvl ${result.newLevel} (+${result.coinsEarned} Moedas)`;
    }

    return { 
      success: true, 
      leveledUp: result.leveledUp, 
      newLevel: result.newLevel,
      // Aqui mapeamos o valor interno (xpReward) para o nome externo (xpEarned)
      xpEarned: result.xpReward, 
      coinsEarned: result.coinsEarned,
      message
    };

  } catch (error) {
    console.error("Erro na Server Action:", error);
    return { success: false, message: "Erro ao processar conclusão." };
  }
}