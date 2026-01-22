"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { toggleCoursePublishAction } from "@/app/actions/admin/publishingActions";
import styles from "./styles.module.css"; // Vamos criar um CSS específico para ele

interface PublishToggleProps {
  courseId: string;
  isPublished: boolean;
}

export default function PublishToggle({ courseId, isPublished }: PublishToggleProps) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Estado local otimista para feedback instantâneo
  const [status, setStatus] = useState(isPublished);

  const handleToggle = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const token = await user.getIdToken();
      // Chama a Server Action
      const result = await toggleCoursePublishAction(token, courseId, status);

      if (result.success) {
        setStatus(result.newStatus); // Confirma a mudança visual
        addToast(result.message, "success");
      } else {
        // Reverte se deu erro
        addToast(result.message, "error");
      }
    } catch (error) {
      addToast("Erro de conexão ao publicar.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.statusInfo}>
        <span className={styles.label}>Status:</span>
        <span className={`${styles.badge} ${status ? styles.published : styles.draft}`}>
          {status ? "PUBLICADO" : "RASCUNHO"}
        </span>
      </div>

      <button 
        onClick={handleToggle} 
        disabled={loading}
        className={`${styles.toggleBtn} ${status ? styles.btnDraft : styles.btnPublish}`}
        title={status ? "Ocultar curso" : "Tornar visível para alunos"}
      >
        {loading ? (
          <Loader2 size={18} className={styles.spin} />
        ) : status ? (
          <>
            <EyeOff size={18} />
            <span>Despublicar</span>
          </>
        ) : (
          <>
            <Eye size={18} />
            <span>Publicar Agora</span>
          </>
        )}
      </button>
    </div>
  );
}