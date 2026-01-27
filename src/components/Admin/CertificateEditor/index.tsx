// src/components/Admin/CertificateEditor/index.tsx
"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Upload, Plus, Trash2, Move, Save, Eye, X, 
  ChevronDown, Type, Image as ImageIcon, Loader2,
  Palette
} from 'lucide-react';
import { 
  CertificateTemplate, 
  CertificateField,
  CertificateFieldStyle,
  CERTIFICATE_PLACEHOLDERS,
  PLACEHOLDER_DESCRIPTIONS,
  PlaceholderKey,
} from '@/types/certificate';
import { DEFAULT_CERTIFICATE_FIELDS } from '@/lib/schemas/certificateSchemas';
import { v4 as uuidv4 } from 'uuid';
import styles from './styles.module.css';

/**
 * ============================================================================
 * TIPOS
 * ============================================================================
 */

interface CertificateEditorProps {
  template?: Partial<CertificateTemplate>;
  onSave: (template: Partial<CertificateTemplate>) => Promise<void>;
  onCancel?: () => void;
  saving?: boolean;
}

interface DragState {
  fieldId: string | null;
  startX: number;
  startY: number;
  originalX: number;
  originalY: number;
}

/**
 * ============================================================================
 * COMPONENTE PRINCIPAL
 * ============================================================================
 */

export default function CertificateEditor({ 
  template, 
  onSave, 
  onCancel,
  saving = false 
}: CertificateEditorProps) {
  // Estados do template
  const [name, setName] = useState(template?.name || 'Novo Template');
  const [description, setDescription] = useState(template?.description || '');
  const [fields, setFields] = useState<CertificateField[]>(
    template?.fields || DEFAULT_CERTIFICATE_FIELDS
  );
  const [background, setBackground] = useState(
    template?.background || { type: 'color' as const, value: '#FFFFFF' }
  );
  const [dimensions, setDimensions] = useState(
    template?.dimensions || { width: 1754, height: 1240, orientation: 'landscape' as const }
  );

  // Estados de UI
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);

  // Drag state
  const [dragState, setDragState] = useState<DragState>({
    fieldId: null,
    startX: 0,
    startY: 0,
    originalX: 0,
    originalY: 0,
  });

  // Refs
  const canvasRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowAddDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * ============================================================================
   * HANDLERS DE CAMPO
   * ============================================================================
   */

  // Adicionar novo campo
  const addField = (placeholderKey: PlaceholderKey) => {
    const placeholder = CERTIFICATE_PLACEHOLDERS[placeholderKey];
    
    const newField: CertificateField = {
      id: uuidv4(),
      type: 'text',
      placeholder,
      defaultValue: placeholder,
      position: { x: 50, y: 50 },
      style: {
        fontSize: 24,
        fontFamily: 'Helvetica',
        fontWeight: 'normal',
        color: '#1a1620',
        textAlign: 'center',
      },
    };
    
    setFields(prev => [...prev, newField]);
    setSelectedFieldId(newField.id);
    setShowAddDropdown(false);
  };

  // Remover campo
  const removeField = (fieldId: string) => {
    setFields(prev => prev.filter(f => f.id !== fieldId));
    if (selectedFieldId === fieldId) {
      setSelectedFieldId(null);
    }
  };

  // Atualizar campo
  const updateField = (fieldId: string, updates: Partial<CertificateField>) => {
    setFields(prev => prev.map(f => 
      f.id === fieldId ? { ...f, ...updates } : f
    ));
  };

  // Atualizar estilo do campo
  const updateFieldStyle = (fieldId: string, styleUpdates: Partial<CertificateFieldStyle>) => {
    setFields(prev => prev.map(f => 
      f.id === fieldId 
        ? { ...f, style: { ...f.style, ...styleUpdates } }
        : f
    ));
  };

  /**
   * ============================================================================
   * DRAG & DROP
   * ============================================================================
   */

  const handleMouseDown = (e: React.MouseEvent, fieldId: string) => {
    if (e.button !== 0) return; // Só botão esquerdo
    
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;

    e.preventDefault();
    setSelectedFieldId(fieldId);
    
    setDragState({
      fieldId,
      startX: e.clientX,
      startY: e.clientY,
      originalX: field.position.x,
      originalY: field.position.y,
    });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState.fieldId || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    const deltaX = e.clientX - dragState.startX;
    const deltaY = e.clientY - dragState.startY;
    
    // Converte delta de pixels para porcentagem
    const percentDeltaX = (deltaX / rect.width) * 100;
    const percentDeltaY = (deltaY / rect.height) * 100;
    
    const newX = Math.max(0, Math.min(100, dragState.originalX + percentDeltaX));
    const newY = Math.max(0, Math.min(100, dragState.originalY + percentDeltaY));

    updateField(dragState.fieldId, {
      position: { x: newX, y: newY }
    });
  }, [dragState]);

  const handleMouseUp = useCallback(() => {
    setDragState(prev => ({ ...prev, fieldId: null }));
  }, []);

  // Registra listeners globais para drag
  useEffect(() => {
    if (dragState.fieldId) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState.fieldId, handleMouseMove, handleMouseUp]);

  /**
   * ============================================================================
   * BACKGROUND
   * ============================================================================
   */

  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validação
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Tipo de arquivo não suportado. Use PNG, JPG ou WebP.');
      return;
    }
    
    setUploadingBg(true);
    
    try {
      // Para preview local, usamos base64
      const reader = new FileReader();
      reader.onload = (event) => {
        setBackground({
          type: 'image',
          value: event.target?.result as string,
        });
        setUploadingBg(false);
      };
      reader.onerror = () => {
        alert('Erro ao carregar imagem');
        setUploadingBg(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Erro no upload:', error);
      setUploadingBg(false);
    }
  };

  const handleBackgroundColorChange = (color: string) => {
    setBackground({
      type: 'color',
      value: color,
    });
  };

  /**
   * ============================================================================
   * SALVAR
   * ============================================================================
   */

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Digite um nome para o template');
      return;
    }
    
    if (fields.length === 0) {
      alert('Adicione pelo menos um campo ao template');
      return;
    }

    await onSave({
      name: name.trim(),
      description: description.trim(),
      background,
      dimensions,
      fields,
      isActive: template?.isActive || false,
    });
  };

  /**
   * ============================================================================
   * RENDERIZAÇÃO
   * ============================================================================
   */

  const selectedField = fields.find(f => f.id === selectedFieldId);

  return (
    <div className={styles.editorContainer}>
      {/* ==================== TOOLBAR ==================== */}
      <div className={styles.toolbar}>
        <div className={styles.toolGroup}>
          {/* Dropdown de Adicionar Campo */}
          <div className={styles.addFieldDropdown} ref={dropdownRef}>
            <button 
              className={styles.addFieldBtn}
              onClick={() => setShowAddDropdown(!showAddDropdown)}
            >
              <Plus size={16} />
              Adicionar Campo
              <ChevronDown size={14} />
            </button>
            
            {showAddDropdown && (
              <div className={styles.dropdownMenu}>
                {(Object.keys(CERTIFICATE_PLACEHOLDERS) as PlaceholderKey[]).map(key => (
                  <button
                    key={key}
                    className={styles.dropdownItem}
                    onClick={() => addField(key)}
                  >
                    <span>{key.replace(/_/g, ' ')}</span>
                    <span>{PLACEHOLDER_DESCRIPTIONS[key]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={styles.toolGroup}>
          {/* Upload de Background */}
          <label className={styles.uploadBtn}>
            {uploadingBg ? (
              <Loader2 size={16} className={styles.spin} />
            ) : (
              <ImageIcon size={16} />
            )}
            {uploadingBg ? 'Carregando...' : 'Upload Fundo'}
            <input 
              type="file" 
              accept="image/png,image/jpeg,image/webp" 
              onChange={handleBackgroundUpload}
              disabled={uploadingBg}
              hidden 
            />
          </label>

          {/* Cor de Fundo */}
          <div className={styles.colorPicker}>
            <span className={styles.colorPickerLabel}>ou cor:</span>
            <input 
              type="color"
              className={styles.colorPickerInput}
              value={background.type === 'color' ? background.value : '#FFFFFF'}
              onChange={(e) => handleBackgroundColorChange(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.actions}>
          {onCancel && (
            <button onClick={onCancel} className={styles.previewBtn}>
              <X size={16} />
              Cancelar
            </button>
          )}
          
          <button 
            onClick={handleSave} 
            className={styles.saveBtn}
            disabled={saving}
          >
            {saving ? (
              <Loader2 size={16} className={styles.spin} />
            ) : (
              <Save size={16} />
            )}
            {saving ? 'Salvando...' : 'Salvar Template'}
          </button>
        </div>
      </div>

      {/* ==================== WORKSPACE ==================== */}
      <div className={styles.workspace}>
        {/* Canvas de Edição */}
        <div className={styles.canvasWrapper}>
          <div 
            ref={canvasRef}
            className={`${styles.canvas} ${styles[dimensions.orientation]}`}
            style={{
              backgroundImage: background.type === 'image' ? `url(${background.value})` : 'none',
              backgroundColor: background.type === 'color' ? background.value : 'transparent',
            }}
            onClick={(e) => {
              // Deseleciona se clicou no canvas vazio
              if (e.target === e.currentTarget) {
                setSelectedFieldId(null);
              }
            }}
          >
            {fields.map((field) => (
              <div
                key={field.id}
                className={`
                  ${styles.field} 
                  ${selectedFieldId === field.id ? styles.selected : ''}
                  ${dragState.fieldId === field.id ? styles.dragging : ''}
                `}
                style={{
                  left: `${field.position.x}%`,
                  top: `${field.position.y}%`,
                  fontSize: `${(field.style.fontSize || 24) * 0.5}px`, // Scale down para preview
                  fontFamily: field.style.fontFamily,
                  fontWeight: field.style.fontWeight,
                  color: field.style.color,
                  textAlign: field.style.textAlign,
                  textTransform: field.style.textTransform,
                  letterSpacing: field.style.letterSpacing ? `${field.style.letterSpacing}px` : undefined,
                }}
                onMouseDown={(e) => handleMouseDown(e, field.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFieldId(field.id);
                }}
              >
                <div className={styles.fieldContent}>
                  <Move size={12} className={styles.dragHandle} />
                  <span>{field.defaultValue || field.placeholder}</span>
                </div>
                
                <button 
                  className={styles.deleteFieldBtn}
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    removeField(field.id); 
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}

            {fields.length === 0 && (
              <div className={styles.emptyState}>
                <Type size={48} />
                <h4>Nenhum campo adicionado</h4>
                <p>Use o botão "Adicionar Campo" para começar a montar seu certificado.</p>
              </div>
            )}
          </div>
        </div>

        {/* Painel de Propriedades */}
        <div className={styles.propertiesPanel}>
          {/* Info do Template */}
          <div className={styles.templateInfo}>
            <input
              type="text"
              className={styles.templateNameInput}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do Template"
            />
            <textarea
              className={styles.templateDescInput}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição (opcional)"
            />
          </div>

          {selectedField ? (
            <>
              <h3 className={styles.panelTitle}>
                Propriedades do Campo
              </h3>

              {/* Texto/Valor */}
              <div className={styles.propertyGroup}>
                <label className={styles.propertyLabel}>Texto do Campo</label>
                <input 
                  type="text"
                  className={styles.propertyInput}
                  value={selectedField.defaultValue || selectedField.placeholder}
                  onChange={(e) => updateField(selectedFieldId!, { 
                    defaultValue: e.target.value 
                  })}
                  placeholder="Texto ou placeholder..."
                />
              </div>

              {/* Posição */}
              <div className={styles.propertyGroup}>
                <label className={styles.propertyLabel}>Posição</label>
                <div className={styles.propertyRow}>
                  <div>
                    <input 
                      type="number"
                      className={styles.propertyInput}
                      value={Math.round(selectedField.position.x)}
                      onChange={(e) => updateField(selectedFieldId!, { 
                        position: { 
                          ...selectedField.position, 
                          x: Number(e.target.value) 
                        } 
                      })}
                      min={0}
                      max={100}
                    />
                    <span style={{ fontSize: '0.7rem', color: '#888' }}>X (%)</span>
                  </div>
                  <div>
                    <input 
                      type="number"
                      className={styles.propertyInput}
                      value={Math.round(selectedField.position.y)}
                      onChange={(e) => updateField(selectedFieldId!, { 
                        position: { 
                          ...selectedField.position, 
                          y: Number(e.target.value) 
                        } 
                      })}
                      min={0}
                      max={100}
                    />
                    <span style={{ fontSize: '0.7rem', color: '#888' }}>Y (%)</span>
                  </div>
                </div>
              </div>

              {/* Tamanho da Fonte */}
              <div className={styles.propertyGroup}>
                <label className={styles.propertyLabel}>Tamanho da Fonte</label>
                <input 
                  type="number"
                  className={styles.propertyInput}
                  value={selectedField.style.fontSize || 24}
                  onChange={(e) => updateFieldStyle(selectedFieldId!, { 
                    fontSize: Number(e.target.value) 
                  })}
                  min={8}
                  max={120}
                />
              </div>

              {/* Cor */}
              <div className={styles.propertyGroup}>
                <label className={styles.propertyLabel}>Cor do Texto</label>
                <div className={styles.colorInputWrapper}>
                  <input 
                    type="color"
                    className={styles.colorSwatch}
                    value={selectedField.style.color || '#000000'}
                    onChange={(e) => updateFieldStyle(selectedFieldId!, { 
                      color: e.target.value 
                    })}
                  />
                  <input 
                    type="text"
                    className={`${styles.propertyInput} ${styles.colorHex}`}
                    value={selectedField.style.color || '#000000'}
                    onChange={(e) => updateFieldStyle(selectedFieldId!, { 
                      color: e.target.value 
                    })}
                    placeholder="#000000"
                  />
                </div>
              </div>

              {/* Peso da Fonte */}
              <div className={styles.propertyGroup}>
                <label className={styles.propertyLabel}>Peso da Fonte</label>
                <select 
                  className={styles.propertySelect}
                  value={selectedField.style.fontWeight || 'normal'}
                  onChange={(e) => updateFieldStyle(selectedFieldId!, { 
                    fontWeight: e.target.value as 'normal' | 'bold' 
                  })}
                >
                  <option value="normal">Normal</option>
                  <option value="bold">Negrito</option>
                </select>
              </div>

              {/* Alinhamento */}
              <div className={styles.propertyGroup}>
                <label className={styles.propertyLabel}>Alinhamento</label>
                <select 
                  className={styles.propertySelect}
                  value={selectedField.style.textAlign || 'center'}
                  onChange={(e) => updateFieldStyle(selectedFieldId!, { 
                    textAlign: e.target.value as 'left' | 'center' | 'right' 
                  })}
                >
                  <option value="left">Esquerda</option>
                  <option value="center">Centro</option>
                  <option value="right">Direita</option>
                </select>
              </div>

              {/* Transformação de Texto */}
              <div className={styles.propertyGroup}>
                <label className={styles.propertyLabel}>Caixa do Texto</label>
                <select 
                  className={styles.propertySelect}
                  value={selectedField.style.textTransform || 'none'}
                  onChange={(e) => updateFieldStyle(selectedFieldId!, { 
                    textTransform: e.target.value as 'none' | 'uppercase' | 'lowercase' | 'capitalize'
                  })}
                >
                  <option value="none">Normal</option>
                  <option value="uppercase">MAIÚSCULAS</option>
                  <option value="lowercase">minúsculas</option>
                  <option value="capitalize">Capitalizado</option>
                </select>
              </div>
            </>
          ) : (
            <div className={styles.emptyState}>
              <Palette size={32} />
              <h4>Selecione um campo</h4>
              <p>Clique em um campo no canvas para editar suas propriedades.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
