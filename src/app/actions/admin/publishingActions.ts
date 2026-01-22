"use server";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";

// 1. Definimos os Tipos de Resposta (Discriminated Union)
type ActionSuccess = {
  success: true; // Literal 'true'
  newStatus: boolean;
  message: string;
};

type ActionError = {
  success: false; // Literal 'false'
  message: string;
};

// A resposta pode ser um ou outro
export type PublishActionResponse = ActionSuccess | ActionError;

/**
 * Alterna o estado de publicação de um curso.
 */
export async function toggleCoursePublishAction(
  token: string, 
  courseId: string, 
  currentStatus: boolean
): Promise<PublishActionResponse> { // <--- Tipagem Explícita aqui
  try {
    // 1. Validação de Segurança
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userSnap = await adminDb.collection("users").doc(decodedToken.uid).get();
    const role = userSnap.data()?.role;

    if (!["admin", "master"].includes(role)) {
      throw new Error("Acesso negado. Permissão insuficiente.");
    }

    // 2. Referência do Documento
    const courseRef = adminDb.collection("courses").doc(courseId);
    const courseSnap = await courseRef.get();

    if (!courseSnap.exists) {
      throw new Error("Curso não encontrado.");
    }

    const courseData = courseSnap.data();

    // 3. Validação de Regras de Negócio
    const newStatus = !currentStatus;
    if (newStatus === true) {
      if ((courseData?.modulesCount || 0) === 0 && (courseData?.totalLessons || 0) === 0) {
        // Retorno de erro controlado
        return { success: false, message: "Não é possível publicar um curso vazio." };
      }
    }

    // 4. Atualização Atômica
    await courseRef.update({
      published: newStatus,
      updatedAt: FieldValue.serverTimestamp()
    });

    // 5. Revalidação de Cache
    revalidatePath("/dashboard/courses");
    revalidatePath(`/dashboard/admin/courses/${courseId}/manage`);
    revalidatePath("/dashboard");

    // Retorno de Sucesso (O TS agora sabe que aqui tem newStatus)
    return { 
      success: true, 
      newStatus, 
      message: newStatus ? "Curso publicado com sucesso!" : "Curso revertido para rascunho." 
    };

  } catch (error: any) {
    console.error("Erro ao alterar publicação:", error);
    // Retorno de Erro (O TS sabe que aqui NÃO tem newStatus)
    return { success: false, message: error.message || "Erro interno." };
  }
}