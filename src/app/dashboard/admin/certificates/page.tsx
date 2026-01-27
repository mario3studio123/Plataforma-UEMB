// src/app/dashboard/admin/certificates/page.tsx
"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Plus, Award, Edit2, Trash2, Copy, Check, 
  Loader2, Calendar, Layers, X, Power, PowerOff
} from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useSidebar } from '@/context/SidebarContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import CertificateEditor from '@/components/Admin/CertificateEditor';
import { CertificateTemplate } from '@/types/certificate';
import {
  listCertificateTemplatesAction,
  getCertificateTemplateAction,
  createCertificateTemplateAction,
  updateCertificateTemplateAction,
  activateCertificateTemplateAction,
  deactivateCertificateTemplateAction,
  deleteCertificateTemplateAction,
  duplicateCertificateTemplateAction,
} from '@/app/actions/admin/certificateTemplateActions';
import styles from './styles.module.css';

/**
 * ============================================================================
 * TIPOS
 * ============================================================================
 */

interface TemplateListItem {
  id: string;
  name: string;
  description?: string;
  backgroundPreview: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * ============================================================================
 * COMPONENTE PRINCIPAL
 * ============================================================================
 */

export default function CertificateTemplatesPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { isExpanded } = useSidebar();
  const { addToast } = useToast();

  // Estados
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<CertificateTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Verifica permissão de admin
  const isAdmin = profile?.role === 'admin' || profile?.role === 'master';

  /**
   * ============================================================================
   * CARREGAMENTO DE DADOS
   * ============================================================================
   */

  const loadTemplates = async () => {
    if (!user) return;
    
    try {
      const token = await user.getIdToken();
      const result = await listCertificateTemplatesAction(token);
      
      if (result.success) {
        setTemplates(result.data);
      } else {
        addToast(result.error.message, 'error');
      }
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
      addToast('Erro ao carregar templates', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && isAdmin) {
      loadTemplates();
    } else if (!loading && !isAdmin) {
      router.push('/dashboard');
    }
  }, [user, isAdmin]);

  /**
   * ============================================================================
   * ANIMAÇÕES
   * ============================================================================
   */

  useGSAP(() => {
    if (containerRef.current) {
      gsap.to(containerRef.current, {
        paddingLeft: isExpanded ? 440 : 180,
        duration: 0.5,
        ease: 'power3.inOut',
      });
    }
  }, [isExpanded]);

  useGSAP(() => {
    if (!loading && gridRef.current && templates.length > 0) {
      gsap.from(gridRef.current.children, {
        y: 30,
        opacity: 0,
        stagger: 0.1,
        duration: 0.6,
        ease: 'back.out(1.2)',
      });
    }
  }, [loading, templates.length]);

  /**
   * ============================================================================
   * HANDLERS
   * ============================================================================
   */

  const handleCreate = () => {
    setEditingTemplate(null);
    setIsCreating(true);
  };

  const handleEdit = async (templateId: string) => {
    if (!user) return;
    
    setActionLoading(templateId);
    
    try {
      const token = await user.getIdToken();
      const result = await getCertificateTemplateAction(token, templateId);
      
      if (result.success) {
        setEditingTemplate(result.data);
        setIsCreating(true);
      } else {
        addToast(result.error.message, 'error');
      }
    } catch (error) {
      addToast('Erro ao carregar template', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSave = async (templateData: Partial<CertificateTemplate>) => {
    if (!user) return;
    
    setSaving(true);
    
    try {
      const token = await user.getIdToken();
      
      if (editingTemplate?.id) {
        // Atualização
        const result = await updateCertificateTemplateAction(
          token, 
          editingTemplate.id, 
          templateData
        );
        
        if (result.success) {
          addToast('Template atualizado com sucesso!', 'success');
        } else {
          addToast(result.error.message, 'error');
          return;
        }
      } else {
        // Criação
        const result = await createCertificateTemplateAction(token, templateData);
        
        if (result.success) {
          addToast('Template criado com sucesso!', 'success');
        } else {
          addToast(result.error.message, 'error');
          return;
        }
      }
      
      setIsCreating(false);
      setEditingTemplate(null);
      await loadTemplates();
    } catch (error) {
      console.error('Erro ao salvar template:', error);
      addToast('Erro ao salvar template', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (templateId: string) => {
    if (!user) return;
    
    setActionLoading(templateId);
    
    try {
      const token = await user.getIdToken();
      const result = await activateCertificateTemplateAction(token, templateId);
      
      if (result.success) {
        addToast('Template ativado! Será usado em novos certificados.', 'success');
        await loadTemplates();
      } else {
        addToast(result.error.message, 'error');
      }
    } catch (error) {
      addToast('Erro ao ativar template', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeactivate = async (templateId: string) => {
    if (!user) return;
    
    setActionLoading(templateId);
    
    try {
      const token = await user.getIdToken();
      const result = await deactivateCertificateTemplateAction(token, templateId);
      
      if (result.success) {
        addToast('Template desativado.', 'success');
        await loadTemplates();
      } else {
        addToast(result.error.message, 'error');
      }
    } catch (error) {
      addToast('Erro ao desativar template', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDuplicate = async (templateId: string) => {
    if (!user) return;
    
    setActionLoading(templateId);
    
    try {
      const token = await user.getIdToken();
      const result = await duplicateCertificateTemplateAction(token, templateId);
      
      if (result.success) {
        addToast('Template duplicado!', 'success');
        await loadTemplates();
      } else {
        addToast(result.error.message, 'error');
      }
    } catch (error) {
      addToast('Erro ao duplicar template', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!user || !confirmDelete) return;
    
    setActionLoading(confirmDelete);
    
    try {
      const token = await user.getIdToken();
      const result = await deleteCertificateTemplateAction(token, confirmDelete);
      
      if (result.success) {
        addToast('Template excluído.', 'success');
        await loadTemplates();
      } else {
        addToast(result.error.message, 'error');
      }
    } catch (error) {
      addToast('Erro ao excluir template', 'error');
    } finally {
      setActionLoading(null);
      setConfirmDelete(null);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  /**
   * ============================================================================
   * RENDERIZAÇÃO
   * ============================================================================
   */

  // Verifica permissão
  if (!isAdmin) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <h3>Acesso Restrito</h3>
          <p>Você não tem permissão para acessar esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={styles.container} ref={containerRef}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <h1>Templates de Certificado</h1>
            <p>
              Gerencie os templates visuais dos certificados. 
              O template ativo será usado para todos os novos certificados emitidos.
            </p>
          </div>
          
          <button onClick={handleCreate} className={styles.createBtn}>
            <Plus size={18} />
            Novo Template
          </button>
        </div>

        {/* Loading */}
        {loading ? (
          <div className={styles.loading}>
            <Loader2 size={40} className={styles.spin} />
            <p>Carregando templates...</p>
          </div>
        ) : templates.length === 0 ? (
          /* Empty State */
          <div className={styles.emptyState}>
            <div className={styles.emptyIconWrapper}>
              <Award size={40} />
            </div>
            <h3>Nenhum template criado</h3>
            <p>
              Crie seu primeiro template de certificado para personalizar 
              as conquistas dos seus alunos.
            </p>
            <button onClick={handleCreate} className={styles.createBtn}>
              <Plus size={18} />
              Criar Primeiro Template
            </button>
          </div>
        ) : (
          /* Templates Grid */
          <div className={styles.templatesGrid} ref={gridRef}>
            {templates.map((template) => (
              <div 
                key={template.id} 
                className={`${styles.templateCard} ${template.isActive ? styles.active : ''}`}
              >
                {template.isActive && (
                  <div className={styles.activeBadge}>
                    <Check size={12} />
                    ATIVO
                  </div>
                )}

                {/* Preview */}
                <div className={styles.templatePreview}>
                  {template.backgroundPreview?.startsWith('http') || 
                   template.backgroundPreview?.startsWith('data:') ? (
                    <img 
                      src={template.backgroundPreview} 
                      alt={template.name}
                    />
                  ) : (
                    <div 
                      className={styles.colorPreview}
                      style={{ backgroundColor: template.backgroundPreview || '#fff' }}
                    >
                      <span>Cor: {template.backgroundPreview || '#FFFFFF'}</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className={styles.templateInfo}>
                  <h3 className={styles.templateName}>{template.name}</h3>
                  {template.description && (
                    <p className={styles.templateDesc}>{template.description}</p>
                  )}
                  <div className={styles.templateMeta}>
                    <span>
                      <Calendar size={12} />
                      {formatDate(template.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className={styles.templateActions}>
                  <button 
                    className={styles.actionBtn}
                    onClick={() => handleEdit(template.id)}
                    disabled={actionLoading === template.id}
                  >
                    {actionLoading === template.id ? (
                      <Loader2 size={14} className={styles.spin} />
                    ) : (
                      <Edit2 size={14} />
                    )}
                    Editar
                  </button>

                  <button 
                    className={styles.actionBtn}
                    onClick={() => handleDuplicate(template.id)}
                    disabled={actionLoading === template.id}
                  >
                    <Copy size={14} />
                    Duplicar
                  </button>

                  {template.isActive ? (
                    <button 
                      className={styles.actionBtn}
                      onClick={() => handleDeactivate(template.id)}
                      disabled={actionLoading === template.id}
                    >
                      <PowerOff size={14} />
                      Desativar
                    </button>
                  ) : (
                    <>
                      <button 
                        className={`${styles.actionBtn} ${styles.primary}`}
                        onClick={() => handleActivate(template.id)}
                        disabled={actionLoading === template.id}
                      >
                        <Power size={14} />
                        Ativar
                      </button>

                      <button 
                        className={`${styles.actionBtn} ${styles.danger}`}
                        onClick={() => setConfirmDelete(template.id)}
                        disabled={actionLoading === template.id}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal do Editor */}
      {isCreating && (
        <div className={styles.editorModal}>
          <div className={styles.editorWrapper}>
            <div className={styles.editorHeader}>
              <h2>
                {editingTemplate ? 'Editar Template' : 'Novo Template'}
              </h2>
              <button 
                onClick={() => {
                  setIsCreating(false);
                  setEditingTemplate(null);
                }}
                className={styles.closeEditorBtn}
              >
                <X size={16} />
                Fechar
              </button>
            </div>
            <div className={styles.editorContent}>
              <CertificateEditor 
                template={editingTemplate || undefined}
                onSave={handleSave}
                onCancel={() => {
                  setIsCreating(false);
                  setEditingTemplate(null);
                }}
                saving={saving}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {confirmDelete && (
        <div className={styles.confirmModal}>
          <div className={styles.confirmBox}>
            <h3>Excluir Template?</h3>
            <p>
              Esta ação não pode ser desfeita. 
              O template será permanentemente removido.
            </p>
            <div className={styles.confirmActions}>
              <button 
                onClick={() => setConfirmDelete(null)}
                className={styles.cancelBtn}
              >
                Cancelar
              </button>
              <button 
                onClick={handleDelete}
                className={styles.dangerBtn}
                disabled={actionLoading === confirmDelete}
              >
                {actionLoading === confirmDelete ? (
                  <Loader2 size={16} className={styles.spin} />
                ) : (
                  'Excluir'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
