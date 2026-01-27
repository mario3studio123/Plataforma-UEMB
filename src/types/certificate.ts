// src/types/certificate.ts
// Tipos para o sistema de certificados dinâmicos

import { FirestoreDate } from "./index";

/**
 * ============================================================================
 * TIPOS DE CAMPOS DO CERTIFICADO
 * ============================================================================
 */

export type CertificateFieldType = 'text' | 'image' | 'date' | 'qrcode';

export interface CertificateFieldPosition {
  x: number;  // 0-100% (posição horizontal)
  y: number;  // 0-100% (posição vertical)
}

export interface CertificateFieldStyle {
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold';
  color?: string;
  textAlign?: 'left' | 'center' | 'right';
  maxWidth?: number;  // em porcentagem
  letterSpacing?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
}

export interface CertificateField {
  id: string;
  type: CertificateFieldType;
  placeholder: string;  // Ex: {{STUDENT_NAME}}, {{COURSE_TITLE}}
  defaultValue?: string;
  position: CertificateFieldPosition;
  style: CertificateFieldStyle;
}

/**
 * ============================================================================
 * TEMPLATE DO CERTIFICADO
 * ============================================================================
 */

export interface CertificateTemplateBackground {
  type: 'image' | 'color';
  value: string;  // URL da imagem ou código hex da cor
}

export interface CertificateTemplateDimensions {
  width: number;   // em pixels
  height: number;  // em pixels
  orientation: 'landscape' | 'portrait';
}

export interface CertificateTemplate {
  id: string;
  name: string;
  description?: string;
  background: CertificateTemplateBackground;
  dimensions: CertificateTemplateDimensions;
  fields: CertificateField[];
  isActive: boolean;
  createdAt: FirestoreDate;
  updatedAt: FirestoreDate;
  createdBy: string;
}

/**
 * ============================================================================
 * DADOS DO CERTIFICADO EMITIDO
 * ============================================================================
 */

export interface IssuedCertificate {
  id: string;
  userId: string;
  userName: string;
  courseId: string;
  courseTitle: string;
  totalHours: string;
  modulesCount?: number;
  issuedAt: string;
  validationCode: string;
  instructor: string;
  templateId: string;
  templateVersion?: string;
}

/**
 * ============================================================================
 * PLACEHOLDERS DISPONÍVEIS
 * ============================================================================
 */

export const CERTIFICATE_PLACEHOLDERS = {
  STUDENT_NAME: '{{STUDENT_NAME}}',
  COURSE_TITLE: '{{COURSE_TITLE}}',
  COMPLETION_DATE: '{{COMPLETION_DATE}}',
  TOTAL_HOURS: '{{TOTAL_HOURS}}',
  VALIDATION_CODE: '{{VALIDATION_CODE}}',
  MODULES_COUNT: '{{MODULES_COUNT}}',
  INSTRUCTOR_NAME: '{{INSTRUCTOR_NAME}}',
  ISSUE_DATE: '{{ISSUE_DATE}}',
  COMPANY_NAME: '{{COMPANY_NAME}}',
} as const;

export type PlaceholderKey = keyof typeof CERTIFICATE_PLACEHOLDERS;
export type PlaceholderValue = typeof CERTIFICATE_PLACEHOLDERS[PlaceholderKey];

/**
 * Descrições amigáveis dos placeholders para o editor
 */
export const PLACEHOLDER_DESCRIPTIONS: Record<PlaceholderKey, string> = {
  STUDENT_NAME: 'Nome completo do aluno',
  COURSE_TITLE: 'Título do curso concluído',
  COMPLETION_DATE: 'Data de conclusão (formatada)',
  TOTAL_HOURS: 'Carga horária total do curso',
  VALIDATION_CODE: 'Código único de validação',
  MODULES_COUNT: 'Número de módulos do curso',
  INSTRUCTOR_NAME: 'Nome do instrutor/instituição',
  ISSUE_DATE: 'Data de emissão do certificado',
  COMPANY_NAME: 'Nome da empresa (Universidade da Embalagem)',
};

/**
 * ============================================================================
 * TIPOS AUXILIARES
 * ============================================================================
 */

// Input para criação de template (sem campos automáticos)
export type CreateCertificateTemplateInput = Omit<
  CertificateTemplate, 
  'id' | 'createdAt' | 'updatedAt' | 'createdBy'
>;

// Input para atualização parcial
export type UpdateCertificateTemplateInput = Partial<
  Omit<CertificateTemplate, 'id' | 'createdAt' | 'createdBy'>
>;

// Dados para renderização do certificado
export interface CertificateRenderData {
  studentName: string;
  courseTitle: string;
  completionDate: string;
  totalHours: string;
  validationCode: string;
  modulesCount: number;
  instructorName: string;
  issueDate: string;
  companyName: string;
}
