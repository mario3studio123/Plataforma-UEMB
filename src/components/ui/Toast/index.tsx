"use client";

import { useEffect, useRef } from "react";
import { ToastMessage } from "@/context/ToastContext";
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from "lucide-react";
import styles from "./styles.module.css";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

interface ToastContainerProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

export default function ToastContainer({ toasts, removeToast }: ToastContainerProps) {
  return (
    <div className={styles.container}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

// Componente Individual para controlar animação de cada um
function ToastItem({ toast, onRemove }: { toast: ToastMessage; onRemove: () => void }) {
  const elRef = useRef<HTMLDivElement>(null);

  // Ícones baseados no tipo
  const icons = {
    success: <CheckCircle size={20} className={styles.iconSuccess} />,
    error: <AlertCircle size={20} className={styles.iconError} />,
    warning: <AlertTriangle size={20} className={styles.iconWarning} />,
    info: <Info size={20} className={styles.iconInfo} />,
  };

  useGSAP(() => {
    // Animação de Entrada (Slide da direita + Fade)
    gsap.fromTo(elRef.current, 
      { x: 50, opacity: 0, scale: 0.9 },
      { x: 0, opacity: 1, scale: 1, duration: 0.4, ease: "back.out(1.2)" }
    );
  }, []); // Roda ao montar

  const handleManualClose = () => {
    // Animação de Saída antes de remover do estado
    gsap.to(elRef.current, {
        x: 50, opacity: 0, scale: 0.9, duration: 0.3,
        onComplete: onRemove
    });
  };

  return (
    <div className={`${styles.toast} ${styles[toast.type]}`} ref={elRef}>
      <div className={styles.iconWrapper}>
        {icons[toast.type]}
      </div>
      <p className={styles.message}>{toast.message}</p>
      <button onClick={handleManualClose} className={styles.closeBtn}>
        <X size={16} />
      </button>
      
      {/* Barra de progresso do tempo (Visual extra) */}
      <div className={styles.progressBar}>
        <div className={styles.progressFill} />
      </div>
    </div>
  );
}