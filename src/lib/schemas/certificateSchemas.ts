// src/lib/schemas/certificateSchemas.ts
// Schemas de validação para o sistema de certificados dinâmicos

import { z } from 'zod';
import { CertificateField } from '@/types/certificate';

/**
 * ============================================================================
 * SCHEMAS DE CAMPOS
 * ============================================================================
 */

export const CertificateFieldPositionSchema = z.object({
  x: z.number()
    .min(0, 'Posição X deve ser no mínimo 0%')
    .max(100, 'Posição X deve ser no máximo 100%'),
  y: z.number()
    .min(0, 'Posição Y deve ser no mínimo 0%')
    .max(100, 'Posição Y deve ser no máximo 100%'),
});

export const CertificateFieldStyleSchema = z.object({
  fontSize: z.number()
    .min(8, 'Tamanho mínimo: 8px')
    .max(120, 'Tamanho máximo: 120px')
    .optional()
    .default(24),
  fontFamily: z.string().optional().default('Helvetica'),
  fontWeight: z.enum(['normal', 'bold']).optional().default('normal'),
  color: z.string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Cor deve estar no formato hexadecimal (#RRGGBB)')
    .optional()
    .default('#000000'),
  textAlign: z.enum(['left', 'center', 'right']).optional().default('center'),
  maxWidth: z.number()
    .min(10, 'Largura mínima: 10%')
    .max(100, 'Largura máxima: 100%')
    .optional(),
  letterSpacing: z.number().optional(),
  textTransform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize'])
    .optional()
    .default('none'),
});

export const CertificateFieldSchema = z.object({
  id: z.string().min(1, 'ID do campo é obrigatório'),
  type: z.enum(['text', 'image', 'date', 'qrcode']),
  placeholder: z.string()
    .min(1, 'Placeholder é obrigatório')
    .regex(/^\{\{[A-Z_]+\}\}$/, 'Formato inválido. Use {{NOME_DO_CAMPO}}'),
  defaultValue: z.string().optional(),
  position: CertificateFieldPositionSchema,
  style: CertificateFieldStyleSchema,
});

/**
 * ============================================================================
 * SCHEMAS DE TEMPLATE
 * ============================================================================
 */

export const CertificateTemplateBackgroundSchema = z.object({
  type: z.enum(['image', 'color']),
  value: z.string().min(1, 'Valor do background é obrigatório'),
}).refine(
  (data) => {
    if (data.type === 'color') {
      return /^#[0-9A-Fa-f]{6}$/.test(data.value);
    }
    // Para imagem, aceita URL ou base64
    return data.value.startsWith('http') || data.value.startsWith('data:image');
  },
  { message: 'Valor de background inválido' }
);

export const CertificateTemplateDimensionsSchema = z.object({
  width: z.number()
    .min(800, 'Largura mínima: 800px')
    .max(4000, 'Largura máxima: 4000px'),
  height: z.number()
    .min(600, 'Altura mínima: 600px')
    .max(3000, 'Altura máxima: 3000px'),
  orientation: z.enum(['landscape', 'portrait']),
});

export const CertificateTemplateSchema = z.object({
  id: z.string().optional(), // Opcional na criação (gerado automaticamente)
  name: z.string()
    .min(3, 'Nome deve ter pelo menos 3 caracteres')
    .max(100, 'Nome muito longo (máximo 100 caracteres)'),
  description: z.string()
    .max(500, 'Descrição muito longa (máximo 500 caracteres)')
    .optional(),
  background: CertificateTemplateBackgroundSchema,
  dimensions: CertificateTemplateDimensionsSchema,
  fields: z.array(CertificateFieldSchema)
    .min(1, 'O template deve ter pelo menos um campo'),
  isActive: z.boolean().default(false),
});

/**
 * ============================================================================
 * SCHEMA DE CRIAÇÃO (SEM CAMPOS AUTOMÁTICOS)
 * ============================================================================
 */

export const CreateCertificateTemplateSchema = CertificateTemplateSchema.omit({
  id: true,
});

/**
 * ============================================================================
 * SCHEMA DE ATUALIZAÇÃO (PARCIAL)
 * ============================================================================
 */

export const UpdateCertificateTemplateSchema = CertificateTemplateSchema.partial().omit({
  id: true,
});

/**
 * ============================================================================
 * TIPOS INFERIDOS
 * ============================================================================
 */

export type CertificateFieldInput = z.infer<typeof CertificateFieldSchema>;
export type CertificateTemplateInput = z.infer<typeof CertificateTemplateSchema>;
export type CreateCertificateTemplateInput = z.infer<typeof CreateCertificateTemplateSchema>;
export type UpdateCertificateTemplateInput = z.infer<typeof UpdateCertificateTemplateSchema>;

/**
 * ============================================================================
 * TEMPLATES PADRÃO
 * ============================================================================
 */

// Template padrão para novos certificados (fallback)
export const DEFAULT_CERTIFICATE_FIELDS: CertificateField[] = [
  {
    id: 'title',
    type: 'text',
    placeholder: '{{COMPANY_NAME}}',
    defaultValue: 'CERTIFICADO DE CONCLUSÃO',
    position: { x: 50, y: 15 },
    style: {
      fontSize: 36,
      fontWeight: 'bold',
      color: '#1a1620',
      textAlign: 'center',
      textTransform: 'uppercase',
      letterSpacing: 4,
    },
  },
  {
    id: 'subtitle',
    type: 'text',
    placeholder: '{{COMPANY_NAME}}',
    defaultValue: 'UNIVERSIDADE DA EMBALAGEM',
    position: { x: 50, y: 22 },
    style: {
      fontSize: 14,
      color: '#666666',
      textAlign: 'center',
      textTransform: 'uppercase',
      letterSpacing: 2,
    },
  },
  {
    id: 'certify_text',
    type: 'text',
    placeholder: '{{COMPANY_NAME}}',
    defaultValue: 'Certificamos que',
    position: { x: 50, y: 35 },
    style: {
      fontSize: 16,
      color: '#333333',
      textAlign: 'center',
    },
  },
  {
    id: 'student_name',
    type: 'text',
    placeholder: '{{STUDENT_NAME}}',
    position: { x: 50, y: 45 },
    style: {
      fontSize: 42,
      fontWeight: 'bold',
      color: '#915bf5',
      textAlign: 'center',
    },
  },
  {
    id: 'completion_text',
    type: 'text',
    placeholder: '{{COMPANY_NAME}}',
    defaultValue: 'concluiu com êxito o curso',
    position: { x: 50, y: 55 },
    style: {
      fontSize: 16,
      color: '#333333',
      textAlign: 'center',
    },
  },
  {
    id: 'course_title',
    type: 'text',
    placeholder: '{{COURSE_TITLE}}',
    position: { x: 50, y: 65 },
    style: {
      fontSize: 28,
      fontWeight: 'bold',
      color: '#1a1620',
      textAlign: 'center',
    },
  },
  {
    id: 'hours_info',
    type: 'text',
    placeholder: '{{TOTAL_HOURS}}',
    defaultValue: 'Com carga horária de {{TOTAL_HOURS}}',
    position: { x: 50, y: 75 },
    style: {
      fontSize: 14,
      color: '#666666',
      textAlign: 'center',
    },
  },
  {
    id: 'date_info',
    type: 'text',
    placeholder: '{{COMPLETION_DATE}}',
    defaultValue: 'Finalizado em {{COMPLETION_DATE}}',
    position: { x: 25, y: 88 },
    style: {
      fontSize: 12,
      color: '#666666',
      textAlign: 'left',
    },
  },
  {
    id: 'validation_code',
    type: 'text',
    placeholder: '{{VALIDATION_CODE}}',
    defaultValue: 'ID: {{VALIDATION_CODE}}',
    position: { x: 75, y: 88 },
    style: {
      fontSize: 10,
      color: '#999999',
      textAlign: 'right',
    },
  },
];
