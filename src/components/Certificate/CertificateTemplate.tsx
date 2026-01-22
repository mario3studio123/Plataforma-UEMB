"use client";

import { Page, Text, View, Document, StyleSheet, Image, Font } from '@react-pdf/renderer';

// Registrando fontes (opcional, usando Helvetica padrão por enquanto para garantir compatibilidade)
// Se quiser fontes custom, podemos carregar depois.

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#fff',
    padding: 0,
  },
  border: {
    margin: 20,
    flex: 1,
    border: '4px solid #1a1620', // Cor escura da UI
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
    borderTop: '20px solid #CA8DFF', // Roxo Primário
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
    color: '#915bf5', // Roxo secundário
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
  logo: {
    width: 150,
    marginBottom: 20,
    // Se tiver uma imagem base64 ou URL pública da logo, coloque aqui
    // src: '...' 
  }
});

interface CertificateData {
    userName: string;
    courseTitle: string;
    totalHours: string;
    issuedAt: string;
    validationCode: string;
}

export const CertificateTemplate = ({ data }: { data: CertificateData }) => (
  <Document>
    <Page size="A4" orientation="landscape" style={styles.page}>
      <View style={styles.border}>
        {/* Decorações */}
        <View style={styles.cornerDecoration} />
        <View style={styles.bottomCorner} />

        {/* Conteúdo */}
        {/* <Image src="/logo-uemb.png" style={styles.logo} /> Se conseguir usar imagem publica */}
        
        <Text style={styles.header}>Certificado de Conclusão</Text>
        <Text style={styles.subHeader}>UNIVERSIDADE DA EMBALAGEM</Text>

        <Text style={styles.text}>Certificamos que</Text>
        
        <Text style={styles.name}>{data.userName}</Text>

        <Text style={styles.text}>concluiu com êxito o curso</Text>
        
        <Text style={styles.courseTitle}>{data.courseTitle}</Text>

        <Text style={styles.text}>
           Com carga horária estimada de {data.totalHours}, finalizado em {new Date(data.issuedAt).toLocaleDateString('pt-BR')}.
        </Text>

        {/* Rodapé e Assinaturas */}
        <View style={styles.footer}>
            <View style={styles.signatureCol}>
                <View style={styles.signLine} />
                <Text style={styles.signText}>Diretoria de Ensino</Text>
            </View>
            
            <View style={styles.signatureCol}>
                {/* Aqui poderia entrar uma imagem de assinatura digitalizada */}
                <View style={styles.signLine} />
                <Text style={styles.signText}>Universidade da Embalagem</Text>
            </View>
        </View>

        <Text style={styles.code}>ID de Validação: {data.validationCode}</Text>
      </View>
    </Page>
  </Document>
);