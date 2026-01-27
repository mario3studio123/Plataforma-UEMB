// src/services/certificateTemplateService.ts
// Serviço para gerenciamento de templates de certificado no Firebase

import { db, storage } from '@/lib/firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc,
  deleteDoc,
  query, 
  where, 
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { 
  CertificateTemplate, 
  CreateCertificateTemplateInput,
  UpdateCertificateTemplateInput,
} from '@/types/certificate';
import { v4 as uuidv4 } from 'uuid';

const COLLECTION_NAME = 'certificate_templates';
const STORAGE_PATH = 'certificate_templates/backgrounds';

/**
 * ============================================================================
 * SERVIÇO DE TEMPLATES DE CERTIFICADO
 * ============================================================================
 */

export const CertificateTemplateService = {
  /**
   * Busca o template ativo atual
   * Retorna null se não houver template ativo
   */
  async getActiveTemplate(): Promise<CertificateTemplate | null> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('isActive', '==', true),
        orderBy('updatedAt', 'desc'),
        limit(1)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return null;
      }
      
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() } as CertificateTemplate;
    } catch (error) {
      console.error('Erro ao buscar template ativo:', error);
      throw error;
    }
  },

  /**
   * Busca um template específico por ID
   */
  async getTemplateById(templateId: string): Promise<CertificateTemplate | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, templateId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }
      
      return { id: docSnap.id, ...docSnap.data() } as CertificateTemplate;
    } catch (error) {
      console.error('Erro ao buscar template:', error);
      throw error;
    }
  },

  /**
   * Lista todos os templates (ordenados por data de criação)
   */
  async listTemplates(): Promise<CertificateTemplate[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as CertificateTemplate));
    } catch (error) {
      console.error('Erro ao listar templates:', error);
      throw error;
    }
  },

  /**
   * Cria um novo template
   * @returns ID do template criado
   */
  async createTemplate(
    input: CreateCertificateTemplateInput,
    userId: string
  ): Promise<string> {
    try {
      const templateId = uuidv4();
      const now = serverTimestamp();
      
      const templateData = {
        ...input,
        id: templateId,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        // Novo template nunca começa ativo
        isActive: false,
      };
      
      await setDoc(doc(db, COLLECTION_NAME, templateId), templateData);
      
      return templateId;
    } catch (error) {
      console.error('Erro ao criar template:', error);
      throw error;
    }
  },

  /**
   * Atualiza um template existente
   */
  async updateTemplate(
    templateId: string, 
    updates: UpdateCertificateTemplateInput
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, templateId);
      
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Erro ao atualizar template:', error);
      throw error;
    }
  },

  /**
   * Ativa um template (desativa todos os outros)
   * Usa transação em batch para garantir atomicidade
   */
  async activateTemplate(templateId: string): Promise<void> {
    try {
      const batch = writeBatch(db);
      
      // 1. Busca todos os templates ativos
      const activeQuery = query(
        collection(db, COLLECTION_NAME),
        where('isActive', '==', true)
      );
      const activeSnapshots = await getDocs(activeQuery);
      
      // 2. Desativa todos os ativos
      activeSnapshots.docs.forEach(docSnap => {
        batch.update(doc(db, COLLECTION_NAME, docSnap.id), { 
          isActive: false,
          updatedAt: serverTimestamp(),
        });
      });
      
      // 3. Ativa o template selecionado
      batch.update(doc(db, COLLECTION_NAME, templateId), { 
        isActive: true,
        updatedAt: serverTimestamp(),
      });
      
      // 4. Executa todas as operações atomicamente
      await batch.commit();
    } catch (error) {
      console.error('Erro ao ativar template:', error);
      throw error;
    }
  },

  /**
   * Desativa um template
   */
  async deactivateTemplate(templateId: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, templateId);
      
      await updateDoc(docRef, {
        isActive: false,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Erro ao desativar template:', error);
      throw error;
    }
  },

  /**
   * Exclui um template
   * Não permite excluir template ativo
   */
  async deleteTemplate(templateId: string): Promise<void> {
    try {
      // Verifica se está ativo
      const template = await this.getTemplateById(templateId);
      
      if (!template) {
        throw new Error('Template não encontrado');
      }
      
      if (template.isActive) {
        throw new Error('Não é possível excluir um template ativo. Desative-o primeiro.');
      }
      
      // Se tem imagem de background, tenta deletar do storage
      if (template.background.type === 'image' && 
          template.background.value.includes('firebasestorage')) {
        try {
          const imageRef = ref(storage, template.background.value);
          await deleteObject(imageRef);
        } catch (storageError) {
          // Ignora erro de storage (imagem pode já ter sido deletada)
          console.warn('Erro ao deletar imagem do template:', storageError);
        }
      }
      
      // Deleta o documento
      await deleteDoc(doc(db, COLLECTION_NAME, templateId));
    } catch (error) {
      console.error('Erro ao excluir template:', error);
      throw error;
    }
  },

  /**
   * Duplica um template existente
   */
  async duplicateTemplate(templateId: string, userId: string): Promise<string> {
    try {
      const original = await this.getTemplateById(templateId);
      
      if (!original) {
        throw new Error('Template original não encontrado');
      }
      
      // Cria cópia com novo nome
      const duplicateInput: CreateCertificateTemplateInput = {
        name: `${original.name} (Cópia)`,
        description: original.description,
        background: { ...original.background },
        dimensions: { ...original.dimensions },
        fields: original.fields.map(field => ({
          ...field,
          id: uuidv4(), // Novos IDs para os campos
        })),
        isActive: false,
      };
      
      return await this.createTemplate(duplicateInput, userId);
    } catch (error) {
      console.error('Erro ao duplicar template:', error);
      throw error;
    }
  },

  /**
   * Upload de imagem de background
   * @returns URL pública da imagem
   */
  async uploadBackground(file: File): Promise<string> {
    try {
      // Valida o arquivo
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        throw new Error('Tipo de arquivo não suportado. Use PNG, JPG ou WebP.');
      }
      
      // Limite de 10MB
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        throw new Error('Arquivo muito grande. Máximo: 10MB');
      }
      
      // Gera nome único
      const fileId = uuidv4();
      const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
      const filePath = `${STORAGE_PATH}/${fileId}.${extension}`;
      
      // Upload
      const storageRef = ref(storage, filePath);
      await uploadBytes(storageRef, file, {
        contentType: file.type,
        customMetadata: {
          originalName: file.name,
          uploadedAt: new Date().toISOString(),
        },
      });
      
      // Retorna URL pública
      return await getDownloadURL(storageRef);
    } catch (error) {
      console.error('Erro ao fazer upload do background:', error);
      throw error;
    }
  },

  /**
   * Converte arquivo para Base64 (preview local)
   */
  async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  },
};

export default CertificateTemplateService;
