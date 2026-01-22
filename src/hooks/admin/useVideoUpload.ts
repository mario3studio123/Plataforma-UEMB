"use client";

import { useState, useCallback, useRef, useEffect } from "react"; // Adicione useEffect
import { ref, uploadBytesResumable, getDownloadURL, deleteObject, UploadTask } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { useToast } from "@/context/ToastContext";
import { VideoMetadata } from "@/lib/schemas/courseSchemas";
import { getVideoDuration } from "@/utils/mediaUtils";

type UploadSuccessCallback = (url: string, meta: VideoMetadata) => void;

interface UseVideoUploadReturn {
  uploading: boolean;
  progress: number;
  videoUrl: string | null;
  videoMeta: VideoMetadata | null;
  startUpload: (file: File, path: string) => Promise<void>;
  cancelUpload: () => void;
  removeVideo: () => Promise<void>;
  resetState: () => void;
}

export function useVideoUpload(
    initialUrl?: string, 
    initialMeta?: VideoMetadata,
    onSuccess?: UploadSuccessCallback
): UseVideoUploadReturn {
  
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(initialUrl || null);
  const [videoMeta, setVideoMeta] = useState<VideoMetadata | null>(initialMeta || null);
  
  const uploadTaskRef = useRef<UploadTask | null>(null);
  const { addToast } = useToast();

  // 🔥 CORREÇÃO 1: Pattern "Latest Ref" para callbacks
  // Isso impede que o startUpload seja recriado se o componente pai renderizar
  const onSuccessRef = useRef(onSuccess);
  
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  const startUpload = useCallback(async (file: File, folderPath: string) => {
    // 1. Validações
    if (!file.type.startsWith("video/")) {
      addToast("Apenas arquivos de vídeo são permitidos.", "warning");
      return;
    }
    const MAX_SIZE = 2 * 1024 * 1024 * 1024; 
    if (file.size > MAX_SIZE) {
      addToast("O vídeo excede o limite de 2GB.", "warning");
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      // 2. Extração de Metadados
      let duration = 0;
      try {
        duration = await getVideoDuration(file);
      } catch (e) {
        console.warn("Falha ao ler duração local:", e);
      }

      const meta: VideoMetadata = {
        duration: Math.round(duration),
        size: file.size,
        filename: file.name,
        mimeType: file.type
      };
      
      setVideoMeta(meta);

      // 3. Upload
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
      const uniqueName = `${Date.now()}_${sanitizedName}`;
      const fullPath = `${folderPath}/${uniqueName}`;
      const storageRef = ref(storage, fullPath);

      const uploadTask = uploadBytesResumable(storageRef, file, {
        customMetadata: { 
            originalName: file.name,
            duration: String(duration) 
        }
      });
      
      uploadTaskRef.current = uploadTask;

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setProgress(p);
        },
        (error) => {
          if (error.code !== 'storage/canceled') {
             console.error("Erro no upload:", error);
             addToast("Falha no upload.", "error");
          }
          setUploading(false);
          setVideoMeta(null);
        },
        async () => {
          // Upload completado com sucesso
          const publicUrl = await getDownloadURL(uploadTask.snapshot.ref);
          
          setVideoUrl(publicUrl);
          setUploading(false);
          uploadTaskRef.current = null;
          
          // 🔥 CORREÇÃO 2: Chama a referência estável
          if (onSuccessRef.current) {
              onSuccessRef.current(publicUrl, meta);
          }
        }
      );

    } catch (error) {
      console.error("Erro fatal upload:", error);
      setUploading(false);
    }
  }, [addToast]); // Removemos onSuccess das dependências para estabilizar a função

  const cancelUpload = useCallback(() => {
    if (uploadTaskRef.current) {
      uploadTaskRef.current.cancel();
      setUploading(false);
      setProgress(0);
      setVideoMeta(null);
      addToast("Upload cancelado.", "info");
    }
  }, [addToast]);

  const removeVideo = useCallback(async () => {
    if (!videoUrl) return;
    try {
      const urlObj = new URL(videoUrl);
      const pathName = urlObj.pathname;
      const decodedPath = decodeURIComponent(pathName.split('/o/')[1].split('?')[0]);
      
      const fileRef = ref(storage, decodedPath);
      await deleteObject(fileRef);
      
      setVideoUrl(null);
      setVideoMeta(null);
      addToast("Vídeo removido.", "info");
    } catch (error: any) {
      console.warn("Erro ao deletar vídeo:", error);
      // Mesmo com erro (ex: já deletado), limpamos o estado visual
      setVideoUrl(null);
      setVideoMeta(null);
    }
  }, [videoUrl, addToast]);

  const resetState = useCallback(() => {
      setVideoUrl(null);
      setVideoMeta(null);
      setProgress(0);
      setUploading(false);
  }, []);

  return { uploading, progress, videoUrl, videoMeta, startUpload, cancelUpload, removeVideo, resetState };
}