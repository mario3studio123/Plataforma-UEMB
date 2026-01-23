"use server";

import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

// Sistema de erros e logging
import { 
  ValidationError,
  handleActionError,
  type ActionResult 
} from "@/lib/errors";
import { createActionLogger } from "@/lib/errors/logger";

// Sistema de autenticação
import { authenticateRequest } from "@/lib/server/auth";

// Sistema de rate limiting
import { checkRateLimit, RATE_LIMIT_CONFIGS } from "@/lib/server/rateLimit";

/**
 * ============================================================================
 * TIPOS
 * ============================================================================
 */

interface ProgressPayload {
  courseId: string;
  lessonId: string;
  secondsWatched: number;
  totalDuration: number;
}

interface ProgressResult {
  saved: boolean;
  isVirtuallyComplete: boolean;
}

/**
 * ============================================================================
 * VALIDAÇÃO
 * ============================================================================
 */

function validateProgressPayload(payload: ProgressPayload): void {
  if (!payload.courseId) {
    throw new ValidationError('Course ID é obrigatório', { courseId: 'Obrigatório' });
  }
  if (!payload.lessonId) {
    throw new ValidationError('Lesson ID é obrigatório', { lessonId: 'Obrigatório' });
  }
  if (typeof payload.secondsWatched !== 'number' || payload.secondsWatched < 0) {
    throw new ValidationError('secondsWatched deve ser um número positivo', { secondsWatched: 'Inválido' });
  }
  if (typeof payload.totalDuration !== 'number' || payload.totalDuration <= 0) {
    throw new ValidationError('totalDuration deve ser um número positivo', { totalDuration: 'Inválido' });
  }
}

/**
 * ============================================================================
 * SAVE VIDEO PROGRESS ACTION
 * ============================================================================
 * Salva o progresso de visualização de um vídeo.
 * Usa debounce no cliente para evitar chamadas excessivas.
 */
export async function saveVideoProgressAction(
  token: string, 
  payload: ProgressPayload
): Promise<ActionResult<ProgressResult>> {
  const actionLogger = createActionLogger('saveVideoProgress');
  
  try {
    // 1. AUTENTICAÇÃO
    const { user } = await authenticateRequest(token);
    const userId = user.uid;

    // 2. RATE LIMITING (mais permissivo para progresso)
    checkRateLimit(RATE_LIMIT_CONFIGS.PROGRESS, userId);

    // 3. VALIDAÇÃO
    validateProgressPayload(payload);

    const { courseId, lessonId, secondsWatched, totalDuration } = payload;

    // 4. CÁLCULO
    const percentage = (secondsWatched / totalDuration) * 100;
    const isVirtuallyComplete = percentage >= 90;

    // 5. ATUALIZAÇÃO NO FIRESTORE
    const enrollmentRef = adminDb.collection("enrollments").doc(`${userId}_${courseId}`);

    await enrollmentRef.update({
      [`progressData.${lessonId}`]: {
        secondsWatched,
        totalDuration,
        percentage: Math.round(percentage),
        isVirtuallyComplete,
        lastUpdated: FieldValue.serverTimestamp(),
      },
      lastAccess: FieldValue.serverTimestamp()
    });

    actionLogger.debug('Progresso salvo', { 
      userId, 
      courseId, 
      lessonId, 
      percentage: Math.round(percentage) 
    });

    return { 
      success: true, 
      data: { saved: true, isVirtuallyComplete } 
    };

  } catch (error) {
    actionLogger.error('Erro ao salvar progresso', error);
    return handleActionError(error);
  }
}

/**
 * ============================================================================
 * GET VIDEO PROGRESS ACTION
 * ============================================================================
 * Busca o progresso salvo de um vídeo específico.
 */
export async function getVideoProgressAction(
  token: string, 
  courseId: string, 
  lessonId: string
): Promise<ActionResult<{ secondsWatched: number; percentage: number } | null>> {
  const actionLogger = createActionLogger('getVideoProgress');
  
  try {
    // 1. AUTENTICAÇÃO
    const { user } = await authenticateRequest(token);
    const userId = user.uid;

    // 2. BUSCA
    const enrollmentRef = adminDb.collection("enrollments").doc(`${userId}_${courseId}`);
    const enrollmentDoc = await enrollmentRef.get();

    if (!enrollmentDoc.exists) {
      return { success: true, data: null };
    }

    const data = enrollmentDoc.data();
    const progressData = data?.progressData?.[lessonId];

    if (!progressData) {
      return { success: true, data: null };
    }

    return { 
      success: true, 
      data: {
        secondsWatched: progressData.secondsWatched || 0,
        percentage: progressData.percentage || 0
      }
    };

  } catch (error) {
    actionLogger.error('Erro ao buscar progresso', error, { courseId, lessonId });
    return handleActionError(error);
  }
}