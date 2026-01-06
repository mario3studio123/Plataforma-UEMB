// src/services/storageService.ts
import { storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";

export type UploadProgressCallback = (progress: number) => void;

/**
 * Faz upload de um arquivo com monitoramento de progresso.
 * @param file O arquivo (File) vindo do input
 * @param path O caminho no storage (ex: courses/ID/aula1.mp4)
 * @param onProgress Callback para atualizar a barra de progresso (0 a 100)
 */
export const uploadFile = (
  file: File, 
  path: string, 
  onProgress: UploadProgressCallback
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, path);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress(progress);
      },
      (error) => {
        reject(error);
      },
      async () => {
        // Upload completado com sucesso
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(downloadURL);
      }
    );
  });
};

/**
 * Deleta um arquivo antigo se o usuário substituir o vídeo
 */
export const deleteFile = async (url: string) => {
  try {
    const fileRef = ref(storage, url);
    await deleteObject(fileRef);
  } catch (error) {
    console.warn("Erro ao deletar arquivo (pode não existir mais):", error);
  }
};