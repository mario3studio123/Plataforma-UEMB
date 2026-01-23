// src/app/actions/quizActions.ts
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
import { logger, createActionLogger } from "@/lib/errors/logger";

// Sistema de autenticação
import { authenticateRequest, type AuthenticatedUser } from "@/lib/server/auth";

// Sistema de rate limiting
import { checkRateLimit, RATE_LIMIT_CONFIGS } from "@/lib/server/rateLimit";

// Regras de gamificação
import { 
  calculateLevel, 
  calculateQuizReward, 
  calculateCoinReward, 
  GAME_CONFIG 
} from "@/lib/gameRules"; 

/**
 * ============================================================================
 * TIPOS
 * ============================================================================
 */

interface QuizQuestion {
  id: string;
  text: string;
  options: Array<{ id: string; text: string }>;
}

interface QuizSubmitResult {
  passed: boolean;
  scorePercent: number;
  correctCount: number;
  totalQuestions: number;
  xpEarned: number;
  stats: {
    oldXp: number;
    newXp: number;
    oldLevel: number;
    newLevel: number;
    leveledUp: boolean;
    coinsEarned: number;
  };
}

/**
 * ============================================================================
 * GET QUIZ QUESTIONS
 * ============================================================================
 * Busca as perguntas do quiz (sem as respostas corretas - sanitizado)
 */
export async function getQuizQuestionsAction(
  courseId: string, 
  moduleId: string
): Promise<ActionResult<QuizQuestion[]>> {
  const actionLogger = createActionLogger('getQuizQuestions');
  
  try {
    actionLogger.debug('Buscando perguntas do quiz', { courseId, moduleId });

    // Validação básica
    if (!courseId || !moduleId) {
      throw new ValidationError('Course ID e Module ID são obrigatórios');
    }

    const questionsRef = adminDb
      .collection("courses")
      .doc(courseId)
      .collection("modules")
      .doc(moduleId)
      .collection("questions");
    
    const snapshot = await questionsRef.orderBy("order", "asc").get();

    if (snapshot.empty) {
      actionLogger.warn('Quiz sem perguntas configuradas', { courseId, moduleId });
      return { 
        success: true, 
        data: [] 
      };
    }

    // Sanitiza as perguntas (remove isCorrect das opções)
    const questions: QuizQuestion[] = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        text: data.text,
        options: (data.options || []).map((opt: { id: string; text: string }) => ({
          id: opt.id,
          text: opt.text
          // NÃO inclui isCorrect aqui!
        }))
      };
    });

    actionLogger.info('Perguntas carregadas com sucesso', { 
      courseId, 
      moduleId, 
      count: questions.length 
    });

    return { success: true, data: questions };

  } catch (error) {
    actionLogger.error('Erro ao buscar quiz', error, { courseId, moduleId });
    return handleActionError(error);
  }
}

/**
 * ============================================================================
 * SUBMIT QUIZ
 * ============================================================================
 * Processa a submissão do quiz com todas as regras de gamificação
 */
export async function submitQuizAction(
  token: string, 
  courseId: string, 
  moduleId: string, 
  userAnswers: Record<string, string>
): Promise<ActionResult<QuizSubmitResult> & { message?: string }> {
  const actionLogger = createActionLogger('submitQuiz');
  
  try {
    // 1. AUTENTICAÇÃO
    const { user } = await authenticateRequest(token);
    const userId = user.uid;
    
    actionLogger.debug('Quiz submit iniciado', { userId, courseId, moduleId });

    // 2. RATE LIMITING
    checkRateLimit(RATE_LIMIT_CONFIGS.QUIZ, userId);

    // 3. VALIDAÇÃO
    if (!courseId || !moduleId) {
      throw new ValidationError('Course ID e Module ID são obrigatórios');
    }

    if (!userAnswers || Object.keys(userAnswers).length === 0) {
      throw new ValidationError('Respostas não fornecidas');
    }

    // 4. BUSCA O GABARITO OFICIAL
    const questionsRef = adminDb
      .collection("courses")
      .doc(courseId)
      .collection("modules")
      .doc(moduleId)
      .collection("questions");
    
    const questionsSnap = await questionsRef.get();
    const totalQuestions = questionsSnap.size;

    if (totalQuestions === 0) {
      throw new NotFoundError('Prova sem questões configuradas');
    }

    // 5. CORREÇÃO DAS RESPOSTAS
    let correctCount = 0;
    questionsSnap.docs.forEach(doc => {
      const qData = doc.data();
      const correctOption = qData.options.find((o: { isCorrect: boolean }) => o.isCorrect === true);
      const userSelectedOptionId = userAnswers[doc.id];

      if (correctOption && userSelectedOptionId === correctOption.id) {
        correctCount++;
      }
    });

    const scorePercent = (correctCount / totalQuestions) * 100;
    const passed = scorePercent >= GAME_CONFIG.PASSING_SCORE;

    actionLogger.info('Quiz corrigido', { 
      userId, 
      courseId, 
      moduleId,
      score: scorePercent,
      passed 
    });

    // 6. TRANSAÇÃO DE BANCO DE DADOS
    const userRef = adminDb.collection("users").doc(userId);
    const enrollmentRef = adminDb.collection("enrollments").doc(`${userId}_${courseId}`);

    const transactionResult = await adminDb.runTransaction(async (t) => {
      const userDoc = await t.get(userRef);
      const enrollmentDoc = await t.get(enrollmentRef);

      // Auto-matrícula se não existir
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
      
      const userData = userDoc.data();
      if (!userData) {
        throw new NotFoundError('Perfil do usuário');
      }

      const completedQuizzes = enrollmentData?.completedQuizzes || [];
      const alreadyCompleted = completedQuizzes.includes(moduleId);

      // Snapshot 'antes'
      const oldXp = userData.xp || 0;
      const oldLevel = userData.level || 1;

      let xpReward = 0;
      let coinsEarned = 0;
      let newXp = oldXp;
      let newLevel = oldLevel;
      let leveledUp = false;

      // Só dá recompensa se passou E não havia completado antes
      if (passed && !alreadyCompleted) {
        xpReward = calculateQuizReward(correctCount, true);
        newXp = oldXp + xpReward;
        newLevel = calculateLevel(newXp);
        leveledUp = newLevel > oldLevel;

        // Atualiza matrícula
        t.set(enrollmentRef, {
          completedQuizzes: FieldValue.arrayUnion(moduleId),
          lastAccess: FieldValue.serverTimestamp()
        }, { merge: true });

        // Se subiu de nível
        if (leveledUp) {
          coinsEarned = calculateCoinReward(newLevel);
          const coinHistoryRef = adminDb.collection("coin_history").doc();
          t.set(coinHistoryRef, {
            userId,
            amount: coinsEarned,
            type: 'level_up',
            description: `Recompensa Nível ${newLevel}`,
            createdAt: FieldValue.serverTimestamp(),
            metadata: { levelReached: newLevel }
          });

          actionLogger.info('Usuário subiu de nível!', { 
            userId, 
            oldLevel, 
            newLevel, 
            coinsEarned 
          });
        }

        // Atualiza usuário
        t.update(userRef, {
          xp: newXp,
          level: newLevel,
          "stats.quizzesCompleted": FieldValue.increment(1),
          ...(leveledUp ? {
            "wallet.coins": FieldValue.increment(coinsEarned),
            "wallet.totalCoinsEarned": FieldValue.increment(coinsEarned)
          } : {})
        });

        // Histórico de XP
        const xpHistoryRef = adminDb.collection("xp_history").doc();
        t.set(xpHistoryRef, {
          userId,
          action: "quiz_completed",
          description: `Aprovação no Módulo (${scorePercent.toFixed(0)}%)`,
          xpAmount: xpReward,
          createdAt: FieldValue.serverTimestamp(),
          metadata: { courseId, moduleId }
        });
      }

      return { oldXp, newXp, oldLevel, newLevel, leveledUp, xpReward, coinsEarned };
    });

    // 7. REVALIDAÇÃO DE CACHE
    revalidatePath(`/dashboard/courses/${courseId}/learn`);

    // 8. RETORNO
    return {
      success: true,
      data: {
        passed,
        scorePercent,
        correctCount,
        totalQuestions,
        xpEarned: transactionResult.xpReward,
        stats: {
          oldXp: transactionResult.oldXp,
          newXp: transactionResult.newXp,
          oldLevel: transactionResult.oldLevel,
          newLevel: transactionResult.newLevel,
          leveledUp: transactionResult.leveledUp,
          coinsEarned: transactionResult.coinsEarned
        }
      }
    };

  } catch (error) {
    actionLogger.error('Erro ao processar quiz', error, { courseId, moduleId });
    
    // Retorna no formato esperado pelo frontend atual (compatibilidade)
    const result = handleActionError(error);
    return {
      ...result,
      message: result.success === false ? result.error.message : undefined
    };
  }
}