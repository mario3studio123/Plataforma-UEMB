// src/components/Certificate/DynamicCertificate.tsx
"use client";

import { useMemo } from 'react';
import { 
  Document, 
  Page, 
  View, 
  Text, 
  Image, 
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import { 
  CertificateTemplate, 
  CertificateField,
  CertificateRenderData,
  CERTIFICATE_PLACEHOLDERS,
} from '@/types/certificate';

/**
 * ============================================================================
 * REGISTRO DE FONTES (OPCIONAL)
 * ============================================================================
 * Se quiser usar fontes customizadas, registre-as aqui.
 * Por enquanto, usamos Helvetica (sempre disponível).
 */

// Font.register({
//   family: 'Montserrat',
//   fonts: [
//     { src: '/fonts/Montserrat-Regular.ttf', fontWeight: 'normal' },
//     { src: '/fonts/Montserrat-Bold.ttf', fontWeight: 'bold' },
//   ]
// });

/**
 * ============================================================================
 * ESTILOS BASE
 * ============================================================================
 */

const createStyles = (width: number, height: number) => StyleSheet.create({
  page: {
    width,
    height,
    position: 'relative',
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
});

/**
 * ============================================================================
 * PROPS
 * ============================================================================
 */

interface DynamicCertificateProps {
  template: CertificateTemplate;
  data: CertificateRenderData;
}

/**
 * ============================================================================
 * COMPONENTE PRINCIPAL
 * ============================================================================
 */

export function DynamicCertificate({ template, data }: DynamicCertificateProps) {
  // Mapa de substituição de placeholders
  const placeholderMap = useMemo(() => ({
    [CERTIFICATE_PLACEHOLDERS.STUDENT_NAME]: data.studentName,
    [CERTIFICATE_PLACEHOLDERS.COURSE_TITLE]: data.courseTitle,
    [CERTIFICATE_PLACEHOLDERS.COMPLETION_DATE]: data.completionDate,
    [CERTIFICATE_PLACEHOLDERS.TOTAL_HOURS]: data.totalHours,
    [CERTIFICATE_PLACEHOLDERS.VALIDATION_CODE]: data.validationCode,
    [CERTIFICATE_PLACEHOLDERS.MODULES_COUNT]: String(data.modulesCount),
    [CERTIFICATE_PLACEHOLDERS.INSTRUCTOR_NAME]: data.instructorName,
    [CERTIFICATE_PLACEHOLDERS.ISSUE_DATE]: data.issueDate,
    [CERTIFICATE_PLACEHOLDERS.COMPANY_NAME]: data.companyName,
  }), [data]);

  // Função para substituir placeholders no texto
  const replacePlaceholders = (text: string): string => {
    let result = text;
    
    Object.entries(placeholderMap).forEach(([placeholder, value]) => {
      result = result.replace(new RegExp(escapeRegex(placeholder), 'g'), value);
    });
    
    return result;
  };

  // Escape de regex para placeholders com caracteres especiais
  const escapeRegex = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  // Gera estilos do documento
  const styles = useMemo(() => 
    createStyles(template.dimensions.width, template.dimensions.height),
    [template.dimensions]
  );

  // Gera estilo para cada campo
  const getFieldStyle = (field: CertificateField) => {
    const { position, style } = field;
    
    return {
      position: 'absolute' as const,
      left: `${position.x}%`,
      top: `${position.y}%`,
      transform: 'translate(-50%, -50%)',
      fontSize: style.fontSize || 24,
      fontFamily: style.fontFamily || 'Helvetica',
      fontWeight: style.fontWeight || 'normal',
      color: style.color || '#000000',
      textAlign: style.textAlign || 'center',
      maxWidth: style.maxWidth ? `${style.maxWidth}%` : undefined,
      letterSpacing: style.letterSpacing,
      textTransform: style.textTransform || 'none',
    };
  };

  // Renderiza um campo baseado no tipo
  const renderField = (field: CertificateField) => {
    const fieldStyle = getFieldStyle(field);
    const key = field.id;

    switch (field.type) {
      case 'text':
      case 'date': {
        // Usa defaultValue se existir, senão usa o placeholder
        const rawText = field.defaultValue || field.placeholder;
        const displayText = replacePlaceholders(rawText);
        
        return (
          <Text key={key} style={fieldStyle}>
            {displayText}
          </Text>
        );
      }

      case 'image': {
        if (!field.defaultValue) return null;
        
        return (
          <Image 
            key={key}
            src={field.defaultValue}
            style={{
              ...fieldStyle,
              width: field.style.maxWidth ? `${field.style.maxWidth}%` : 100,
              height: 'auto',
            }}
          />
        );
      }

      case 'qrcode': {
        // QR Code seria implementado com biblioteca específica
        // Por enquanto, renderiza o código como texto
        const codeText = replacePlaceholders(field.placeholder);
        return (
          <View key={key} style={fieldStyle}>
            <Text style={{ fontSize: 10, color: '#666' }}>
              [QR: {codeText}]
            </Text>
          </View>
        );
      }

      default:
        return null;
    }
  };

  return (
    <Document>
      <Page 
        size={[template.dimensions.width, template.dimensions.height]}
        style={styles.page}
      >
        {/* Background */}
        {template.background.type === 'image' ? (
          <Image 
            src={template.background.value} 
            style={styles.backgroundImage}
          />
        ) : (
          <View 
            style={[
              styles.background, 
              { backgroundColor: template.background.value }
            ]} 
          />
        )}

        {/* Campos Dinâmicos */}
        {template.fields.map(renderField)}
      </Page>
    </Document>
  );
}

/**
 * ============================================================================
 * COMPONENTE DE FALLBACK (TEMPLATE ESTÁTICO)
 * ============================================================================
 * Usado quando não há template dinâmico configurado
 */

const fallbackStyles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#fff',
    padding: 0,
  },
  border: {
    margin: 20,
    flex: 1,
    border: '4px solid #1a1620',
    padding: 30,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cornerDecoration: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 100,
    height: 100,
    borderTop: '20px solid #CA8DFF',
    borderLeft: '20px solid #CA8DFF',
  },
  bottomCorner: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 100,
    height: 100,
    borderBottom: '20px solid #CA8DFF',
    borderRight: '20px solid #CA8DFF',
  },
  header: {
    fontSize: 32,
    marginBottom: 10,
    textTransform: 'uppercase',
    color: '#1a1620',
    fontFamily: 'Helvetica-Bold',
  },
  subHeader: {
    fontSize: 14,
    color: '#666',
    marginBottom: 40,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  name: {
    fontSize: 40,
    color: '#915bf5',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 20,
    textAlign: 'center',
    borderBottom: '1px solid #ddd',
    paddingBottom: 10,
    width: '80%',
  },
  text: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 5,
    color: '#333',
    lineHeight: 1.5,
  },
  courseTitle: {
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
    marginVertical: 10,
    color: '#1a1620',
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTop: '1px solid #eee',
    paddingTop: 20,
  },
  signatureCol: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  signLine: {
    width: 150,
    borderBottom: '1px solid #333',
    marginBottom: 5,
  },
  signText: {
    fontSize: 10,
    color: '#666',
  },
  code: {
    fontSize: 8,
    color: '#999',
    position: 'absolute',
    bottom: 10,
    right: 20,
  },
});

interface FallbackCertificateProps {
  data: CertificateRenderData;
}

export function FallbackCertificate({ data }: FallbackCertificateProps) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={fallbackStyles.page}>
        <View style={fallbackStyles.border}>
          <View style={fallbackStyles.cornerDecoration} />
          <View style={fallbackStyles.bottomCorner} />

          <Text style={fallbackStyles.header}>Certificado de Conclusão</Text>
          <Text style={fallbackStyles.subHeader}>{data.companyName}</Text>

          <Text style={fallbackStyles.text}>Certificamos que</Text>
          
          <Text style={fallbackStyles.name}>{data.studentName}</Text>

          <Text style={fallbackStyles.text}>concluiu com êxito o curso</Text>
          
          <Text style={fallbackStyles.courseTitle}>{data.courseTitle}</Text>

          <Text style={fallbackStyles.text}>
            Com carga horária de {data.totalHours}, finalizado em {data.completionDate}.
          </Text>

          <View style={fallbackStyles.footer}>
            <View style={fallbackStyles.signatureCol}>
              <View style={fallbackStyles.signLine} />
              <Text style={fallbackStyles.signText}>Diretoria de Ensino</Text>
            </View>
            
            <View style={fallbackStyles.signatureCol}>
              <View style={fallbackStyles.signLine} />
              <Text style={fallbackStyles.signText}>{data.companyName}</Text>
            </View>
          </View>

          <Text style={fallbackStyles.code}>ID de Validação: {data.validationCode}</Text>
        </View>
      </Page>
    </Document>
  );
}

/**
 * ============================================================================
 * COMPONENTE WRAPPER (ESCOLHE AUTOMÁTICO)
 * ============================================================================
 */

interface SmartCertificateProps {
  template: CertificateTemplate | null;
  data: CertificateRenderData;
}

export function SmartCertificate({ template, data }: SmartCertificateProps) {
  if (template) {
    return <DynamicCertificate template={template} data={data} />;
  }
  
  return <FallbackCertificate data={data} />;
}

export default SmartCertificate;
