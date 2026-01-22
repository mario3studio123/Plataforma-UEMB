"use server";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { CourseSchema, CreateCourseInput } from "@/lib/schemas/courseSchemas";

/**
 * Cria um novo curso no Firestore com validação Zod e verificação de Admin.
 */
export async function createCourseAction(token: string, payload: CreateCourseInput) {
  try {
    // 1. Validação de Autenticação e Permissão (Admin/Master)
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;
    
    // Verificamos a role no banco para dupla segurança (ou Custom Claims se tiver configurado)
    const userDoc = await adminDb.collection("users").doc(userId).get();
    const userData = userDoc.data();
    
    if (!userData || !["admin", "master"].includes(userData.role)) {
      return { success: false, message: "Acesso negado. Apenas administradores." };
    }

    // 2. Validação de Dados (Zod)
const validation = CourseSchema.safeParse(payload);
    
    if (!validation.success) {
      // Retorna o primeiro erro encontrado de forma amigável
      const errorMessage = validation.error.issues[0].message;
      return { success: false, message: errorMessage };
    }

    const { id, title, description, coverUrl, level } = validation.data;

    // 3. Persistência no Firestore
    const courseRef = adminDb.collection("courses").doc(id);
    
    // Verifica se já existe (para evitar sobrescrita acidental, embora improvável com ID novo)
    const existingDoc = await courseRef.get();
    if (existingDoc.exists) {
      return { success: false, message: "Erro: ID de curso duplicado." };
    }

    await courseRef.set({
      id,
      title,
      description,
      coverUrl,
      level,
      modulesCount: 0,
      totalLessons: 0,
      published: false, // Cursos nascem como rascunho por segurança
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: userId
    });

    // 4. Revalidação de Cache do Next.js
    revalidatePath("/dashboard/courses");
    revalidatePath("/dashboard/admin");

    return { success: true, courseId: id };

  } catch (error) {
    console.error("Erro ao criar curso (Server Action):", error);
    return { success: false, message: "Erro interno ao criar curso." };
  }
}