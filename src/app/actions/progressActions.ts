"use server";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

interface ProgressPayload {
  courseId: string;
  lessonId: string;
  secondsWatched: number;
  totalDuration: number;
}

export async function saveVideoProgressAction(token: string, payload: ProgressPayload) {
  try {
    // 1. Validar Token (Segurança)
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    const { courseId, lessonId, secondsWatched, totalDuration } = payload;
    const enrollmentRef = adminDb.collection("enrollments").doc(`${userId}_${courseId}`);

    const percentage = (secondsWatched / totalDuration) * 100;
    const isVirtuallyComplete = percentage >= 90;

    await enrollmentRef.update({
      [`progressData.${lessonId}`]: {
        secondsWatched: secondsWatched,
        totalDuration: totalDuration,
        lastUpdated: FieldValue.serverTimestamp(),
      },
      lastAccess: FieldValue.serverTimestamp()
    });

    return { success: true };

  } catch (error) {
    console.error("Erro ao salvar progresso:", error);
    return { success: false };
  }
}