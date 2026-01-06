"use client";

import { useState, useRef } from "react";
import { UploadCloud, FileVideo, CheckCircle, X, Loader2 } from "lucide-react";
import styles from "./styles.module.css";
import { uploadFile, deleteFile } from "@/services/storageService";

interface VideoUploaderProps {
  folderPath: string; // Ex: courses/123/modules/456
  currentVideoUrl?: string; // Se já existir um vídeo (edição)
  onUploadComplete: (url: string, fileName: string) => void;
  onRemove: () => void; // Para limpar o campo no pai
}

export default function VideoUploader({ folderPath, currentVideoUrl, onUploadComplete, onRemove }: VideoUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentVideoUrl || null);

  const inputRef = useRef<HTMLInputElement>(null);

  // --- Handlers de Drag & Drop ---
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  // --- Lógica de Upload ---
  const handleFile = async (selectedFile: File) => {
    // Validação básica
    if (!selectedFile.type.startsWith("video/")) {
      alert("Por favor, selecione apenas arquivos de vídeo.");
      return;
    }

    setFile(selectedFile);
    setUploading(true);
    setProgress(0);

    // Se já tinha um vídeo antes e estamos trocando, seria bom deletar o antigo?
    // Por segurança, muitas vezes deixamos órfão ou deletamos só ao salvar o form final.
    // Aqui vou assumir que sobrescrevemos visualmente.

    try {
      // Cria um nome único com timestamp para evitar cache ou sobrescrita errada
      const uniqueName = `${Date.now()}_${selectedFile.name}`;
      const fullPath = `${folderPath}/${uniqueName}`;

      const url = await uploadFile(selectedFile, fullPath, (prog) => {
        setProgress(prog);
      });

      setPreviewUrl(url);
      onUploadComplete(url, uniqueName);
    } catch (error) {
      console.error("Erro no upload:", error);
      alert("Falha ao enviar vídeo.");
      setFile(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveVideo = async () => {
    if (previewUrl && !uploading) {
        // Opcional: Deletar do storage imediatamente ou esperar o "Salvar" do form pai.
        // Para economizar storage, vamos deletar se for um upload recente.
        if (confirm("Remover este vídeo?")) {
            // await deleteFile(previewUrl); // Descomente se quiser deletar do storage na hora
            setPreviewUrl(null);
            setFile(null);
            setProgress(0);
            onRemove();
        }
    }
  };

  return (
    <div className={styles.container}>
      {/* Estado 1: Nenhum vídeo selecionado */}
      {!previewUrl && !uploading && (
        <div 
            className={`${styles.dropZone} ${dragActive ? styles.active : ""}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
        >
          <input 
            ref={inputRef} 
            type="file" 
            accept="video/*" 
            onChange={handleChange} 
            hidden 
          />
          <div className={styles.iconCircle}>
            <UploadCloud size={24} color="#CA8DFF" />
          </div>
          <p className={styles.dropText}>
            Clique ou arraste o vídeo aqui <br />
            <span>(MP4, WebM - Max 500MB)</span>
          </p>
        </div>
      )}

      {/* Estado 2: Upload em andamento */}
      {uploading && (
        <div className={styles.uploadingState}>
            <div className={styles.fileInfo}>
                <FileVideo size={20} color="#ccc" />
                <span className={styles.fileName}>{file?.name}</span>
            </div>
            <div className={styles.progressBarBg}>
                <div 
                    className={styles.progressBarFill} 
                    style={{ width: `${progress}%` }} 
                />
            </div>
            <span className={styles.percentage}>{Math.round(progress)}%</span>
        </div>
      )}

      {/* Estado 3: Vídeo Pronto / Preview */}
      {previewUrl && !uploading && (
        <div className={styles.previewState}>
            <video src={previewUrl} className={styles.miniVideo} controls />
            <div className={styles.previewInfo}>
                <span className={styles.successBadge}>
                    <CheckCircle size={14} /> Upload Concluído
                </span>
                <button 
                    type="button" 
                    onClick={handleRemoveVideo} 
                    className={styles.removeBtn}
                >
                    <X size={16} /> Remover
                </button>
            </div>
        </div>
      )}
    </div>
  );
}