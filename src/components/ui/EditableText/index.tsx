"use client";

import { useState, useRef, useEffect } from "react";
import styles from "./styles.module.css";
import { Edit2, Loader2, Check, X } from "lucide-react";

interface EditableTextProps {
  initialValue: string;
  onSave: (newValue: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string; // Para estilizar o texto quando não está editando
}

export default function EditableText({ 
  initialValue, 
  onSave, 
  isLoading = false, 
  placeholder = "Digite...",
  className = ""
}: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sincroniza se o valor externo mudar
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  // Foca no input ao entrar no modo edição
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (value.trim() === "") {
        setValue(initialValue); // Reverte se vazio
        setIsEditing(false);
        return;
    }
    if (value !== initialValue) {
        onSave(value);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setValue(initialValue);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") handleCancel();
  };

  if (isEditing) {
    return (
      <div className={styles.editContainer}>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave} // Salva ao clicar fora (comportamento padrão Notion/Trello)
          className={styles.input}
          placeholder={placeholder}
          disabled={isLoading}
        />
        {/* Ícones de ação flutuantes (opcional, bom para mobile) */}
        <div className={styles.actions}>
            {isLoading ? <Loader2 size={14} className={styles.spin}/> : null}
        </div>
      </div>
    );
  }

  return (
    <div 
        className={`${styles.displayContainer} ${className}`} 
        onClick={() => setIsEditing(true)}
        title="Clique para editar"
    >
      <span>{value}</span>
      <Edit2 size={12} className={styles.editIcon} />
    </div>
  );
}