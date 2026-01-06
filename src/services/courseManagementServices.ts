import { db, storage } from "@/lib/firebase";
import { doc, deleteDoc, collection, getDocs, writeBatch } from "firebase/firestore";
import { ref, listAll, deleteObject } from "firebase/storage";

/**
 * Exclui recursivamente todos os arquivos de uma pasta no Storage
 */
async function deleteFolderContents(path: string) {
  const refFolder = ref(storage, path);
  
  try {
    const listResult = await listAll(refFolder);

    // 1. Deleta arquivos soltos na pasta
    const filePromises = listResult.items.map((itemRef) => deleteObject(itemRef));
    await Promise.all(filePromises);

    // 2. Entra recursivamente nas subpastas (ex: modules/...)
    const folderPromises = listResult.prefixes.map((folderRef) => 
      deleteFolderContents(folderRef.fullPath)
    );
    await Promise.all(folderPromises);
    
  } catch (error) {
    console.warn(`Erro ao limpar pasta ${path} (pode já estar vazia):`, error);
  }
}

/**
 * Função Principal: Apaga Curso + Módulos + Aulas + Arquivos
 */
export async function deleteCourseFull(courseId: string) {
  try {
    console.log(`Iniciando exclusão do curso: ${courseId}`);

    // 1. Limpar Storage (Capa e Vídeos)
    // Deleta tudo dentro de 'courses/{courseId}'
    await deleteFolderContents(`courses/${courseId}`);

    // 2. Limpar Firestore (Cascata manual)
    // O Firestore não deleta subcoleções automaticamente, precisamos fazer na mão.
    
    const modulesRef = collection(db, "courses", courseId, "modules");
    const modulesSnap = await getDocs(modulesRef);

    // Usaremos um Batch (Lote) para deletar tudo de uma vez e ser mais rápido/seguro
    const batch = writeBatch(db);

    for (const modDoc of modulesSnap.docs) {
      // Para cada módulo, buscar as aulas
      const lessonsRef = collection(db, "courses", courseId, "modules", modDoc.id, "lessons");
      const lessonsSnap = await getDocs(lessonsRef);

      // Adicionar aulas ao lote de exclusão
      lessonsSnap.forEach((lessonDoc) => {
        batch.delete(lessonDoc.ref);
      });

      // Adicionar o próprio módulo ao lote
      batch.delete(modDoc.ref);
    }

    // Executa a exclusão de todos os módulos e aulas
    await batch.commit();

    // 3. Finalmente, apaga o documento do curso
    await deleteDoc(doc(db, "courses", courseId));

    console.log("Curso excluído com sucesso!");
    return true;

  } catch (error) {
    console.error("Erro fatal ao excluir curso:", error);
    throw error;
  }
}