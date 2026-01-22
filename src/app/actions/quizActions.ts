// src/app/actions/quizActions.ts
"use server";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { 
  calculateLevel, 
  calculateQuizReward, 
  calculateCoinReward, 
  GAME_CONFIG 
} from "@/lib/gameRules"; 

// ... (Tipos e getQuizQuestionsAction permanecem iguais) ...

export async function getQuizQuestionsAction(courseId: string, moduleId: string): Promise<{ success: boolean; data?: any[]; message?: string }> {
    // ... Seu código de getQuizQuestionsAction (já estava ok) ...
    // Vou reescrever apenas para garantir o contexto completo se copiar/colar:
    try {
        const questionsRef = adminDb.collection("courses").doc(courseId).collection("modules").doc(moduleId).collection("questions");
        const snapshot = await questionsRef.orderBy("order", "asc").get(); 
    
        const questions = snapshot.docs.map(doc => {
          const data = doc.data();
          const optionsSanitized = (data.options || []).map((opt: any) => ({
            id: opt.id,
            text: opt.text
          }));
    
          return {
            id: doc.id,
            text: data.text,
            options: optionsSanitized
          };
        });
    
        return { success: true, data: questions };
    
      } catch (error) {
        console.error("Erro ao buscar quiz:", error);
        return { success: false, message: "Erro ao carregar a prova." };
      }
}


export async function submitQuizAction(
  token: string, 
  courseId: string, 
  moduleId: string, 
  userAnswers: Record<string, string>
) {
  try {
    // A. Validação de Identidade
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    const userRef = adminDb.collection("users").doc(userId);
    const enrollmentRef = adminDb.collection("enrollments").doc(`${userId}_${courseId}`);
    const questionsRef = adminDb.collection("courses").doc(courseId).collection("modules").doc(moduleId).collection("questions");

    // B. Buscar Gabarito Oficial
    const questionsSnap = await questionsRef.get();
    const totalQuestions = questionsSnap.size;

    if (totalQuestions === 0) throw new Error("Prova sem questões configuradas.");

    // Correção
    let correctCount = 0;
    questionsSnap.docs.forEach(doc => {
        const qData = doc.data();
        const correctOption = qData.options.find((o: any) => o.isCorrect === true);
        const userSelectedOptionId = userAnswers[doc.id];

        if (correctOption && userSelectedOptionId === correctOption.id) {
            correctCount++;
        }
    });

    const scorePercent = (correctCount / totalQuestions) * 100;
    const passed = scorePercent >= GAME_CONFIG.PASSING_SCORE; 

    // C. Transação de Banco de Dados
    const transactionResult = await adminDb.runTransaction(async (t) => {
        const userDoc = await t.get(userRef);
        let enrollmentDoc = await t.get(enrollmentRef);

        // --- CORREÇÃO: AUTO-MATRÍCULA NO QUIZ ---
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
        // ------------------------------------------
        
        const userData = userDoc.data();
        if (!userData) throw new Error("Usuário não encontrado.");

        const completedQuizzes = enrollmentData?.completedQuizzes || [];
        const alreadyCompleted = completedQuizzes.includes(moduleId);

        // SNAPSHOT 'ANTES'
        const oldXp = userData.xp || 0;
        const oldLevel = userData.level || 1;

        let xpReward = 0;
        let coinsEarned = 0;
        let newXp = oldXp;
        let newLevel = oldLevel;
        let leveledUp = false;

        if (passed && !alreadyCompleted) {
            xpReward = calculateQuizReward(correctCount, true);
            newXp = oldXp + xpReward;
            newLevel = calculateLevel(newXp);
            leveledUp = newLevel > oldLevel;

            // 1. Atualizar Matrícula
            t.set(enrollmentRef, {
                completedQuizzes: FieldValue.arrayUnion(moduleId),
                lastAccess: FieldValue.serverTimestamp()
            }, { merge: true });

            // 2. Se subiu de nível
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
            }

            // 3. Atualizar Usuário
            t.update(userRef, {
                xp: newXp,
                level: newLevel,
                "stats.quizzesCompleted": FieldValue.increment(1),
                ...(leveledUp ? {
                    "wallet.coins": FieldValue.increment(coinsEarned),
                    "wallet.totalCoinsEarned": FieldValue.increment(coinsEarned)
                } : {})
            });

            // 4. Histórico de XP
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

        return {
            oldXp, newXp, oldLevel, newLevel, leveledUp, xpReward, coinsEarned
        };
    });

    revalidatePath(`/dashboard/courses/${courseId}/learn`);
    
    return {
        success: true,
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
    };

  } catch (error: any) {
    console.error("Erro ao processar quiz:", error);
    return { success: false, message: error.message || "Erro interno ao corrigir prova." };
  }
}