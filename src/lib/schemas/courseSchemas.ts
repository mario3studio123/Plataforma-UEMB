// src/lib/schemas/courseSchemas.ts
import { z } from "zod";
import { COURSE_LEVELS } from "@/lib/constants";

// ============================================================================
// 1. UTILITÁRIOS E ENUMS
// ============================================================================

export const CourseLevelEnum = z.enum(COURSE_LEVELS);

// Schema para validar strings de duração APENAS NA UI (não usado para salvar no banco)
export const DurationStringSchema = z.string().regex(
  /^(\d{1,2}:)?([0-5]?\d):([0-5]?\d)$/,
  "Formato inválido. Use MM:SS (ex: 10:00) ou HH:MM:SS"
);

// ============================================================================
// 2. SCHEMAS DE AULA (LESSON) - CORE DA MUDANÇA
// ============================================================================

export const VideoMetadataSchema = z.object({
  duration: z.number().min(0).default(0), // Segundos
  size: z.number().min(0).default(0),     // Bytes
  filename: z.string().optional(),
  mimeType: z.string().optional(),
});

export const LessonSchema = z.object({
  id: z.string().optional(),
  
  title: z.string()
    .min(3, "O título deve ter pelo menos 3 caracteres")
    .max(100, "O título é muito longo (máx 100)"),
    
  description: z.string().optional(),
  
  videoUrl: z.string().url("A URL do vídeo é inválida"), // <--- VERIFIQUE ESTA VÍRGULA
  
  // AQUI ESTAVA O ERRO:
  duration: z.number()
    .int()
    .min(0, "A duração não pode ser negativa")
    .default(0),
  
  videoMetadata: VideoMetadataSchema.optional(),
  
  xpReward: z.coerce.number()
    .min(10, "Mínimo 10 XP")
    .max(1000, "Máximo 1000 XP")
    .default(50),
    
  order: z.number().int().default(0),
  freePreview: z.boolean().default(false),
});

// ============================================================================
// 3. SCHEMAS DE QUIZ
// ============================================================================

const QuizOptionSchema = z.object({
  id: z.string(),
  text: z.string().min(1, "O texto da opção é obrigatório"),
  isCorrect: z.boolean(),
});

export const QuizQuestionSchema = z.object({
  id: z.string().optional(),
  text: z.string().min(5, "O enunciado da pergunta deve ser claro"),
  options: z.array(QuizOptionSchema)
    .min(2, "A pergunta deve ter pelo menos 2 opções")
    .refine(
      (opts) => opts.some(opt => opt.isCorrect),
      "Pelo menos uma opção deve ser marcada como correta"
    ),
  order: z.number().int().default(0),
});

// ============================================================================
// 4. SCHEMAS DE ESTRUTURA (MODULO & SYLLABUS)
// ============================================================================

// Schemas "Leves" para o array 'syllabus' cacheado no documento do curso
export const LessonSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  duration: z.number(), // Segundos
  type: z.enum(['video', 'quiz']).default('video'),
  freePreview: z.boolean().default(false)
});

export const ModuleSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  lessons: z.array(LessonSummarySchema).default([]),
  hasQuiz: z.boolean().optional().default(false)
});

// Schema completo para criação/edição de Módulo
export const ModuleSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(3, "Nome do módulo muito curto").max(80),
  order: z.number().int().min(0),
  description: z.string().optional(),
});

// ============================================================================
// 5. SCHEMA DO CURSO (COURSE)
// ============================================================================

export const CourseSchema = z.object({
  id: z.string().min(1, "ID do curso é obrigatório"),
  
  title: z.string()
    .min(5, "Título muito curto (mínimo 5)")
    .max(100, "Título muito longo (máximo 100)"),
    
  description: z.string()
    .min(20, "Descrição muito curta (mínimo 20 caracteres)")
    .max(2000, "Descrição muito longa"),
    
  coverUrl: z.string().url("A imagem de capa é obrigatória e deve ser uma URL válida"),
  
  level: CourseLevelEnum,
  
  published: z.boolean().default(false),
  price: z.number().min(0).default(0),
  
  tags: z.array(z.string())
    .max(10, "Máximo de 10 tags permitidas")
    .default([]),
    
  // Estrutura Cacheada
  syllabus: z.array(ModuleSummarySchema).optional(),
  
  // Agregados Numéricos
  totalDuration: z.number().default(0), // Segundos
  totalLessons: z.number().default(0),
});


// ============================================================================
// 6. SCHEMAS UTILITÁRIOS (REORDER)
// ============================================================================

export const ReorderItemSchema = z.object({
  id: z.string(),
  newOrder: z.number().int()
});

export const ReorderSchema = z.array(ReorderItemSchema);

// ============================================================================
// 7. EXPORTAÇÃO DE TIPOS INFERIDOS (TypeScript)
// ============================================================================

export type CreateCourseInput = z.infer<typeof CourseSchema>;
export type ModuleInput = z.infer<typeof ModuleSchema>;
export type LessonInput = z.infer<typeof LessonSchema>;
export type QuizQuestionInput = z.infer<typeof QuizQuestionSchema>;
export type ReorderItem = z.infer<typeof ReorderItemSchema>;

export type VideoMetadata = z.infer<typeof VideoMetadataSchema>;

// Tipos explícitos para Syllabus (evita problemas com z.infer + .default())
export interface SyllabusLesson {
  id: string;
  title: string;
  duration: number;
  type?: 'video' | 'quiz';
  freePreview?: boolean;
}

export interface SyllabusModule {
  id: string;
  title: string;
  lessons: SyllabusLesson[];
  hasQuiz?: boolean;
}