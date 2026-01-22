// src/hooks/useVideoShortcuts.ts
import { useEffect, RefObject } from "react"; // <--- Adicionado RefObject aqui

interface ShortcutsProps {
  videoRef: RefObject<HTMLVideoElement | null>; // <--- Tipo corrigido para aceitar null inicial
  togglePlay: () => void;
  toggleFullscreen: () => void;
  toggleMute: () => void;
  seek: (seconds: number) => void;
  volumeChange: (delta: number) => void;
}

export function useVideoShortcuts({
  videoRef,
  togglePlay,
  toggleFullscreen,
  toggleMute,
  seek,
  volumeChange
}: ShortcutsProps) {
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se o usuário estiver digitando em um input ou textarea
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === "input" || activeTag === "textarea") return;

      switch (e.key.toLowerCase()) {
        case " ": // Espaço
        case "k":
          e.preventDefault(); // Evita scroll da página
          togglePlay();
          break;
        case "f":
          toggleFullscreen();
          break;
        case "m":
          toggleMute();
          break;
        case "arrowleft":
          seek(-5); // Volta 5s
          break;
        case "arrowright":
          seek(5); // Avança 5s
          break;
        case "arrowup":
          e.preventDefault();
          volumeChange(0.1);
          break;
        case "arrowdown":
          e.preventDefault();
          volumeChange(-0.1);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [videoRef, togglePlay, toggleFullscreen, toggleMute, seek, volumeChange]);
}