// src/components/Admin/CourseManager/SortableLessonItem.tsx
"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Edit2, X, FileVideo } from "lucide-react";
import styles from "@/app/dashboard/admin/courses/[id]/manage/styles.module.css";
import { Lesson } from "@/types";

interface SortableLessonItemProps {
  lesson: Lesson;
  moduleId: string;
  onEdit: (modId: string, lesson: Lesson) => void;
  onDelete: (modId: string, lessonId: string) => void;
}

export function SortableLessonItem({ lesson, moduleId, onEdit, onDelete }: SortableLessonItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: lesson.id,
    data: {
      type: "Lesson",
      lesson,
      moduleId 
    }
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    position: "relative" as const,
    zIndex: isDragging ? 999 : "auto",
  };

  return (
    <div ref={setNodeRef} style={style} className={styles.lessonItem}>
      
      {/* Lado Esquerdo: Info */}
      <div className={styles.lessonInfo}>
        {/* Drag Handle separado */}
        <div 
          {...attributes} 
          {...listeners} 
          className={styles.lessonDrag} 
          title="Arrastar Aula"
        >
          <GripVertical size={16} />
        </div>
        
        {/* Ícone Wrapper (Correção do ícone sumindo) */}
        <div className={styles.lessonIconWrapper}>
           <FileVideo size={16} />
        </div>
        
        <span className={styles.lessonTitleText}>{lesson.title}</span>
        
        {lesson.freePreview && (
            <span style={{ 
                fontSize: '0.65rem', 
                background: 'rgba(74,222,128,0.1)', 
                color: '#4ade80', 
                padding: '2px 6px', 
                borderRadius: 4, 
                marginLeft: 8,
                border: '1px solid rgba(74,222,128,0.2)'
            }}>
                Grátis
            </span>
        )}
      </div>

      {/* Lado Direito: Ações */}
      <div className={styles.lessonMeta}>
         <span className={styles.durationBadge}>
            {typeof lesson.duration === 'string' ? lesson.duration : "00:00"}
         </span>
         
         <div style={{ display: 'flex', gap: 4 }}>
            <button 
                onClick={() => onEdit(moduleId, lesson)} 
                className={styles.iconBtn}
                title="Editar Aula"
            >
              <Edit2 size={14} />
            </button>
            
            <button 
                onClick={() => onDelete(moduleId, lesson.id)} 
                className={`${styles.iconBtn} ${styles.danger}`}
                title="Remover Aula"
            >
              <X size={14} />
            </button>
         </div>
      </div>
    </div>
  );
}