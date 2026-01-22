"use server";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { rebuildCourseSyllabus } from "@/lib/server/courseSyncService";

export async function transferLessonAction(
  token: string,
  courseId: string,
  fromModuleId: string,
  toModuleId: string,
  lessonId: string,
  newIndex: number
) {
  try {
    // 1. Auth Check
    await adminAuth.verifyIdToken(token);

    // Referências
    const courseRef = adminDb.collection("courses").doc(courseId);
    const sourceLessonRef = courseRef.collection("modules").doc(fromModuleId).collection("lessons").doc(lessonId);
    const targetModuleRef = courseRef.collection("modules").doc(toModuleId);
    const targetCollectionRef = targetModuleRef.collection("lessons");
    
    // Novo ID (ou manter o mesmo se preferir, mas mover requer criar novo doc em subcoleção diferente)
    // Manter o mesmo ID é bom para SEO e referências, mas no Firestore subcoleção muda o path.
    // Vamos criar um novo doc com o MESMO ID para facilitar, mas tecnicamente é um novo path.
    const newLessonRef = targetCollectionRef.doc(lessonId);

    await adminDb.runTransaction(async (t) => {
      // Leitura
      const sourceDoc = await t.get(sourceLessonRef);
      if (!sourceDoc.exists) throw new Error("Aula original não encontrada.");
      
      const lessonData = sourceDoc.data();

      // Escrita (Cópia para o novo destino com a nova ordem)
      t.set(newLessonRef, {
        ...lessonData,
        order: newIndex,
        updatedAt: FieldValue.serverTimestamp()
      });

      // Deleção (Remove da origem)
      t.delete(sourceLessonRef);
    });

    // 🔥 SYNC: Recalcular estrutura do curso
    await rebuildCourseSyllabus(courseId);

    revalidatePath(`/dashboard/admin/courses/${courseId}/manage`);
    return { success: true };

  } catch (error: any) {
    console.error("Erro ao mover aula:", error);
    return { success: false, message: error.message };
  }
}