// src/app/actions/admin/taxonomyActions.ts
"use server";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

const TAXONOMY_DOC_PATH = "settings/taxonomy";

/**
 * Busca a lista de tags globais
 */
export async function getGlobalTagsAction() {
  try {
    // Não precisa de verificação rigorosa de auth aqui se for público para leitura,
    // mas se quiser restrito: await adminAuth.verifyIdToken(token);
    
    const docSnap = await adminDb.doc(TAXONOMY_DOC_PATH).get();
    
    if (!docSnap.exists) {
      // Se não existir, cria o documento inicial com algumas tags padrão
      const defaultTags = ["Extrusão", "Segurança", "Manutenção"];
      await adminDb.doc(TAXONOMY_DOC_PATH).set({ tags: defaultTags });
      return { success: true, tags: defaultTags };
    }

    const data = docSnap.data();
    return { success: true, tags: (data?.tags as string[]) || [] };

  } catch (error) {
    console.error("Erro ao buscar tags:", error);
    return { success: false, tags: [] };
  }
}

/**
 * Adiciona uma nova tag à lista global
 */
export async function addGlobalTagAction(token: string, newTag: string) {
  try {
    // 1. Segurança: Apenas Admin/Master
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
    const role = userDoc.data()?.role;

    if (!["admin", "master"].includes(role)) {
      return { success: false, message: "Sem permissão." };
    }

    // 2. Padronização (Capitalize)
    const formattedTag = newTag.charAt(0).toUpperCase() + newTag.slice(1);

    // 3. Atualiza o array no Firestore (arrayUnion evita duplicatas automaticamente)
    await adminDb.doc(TAXONOMY_DOC_PATH).update({
      tags: FieldValue.arrayUnion(formattedTag)
    });

    return { success: true, tag: formattedTag };

  } catch (error) {
    console.error("Erro ao adicionar tag:", error);
    return { success: false, message: "Erro interno." };
  }
}