// src/utils/formatters.ts

/**
 * 1. Formata segundos para "MM:SS" ou "HH:MM:SS"
 * Ideal para players de vídeo, inputs e listas.
 * * Ex: 
 * - 65 -> "01:05"
 * - 3665 -> "01:01:05"
 * - 0 -> "00:00"
 */
export function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || isNaN(totalSeconds) || totalSeconds < 0) return "00:00";

  const secondsInt = Math.floor(totalSeconds);
  
  const hours = Math.floor(secondsInt / 3600);
  const minutes = Math.floor((secondsInt % 3600) / 60);
  const seconds = Math.floor(secondsInt % 60);

  const mStr = minutes.toString().padStart(2, '0');
  const sStr = seconds.toString().padStart(2, '0');

  if (hours > 0) {
    const hStr = hours.toString().padStart(2, '0');
    return `${hStr}:${mStr}:${sStr}`;
  }

  return `${mStr}:${sStr}`;
}

/**
 * Alias para manter compatibilidade com componentes antigos que usam 'formatTime'
 */
export function formatTime(seconds: number): string {
  return formatDuration(seconds);
}

/**
 * 2. Converte String de tempo ("MM:SS" ou "HH:MM:SS") para segundos (Number)
 * Ideal para processar o input do usuário antes de salvar no banco.
 * * Ex:
 * - "01:05" -> 65
 * - "10:00" -> 600
 * - "1:00:00" -> 3600
 */
export function parseDurationToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  
  // Limpa caracteres inválidos, mantém apenas dígitos e dois pontos
  const cleanStr = timeStr.replace(/[^\d:]/g, "");
  
  // Divide e converte para números
  const parts = cleanStr.split(":").map((part) => parseInt(part, 10));

  // Se algum falhou na conversão (NaN), retorna 0
  if (parts.some(isNaN)) return 0;

  // Formato HH:MM:SS
  if (parts.length === 3) {
    return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  }
  
  // Formato MM:SS
  if (parts.length === 2) {
    return (parts[0] * 60) + parts[1];
  }
  
  // Formato SS (apenas números digitados)
  if (parts.length === 1) {
    return parts[0]; 
  }

  return 0;
}

/**
 * 3. Formata duração de forma "verbosa" / legível
 * Ideal para descrições de curso e certificados.
 * * Ex:
 * - 3600 -> "1h"
 * - 3660 -> "1h 1min"
 * - 600 -> "10min"
 */
export function formatDurationVerbose(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return "0min";
  
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes > 0 ? `${minutes}min` : ''}`;
  }
  
  // Se for menos de 1 minuto mas maior que 0
  if (minutes === 0 && totalSeconds > 0) {
    return "< 1min";
  }

  return `${minutes}min`;
}