// src/app/actions/courseActions.ts
"use server";

import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";

// Sistema de erros e logging
import { 
  NotFoundError,
  ValidationError,
  handleActionError,
  type ActionResult 
} from "@/lib/errors";
import { createActionLogger } from "@/lib/errors/logger";

// Sistema de autenticação
import { authenticateRequest } from "@/lib/server/auth";

// Sistema de rate limiting
import { checkRateLimit, RATE_LIMIT_CONFIGS } from "@/lib/server/rateLimit";

// Gamificação
import { calculateLevel, calculateCoinReward, GAME_CONFIG } from "@/lib/gameRules";

/**
 * ============================================================================
 * TIPOS INTERNOS
 * ============================================================================
 */

// Define o formato de retorno esperado pelo Frontend (dentro de data)
interface FinishLessonResult {
  leveledUp: boolean;
  newLevel: number;
  xpEarned: number;
  coinsEarned: number;
  newProgress: number;
  message: string;
}

// 🔥 NOVO: Define exatamente o que a transação pode retornar (Discriminated Union)
type TransactionResult = 
  | { 
      success: true; 
      leveledUp: boolean; 
      newLevel: number; 
      xpReward: number; 
      coinsEarned: number; 
      newProgress: number; 
      lessonTitle: string; 
    }
  | { 
      success: false; 
      alreadyCompleted: true; 
      currentProgress: number; 
    };

/**
 * ============================================================================
 * FINISH LESSON SERVER ACTION
 * ============================================================================
 */
export async function finishLessonServerAction(
  token: string, 
  courseId: string, 
  moduleId: string, 
  lessonId: string
): Promise<ActionResult<FinishLessonResult> & { 
  // Campos extras para compatibilidade com o frontend antigo
  leveledUp?: boolean;
  newLevel?: number;
  xpEarned?: number;
  coinsEarned?: number;
  message?: string;
}> {
  const actionLogger = createActionLogger('finishLesson');
  
  try {
    // 1. AUTENTICAÇÃO
    const { user } = await authenticateRequest(token);
    const userId = user.uid;

    actionLogger.debug('Iniciando conclusão de aula', { userId, courseId, moduleId, lessonId });

    // 2. RATE LIMITING
    checkRateLimit(RATE_LIMIT_CONFIGS.DEFAULT, userId);

    // 3. VALIDAÇÃO
    if (!courseId || !moduleId || !lessonId) {
      throw new ValidationError('IDs obrigatórios não fornecidos');
    }

    // 4. REFERÊNCIAS
    const courseRef = adminDb.collection("courses").doc(courseId);
    const enrollmentRef = adminDb.collection("enrollments").doc(`${userId}_${courseId}`);
    const userRef = adminDb.collection("users").doc(userId);
    const lessonRef = courseRef.collection("modules").doc(moduleId).collection("lessons").doc(lessonId);

    // 5. TRANSAÇÃO ATÔMICA (Tipada com TransactionResult)
    const result = await adminDb.runTransaction<TransactionResult>(async (t) => {
      // Leituras (DEVEM vir antes das escritas)
      const lessonDoc = await t.get(lessonRef);
      const userDoc = await t.get(userRef);
      const courseDoc = await t.get(courseRef);
      const enrollmentDoc = await t.get(enrollmentRef);

      if (!lessonDoc.exists) throw new NotFoundError('Aula');
      if (!userDoc.exists) throw new NotFoundError('Usuário');

      // Auto-matrícula se necessário
      let enrollmentData = enrollmentDoc.data();

      if (!enrollmentDoc.exists) {
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
        
        t.set(enrollmentRef, initialEnrollmentData);
        enrollmentData = initialEnrollmentData;
      }

      const userData = userDoc.data()!;
      const completedLessons = enrollmentData?.completedLessons || [];

      // Evita processar se já completou
      if (completedLessons.includes(lessonId)) {
        return { 
          success: false, 
          alreadyCompleted: true,
          currentProgress: enrollmentData?.progress || 0
        };
      }

      // Dados para Recompensa e Progresso
      const lessonData = lessonDoc.data()!;
      const courseData = courseDoc.data();
      const xpReward = lessonData.xpReward || GAME_CONFIG.REWARDS.BASE_LESSON_XP;
      
      const newCompletedList = [...completedLessons, lessonId];
      const totalLessons = courseData?.totalLessons || 1;
      const newProgress = Math.min(Math.round((newCompletedList.length / totalLessons) * 100), 100);

      // Atualiza Matrícula
      t.set(enrollmentRef, {
        completedLessons: FieldValue.arrayUnion(lessonId),
        lastAccess: FieldValue.serverTimestamp(),
        progress: newProgress,
        status: newProgress === 100 ? "completed" : "active",
        completedAt: newProgress === 100 ? FieldValue.serverTimestamp() : null
      }, { merge: true });

      // Lógica de Nível e Moedas
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

        actionLogger.info('Usuário subiu de nível!', { userId, newLevel, coinsEarned });
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

      // Histórico de XP
      const xpHistoryRef = adminDb.collection("xp_history").doc();
      t.set(xpHistoryRef, {
        userId,
        action: "lesson_completed",
        description: `Conclusão: ${lessonData.title || 'Aula'}`,
        xpAmount: xpReward,
        createdAt: FieldValue.serverTimestamp(),
        metadata: { courseId, moduleId, lessonId }
      });

      return { 
        success: true, 
        leveledUp, 
        newLevel, 
        xpReward, 
        coinsEarned, 
        newProgress,
        lessonTitle: lessonData.title
      };
    });

    // 6. RESULTADO (Agora o TypeScript entende o fluxo)
    if (!result.success) {
      // Como verificamos !result.success, o TS sabe que é o objeto de "erro"
      return { 
        success: true,
        data: {
          leveledUp: false,
          newLevel: 0,
          xpEarned: 0,
          coinsEarned: 0,
          newProgress: result.currentProgress || 0,
          message: "Aula já concluída anteriormente."
        },
        leveledUp: false,
        xpEarned: 0,
        message: "Aula já concluída anteriormente."
      };
    }

    // 7. REVALIDAÇÃO DE CACHE
    revalidatePath(`/dashboard/courses/${courseId}/learn`);
    revalidatePath(`/dashboard`);

    // 8. MENSAGEM DE FEEDBACK
    // Aqui o TS sabe que 'result' é o objeto de SUCESSO, então xpReward existe
    let message = `Aula concluída! +${result.xpReward} XP`;
    if (result.leveledUp) {
      message = `SUBIU DE NÍVEL! Lvl ${result.newLevel} (+${result.coinsEarned} Moedas)`;
    }

    actionLogger.info('Aula concluída com sucesso', { 
      userId, 
      lessonId, 
      xpEarned: result.xpReward, 
      leveledUp: result.leveledUp 
    });

    return { 
      success: true,
      data: {
        leveledUp: result.leveledUp,
        newLevel: result.newLevel,
        xpEarned: result.xpReward, // Mapeado corretamente
        coinsEarned: result.coinsEarned,
        newProgress: result.newProgress,
        message
      },
      // Campos extras
      leveledUp: result.leveledUp,
      newLevel: result.newLevel,
      xpEarned: result.xpReward,
      coinsEarned: result.coinsEarned,
      message
    };

  } catch (error) {
    actionLogger.error('Erro ao concluir aula', error, { courseId, moduleId, lessonId });
    
    const result = handleActionError(error);
    return {
      ...result,
      message: result.success === false ? result.error.message : undefined
    };
  }
}