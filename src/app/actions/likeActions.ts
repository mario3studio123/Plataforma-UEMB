"use server";

import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { authenticateRequest } from "@/lib/server/auth";
import { handleActionError, type ActionResult } from "@/lib/errors";
import { createActionLogger } from "@/lib/errors/logger";

/**
 * ============================================================================
 * TIPOS
 * ============================================================================
 */

interface LikeResult {
  liked: boolean;
  totalLikes: number;
}

interface LessonLikesResult {
  userLiked: boolean;
  totalLikes: number;
}

/**
 * ============================================================================
 * TOGGLE LIKE - Adiciona ou remove like de uma aula
 * ============================================================================
 */
export async function toggleLessonLikeAction(
  token: string,
  courseId: string,
  moduleId: string,
  lessonId: string
): Promise<ActionResult<LikeResult>> {
  const actionLogger = createActionLogger('toggleLessonLike');

  try {
    // 1. AUTENTICAÇÃO
    const { user } = await authenticateRequest(token);
    const userId = user.uid;

    actionLogger.debug('Toggle like iniciado', { userId, courseId, moduleId, lessonId });

    // 2. REFERÊNCIAS
    const lessonRef = adminDb
      .collection("courses")
      .doc(courseId)
      .collection("modules")
      .doc(moduleId)
      .collection("lessons")
      .doc(lessonId);

    const userLikeRef = adminDb
      .collection("lesson_likes")
      .doc(`${userId}_${lessonId}`);

    // 3. TRANSAÇÃO ATÔMICA
    const result = await adminDb.runTransaction(async (t) => {
      const lessonDoc = await t.get(lessonRef);
      const userLikeDoc = await t.get(userLikeRef);

      if (!lessonDoc.exists) {
        throw new Error("Aula não encontrada");
      }

      const currentLikes = lessonDoc.data()?.likes || 0;
      const userAlreadyLiked = userLikeDoc.exists;

      if (userAlreadyLiked) {
        // Remove o like
        t.delete(userLikeRef);
        t.update(lessonRef, {
          likes: Math.max(0, currentLikes - 1)
        });

        return {
          liked: false,
          totalLikes: Math.max(0, currentLikes - 1)
        };
      } else {
        // Adiciona o like
        t.set(userLikeRef, {
          userId,
          lessonId,
          courseId,
          moduleId,
          createdAt: FieldValue.serverTimestamp()
        });
        t.update(lessonRef, {
          likes: currentLikes + 1
        });

        return {
          liked: true,
          totalLikes: currentLikes + 1
        };
      }
    });

    actionLogger.info('Like toggled', { userId, lessonId, liked: result.liked });

    return { success: true, data: result };

  } catch (error) {
    actionLogger.error('Erro ao toggle like', error, { courseId, moduleId, lessonId });
    return handleActionError(error);
  }
}

/**
 * ============================================================================
 * GET LESSON LIKES - Busca likes de uma aula e se o usuário curtiu
 * ============================================================================
 */
export async function getLessonLikesAction(
  token: string,
  courseId: string,
  moduleId: string,
  lessonId: string
): Promise<ActionResult<LessonLikesResult>> {
  const actionLogger = createActionLogger('getLessonLikes');

  try {
    // 1. AUTENTICAÇÃO
    const { user } = await authenticateRequest(token);
    const userId = user.uid;

    // 2. BUSCAR DADOS
    const lessonRef = adminDb
      .collection("courses")
      .doc(courseId)
      .collection("modules")
      .doc(moduleId)
      .collection("lessons")
      .doc(lessonId);

    const userLikeRef = adminDb
      .collection("lesson_likes")
      .doc(`${userId}_${lessonId}`);

    const [lessonDoc, userLikeDoc] = await Promise.all([
      lessonRef.get(),
      userLikeRef.get()
    ]);

    const totalLikes = lessonDoc.data()?.likes || 0;
    const userLiked = userLikeDoc.exists;

    return {
      success: true,
      data: {
        userLiked,
        totalLikes
      }
    };

  } catch (error) {
    actionLogger.error('Erro ao buscar likes', error, { courseId, moduleId, lessonId });
    return handleActionError(error);
  }
}
