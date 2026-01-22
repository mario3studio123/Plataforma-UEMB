// src/utils/mediaUtils.ts

/**
 * Carrega o vídeo em memória temporária apenas para ler a duração.
 * Retorna a duração em segundos.
 */
export const getVideoDuration = (file: File): Promise<number> => {
  return new Promise((resolve, reject) => {
    try {
      const video = document.createElement('video');
      video.preload = 'metadata';

      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src); // Limpa memória
        resolve(video.duration);
      };

      video.onerror = () => {
        reject("Erro ao carregar metadados do vídeo");
      };

      video.src = window.URL.createObjectURL(file);
    } catch (e) {
      reject(e);
    }
  });
};