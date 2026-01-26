const STORAGE_KEYS = {
  VOLUME: "uemb_player_volume",
  SPEED: "uemb_player_speed",
  MUTED: "uemb_player_muted"
};

export const getStoredVolume = (): number => {
  if (typeof window === "undefined") return 1;
  const val = localStorage.getItem(STORAGE_KEYS.VOLUME);
  return val ? parseFloat(val) : 1;
};

export const getStoredSpeed = (): number => {
  if (typeof window === "undefined") return 1.0;
  const val = localStorage.getItem(STORAGE_KEYS.SPEED);
  const validSpeeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
  const parsed = val ? parseFloat(val) : 1.0;
  return validSpeeds.includes(parsed) ? parsed : 1.0;
};

export const getStoredMuted = (): boolean => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEYS.MUTED) === "true";
};

export const savePlayerPreferences = (volume: number, speed: number, muted: boolean) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.VOLUME, volume.toString());
  localStorage.setItem(STORAGE_KEYS.SPEED, speed.toString());
  localStorage.setItem(STORAGE_KEYS.MUTED, muted.toString());
};