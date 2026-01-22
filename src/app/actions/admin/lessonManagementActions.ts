"use server";

import { adminAuth, adminDb, adminStorage } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { LessonSchema, LessonInput } from "@/lib/schemas/courseSchemas";
import { rebuildCourseSyllabus } from "@/lib/server/courseSyncService"; // <--- O MOTOR DE SINCRONIZAÇÃO


async function assertAdmin(token: string) {
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
    const role = userSnap.data()?.role;
    
    if (!["admin", "master"].includes(role)) {
      throw new Error("Acesso negado. Permissão insuficiente.");
    }
    return decoded.uid;
  } catch (error) {
    throw new Error("Falha na autenticação administrativa.");
  }
}


async function cleanupOldVideo(oldVideoUrl: string | undefined) {
  if (!oldVideoUrl) return;
  try {
    const urlObj = new URL(oldVideoUrl);

    const pathName = urlObj.pathname; 
    const decodedPath = decodeURIComponent(pathName.split('/o/')[1].split('?')[0]);

    const bucket = adminStorage.bucket();
    const file = bucket.file(decodedPath);
    
    const [exists] = await file.exists();
    if (exists) {
      await file.delete();
      console.log(`🗑️ [Storage] Vídeo antigo removido: ${decodedPath}`);
    }
  } catch (error) {
    console.warn("⚠️ [Storage] Aviso: Falha não-crítica ao limpar vídeo antigo:", error);
  }
}

// ============================================================================
// 🚀 SERVER ACTIONS OTIMIZADAS (COM SYNC AUTOMÁTICO)
// ============================================================================

export async function upsertLessonAction(
  token: string, 
  courseId: string, 
  moduleId: string, 
  lessonId: string | undefined, 
  payload: LessonInput
) {
  let oldVideoToDelete: string | null = null;

  try {
    // 1. Segurança
    await assertAdmin(token);

    // 2. Validação de Dados (Zod)
    const validation = LessonSchema.safeParse(payload);
    if (!validation.success) {
      const errorMsg = validation.error.issues.map(i => i.message).join(", ");
      return { success: false, message: `Dados inválidos: ${errorMsg}` };
    }
    
    const data = validation.data;
    const courseRef = adminDb.collection("courses").doc(courseId);
    const moduleRef = courseRef.collection("modules").doc(moduleId);
    
    // Define a referência (Novo ID se undefined, ID existente se edição)
    const lessonRef = lessonId 
      ? moduleRef.collection("lessons").doc(lessonId) 
      : moduleRef.collection("lessons").doc();

    // 3. Persistência da Aula (Transação para garantir integridade do documento)
    await adminDb.runTransaction(async (t) => {
      // Verificação de Segurança: O módulo pai existe?
      const modDoc = await t.get(moduleRef);
      if (!modDoc.exists) throw new Error("Módulo pai não encontrado.");

      // Se for EDIÇÃO, verificamos se o vídeo mudou para marcar limpeza
      if (lessonId) {
        const currentLessonSnap = await t.get(lessonRef);
        if (currentLessonSnap.exists) {
          const oldData = currentLessonSnap.data();
          // Se a URL nova for diferente da antiga e a antiga existia
          if (oldData?.videoUrl && oldData.videoUrl !== data.videoUrl) {
            oldVideoToDelete = oldData.videoUrl;
          }
        }
      }

      // Prepara objeto final para salvar
      const lessonFinalData = {
        ...data,
        id: lessonRef.id,
        updatedAt: FieldValue.serverTimestamp(),
        // Preserva createdAt se for edição, cria se for novo
        ...(lessonId ? {} : { createdAt: FieldValue.serverTimestamp() })
      };

      // Salva a aula (Merge true para segurança, embora set substitua)
      t.set(lessonRef, JSON.parse(JSON.stringify(lessonFinalData)), { merge: true });
    });

    // 4. Limpeza de Recursos (Fora da Transação)
    if (oldVideoToDelete) {
      await cleanupOldVideo(oldVideoToDelete);
    }

    // 5. 🔥 SYNC CRÍTICO: RECONSTRUÇÃO DO SYLLABUS 🔥
    // Isso garante que o JSON do curso e os contadores estejam matematicamente perfeitos
    await rebuildCourseSyllabus(courseId);

    // 6. Revalidação de Cache (Admin e Aluno)
    revalidatePath(`/dashboard/admin/courses/${courseId}/manage`);
    revalidatePath(`/dashboard/courses/${courseId}/learn`);
    
    return { success: true };

  } catch (error: any) {
    console.error("❌ Erro Fatal upsertLesson:", error);
    return { success: false, message: error.message || "Erro ao salvar aula." };
  }
}

export async function deleteLessonAction(
  token: string, 
  courseId: string, 
  moduleId: string, 
  lessonId: string
) {
  let videoToDelete: string | null = null;

  try {
    // 1. Segurança
    await assertAdmin(token);

    const lessonRef = adminDb.collection("courses").doc(courseId)
      .collection("modules").doc(moduleId)
      .collection("lessons").doc(lessonId);

    // 2. Busca dados antes de deletar (para saber qual vídeo apagar)
    const lessonDoc = await lessonRef.get();
    
    if (!lessonDoc.exists) {
      // Se já não existe, tecnicamente é um sucesso, mas fazemos um sync por garantia
      await rebuildCourseSyllabus(courseId);
      return { success: true }; 
    }

    const data = lessonDoc.data();
    if (data?.videoUrl) {
      videoToDelete = data.videoUrl;
    }

    // 3. Deleta o documento da aula
    await lessonRef.delete();

    // 4. Limpeza do Storage
    if (videoToDelete) {
      await cleanupOldVideo(videoToDelete);
    }

    // 5. 🔥 SYNC CRÍTICO 🔥
    // Remove a aula do Syllabus e atualiza contadores do curso
    await rebuildCourseSyllabus(courseId);

    // 6. Revalidação
    revalidatePath(`/dashboard/admin/courses/${courseId}/manage`);
    revalidatePath(`/dashboard/courses/${courseId}/learn`);

    return { success: true };

  } catch (error: any) {
    console.error("❌ Erro deleteLesson:", error);
    return { success: false, message: "Erro ao deletar aula." };
  }
}