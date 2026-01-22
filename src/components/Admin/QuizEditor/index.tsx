"use client";

import { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase"; // Apenas para leitura (GET)
import { collection, getDocs } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { X, Plus, Trash2, CheckCircle, Save, AlertCircle, Loader2 } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import styles from "./styles.module.css";

// Import das Actions Seguras
import { upsertQuestionAction, deleteQuestionAction } from "@/app/actions/admin/quizManagementActions";

// Tipos
type Option = { id: string; text: string; isCorrect: boolean };
type Question = { id?: string; text: string; options: Option[]; order: number };

interface QuizEditorProps {
  courseId: string;
  moduleId: string;
  moduleTitle: string;
  onClose: () => void;
}

export default function QuizEditor({ courseId, moduleId, moduleTitle, onClose }: QuizEditorProps) {
  const { user } = useAuth();
  const { addToast } = useToast();
  
  // Refs
  const modalRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Estados
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Estado do Formulário
  const [editingId, setEditingId] = useState<string | null>(null);
  const [qText, setQText] = useState("");
  const [options, setOptions] = useState<Option[]>([
    { id: '1', text: '', isCorrect: false },
    { id: '2', text: '', isCorrect: false }
  ]);

  // --- 1. Carregar Perguntas (Leitura ainda pode ser Client-Side para agilidade, ou via Action) ---
  const fetchQuestions = async () => {
    try {
      const ref = collection(db, "courses", courseId, "modules", moduleId, "questions");
      const snap = await getDocs(ref);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Question));
      // Ordenação local simples se não tiver order
      setQuestions(list);
    } catch (error) {
      console.error("Erro ao buscar:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchQuestions(); }, [courseId, moduleId]);

  // --- 2. Animação ---
  useGSAP(() => {
    gsap.fromTo(modalRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    gsap.fromTo(contentRef.current, 
      { scale: 0.9, opacity: 0, y: 20 }, 
      { scale: 1, opacity: 1, y: 0, duration: 0.4, ease: "back.out(1.2)", delay: 0.1 }
    );
  }, []);

  // --- 3. Handlers do Formulário ---
  const handleAddOption = () => {
    setOptions([...options, { id: Date.now().toString(), text: '', isCorrect: false }]);
  };

  const handleOptionChange = (id: string, text: string) => {
    setOptions(options.map(opt => opt.id === id ? { ...opt, text } : opt));
  };

  const handleSetCorrect = (id: string) => {
    setOptions(options.map(opt => ({ ...opt, isCorrect: opt.id === id })));
  };

  const handleRemoveOption = (id: string) => {
    if (options.length <= 2) return addToast("Mínimo 2 opções.", "warning");
    setOptions(options.filter(opt => opt.id !== id));
  };

  const resetForm = () => {
    setEditingId(null);
    setQText("");
    setOptions([
        { id: Date.now() + '1', text: '', isCorrect: false },
        { id: Date.now() + '2', text: '', isCorrect: false }
    ]);
  };

  const handleEditClick = (q: Question) => {
    setEditingId(q.id || null);
    setQText(q.text);
    setOptions(q.options);
  };

  // --- 4. Ações via Server Action ---
  const handleSaveQuestion = async () => {
    if (!qText.trim()) return addToast("Enunciado vazio.", "warning");
    if (options.some(o => !o.text.trim())) return addToast("Preencha todas opções.", "warning");
    if (!options.some(o => o.isCorrect)) return addToast("Marque a correta.", "warning");
    if (!user) return;

    setSaving(true);
    try {
        const token = await user.getIdToken();
        const payload = { 
            text: qText, 
            options, 
            order: questions.length // Simples ordem incremental
        };

        const res = await upsertQuestionAction(token, courseId, moduleId, editingId, payload);

        if (res.success) {
            addToast(editingId ? "Questão atualizada!" : "Questão criada!", "success");
            resetForm();
            fetchQuestions(); // Recarrega lista
        } else {
            addToast(res.message || "Erro ao salvar.", "error");
        }
    } catch (err) {
        console.error(err);
        addToast("Erro de conexão.", "error");
    } finally {
        setSaving(false);
    }
  };

  const handleDeleteClick = async (id: string) => {
    if (!confirm("Deletar pergunta?") || !user) return;
    try {
        const token = await user.getIdToken();
        await deleteQuestionAction(token, courseId, moduleId, id);
        setQuestions(prev => prev.filter(q => q.id !== id));
        if (editingId === id) resetForm();
    } catch (err) {
        addToast("Erro ao deletar.", "error");
    }
  };

  return (
    <div className={styles.overlay} ref={modalRef}>
      <div className={styles.modal} ref={contentRef}>
        
        {/* HEADER */}
        <div className={styles.header}>
            <div>
                <h2>Gerenciar Prova</h2>
                <p className={styles.subtitle}>{moduleTitle}</p>
            </div>
            <button onClick={onClose} className={styles.closeBtn}><X size={24} /></button>
        </div>

        <div className={styles.body}>
            
            {/* ESQUERDA: LISTA */}
            <div className={styles.listColumn}>
                <div className={styles.listHeader}>
                    <span>{questions.length} Questões</span>
                    <button onClick={resetForm} className={styles.newBtn} disabled={saving}>
                        <Plus size={16}/> Nova
                    </button>
                </div>
                
                <div className={styles.questionsList}>
                    {loading ? <div className={styles.loading}>Carregando...</div> : questions.map((q, i) => (
                        <div 
                            key={q.id} 
                            className={`${styles.questionItem} ${editingId === q.id ? styles.activeItem : ''}`}
                            onClick={() => handleEditClick(q)}
                        >
                            <span className={styles.qIndex}>#{i + 1}</span>
                            <p className={styles.qTextPreview}>{q.text}</p>
                            <button 
                                className={styles.deleteMiniBtn}
                                onClick={(e) => { e.stopPropagation(); if(q.id) handleDeleteClick(q.id); }}
                            >
                                <Trash2 size={14}/>
                            </button>
                        </div>
                    ))}
                    {questions.length === 0 && !loading && (
                        <div className={styles.emptyState}>
                            <AlertCircle size={32} opacity={0.5}/>
                            <p>Nenhuma pergunta criada.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* DIREITA: EDITOR */}
            <div className={styles.editorColumn}>
                <h3 className={styles.editorTitle}>
                    {editingId ? "Editar Pergunta" : "Nova Pergunta"}
                </h3>

                <div className={styles.fieldGroup}>
                    <label>Enunciado</label>
                    <textarea 
                        value={qText} onChange={e => setQText(e.target.value)}
                        placeholder="Ex: Qual o material..." rows={3} disabled={saving}
                    />
                </div>

                <div className={styles.fieldGroup}>
                    <label>Opções (Clique no círculo para marcar a correta)</label>
                    <div className={styles.optionsList}>
                        {options.map((opt, idx) => (
                            <div key={opt.id} className={`${styles.optionRow} ${opt.isCorrect ? styles.correctRow : ''}`}>
                                <button 
                                    className={`${styles.checkBtn} ${opt.isCorrect ? styles.checked : ''}`}
                                    onClick={() => handleSetCorrect(opt.id)}
                                    disabled={saving}
                                >
                                    <CheckCircle size={18} />
                                </button>
                                <input 
                                    type="text" value={opt.text}
                                    onChange={(e) => handleOptionChange(opt.id, e.target.value)}
                                    placeholder={`Opção ${idx + 1}`}
                                    disabled={saving}
                                />
                                <button onClick={() => handleRemoveOption(opt.id)} className={styles.removeOptBtn} disabled={saving}>
                                    <X size={16}/>
                                </button>
                            </div>
                        ))}
                    </div>
                    <button onClick={handleAddOption} className={styles.addOptBtn} disabled={saving}>
                        <Plus size={14}/> Adicionar Opção
                    </button>
                </div>

                <div className={styles.editorFooter}>
                    <button onClick={handleSaveQuestion} className={styles.saveBtn} disabled={saving}>
                        {saving ? <><Loader2 className={styles.spin} size={18}/> Salvando...</> : <><Save size={18} /> Salvar</>}
                    </button>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
}