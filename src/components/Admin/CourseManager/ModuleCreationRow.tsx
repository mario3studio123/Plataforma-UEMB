"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, X, Check, Loader2 } from "lucide-react";
import styles from "./ModuleCreationRow.module.css";
import { useCourseEditor } from "@/context/admin/CourseEditorContext";

export default function ModuleCreationRow() {
  const { createModule, isLoading } = useCourseEditor();
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCreating && inputRef.current) {
        inputRef.current.focus();
    }
  }, [isCreating]);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    
    // Dispara a criação
    createModule(title);
    
    // Reseta
    setTitle("");
    setIsCreating(false); 
    // Nota: Como o React Query atualiza a lista, o novo módulo aparecerá automaticamente.
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
    if (e.key === "Escape") {
        setIsCreating(false);
        setTitle("");
    }
  };

  if (isCreating) {
    return (
        <div className={styles.creationContainer}>
            <input 
                ref={inputRef}
                className={styles.input}
                placeholder="Nome do novo módulo..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => !title && setIsCreating(false)} // Fecha se vazio ao sair
            />
            <div className={styles.actions}>
                <button onClick={() => setIsCreating(false)} className={styles.cancelBtn}>
                    <X size={18} />
                </button>
                <button onClick={handleSubmit} className={styles.confirmBtn} disabled={isLoading || !title.trim()}>
                    {isLoading ? <Loader2 size={18} className={styles.spin} /> : <Check size={18} />}
                </button>
            </div>
        </div>
    );
  }

  return (
    <button onClick={() => setIsCreating(true)} className={styles.addButton}>
        <Plus size={20} />
        <span>Adicionar novo módulo</span>
    </button>
  );
}