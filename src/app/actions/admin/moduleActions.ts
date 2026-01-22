"use server";

import { adminAuth, adminDb, adminStorage } from "@/lib/firebaseAdmin";
import { ReorderSchema, ReorderItem } from "@/lib/schemas/courseSchemas";
import { rebuildCourseSyllabus } from "@/lib/server/courseSyncService"; // <--- O Motor de Sync
import { revalidatePath } from "next/cache";

// ============================================================================
// 🔒 HELPERS
// ============================================================================

async function assertAdmin(token: string) {
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
    const role = userSnap.data()?.role;
    
    if (!["admin", "master"].includes(role)) {
      throw new Error("Acesso negado.");
    }
    return decoded.uid;
  } catch (error) {
    throw new Error("Falha de autenticação.");
  }
}

/**
 * Helper para deletar arquivos do Storage baseado na URL
 */
async function deleteVideoFromStorage(videoUrl: string) {
  if (!videoUrl) return;
  try {
    const urlObj = new URL(videoUrl);
    const pathName = urlObj.pathname;
    const decodedPath = decodeURIComponent(pathName.split('/o/')[1].split('?')[0]);
    
    const bucket = adminStorage.bucket();
    const file = bucket.file(decodedPath);
    
    const [exists] = await file.exists();
    if (exists) {
      await file.delete();
      console.log(`🗑️ [Storage] Vídeo limpo: ${decodedPath}`);
    }
  } catch (error) {
    console.warn(`⚠️ Erro ao limpar vídeo (${videoUrl}):`, error);
  }
}

// ============================================================================
// 🚀 SERVER ACTIONS
// ============================================================================

/**
 * Reordena MÓDULOS em lote e reconstrói o Syllabus
 */
export async function reorderModulesAction(token: string, courseId: string, items: ReorderItem[]) {
  try {
    await assertAdmin(token);
    
    const validation = ReorderSchema.safeParse(items);
    if (!validation.success) return { success: false, message: "Dados de ordem inválidos." };

    // Batch Write para performance e atomicidade
    const batch = adminDb.batch();
    const modulesRef = adminDb.collection("courses").doc(courseId).collection("modules");

    items.forEach((item) => {
      const docRef = modulesRef.doc(item.id);
      batch.update(docRef, { order: item.newOrder });
    });

    await batch.commit();

    // 🔥 SYNC: Reconstrói o JSON do curso na nova ordem
    await rebuildCourseSyllabus(courseId);

    revalidatePath(`/dashboard/admin/courses/${courseId}/manage`);
    return { success: true };

  } catch (error) {
    console.error("Erro reorderModules:", error);
    return { success: false, message: "Erro ao reordenar módulos." };
  }
}

/**
 * Reordena AULAS dentro de um módulo e reconstrói o Syllabus
 */
export async function reorderLessonsAction(token: string, courseId: string, moduleId: string, items: ReorderItem[]) {
  try {
    await assertAdmin(token);
    
    const batch = adminDb.batch();
    const lessonsRef = adminDb.collection("courses").doc(courseId)
      .collection("modules").doc(moduleId)
      .collection("lessons");

    items.forEach((item) => {
      const docRef = lessonsRef.doc(item.id);
      batch.update(docRef, { order: item.newOrder });
    });

    await batch.commit();

    // 🔥 SYNC: Atualiza a ordem das aulas no Syllabus
    await rebuildCourseSyllabus(courseId);

    revalidatePath(`/dashboard/admin/courses/${courseId}/manage`);
    return { success: true };

  } catch (error) {
    console.error("Erro reorderLessons:", error);
    return { success: false, message: "Erro ao reordenar aulas." };
  }
}

/**
 * 🗑️ DELEÇÃO SEGURA DE MÓDULO (Deep Clean)
 * Apaga o módulo, todas as aulas, todas as perguntas e TODOS OS VÍDEOS do Storage.
 */
export async function deleteModuleAction(token: string, courseId: string, moduleId: string) {
  try {
    await assertAdmin(token);

    const moduleRef = adminDb.collection("courses").doc(courseId).collection("modules").doc(moduleId);
    const lessonsRef = moduleRef.collection("lessons");
    const questionsRef = moduleRef.collection("questions");

    console.log(`🚨 Iniciando exclusão profunda do módulo: ${moduleId}`);

    // 1. Listar todas as aulas para pegar URLs de vídeo
    const lessonsSnap = await lessonsRef.get();
    
    // 2. Limpar Storage (Vídeos)
    const cleanupPromises = lessonsSnap.docs.map(async (doc) => {
      const data = doc.data();
      if (data.videoUrl) {
        await deleteVideoFromStorage(data.videoUrl);
      }
    });
    await Promise.all(cleanupPromises);

    // 3. Deletar Subcoleções (Firestore não faz cascata automática)
    // Usamos Batch em chunks de 500 se necessário, mas aqui faremos delete paralelo para simplicidade
    // (Mais rápido que batch serial para < 50 itens)
    
    const deleteLessonsPromises = lessonsSnap.docs.map(doc => doc.ref.delete());
    
    const questionsSnap = await questionsRef.get();
    const deleteQuestionsPromises = questionsSnap.docs.map(doc => doc.ref.delete());

    await Promise.all([...deleteLessonsPromises, ...deleteQuestionsPromises]);

    // 4. Deletar o Documento do Módulo
    await moduleRef.delete();

    // 5. 🔥 SYNC: Recalcular Syllabus e Totais do Curso
    await rebuildCourseSyllabus(courseId);

    console.log("✅ Módulo excluído com sucesso.");
    revalidatePath(`/dashboard/admin/courses/${courseId}/manage`);
    
    return { success: true };

  } catch (error: any) {
    console.error("Erro deleteModule:", error);
    return { success: false, message: error.message || "Erro ao deletar módulo." };
  }
}

// Adicione ao final do arquivo existente
/**
 * Atualiza dados de um módulo (ex: Título)
 */
export async function updateModuleAction(token: string, courseId: string, moduleId: string, data: { title: string }) {
  try {
    await assertAdmin(token);

    if (!data.title || data.title.trim().length < 3) {
        return { success: false, message: "O título deve ter no mínimo 3 caracteres." };
    }

    const moduleRef = adminDb.collection("courses").doc(courseId).collection("modules").doc(moduleId);
    
    await moduleRef.update({
      title: data.title,
      updatedAt: new Date() // Usando Date() ou FieldValue.serverTimestamp()
    });

    revalidatePath(`/dashboard/admin/courses/${courseId}/manage`);
    return { success: true };

  } catch (error: any) {
    console.error("Erro updateModule:", error);
    return { success: false, message: "Erro ao atualizar módulo." };
  }
}