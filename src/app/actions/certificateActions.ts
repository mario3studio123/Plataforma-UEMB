"use server";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { v4 as uuidv4 } from 'uuid';
import { revalidatePath } from "next/cache";
import { formatDurationVerbose } from "@/utils/formatters";

/**
 * ============================================================================
 * HELPERS
 * ============================================================================
 */

// Extrai a versão do template (data de atualização) de forma segura
function getTemplateVersion(template: any): string | null {
  if (!template?.updatedAt) return null;
  
  const updatedAt = template.updatedAt;
  
  // Se já é uma string
  if (typeof updatedAt === 'string') {
    return updatedAt;
  }
  
  // Se é um Timestamp do Firestore (com método toDate)
  if (typeof updatedAt.toDate === 'function') {
    return updatedAt.toDate().toISOString();
  }
  
  // Se é um objeto com _seconds (formato serializado do Timestamp)
  if (updatedAt._seconds) {
    return new Date(updatedAt._seconds * 1000).toISOString();
  }
  
  return null;
}

/**
 * ============================================================================
 * EMITIR CERTIFICADO
 * ============================================================================
 */

export async function issueCertificateAction(token: string, courseId: string) {
  try {
    // 1. Validação de Identidade
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // 2. Verificar se o curso foi realmente concluído
    const enrollmentRef = adminDb.collection("enrollments").doc(`${userId}_${courseId}`);
    const enrollmentSnap = await enrollmentRef.get();

    if (!enrollmentSnap.exists) {
        return { success: false, message: "Matrícula não encontrada." };
    }

    const enrollmentData = enrollmentSnap.data();
    
    // Regra de Ouro: Só emite se tiver 100% de progresso
    if (!enrollmentData || enrollmentData.progress < 100) {
        return { success: false, message: "Conclua todas as aulas para emitir o certificado." };
    }

    // 3. Verificar se já existe (Idempotência)
    // Se já emitiu, retornamos o existente para não duplicar stats
    const certQuery = await adminDb.collection("certificates")
        .where("userId", "==", userId)
        .where("courseId", "==", courseId)
        .get();

    if (!certQuery.empty) {
        // Já existe, retornamos os dados do primeiro encontrado
        const certData = certQuery.docs[0].data();
        return { success: true, certificate: certData, isNew: false };
    }

    // 4. Buscar dados do Curso e Usuário para "congelar" no certificado
    const userSnap = await adminDb.collection("users").doc(userId).get();
    const courseSnap = await adminDb.collection("courses").doc(courseId).get();
    
    const userData = userSnap.data();
    const courseData = courseSnap.data();

    // 5. Buscar template de certificado ativo
    const templateQuery = await adminDb
      .collection("certificate_templates")
      .where("isActive", "==", true)
      .limit(1)
      .get();

    const activeTemplate = templateQuery.empty 
      ? null 
      : { id: templateQuery.docs[0].id, ...templateQuery.docs[0].data() };

    // 6. Gerar Código de Validação Único
    const validationCode = uuidv4().split('-')[0].toUpperCase() + "-" + Date.now().toString().slice(-6);

    // Formata a duração de forma legível
    const totalDurationSeconds = courseData?.totalDurationSeconds || courseData?.totalDuration || 0;
    const formattedDuration = typeof totalDurationSeconds === 'number' 
      ? formatDurationVerbose(totalDurationSeconds)
      : totalDurationSeconds || "0h";

    // Conta módulos do curso
    const modulesSnapshot = await adminDb
      .collection("courses")
      .doc(courseId)
      .collection("modules")
      .get();
    const modulesCount = modulesSnapshot.size;

    const certificateData = {
        id: uuidv4(),
        userId,
        userName: userData?.name || "Aluno",
        courseId,
        courseTitle: courseData?.title || "Curso",
        totalHours: formattedDuration,
        modulesCount,
        issuedAt: new Date().toISOString(),
        validationCode,
        instructor: "Universidade da Embalagem",
        companyName: "Universidade da Embalagem",
        // Referência ao template usado (para histórico)
        templateId: activeTemplate?.id || "default",
        templateVersion: getTemplateVersion(activeTemplate),
    };

    // 7. Gravação Atômica (Certificado + Stats do Usuário)
    await adminDb.runTransaction(async (t) => {
        // Cria o documento do certificado
        const newCertRef = adminDb.collection("certificates").doc(certificateData.id);
        t.set(newCertRef, certificateData);

        // Atualiza stats do usuário
        const userRef = adminDb.collection("users").doc(userId);
        t.update(userRef, {
            "stats.certificatesEarned": FieldValue.increment(1)
        });
        
        // Marca na matrícula que o certificado foi emitido
        t.update(enrollmentRef, {
            certificateId: certificateData.id
        });
    });

    revalidatePath("/dashboard/certificates");
    
    return { success: true, certificate: certificateData, isNew: true };

  } catch (error) {
    console.error("Erro ao emitir certificado:", error);
    return { success: false, message: "Erro interno ao gerar certificado." };
  }
}

/**
 * ============================================================================
 * BUSCAR CERTIFICADOS DO USUÁRIO (COM TEMPLATE)
 * ============================================================================
 */

// Helper para converter Timestamp do Firestore para string
function serializeFirestoreData(data: any): any {
  if (!data) return data;
  
  const serialized: any = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) {
      serialized[key] = value;
    } else if (value && typeof value === 'object' && '_seconds' in value) {
      // É um Firestore Timestamp
      serialized[key] = new Date((value as any)._seconds * 1000).toISOString();
    } else if (value && typeof value === 'object' && 'toDate' in value && typeof (value as any).toDate === 'function') {
      // É um Firestore Timestamp (formato alternativo)
      serialized[key] = (value as any).toDate().toISOString();
    } else if (Array.isArray(value)) {
      serialized[key] = value.map(item => 
        typeof item === 'object' ? serializeFirestoreData(item) : item
      );
    } else if (typeof value === 'object') {
      serialized[key] = serializeFirestoreData(value);
    } else {
      serialized[key] = value;
    }
  }
  
  return serialized;
}

export async function getUserCertificatesAction(token: string) {
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Busca certificados do usuário
    const certQuery = await adminDb
      .collection("certificates")
      .where("userId", "==", userId)
      .orderBy("issuedAt", "desc")
      .get();

    const certificates = certQuery.docs.map(doc => 
      serializeFirestoreData({ id: doc.id, ...doc.data() })
    );

    // Busca template ativo
    const templateQuery = await adminDb
      .collection("certificate_templates")
      .where("isActive", "==", true)
      .limit(1)
      .get();

    // Serializa o template para remover classes Timestamp
    const activeTemplate = templateQuery.empty 
      ? null 
      : serializeFirestoreData({ 
          id: templateQuery.docs[0].id, 
          ...templateQuery.docs[0].data() 
        });

    return { 
      success: true, 
      certificates,
      activeTemplate,
    };

  } catch (error) {
    console.error("Erro ao buscar certificados:", error);
    return { success: false, message: "Erro ao buscar certificados." };
  }
}