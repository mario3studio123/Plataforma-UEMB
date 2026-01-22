// src/components/admin/CourseManager/LessonModal.tsx
"use client";

import { useRef } from "react";
import { X, Clock, Zap, Loader2, Save, FileText, Lock, Unlock } from "lucide-react";
import VideoUploader from "@/components/Admin/VideoUploader";
import styles from "@/app/dashboard/admin/courses/[id]/manage/styles.module.css";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useLessonForm } from "@/hooks/admin/useLessonForm";

interface LessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: string;
  moduleId: string;
  lessonId?: string;
  initialData?: any;
}

export default function LessonModal({
  isOpen,
  onClose,
  courseId,
  moduleId,
  lessonId,
  initialData,
}: LessonModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  const { 
    form, 
    errors, 
    isSubmitting, 
    handleChange, 
    handleVideoSuccess, 
    handleRemoveVideo, 
    handleSubmit 
  } = useLessonForm({
    courseId,
    moduleId,
    lessonId,
    initialData,
    onSuccess: onClose
  });

  useGSAP(() => {
    if (isOpen && modalRef.current) {
      gsap.fromTo(modalRef.current, 
        { scale: 0.95, opacity: 0, y: 10 }, 
        { scale: 1, opacity: 1, y: 0, duration: 0.3, ease: "back.out(1.2)" }
      );
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent} ref={modalRef}>
        
        <div className={styles.modalHeader}>
          <h3>{lessonId ? "Editar Aula" : "Nova Aula"}</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <div className={styles.modalBody}>
          
          <div className={styles.formGroup}>
            <label>Título da Aula</label>
            <input 
              value={form.title} 
              onChange={e => handleChange('title', e.target.value)} 
              placeholder="Ex: 1. Introdução ao Processo" 
              autoFocus 
            />
            {errors.title && <span className={styles.errorText}>{errors.title}</span>}
          </div>

          <div className={styles.formGroup}>
             <label>Vídeo da Aula</label>
             <VideoUploader 
               folderPath={`courses/${courseId}/modules/${moduleId}`} 
               currentVideoUrl={form.videoUrl}
               
               onSuccess={handleVideoSuccess}
               
               onRemove={handleRemoveVideo}
             />
             {errors.videoUrl && <span className={styles.errorText}>{errors.videoUrl}</span>}
          </div>

          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label><Clock size={14} /> Duração (MM:SS)</label>
              <input 
                value={form.durationStr} 
                onChange={e => handleChange('durationStr', e.target.value)} 
                placeholder="00:00" 
              />
              {errors.durationStr && <span className={styles.errorText}>{errors.durationStr}</span>}
            </div>
            
            <div className={styles.formGroup}>
              <label><Zap size={14} /> Recompensa XP</label>
              <input 
                type="number" 
                value={form.xpReward} 
                onChange={e => handleChange('xpReward', Number(e.target.value))} 
                min={10}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label><FileText size={14} /> Descrição / Resumo</label>
            <textarea 
              rows={3}
              value={form.description} 
              onChange={e => handleChange('description', e.target.value)}
              placeholder="Opcional: Resumo do que é ensinado nesta aula..."
            />
          </div>

          <div className={styles.formGroup}>
             <button 
                type="button"
                className={styles.addModuleBtn} 
                style={{ 
                    background: form.freePreview ? 'rgba(74, 222, 128, 0.1)' : '#1a1620',
                    border: form.freePreview ? '1px solid #4ade80' : '1px dashed #444',
                    color: form.freePreview ? '#4ade80' : '#888',
                    justifyContent: 'center'
                }}
                onClick={() => handleChange('freePreview', !form.freePreview)}
             >
                {form.freePreview ? <Unlock size={16}/> : <Lock size={16}/>}
                <span>{form.freePreview ? "Aula Aberta (Gratuita)" : "Conteúdo Exclusivo (Padrão)"}</span>
             </button>
          </div>

        </div>

        <div className={styles.modalFooter}>
          <button 
            onClick={handleSubmit} 
            className={styles.saveBtnFull} 
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <><Loader2 className={styles.spin} size={18} /> Salvando...</>
            ) : (
              <><Save size={18} /> Salvar Aula</>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}