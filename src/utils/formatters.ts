
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

export function formatTime(seconds: number): string {
  return formatDuration(seconds);
}

export function parseDurationToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  
  const cleanStr = timeStr.replace(/[^\d:]/g, "");
  const parts = cleanStr.split(":").map((part) => parseInt(part, 10));
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) {
    return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  }
  
  if (parts.length === 2) {
    return (parts[0] * 60) + parts[1];
  }
  
  if (parts.length === 1) {
    return parts[0]; 
  }

  return 0;
}

export function formatDurationVerbose(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return "0min";
  
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes > 0 ? `${minutes}min` : ''}`;
  }

  if (minutes === 0 && totalSeconds > 0) {
    return "< 1min";
  }

  return `${minutes}min`;
}