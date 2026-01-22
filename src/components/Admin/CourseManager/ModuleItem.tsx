// src/components/admin/CourseManager/ModuleItem.tsx
"use client";

import { useSortable } from "@dnd-kit/sortable";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Zap, Plus } from "lucide-react";
import styles from "@/app/dashboard/admin/courses/[id]/manage/styles.module.css";
import { Module } from "@/types";
import { SortableLessonItem } from "./SortableLessonItem";
import { useCourseEditor } from "@/context/admin/CourseEditorContext";
import EditableText from "@/components/ui/EditableText";

interface ModuleItemProps {
  module: Module;
}

export default function ModuleItem({ module }: ModuleItemProps) {
  // 1. Consome Ações do Contexto (Código Limpo)
  const { 
    deleteModule, 
    updateModule,
    openQuizEditor, 
    openLessonModal, 
    deleteLesson 
  } = useCourseEditor();

  // 2. Configura Sortable (Para o próprio Módulo ser arrastável)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: module.id,
    data: { type: "Module", module }
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 999 : "auto", // Garante que fique por cima ao arrastar
    position: "relative" as const
  };

  return (
    <div ref={setNodeRef} style={style} className={styles.moduleItem}>
      
      {/* --- HEADER DO MÓDULO (Barra Escura) --- */}
      <div className={styles.moduleHeader}>
        <div className={styles.moduleTitleGroup}>
          {/* Handle para arrastar o MÓDULO */}
          <div 
            {...attributes} 
            {...listeners} 
            className={styles.dragHandle} 
            title="Arrastar Módulo"
          >
             <GripVertical size={20} />
          </div>
          
          {/* Título Editável (Substitui texto estático) */}
          <EditableText 
            initialValue={module.title}
            onSave={(newTitle) => updateModule(module.id, newTitle)}
            className={styles.moduleName} // Mantém a fonte/cor original
            placeholder="Nome do Módulo"
          />
        </div>
        
        <div className={styles.moduleActions}>
          <button 
            onClick={() => openQuizEditor(module.id)} 
            className={styles.quizBtn} 
            title="Gerenciar Prova"
          >
            <Zap size={14} /> Prova
          </button>
          
          <button 
            onClick={() => deleteModule(module.id)} 
            className={`${styles.iconBtn} ${styles.danger}`}
            title="Excluir Módulo"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* --- ÁREA DE AULAS (Sortable Context Aninhado) --- */}
      <div className={styles.lessonsList}>
        {/* Define que os itens aqui dentro são do tipo "Lesson" e pertencem a este container */}
        <SortableContext 
          id={module.id} 
          items={module.lessons.map(l => l.id)} 
          strategy={verticalListSortingStrategy}
        >
          {module.lessons.map((lesson) => (
            <SortableLessonItem
              key={lesson.id}
              lesson={lesson}
              moduleId={module.id}
              // Passamos as funções do contexto para o item filho
              onEdit={() => openLessonModal(module.id, lesson)}
              onDelete={() => deleteLesson(module.id, lesson.id)}
            />
          ))}
        </SortableContext>

        {/* Empty State: Ajuda visual para soltar aulas em módulos vazios */}
        {module.lessons.length === 0 && (
            <div className={styles.emptyModuleDropZone}>
                Este módulo está vazio. Arraste aulas para cá ou crie uma nova.
            </div>
        )}

        <button onClick={() => openLessonModal(module.id)} className={styles.addLessonBtn}>
          <Plus size={16} /> Adicionar Aula
        </button>
      </div>
    </div>
  );
}