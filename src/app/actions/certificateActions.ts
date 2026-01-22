"use server";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { v4 as uuidv4 } from 'uuid';
import { revalidatePath } from "next/cache";

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
    // (Importante: Se o nome do curso mudar no futuro, o certificado antigo mantém o nome da época)
    const userSnap = await adminDb.collection("users").doc(userId).get();
    const courseSnap = await adminDb.collection("courses").doc(courseId).get();
    
    const userData = userSnap.data();
    const courseData = courseSnap.data();

    // 5. Gerar Código de Validação Único
    const validationCode = uuidv4().split('-')[0].toUpperCase() + "-" + Date.now().toString().slice(-6);

    const certificateData = {
        id: uuidv4(),
        userId,
        userName: userData?.name || "Aluno",
        courseId,
        courseTitle: courseData?.title || "Curso",
        totalHours: courseData?.totalDuration || "0h", // Pega a duração formatada
        issuedAt: new Date().toISOString(), // Data atual ISO
        validationCode,
        instructor: "Universidade da Embalagem"
    };

    // 6. Gravação Atômica (Certificado + Stats do Usuário)
    await adminDb.runTransaction(async (t) => {
        // Cria o documento do certificado
        const newCertRef = adminDb.collection("certificates").doc(certificateData.id);
        t.set(newCertRef, certificateData);

        // Atualiza stats do usuário
        const userRef = adminDb.collection("users").doc(userId);
        t.update(userRef, {
            "stats.certificatesEarned": FieldValue.increment(1)
        });
        
        // Marca na matrícula que o certificado foi emitido (opcional, mas bom para cache)
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