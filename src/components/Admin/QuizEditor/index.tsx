"use client";

import { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, addDoc, getDocs, deleteDoc, doc, updateDoc, serverTimestamp 
} from "firebase/firestore";
import { X, Plus, Trash2, CheckCircle, Save, AlertCircle } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import styles from "./styles.module.css";

// Tipos
type Option = {
  id: string;
  text: string;
  isCorrect: boolean;
};

type Question = {
  id?: string;
  text: string;
  options: Option[];
  createdAt?: any;
};

interface QuizEditorProps {
  courseId: string;
  moduleId: string;
  moduleTitle: string;
  onClose: () => void;
}

export default function QuizEditor({ courseId, moduleId, moduleTitle, onClose }: QuizEditorProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estado do Formulário Atual
  const [editingId, setEditingId] = useState<string | null>(null); // Se null, é modo criação
  const [qText, setQText] = useState("");
  const [options, setOptions] = useState<Option[]>([
    { id: '1', text: '', isCorrect: false },
    { id: '2', text: '', isCorrect: false }
  ]);

  // --- 1. Carregar Perguntas ---
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const ref = collection(db, "courses", courseId, "modules", moduleId, "questions");
        const snap = await getDocs(ref);
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Question));
        setQuestions(list);
      } catch (error) {
        console.error("Erro ao buscar perguntas:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, [courseId, moduleId]);

  // --- 2. Animação de Entrada (GSAP) ---
  useGSAP(() => {
    gsap.fromTo(modalRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    gsap.fromTo(contentRef.current, 
      { scale: 0.9, opacity: 0, y: 20 }, 
      { scale: 1, opacity: 1, y: 0, duration: 0.4, ease: "back.out(1.2)", delay: 0.1 }
    );
  }, []);

  // --- 3. Lógica do Formulário ---
  
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
    if (options.length <= 2) return alert("Mínimo de 2 opções.");
    setOptions(options.filter(opt => opt.id !== id));
  };

  const handleSaveQuestion = async () => {
    if (!qText.trim()) return alert("Digite a pergunta.");
    if (options.some(o => !o.text.trim())) return alert("Preencha todas as opções.");
    if (!options.some(o => o.isCorrect)) return alert("Selecione a resposta correta.");

    const questionData = {
      text: qText,
      options,
      updatedAt: serverTimestamp()
    };

    try {
      if (editingId) {
        // Editar
        await updateDoc(doc(db, "courses", courseId, "modules", moduleId, "questions", editingId), questionData);
        setQuestions(questions.map(q => q.id === editingId ? { ...questionData, id: editingId } : q));
      } else {
        // Criar
        const docRef = await addDoc(collection(db, "courses", courseId, "modules", moduleId, "questions"), {
            ...questionData,
            createdAt: serverTimestamp()
        });
        setQuestions([...questions, { ...questionData, id: docRef.id }]);
      }
      resetForm();
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar.");
    }
  };

  const handleEditClick = (q: Question) => {
    setEditingId(q.id || null);
    setQText(q.text);
    setOptions(q.options);
  };

  const handleDeleteClick = async (id: string) => {
    if(!confirm("Deletar pergunta?")) return;
    try {
      await deleteDoc(doc(db, "courses", courseId, "modules", moduleId, "questions", id));
      setQuestions(questions.filter(q => q.id !== id));
      if (editingId === id) resetForm();
    } catch (err) { console.error(err); }
  };

  const resetForm = () => {
    setEditingId(null);
    setQText("");
    setOptions([
        { id: Date.now().toString() + '1', text: '', isCorrect: false },
        { id: Date.now().toString() + '2', text: '', isCorrect: false }
    ]);
  };

  return (
    <div className={styles.overlay} ref={modalRef}>
      <div className={styles.modal} ref={contentRef}>
        
        {/* HEADER */}
        <div className={styles.header}>
            <div>
                <h2>Gerenciar Prova</h2>
                <p className={styles.subtitle}>Módulo: {moduleTitle}</p>
            </div>
            <button onClick={onClose} className={styles.closeBtn}><X size={24} /></button>
        </div>

        <div className={styles.body}>
            
            {/* COLUNA ESQUERDA: LISTA */}
            <div className={styles.listColumn}>
                <div className={styles.listHeader}>
                    <span>{questions.length} Questões</span>
                    <button onClick={resetForm} className={styles.newBtn}>
                        <Plus size={16}/> Nova
                    </button>
                </div>
                
                <div className={styles.questionsList}>
                    {loading ? <p className={styles.loading}>Carregando...</p> : questions.map((q, i) => (
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

            {/* COLUNA DIREITA: EDITOR */}
            <div className={styles.editorColumn}>
                <h3 className={styles.editorTitle}>
                    {editingId ? "Editar Pergunta" : "Criar Nova Pergunta"}
                </h3>

                <div className={styles.fieldGroup}>
                    <label>Enunciado da Pergunta</label>
                    <textarea 
                        value={qText} 
                        onChange={e => setQText(e.target.value)}
                        placeholder="Ex: Qual o material mais utilizado em..."
                        rows={3}
                    />
                </div>

                <div className={styles.fieldGroup}>
                    <label>Opções de Resposta (Marque a correta)</label>
                    <div className={styles.optionsList}>
                        {options.map((opt, idx) => (
                            <div key={opt.id} className={`${styles.optionRow} ${opt.isCorrect ? styles.correctRow : ''}`}>
                                <button 
                                    className={`${styles.checkBtn} ${opt.isCorrect ? styles.checked : ''}`}
                                    onClick={() => handleSetCorrect(opt.id)}
                                    title="Marcar como correta"
                                >
                                    <CheckCircle size={18} />
                                </button>
                                <input 
                                    type="text" 
                                    value={opt.text}
                                    onChange={(e) => handleOptionChange(opt.id, e.target.value)}
                                    placeholder={`Opção ${idx + 1}`}
                                />
                                <button onClick={() => handleRemoveOption(opt.id)} className={styles.removeOptBtn}>
                                    <X size={16}/>
                                </button>
                            </div>
                        ))}
                    </div>
                    <button onClick={handleAddOption} className={styles.addOptBtn}>
                        <Plus size={14}/> Adicionar Opção
                    </button>
                </div>

                <div className={styles.editorFooter}>
                    <button onClick={handleSaveQuestion} className={styles.saveBtn}>
                        <Save size={18} /> Salvar Pergunta
                    </button>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
}