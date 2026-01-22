// src/lib/gameRules.ts

export const GAME_CONFIG = {
  // Configuração de Níveis (Curva Exponencial)
  LEVELING: {
    BASE_XP: 500,     // XP base para os primeiros níveis
    EXPONENT: 1.5,    // Dificuldade. Quanto maior, mais difícil subir nos níveis altos.
  },

  // Configuração da Economia (Moedas)
  ECONOMY: {
    LEVEL_UP_BASE: 50,       // Ganho fixo ao subir de nível
    LEVEL_UP_MULTIPLIER: 10, // Ganho variável: Nível * 10
  },

  // Recompensas de XP
  REWARDS: {
    BASE_LESSON_XP: 50,
    QUIZ_PASS_BONUS: 100,
    QUIZ_QUESTION_VALUE: 10,
  },
  
  PASSING_SCORE: 70, 
};

/**
 * Calcula o nível atual baseado no XP total (Lógica Exponencial)
 * Fórmula: Nível = (TotalXP / Base)^(1/Expoente)
 */
export function calculateLevel(totalXp: number): number {
  if (totalXp <= 0) return 1;
  return Math.floor(Math.pow(totalXp / GAME_CONFIG.LEVELING.BASE_XP, 1 / GAME_CONFIG.LEVELING.EXPONENT)) + 1;
}

/**
 * Calcula quanto XP é necessário para alcançar um nível específico
 */
export function calculateXpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(GAME_CONFIG.LEVELING.BASE_XP * Math.pow(level - 1, GAME_CONFIG.LEVELING.EXPONENT));
}

/**
 * Retorna dados detalhados para a Barra de Progresso no Frontend
 */
export function getLevelProgress(totalXp: number): number {
  const currentLevel = calculateLevel(totalXp);
  const nextLevel = currentLevel + 1;

  const xpCurrentLevelStart = calculateXpForLevel(currentLevel);
  const xpNextLevelStart = calculateXpForLevel(nextLevel);
  
  const xpNeededForNext = xpNextLevelStart - xpCurrentLevelStart;
  const xpGainedInCurrent = totalXp - xpCurrentLevelStart;
  
  // Evita divisão por zero ou números negativos
  if (xpNeededForNext <= 0) return 100;

  const percentage = (xpGainedInCurrent / xpNeededForNext) * 100;
  return Math.min(Math.max(percentage, 0), 100);
}

/**
 * Calcula recompensa de moedas ao subir de nível
 */
export function calculateCoinReward(newLevel: number): number {
  // Ex: Nível 2 = 50 + (2 * 10) = 70 Moedas
  return GAME_CONFIG.ECONOMY.LEVEL_UP_BASE + (newLevel * GAME_CONFIG.ECONOMY.LEVEL_UP_MULTIPLIER);
}

/**
 * Calcula recompensa do Quiz
 */
export function calculateQuizReward(correctCount: number, passed: boolean): number {
  if (!passed) return 0;
  return GAME_CONFIG.REWARDS.QUIZ_PASS_BONUS + (correctCount * GAME_CONFIG.REWARDS.QUIZ_QUESTION_VALUE);
}