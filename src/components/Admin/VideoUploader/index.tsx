"use client";

import { useState, useRef } from "react";
import { UploadCloud, CheckCircle, X, Loader2, PlayCircle } from "lucide-react";
import styles from "./styles.module.css";
import { useVideoUpload } from "@/hooks/admin/useVideoUpload";
import { VideoMetadata } from "@/lib/schemas/courseSchemas";

interface VideoUploaderProps {
  folderPath: string;
  currentVideoUrl?: string;
  // MUDANÇA AQUI: Removemos os dois separados e usamos um único
  onSuccess: (url: string, meta: VideoMetadata) => void;
  onRemove: () => void;
}

export default function VideoUploader({ 
  folderPath, 
  currentVideoUrl, 
  onSuccess, // Recebe a função unificada
  onRemove 
}: VideoUploaderProps) {
  
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  // Hook configurado para chamar o onSuccess direto
  const { 
    uploading, 
    progress, 
    videoUrl, 
    videoMeta, 
    startUpload, 
    cancelUpload, 
    removeVideo 
  } = useVideoUpload(
    currentVideoUrl, 
    undefined, 
    // Callback Interno: Repassa tudo direto para o pai
    (url, meta) => {
      onSuccess(url, meta);
    }
  );

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      startUpload(e.dataTransfer.files[0], folderPath);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      startUpload(e.target.files[0], folderPath);
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleManualRemove = async () => {
      if (confirm("Tem certeza? O vídeo será removido.")) {
          await removeVideo();
          onRemove();
      }
  };

  return (
    <div className={styles.container}>
      {/* 1. UPLOADING */}
      {uploading && (
        <div className={styles.uploadingState}>
            <div className={styles.uploadHeader}>
                <div className={styles.fileInfo}>
                    <Loader2 size={18} className={styles.spin} color="#915bf5" />
                    <span className={styles.fileName}>{videoMeta?.filename || "Enviando..."}</span>
                </div>
                <button onClick={cancelUpload} className={styles.cancelTextBtn}>Cancelar</button>
            </div>
            <div className={styles.progressBarBg}>
                <div className={styles.progressBarFill} style={{ width: `${progress}%` }} />
            </div>
            <p className={styles.uploadStatus}>{Math.round(progress)}% concluído</p>
        </div>
      )}

      {/* 2. SUCESSO / PREVIEW */}
      {!uploading && videoUrl && (
        <div className={styles.previewState}>
            <div className={styles.previewContent}>
                <div className={styles.videoIconBox}>
                    <PlayCircle size={24} color="#fff" />
                </div>
                <div className={styles.previewInfo}>
                    <div className={styles.successBadge}>
                        <CheckCircle size={14} className={styles.iconSuccess} />
                        <span>Vídeo Carregado</span>
                    </div>
                    {videoMeta && videoMeta.duration > 0 && (
                        <span className={styles.fileMeta}>
                            Duração: {Math.floor(videoMeta.duration / 60)}:{String(Math.round(videoMeta.duration % 60)).padStart(2, '0')}
                        </span>
                    )}
                </div>
            </div>
            <button type="button" onClick={handleManualRemove} className={styles.removeBtn}>
                <X size={18} />
            </button>
        </div>
      )}

      {/* 3. DROPZONE */}
      {!uploading && !videoUrl && (
        <div 
            className={`${styles.dropZone} ${dragActive ? styles.active : ""}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
        >
          <input ref={inputRef} type="file" accept="video/mp4,video/webm" onChange={handleChange} hidden />
          <div className={styles.iconCircle}><UploadCloud size={24} color="#CA8DFF" /></div>
          <div className={styles.dropTextContent}>
            <p className={styles.dropTextMain}>Clique ou arraste o vídeo</p>
            <p className={styles.dropTextSub}>MP4 ou WebM (Máx 2GB)</p>
          </div>
        </div>
      )}
    </div>
  );
}