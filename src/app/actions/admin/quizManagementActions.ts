"use server";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { QuizQuestionSchema, QuizQuestionInput } from "@/lib/schemas/courseSchemas";

async function assertAdmin(token: string) {
  const decoded = await adminAuth.verifyIdToken(token);
  // Pode adicionar checagem de role no banco aqui se quiser dupla segurança
}

export async function upsertQuestionAction(
  token: string,
  courseId: string, 
  moduleId: string, 
  questionId: string | null,
  payload: QuizQuestionInput
) {
  try {
    await assertAdmin(token);

    // Validação Zod
    const validation = QuizQuestionSchema.safeParse(payload);
    if (!validation.success) return { success: false, message: "Dados inválidos." };

    const questionsRef = adminDb.collection("courses").doc(courseId)
      .collection("modules").doc(moduleId)
      .collection("questions");

    const data = {
      ...validation.data,
      updatedAt: FieldValue.serverTimestamp()
    };

    if (questionId) {
      await questionsRef.doc(questionId).update(data);
    } else {
      await questionsRef.add({
        ...data,
        createdAt: FieldValue.serverTimestamp()
      });
    }

    revalidatePath(`/dashboard/admin/courses/${courseId}/manage`);
    return { success: true };

  } catch (error) {
    console.error("Erro no quiz:", error);
    return { success: false, message: "Erro ao salvar questão." };
  }
}

export async function deleteQuestionAction(token: string, courseId: string, moduleId: string, questionId: string) {
  try {
    await assertAdmin(token);
    await adminDb.collection("courses").doc(courseId)
      .collection("modules").doc(moduleId)
      .collection("questions").doc(questionId).delete();
      
    revalidatePath(`/dashboard/admin/courses/${courseId}/manage`);
    return { success: true };
  } catch (error) {
    return { success: false, message: "Erro ao deletar." };
  }
}