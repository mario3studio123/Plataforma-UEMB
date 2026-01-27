// src/app/actions/admin/certificateTemplateActions.ts
"use server";

import { adminAuth, adminDb, adminStorage } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { v4 as uuidv4 } from "uuid";
import { 
  CreateCertificateTemplateSchema,
  UpdateCertificateTemplateSchema,
} from "@/lib/schemas/certificateSchemas";
import {
  ActionResult,
  handleActionError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
  ErrorCodes,
} from "@/lib/errors";
import { createActionLogger } from "@/lib/errors/logger";

const COLLECTION_NAME = "certificate_templates";

/**
 * ============================================================================
 * HELPER DE SERIALIZAÇÃO
 * ============================================================================
 * Converte objetos do Firestore (com Timestamps) para objetos planos
 */

function serializeFirestoreData(data: any): any {
  if (!data) return data;
  
  const serialized: any = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) {
      serialized[key] = value;
    } else if (value && typeof value === 'object' && '_seconds' in value) {
      // É um Firestore Timestamp (formato _seconds/_nanoseconds)
      serialized[key] = new Date((value as any)._seconds * 1000).toISOString();
    } else if (value && typeof value === 'object' && 'toDate' in value && typeof (value as any).toDate === 'function') {
      // É um Firestore Timestamp (com método toDate)
      serialized[key] = (value as any).toDate().toISOString();
    } else if (Array.isArray(value)) {
      serialized[key] = value.map(item => 
        typeof item === 'object' && item !== null ? serializeFirestoreData(item) : item
      );
    } else if (typeof value === 'object') {
      serialized[key] = serializeFirestoreData(value);
    } else {
      serialized[key] = value;
    }
  }
  
  return serialized;
}

/**
 * ============================================================================
 * HELPERS
 * ============================================================================
 */

async function verifyAdminAccess(token: string): Promise<string> {
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;
    
    const userDoc = await adminDb.collection("users").doc(userId).get();
    const userData = userDoc.data();
    
    if (!userData || !["admin", "master"].includes(userData.role)) {
      throw new AuthorizationError(
        "Apenas administradores podem gerenciar templates de certificado.",
        ErrorCodes.AUTHZ_ADMIN_REQUIRED
      );
    }
    
    return userId;
  } catch (error) {
    if (error instanceof AuthorizationError) throw error;
    throw new AuthenticationError("Sessão inválida. Faça login novamente.");
  }
}

/**
 * ============================================================================
 * LISTAR TEMPLATES
 * ============================================================================
 */

interface TemplateListItem {
  id: string;
  name: string;
  description?: string;
  backgroundPreview: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function listCertificateTemplatesAction(
  token: string
): Promise<ActionResult<TemplateListItem[]>> {
  const actionLogger = createActionLogger("listCertificateTemplates");
  
  try {
    await verifyAdminAccess(token);
    
    const snapshot = await adminDb
      .collection(COLLECTION_NAME)
      .orderBy("createdAt", "desc")
      .get();
    
    const templates: TemplateListItem[] = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        description: data.description,
        backgroundPreview: data.background?.value || "",
        isActive: data.isActive || false,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || "",
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || "",
      };
    });
    
    actionLogger.info("Templates listados", { count: templates.length });
    
    return { success: true, data: templates };
  } catch (error) {
    actionLogger.error("Erro ao listar templates", error);
    return handleActionError(error);
  }
}

/**
 * ============================================================================
 * BUSCAR TEMPLATE POR ID
 * ============================================================================
 */

export async function getCertificateTemplateAction(
  token: string,
  templateId: string
): Promise<ActionResult<any>> {
  const actionLogger = createActionLogger("getCertificateTemplate");
  
  try {
    await verifyAdminAccess(token);
    
    const docRef = adminDb.collection(COLLECTION_NAME).doc(templateId);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      throw new NotFoundError("Template de certificado");
    }
    
    const data = docSnap.data();
    
    // Serializa todo o objeto para remover classes Firestore
    const serializedData = serializeFirestoreData({
      id: docSnap.id,
      ...data,
    });
    
    return { 
      success: true, 
      data: serializedData
    };
  } catch (error) {
    actionLogger.error("Erro ao buscar template", error);
    return handleActionError(error);
  }
}

/**
 * ============================================================================
 * BUSCAR TEMPLATE ATIVO (PÚBLICO - SEM AUTENTICAÇÃO DE ADMIN)
 * ============================================================================
 */

export async function getActiveCertificateTemplateAction(): Promise<ActionResult<any | null>> {
  const actionLogger = createActionLogger("getActiveCertificateTemplate");
  
  try {
    const snapshot = await adminDb
      .collection(COLLECTION_NAME)
      .where("isActive", "==", true)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return { success: true, data: null };
    }
    
    const doc = snapshot.docs[0];
    const data = doc.data();
    
    // Serializa todo o objeto para remover classes Firestore
    const serializedData = serializeFirestoreData({
      id: doc.id,
      ...data,
    });
    
    return { 
      success: true, 
      data: serializedData
    };
  } catch (error) {
    actionLogger.error("Erro ao buscar template ativo", error);
    return handleActionError(error);
  }
}

/**
 * ============================================================================
 * CRIAR TEMPLATE
 * ============================================================================
 */

export async function createCertificateTemplateAction(
  token: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const actionLogger = createActionLogger("createCertificateTemplate");
  
  try {
    const userId = await verifyAdminAccess(token);
    
    // Validação
    const validation = CreateCertificateTemplateSchema.safeParse(input);
    if (!validation.success) {
      const errorMessage = validation.error.issues[0]?.message || "Dados inválidos";
      throw new ValidationError(errorMessage);
    }
    
    const validatedData = validation.data;
    const templateId = uuidv4();
    
    const templateData = {
      ...validatedData,
      id: templateId,
      isActive: false, // Novo template nunca começa ativo
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: userId,
    };
    
    await adminDb.collection(COLLECTION_NAME).doc(templateId).set(templateData);
    
    actionLogger.info("Template criado", { templateId, name: validatedData.name });
    
    revalidatePath("/dashboard/admin/certificates");
    
    return { success: true, data: { id: templateId } };
  } catch (error) {
    actionLogger.error("Erro ao criar template", error);
    return handleActionError(error);
  }
}

/**
 * ============================================================================
 * ATUALIZAR TEMPLATE
 * ============================================================================
 */

export async function updateCertificateTemplateAction(
  token: string,
  templateId: string,
  input: unknown
): Promise<ActionResult<void>> {
  const actionLogger = createActionLogger("updateCertificateTemplate");
  
  try {
    await verifyAdminAccess(token);
    
    // Verifica se template existe
    const docRef = adminDb.collection(COLLECTION_NAME).doc(templateId);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      throw new NotFoundError("Template de certificado");
    }
    
    // Validação
    const validation = UpdateCertificateTemplateSchema.safeParse(input);
    if (!validation.success) {
      const errorMessage = validation.error.issues[0]?.message || "Dados inválidos";
      throw new ValidationError(errorMessage);
    }
    
    const validatedData = validation.data;
    
    await docRef.update({
      ...validatedData,
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    actionLogger.info("Template atualizado", { templateId });
    
    revalidatePath("/dashboard/admin/certificates");
    revalidatePath("/dashboard/certificates");
    
    return { success: true, data: undefined };
  } catch (error) {
    actionLogger.error("Erro ao atualizar template", error);
    return handleActionError(error);
  }
}

/**
 * ============================================================================
 * ATIVAR TEMPLATE
 * ============================================================================
 */

export async function activateCertificateTemplateAction(
  token: string,
  templateId: string
): Promise<ActionResult<void>> {
  const actionLogger = createActionLogger("activateCertificateTemplate");
  
  try {
    await verifyAdminAccess(token);
    
    // Verifica se template existe
    const docRef = adminDb.collection(COLLECTION_NAME).doc(templateId);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      throw new NotFoundError("Template de certificado");
    }
    
    // Transação: desativa todos e ativa o selecionado
    await adminDb.runTransaction(async (transaction) => {
      // Busca templates ativos
      const activeQuery = await adminDb
        .collection(COLLECTION_NAME)
        .where("isActive", "==", true)
        .get();
      
      // Desativa todos
      activeQuery.docs.forEach(doc => {
        transaction.update(doc.ref, { 
          isActive: false,
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
      
      // Ativa o selecionado
      transaction.update(docRef, { 
        isActive: true,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    
    actionLogger.info("Template ativado", { templateId });
    
    revalidatePath("/dashboard/admin/certificates");
    revalidatePath("/dashboard/certificates");
    
    return { success: true, data: undefined };
  } catch (error) {
    actionLogger.error("Erro ao ativar template", error);
    return handleActionError(error);
  }
}

/**
 * ============================================================================
 * DESATIVAR TEMPLATE
 * ============================================================================
 */

export async function deactivateCertificateTemplateAction(
  token: string,
  templateId: string
): Promise<ActionResult<void>> {
  const actionLogger = createActionLogger("deactivateCertificateTemplate");
  
  try {
    await verifyAdminAccess(token);
    
    const docRef = adminDb.collection(COLLECTION_NAME).doc(templateId);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      throw new NotFoundError("Template de certificado");
    }
    
    await docRef.update({
      isActive: false,
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    actionLogger.info("Template desativado", { templateId });
    
    revalidatePath("/dashboard/admin/certificates");
    
    return { success: true, data: undefined };
  } catch (error) {
    actionLogger.error("Erro ao desativar template", error);
    return handleActionError(error);
  }
}

/**
 * ============================================================================
 * EXCLUIR TEMPLATE
 * ============================================================================
 */

export async function deleteCertificateTemplateAction(
  token: string,
  templateId: string
): Promise<ActionResult<void>> {
  const actionLogger = createActionLogger("deleteCertificateTemplate");
  
  try {
    await verifyAdminAccess(token);
    
    const docRef = adminDb.collection(COLLECTION_NAME).doc(templateId);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      throw new NotFoundError("Template de certificado");
    }
    
    const data = docSnap.data();
    
    // Não permite excluir template ativo
    if (data?.isActive) {
      throw new ValidationError("Não é possível excluir um template ativo. Desative-o primeiro.");
    }
    
    // Tenta excluir imagem do storage se for URL do Firebase
    if (data?.background?.type === "image" && 
        data.background.value?.includes("firebasestorage")) {
      try {
        const bucket = adminStorage.bucket();
        // Extrai o path da URL
        const urlPath = decodeURIComponent(
          data.background.value.split("/o/")[1]?.split("?")[0] || ""
        );
        if (urlPath) {
          await bucket.file(urlPath).delete();
        }
      } catch (storageError) {
        // Ignora erro de storage (imagem pode já ter sido deletada)
        actionLogger.warn("Erro ao deletar imagem do template", undefined, storageError);
      }
    }
    
    await docRef.delete();
    
    actionLogger.info("Template excluído", { templateId });
    
    revalidatePath("/dashboard/admin/certificates");
    
    return { success: true, data: undefined };
  } catch (error) {
    actionLogger.error("Erro ao excluir template", error);
    return handleActionError(error);
  }
}

/**
 * ============================================================================
 * DUPLICAR TEMPLATE
 * ============================================================================
 */

export async function duplicateCertificateTemplateAction(
  token: string,
  templateId: string
): Promise<ActionResult<{ id: string }>> {
  const actionLogger = createActionLogger("duplicateCertificateTemplate");
  
  try {
    const userId = await verifyAdminAccess(token);
    
    const docRef = adminDb.collection(COLLECTION_NAME).doc(templateId);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      throw new NotFoundError("Template de certificado");
    }
    
    const originalData = docSnap.data()!;
    const newTemplateId = uuidv4();
    
    // Cria cópia com novos IDs
    const duplicateData = {
      ...originalData,
      id: newTemplateId,
      name: `${originalData.name} (Cópia)`,
      isActive: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: userId,
      fields: originalData.fields?.map((field: any) => ({
        ...field,
        id: uuidv4(),
      })) || [],
    };
    
    await adminDb.collection(COLLECTION_NAME).doc(newTemplateId).set(duplicateData);
    
    actionLogger.info("Template duplicado", { 
      originalId: templateId, 
      newId: newTemplateId 
    });
    
    revalidatePath("/dashboard/admin/certificates");
    
    return { success: true, data: { id: newTemplateId } };
  } catch (error) {
    actionLogger.error("Erro ao duplicar template", error);
    return handleActionError(error);
  }
}
