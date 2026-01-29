// src/components/Admin/CertificateEditor/index.tsx
"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Save, X, Plus, Type, Image as ImageIcon, 
  AlignLeft, AlignCenter, AlignRight, 
  Bold, Italic, Trash2, 
  Move, ZoomIn, ZoomOut, Upload,
  ChevronDown
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { 
  CertificateTemplate, 
  CertificateField, 
  CertificateFieldStyle,
  CERTIFICATE_PLACEHOLDERS, 
  PLACEHOLDER_DESCRIPTIONS,
  PlaceholderKey 
} from '@/types/certificate';
import { DEFAULT_CERTIFICATE_FIELDS } from '@/lib/schemas/certificateSchemas';
import styles from './styles.module.css';

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

export default function CertificateEditor({ 
  template, 
  onSave, 
  onCancel,
  saving = false 
}: CertificateEditorProps) {
  // --- STATE: DADOS ---
  const [name, setName] = useState(template?.name || 'Novo Template');
  const [fields, setFields] = useState<CertificateField[]>(
    template?.fields || DEFAULT_CERTIFICATE_FIELDS
  );
  const [background, setBackground] = useState(
    template?.background || { type: 'color' as const, value: '#FFFFFF' }
  );
  const [dimensions, setDimensions] = useState(
    template?.dimensions || { width: 1123, height: 794, orientation: 'landscape' as const } // A4 Landscape 96dpi approx
  );

  // --- STATE: UI ---
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showAddMenu, setShowAddMenu] = useState(false);
  
  // Dragging
  const [dragState, setDragState] = useState<DragState>({
    fieldId: null, startX: 0, startY: 0, originalX: 0, originalY: 0,
  });

  const canvasRef = useRef<HTMLDivElement>(null);

  // --- HANDLERS: SELEÇÃO ---
  
  // Clicar no fundo: Desselecionar tudo
  const handleStageClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setSelectedId(null);
      setShowAddMenu(false);
    }
  };

  // Clicar no elemento: Selecionar e iniciar Drag (se não for resize)
  const handleElementMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Impede que o click no fundo dispare
    setSelectedId(id);

    const field = fields.find(f => f.id === id);
    if (!field) return;

    setDragState({
      fieldId: id,
      startX: e.clientX,
      startY: e.clientY,
      originalX: field.position.x,
      originalY: field.position.y,
    });
  };

  // --- HANDLERS: DRAG & DROP ---

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState.fieldId || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    
    // Calcula o delta em pixels, ajustado pelo zoom
    const deltaX = (e.clientX - dragState.startX) / zoom;
    const deltaY = (e.clientY - dragState.startY) / zoom;

    // Converte para porcentagem
    const percentDeltaX = (deltaX / rect.width) * 100;
    const percentDeltaY = (deltaY / rect.height) * 100;

    const newX = dragState.originalX + percentDeltaX;
    const newY = dragState.originalY + percentDeltaY;

    // Atualiza estado (sem clamp rígido para permitir sangria se quiser, ou clamp 0-100)
    setFields(prev => prev.map(f => 
      f.id === dragState.fieldId 
        ? { ...f, position: { x: Math.max(0, Math.min(100, newX)), y: Math.max(0, Math.min(100, newY)) } } 
        : f
    ));
  }, [dragState, zoom]);

  const handleMouseUp = useCallback(() => {
    setDragState(prev => ({ ...prev, fieldId: null }));
  }, []);

  useEffect(() => {
    if (dragState.fieldId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState.fieldId, handleMouseMove, handleMouseUp]);

  // --- HANDLERS: CRUD CAMPOS ---

  const addField = (key: PlaceholderKey) => {
    const newField: CertificateField = {
      id: uuidv4(),
      type: 'text',
      placeholder: CERTIFICATE_PLACEHOLDERS[key],
      defaultValue: PLACEHOLDER_DESCRIPTIONS[key],
      position: { x: 50, y: 50 },
      style: {
        fontSize: 24,
        fontFamily: 'Helvetica',
        fontWeight: 'normal',
        color: '#000000',
        textAlign: 'center',
      }
    };
    setFields([...fields, newField]);
    setSelectedId(newField.id);
    setShowAddMenu(false);
  };

  const updateField = (id: string, updates: Partial<CertificateField>) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const updateStyle = (id: string, styleUpdates: Partial<CertificateFieldStyle>) => {
    setFields(prev => prev.map(f => 
      f.id === id ? { ...f, style: { ...f.style, ...styleUpdates } } : f
    ));
  };

  const deleteField = (id: string) => {
    setFields(prev => prev.filter(f => f.id !== id));
    setSelectedId(null);
  };

  // --- HANDLERS: BACKGROUND ---
  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      setBackground({ type: 'image', value: ev.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  // --- ELEMENTO SELECIONADO ---
  const selectedField = fields.find(f => f.id === selectedId);

  return (
    <div className={styles.container}>
      
      {/* ================= HEADER TOOLBAR ================= */}
      <div className={styles.toolbar}>
        <div className={styles.toolGroup}>
          <div style={{position: 'relative'}}>
            <button 
              className={`${styles.toolBtn} ${styles.primary}`}
              onClick={() => setShowAddMenu(!showAddMenu)}
            >
              <Plus size={16} /> Adicionar Elemento
            </button>
            {showAddMenu && (
              <div className={styles.addMenu}>
                {(Object.keys(CERTIFICATE_PLACEHOLDERS) as PlaceholderKey[]).map(key => (
                  <button key={key} className={styles.addMenuItem} onClick={() => addField(key)}>
                    <Type size={14} /> {key.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <div className={styles.toolGroup} style={{ marginLeft: 20, borderLeft: '1px solid #333', paddingLeft: 20 }}>
            <button className={styles.toolBtn} onClick={() => setZoom(z => Math.max(0.2, z - 0.1))}><ZoomOut size={16}/></button>
            <span style={{ fontSize: '0.8rem', minWidth: 40, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
            <button className={styles.toolBtn} onClick={() => setZoom(z => Math.min(2, z + 0.1))}><ZoomIn size={16}/></button>
          </div>
        </div>

        <div className={styles.toolGroup}>
          <button className={styles.toolBtn} onClick={onCancel}><X size={16} /> Cancelar</button>
          <button 
            className={`${styles.toolBtn} ${styles.primary}`} 
            onClick={() => onSave({ name, fields, background, dimensions })}
            disabled={saving}
          >
            <Save size={16} /> {saving ? 'Salvando...' : 'Salvar Template'}
          </button>
        </div>
      </div>

      {/* ================= WORKSPACE ================= */}
      <div className={styles.workspace}>
        
        {/* --- STAGE (CANVAS) --- */}
        <div 
          className={styles.canvasArea} 
          onClick={handleStageClick}
        >
          <div 
            className={styles.artboard}
            ref={canvasRef}
            style={{
              width: dimensions.width,
              height: dimensions.height,
              transform: `scale(${zoom})`,
              backgroundColor: background.type === 'color' ? background.value : '#fff',
              backgroundImage: background.type === 'image' ? `url(${background.value})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            {fields.map(field => {
              const isSelected = selectedId === field.id;
              
              return (
                <div
                  key={field.id}
                  className={`${styles.element} ${isSelected ? styles.selected : ''} ${dragState.fieldId === field.id ? styles.dragging : ''}`}
                  style={{
                    left: `${field.position.x}%`,
                    top: `${field.position.y}%`,
                    fontSize: `${field.style.fontSize}px`,
                    fontFamily: field.style.fontFamily,
                    fontWeight: field.style.fontWeight,
                    color: field.style.color,
                    textAlign: field.style.textAlign,
                    letterSpacing: field.style.letterSpacing ? `${field.style.letterSpacing}px` : undefined,
                    textTransform: field.style.textTransform,
                    width: field.style.maxWidth ? `${field.style.maxWidth}%` : 'auto',
                  }}
                  onMouseDown={(e) => handleElementMouseDown(e, field.id)}
                >
                  {/* Conteúdo Real */}
                  {field.defaultValue || field.placeholder}

                  {/* UI de Seleção (Handles) */}
                  {isSelected && (
                    <>
                      <div className={styles.resizeHandle} style={{ top: -4, left: -4, cursor: 'nw-resize' }} />
                      <div className={styles.resizeHandle} style={{ top: -4, right: -4, cursor: 'ne-resize' }} />
                      <div className={styles.resizeHandle} style={{ bottom: -4, left: -4, cursor: 'sw-resize' }} />
                      <div className={styles.resizeHandle} style={{ bottom: -4, right: -4, cursor: 'se-resize' }} />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* --- PROPERTIES PANEL (RIGHT) --- */}
        <div className={styles.propertiesPanel}>
          
          {/* Se nada selecionado -> Configurações do Template */}
          {!selectedField && (
            <>
              <div className={styles.panelSection}>
                <h4 className={styles.sectionTitle}>Documento</h4>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>Nome do Template</label>
                  <input 
                    className={styles.input} 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                  />
                </div>
              </div>

              <div className={styles.panelSection}>
                <h4 className={styles.sectionTitle}>Dimensões</h4>
                <div className={styles.inputRow}>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Largura (px)</label>
                    <input 
                      type="number" className={styles.input} 
                      value={dimensions.width} 
                      onChange={e => setDimensions({...dimensions, width: Number(e.target.value)})}
                    />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Altura (px)</label>
                    <input 
                      type="number" className={styles.input} 
                      value={dimensions.height} 
                      onChange={e => setDimensions({...dimensions, height: Number(e.target.value)})}
                    />
                  </div>
                </div>
              </div>

              <div className={styles.panelSection}>
                <h4 className={styles.sectionTitle}>Fundo</h4>
                <div className={styles.inputGroup} style={{ marginBottom: 12 }}>
                  <label className={styles.label}>Upload Imagem</label>
                  <label className={styles.toolBtn} style={{ justifyContent: 'center', border: '1px dashed #333' }}>
                    <input type="file" hidden onChange={handleBgUpload} accept="image/*" />
                    <Upload size={14} /> Escolher Arquivo
                  </label>
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>Ou Cor Sólida</label>
                  <div className={styles.colorPreview}>
                    <input 
                      type="color" 
                      className={styles.colorSwatch} 
                      value={background.type === 'color' ? background.value : '#ffffff'}
                      onChange={e => setBackground({ type: 'color', value: e.target.value })}
                    />
                    <span className={styles.colorValue}>
                      {background.type === 'color' ? background.value : 'Imagem definida'}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Se elemento selecionado -> Propriedades do Elemento */}
          {selectedField && (
            <>
              <div className={styles.panelSection} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 className={styles.sectionTitle} style={{ marginBottom: 0 }}>Editar Texto</h4>
                <button 
                  className={styles.toolBtn} 
                  style={{ color: '#ef4444' }}
                  onClick={() => deleteField(selectedField.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className={styles.panelSection}>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>Conteúdo</label>
                  <input 
                    className={styles.input} 
                    value={selectedField.defaultValue} 
                    onChange={e => updateField(selectedField.id, { defaultValue: e.target.value })}
                  />
                </div>
              </div>

              <div className={styles.panelSection}>
                <h4 className={styles.sectionTitle}>Tipografia</h4>
                
                <div className={styles.inputRow}>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Tamanho</label>
                    <input 
                      type="number" className={styles.input} 
                      value={selectedField.style.fontSize}
                      onChange={e => updateStyle(selectedField.id, { fontSize: Number(e.target.value) })}
                    />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Cor</label>
                    <div className={styles.colorPreview} style={{ height: 30 }}>
                      <input 
                        type="color" 
                        className={styles.colorSwatch} 
                        value={selectedField.style.color}
                        onChange={e => updateStyle(selectedField.id, { color: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.inputGroup} style={{ marginBottom: 12 }}>
                  <label className={styles.label}>Fonte</label>
                  <select 
                    className={styles.select}
                    value={selectedField.style.fontFamily}
                    onChange={e => updateStyle(selectedField.id, { fontFamily: e.target.value })}
                  >
                    <option value="Helvetica">Helvetica / Arial</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Courier New">Courier New</option>
                    <option value="Georgia">Georgia</option>
                  </select>
                </div>

                <div className={styles.inputRow}>
                  <div className={styles.iconButtonGroup} style={{ flex: 1 }}>
                    <button 
                      className={`${styles.iconBtn} ${selectedField.style.textAlign === 'left' ? styles.active : ''}`}
                      onClick={() => updateStyle(selectedField.id, { textAlign: 'left' })}
                    >
                      <AlignLeft size={16} />
                    </button>
                    <button 
                      className={`${styles.iconBtn} ${selectedField.style.textAlign === 'center' ? styles.active : ''}`}
                      onClick={() => updateStyle(selectedField.id, { textAlign: 'center' })}
                    >
                      <AlignCenter size={16} />
                    </button>
                    <button 
                      className={`${styles.iconBtn} ${selectedField.style.textAlign === 'right' ? styles.active : ''}`}
                      onClick={() => updateStyle(selectedField.id, { textAlign: 'right' })}
                    >
                      <AlignRight size={16} />
                    </button>
                  </div>

                  <div className={styles.iconButtonGroup} style={{ flex: 1 }}>
                    <button 
                      className={`${styles.iconBtn} ${selectedField.style.fontWeight === 'bold' ? styles.active : ''}`}
                      onClick={() => updateStyle(selectedField.id, { fontWeight: selectedField.style.fontWeight === 'bold' ? 'normal' : 'bold' })}
                    >
                      <Bold size={16} />
                    </button>
                    <button 
                      className={`${styles.iconBtn} ${selectedField.style.textTransform === 'uppercase' ? styles.active : ''}`}
                      onClick={() => updateStyle(selectedField.id, { textTransform: selectedField.style.textTransform === 'uppercase' ? 'none' : 'uppercase' })}
                    >
                      <Type size={16} />
                    </button>
                  </div>
                </div>
              </div>

              <div className={styles.panelSection}>
                <h4 className={styles.sectionTitle}>Posição (Precisa)</h4>
                <div className={styles.inputRow}>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>X (%)</label>
                    <input 
                      type="number" className={styles.input} step="0.1"
                      value={Number(selectedField.position.x).toFixed(1)}
                      onChange={e => updateField(selectedField.id, { position: { ...selectedField.position, x: Number(e.target.value) } })}
                    />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Y (%)</label>
                    <input 
                      type="number" className={styles.input} step="0.1"
                      value={Number(selectedField.position.y).toFixed(1)}
                      onChange={e => updateField(selectedField.id, { position: { ...selectedField.position, y: Number(e.target.value) } })}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}