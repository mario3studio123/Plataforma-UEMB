export const COURSE_LEVELS = ["Básico", "Intermediário", "Avançado", "Expert"] as const;

// Helper para tipagem automática baseada no array acima
export type CourseLevel = (typeof COURSE_LEVELS)[number];