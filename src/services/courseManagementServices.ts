import { db, storage } from "@/lib/firebase";
import { doc, deleteDoc, collection, getDocs, writeBatch } from "firebase/firestore";
import { ref, listAll, deleteObject } from "firebase/storage";

// Helper Recursivo para limpar Storage
async function deleteFolderContents(path: string) {
  const refFolder = ref(storage, path);
  try {
    const listResult = await listAll(refFolder);
    // Deleta arquivos
    await Promise.all(listResult.items.map((item) => deleteObject(item)));
    // Entra nas pastas (Recursão)
    await Promise.all(listResult.prefixes.map((folder) => deleteFolderContents(folder.fullPath)));
  } catch (error) {
    console.warn(`Pasta ${path} vazia ou inexistente.`);
  }
}

/**
 * EXCLUSÃO COMPLETA E PROFISSIONAL DO CURSO
 * 1. Apaga arquivos do Storage (Capa, Vídeos dos módulos)
 * 2. Apaga Coleções Aninhadas (Modules -> Lessons -> Questions)
 * 3. Apaga Documento Pai
 */
export async function deleteCourseFull(courseId: string) {
  console.log(`🗑️ Iniciando exclusão do curso: ${courseId}`);

  // 1. Limpeza do Storage (Assíncrono, não bloqueante se falhar um arquivo)
  await deleteFolderContents(`courses/${courseId}`).catch(err => console.error("Erro storage:", err));

  // 2. Limpeza do Firestore (Cascata Manual necessária no NoSQL)
  const modulesRef = collection(db, "courses", courseId, "modules");
  const modulesSnap = await getDocs(modulesRef);

  // Firestore Batch (Limite de 500 operações, cuidado em produção massiva)
  // Se for muito grande, teria que fazer em chunks, mas para cursos normais ok.
  const batch = writeBatch(db);

  for (const modDoc of modulesSnap.docs) {
    // A. Deletar Aulas
    const lessonsRef = collection(db, "courses", courseId, "modules", modDoc.id, "lessons");
    const lessonsSnap = await getDocs(lessonsRef);
    lessonsSnap.forEach(doc => batch.delete(doc.ref));

    // B. Deletar Perguntas do Quiz (Se houver)
    const questionsRef = collection(db, "courses", courseId, "modules", modDoc.id, "questions");
    const questionsSnap = await getDocs(questionsRef);
    questionsSnap.forEach(doc => batch.delete(doc.ref));

    // C. Deletar o Módulo
    batch.delete(modDoc.ref);
  }

  // 3. Deletar o Curso
  const courseRef = doc(db, "courses", courseId);
  batch.delete(courseRef);

  await batch.commit();
  console.log("✅ Curso excluído com sucesso.");
  return true;
}