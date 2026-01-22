import { create } from 'zustand';
import { Lesson, Module } from '@/types';

type ContentType = 'lesson' | 'quiz';

interface PlayerState {
  // Estado
  activeCourseId: string | null;
  activeModuleId: string | null;
  activeLesson: Lesson | null;
  contentType: ContentType;
  
  // Ações
  initialize: (courseId: string, module: Module, lesson: Lesson) => void;
  setActiveLesson: (lesson: Lesson, moduleId: string) => void;
  openQuiz: (moduleId: string) => void;
  reset: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  activeCourseId: null,
  activeModuleId: null,
  activeLesson: null,
  contentType: 'lesson',

  initialize: (courseId, module, lesson) => set({
    activeCourseId: courseId,
    activeModuleId: module.id,
    activeLesson: lesson,
    contentType: 'lesson'
  }),

  setActiveLesson: (lesson, moduleId) => set({
    activeLesson: lesson,
    activeModuleId: moduleId,
    contentType: 'lesson'
  }),

  openQuiz: (moduleId) => set({
    activeModuleId: moduleId,
    contentType: 'quiz',
    activeLesson: null
  }),

  reset: () => set({
    activeCourseId: null,
    activeModuleId: null,
    activeLesson: null,
    contentType: 'lesson'
  })
}));