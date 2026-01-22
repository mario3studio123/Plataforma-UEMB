// src/hooks/admin/useCourseDragDrop.ts
import { useState } from "react";
import { 
  DragStartEvent, 
  DragOverEvent, 
  DragEndEvent, 
  useSensor, 
  useSensors, 
  PointerSensor, 
  KeyboardSensor 
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Module, Lesson } from "@/types";
import { useCourseStructure } from "./useCourseStructure";

export function useCourseDragDrop(courseId: string, modules: Module[]) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<Module | Lesson | null>(null);
  
  // Hook de estrutura que já tínhamos (ele chama as Server Actions)
  const { moveModule, moveLesson } = useCourseStructure(courseId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  // Helper para achar onde o item está
  const findContainer = (id: string): string | undefined => {
    if (modules.find((m) => m.id === id)) return id;
    return modules.find((m) => m.lessons.some((l) => l.id === id))?.id;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    // Identifica o que estamos arrastando para renderizar o Overlay correto
    if (active.data.current?.type === "Module") setActiveItem(active.data.current.module);
    if (active.data.current?.type === "Lesson") setActiveItem(active.data.current.lesson);
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Lógica puramente visual (opcional aqui se não usar virtualização)
    // O dnd-kit lida bem com isso, mas se precisar de realce especial, é aqui.
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const activeType = active.data.current?.type;

    if (!over) {
      resetDrag();
      return;
    }

    // 1. Lógica para MÓDULOS
    if (activeType === "Module" && active.id !== over.id) {
      const oldIndex = modules.findIndex((m) => m.id === active.id);
      const newIndex = modules.findIndex((m) => m.id === over.id);
      
      // Cria novo array ordenado
      const reordered = arrayMove(modules, oldIndex, newIndex);
      
      // Dispara atualização (Otimista + Server Action)
      moveModule(reordered);
    }

    // 2. Lógica para AULAS
    if (activeType === "Lesson") {
      const activeContainer = findContainer(active.id as string);
      const overContainer = findContainer(over.id as string);

      if (activeContainer && overContainer) {
        const activeModuleIndex = modules.findIndex(m => m.id === activeContainer);
        const overModuleIndex = modules.findIndex(m => m.id === overContainer);
        
        // Simulação da nova estrutura
        const newModules = [...modules];
        const activeLessons = [...newModules[activeModuleIndex].lessons];
        const overLessons = activeContainer === overContainer 
          ? activeLessons 
          : [...newModules[overModuleIndex].lessons];

        const oldIndex = activeLessons.findIndex(l => l.id === active.id);
        const newIndex = overLessons.findIndex(l => l.id === over.id);

        let finalNewIndex = newIndex;
        if (newIndex === -1) finalNewIndex = overLessons.length;

        // Se houve mudança real
        if (activeContainer !== overContainer || oldIndex !== finalNewIndex) {
            // Aplica mudança no array clonado para enviar o estado "futuro"
            if (activeContainer === overContainer) {
                newModules[activeModuleIndex] = {
                    ...newModules[activeModuleIndex],
                    lessons: arrayMove(activeLessons, oldIndex, finalNewIndex)
                };
            } else {
                const [movedItem] = activeLessons.splice(oldIndex, 1);
                overLessons.splice(finalNewIndex, 0, movedItem);
                newModules[activeModuleIndex] = { ...newModules[activeModuleIndex], lessons: activeLessons };
                newModules[overModuleIndex] = { ...newModules[overModuleIndex], lessons: overLessons };
            }

            // Dispara ação
            moveLesson(
                active.id as string,
                activeContainer,
                overContainer,
                finalNewIndex,
                newModules
            );
        }
      }
    }

    resetDrag();
  };

  const resetDrag = () => {
    setActiveId(null);
    setActiveItem(null);
  };

  return {
    sensors,
    activeId,
    activeItem,
    handleDragStart,
    handleDragOver,
    handleDragEnd
  };
}