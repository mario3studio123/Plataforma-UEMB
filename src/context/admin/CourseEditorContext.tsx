// src/context/admin/CourseEditorContext.tsx
"use client";

import { createContext, useContext, ReactNode, useState, useCallback } from "react";
import { Course, Module, Lesson } from "@/types";
import { useAdminCourseData, useAdminCourseMutations } from "@/hooks/admin/useAdminCourse";

// --- DEFINIÇÃO DO CONTRATO DO CONTEXTO ---
interface CourseEditorContextType {
  // Dados Principais
  courseId: string;
  course: Course | undefined;
  modules: Module[];
  isLoading: boolean;
  
  // Estados de UI (Controle de Modais e Seleção)
  activeModal: 'lesson' | 'quiz' | null;
  selectedModuleId: string | null;
  selectedLesson: Lesson | null; // Se null, é criação. Se preenchido, é edição.
  
  // Ações de UI (Abrir/Fechar Modais)
  openLessonModal: (moduleId: string, lesson?: Lesson) => void;
  openQuizEditor: (moduleId: string) => void;
  closeModals: () => void;
  
  // Ações de Dados (Mutations expostas para os componentes filhos)
  createModule: (title: string) => void;
  updateModule: (moduleId: string, title: string) => void;
  deleteModule: (moduleId: string) => void;
  deleteLesson: (moduleId: string, lessonId: string) => void;
}

const CourseEditorContext = createContext<CourseEditorContextType | undefined>(undefined);

// --- PROVIDER ---
export function CourseEditorProvider({ 
  children, 
  courseId 
}: { 
  children: ReactNode; 
  courseId: string 
}) {
  // 1. Busca Dados e Mutações (Hooks Refatorados)
  const { data, isLoading } = useAdminCourseData(courseId);
  const mutations = useAdminCourseMutations(courseId);

  // 2. Estados Locais de UI (Modais)
  const [activeModal, setActiveModal] = useState<CourseEditorContextType['activeModal']>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

  // 3. Handlers de UI (Abertura de Modais)
  const openLessonModal = useCallback((moduleId: string, lesson: Lesson | null = null) => {
    setSelectedModuleId(moduleId);
    setSelectedLesson(lesson);
    setActiveModal('lesson');
  }, []);

  const openQuizEditor = useCallback((moduleId: string) => {
    setSelectedModuleId(moduleId);
    setActiveModal('quiz');
  }, []);

  const closeModals = useCallback(() => {
    setActiveModal(null);
    setSelectedModuleId(null);
    setSelectedLesson(null);
  }, []);

  // 4. Wrappers para Mutations (Lógica de Negócio + Feedback Básico)
  
  const handleCreateModule = useCallback((title: string) => {
    const currentOrder = data?.modules?.length || 0;
    mutations.createModule.mutate({ title, order: currentOrder });
  }, [data?.modules, mutations.createModule]);

  const handleUpdateModule = useCallback((moduleId: string, title: string) => {
    // A validação fina já está na Server Action, mas evitamos chamadas inúteis aqui
    if (title.trim() !== "") {
        mutations.updateModule.mutate({ moduleId, title });
    }
  }, [mutations.updateModule]);

  const handleDeleteModule = useCallback((moduleId: string) => {
    // Futuramente: Substituir por um Modal de Confirmação customizado
    if (window.confirm("Tem certeza? Isso apagará todas as aulas e vídeos deste módulo permanentemente.")) {
      mutations.deleteModule.mutate(moduleId);
    }
  }, [mutations.deleteModule]);

  const handleDeleteLesson = useCallback((moduleId: string, lessonId: string) => {
    if (window.confirm("Excluir esta aula permanentemente? O vídeo será removido.")) {
      mutations.deleteLesson.mutate({ moduleId, lessonId });
    }
  }, [mutations.deleteLesson]);

  // 5. Montagem do Objeto de Valor
  const contextValue: CourseEditorContextType = {
    courseId,
    course: data?.course,
    modules: data?.modules || [],
    isLoading,
    
    // UI State
    activeModal,
    selectedModuleId,
    selectedLesson,
    
    // UI Actions
    openLessonModal,
    openQuizEditor,
    closeModals,
    
    // Data Actions
    createModule: handleCreateModule,
    updateModule: handleUpdateModule,
    deleteModule: handleDeleteModule,
    deleteLesson: handleDeleteLesson,
  };

  return (
    <CourseEditorContext.Provider value={contextValue}>
      {children}
    </CourseEditorContext.Provider>
  );
}

// --- HOOK CONSUMIDOR ---
export function useCourseEditor() {
  const context = useContext(CourseEditorContext);
  if (!context) {
    throw new Error("useCourseEditor deve ser usado dentro de um CourseEditorProvider");
  }
  return context;
}