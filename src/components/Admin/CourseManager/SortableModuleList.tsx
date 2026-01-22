// src/components/admin/CourseManager/SortableModuleList.tsx
"use client";

import { 
  DndContext, 
  closestCorners, 
  DragOverlay, 
  defaultDropAnimationSideEffects,
  DropAnimation
} from "@dnd-kit/core";
import { 
  SortableContext, 
  verticalListSortingStrategy 
} from "@dnd-kit/sortable";
import { createPortal } from "react-dom";

// Componentes
import ModuleItem from "./ModuleItem";
import ModuleCreationRow from "./ModuleCreationRow";

// Contexto e Hooks
import { useCourseEditor } from "@/context/admin/CourseEditorContext";
import { useCourseDragDrop } from "@/hooks/admin/useCourseDragDrop";

export default function SortableModuleList() {
  // 1. Consome os dados do contexto (Single Source of Truth)
  const { courseId, modules } = useCourseEditor();
  
  // 2. Inicializa a lógica de Drag & Drop isolada no Hook
  const { 
    sensors, 
    activeId, 
    activeItem, 
    handleDragStart, 
    handleDragOver, 
    handleDragEnd 
  } = useCourseDragDrop(courseId, modules);

  // Configuração da animação ao soltar o item (suavidade)
  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({ 
      styles: { 
        active: { opacity: '0.4' } 
      } 
    }),
  };

  return (
    <DndContext 
      sensors={sensors} 
      collisionDetection={closestCorners} 
      onDragStart={handleDragStart}
      onDragOver={handleDragOver} 
      onDragEnd={handleDragEnd}
    >
      {/* Contexto de Ordenação Vertical para os Módulos */}
      <SortableContext 
        items={modules.map(m => m.id)} 
        strategy={verticalListSortingStrategy}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Lista de Módulos */}
          {modules.map((mod) => (
            <ModuleItem key={mod.id} module={mod} />
          ))}

          {/* Botão/Input de Criação no final da lista */}
          <ModuleCreationRow />
          
        </div>
      </SortableContext>

      {/* DRAG OVERLAY:
          Este é o elemento que "voa" seguindo o mouse.
          Renderizamos via Portal no body para garantir que fique acima de tudo (z-index).
      */}
      {typeof document !== 'undefined' && createPortal(
        <DragOverlay dropAnimation={dropAnimation}>
          {activeId && activeItem ? (
             <div style={{ 
                background: '#2d2833', 
                padding: '16px 24px', 
                borderRadius: 12, 
                border: '1px solid #CA8DFF',
                boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
                color: '#fff',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: 'grabbing'
             }}>
               {/* Identificamos visualmente se é Módulo ou Aula.
                  O hook useCourseDragDrop preenche activeItem com o objeto correto.
               */}
               <span style={{ 
                 fontSize: '0.8rem', 
                 background: 'rgba(255,255,255,0.1)', 
                 padding: '2px 6px', 
                 borderRadius: 4,
                 textTransform: 'uppercase',
                 color: '#aaa'
               }}>
                 {(activeItem as any).lessons !== undefined ? "MÓDULO" : "AULA"}
               </span>
               
               <span>{(activeItem as any).title}</span>
             </div>
          ) : null}
        </DragOverlay>,
        document.body
      )}
    </DndContext>
  );
}