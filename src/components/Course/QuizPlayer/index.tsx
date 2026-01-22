// src/components/Course/QuizPlayer/index.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowRight, Check, X, Loader2 } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useToast } from "@/context/ToastContext";
import styles from "./styles.module.css";
import { useAuth } from "@/context/AuthContext";
import { getQuizQuestionsAction, submitQuizAction } from "@/app/actions/quizActions";
import LevelUpOverlay from "@/components/Game/LevelUpOverlay"; // <--- O Componente Cinematográfico

// Tipos
type OptionSanitized = { id: string; text: string };
type QuestionSanitized = { id: string; text: string; options: OptionSanitized[] };

interface QuizPlayerProps {
  courseId: string;
  moduleId: string;
  onPass: (xpEarned: number) => void;
  onClose: () => void;
}

export default function QuizPlayer({ courseId, moduleId, onPass, onClose }: QuizPlayerProps) {
  const { user } = useAuth();
  const { addToast } = useToast();
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Estados de Dados
  const [questions, setQuestions] = useState<QuestionSanitized[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  
  // Estados de Controle
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Estado de Resultado (Rico em dados para a animação)
  const [result, setResult] = useState<{ 
      passed: boolean; 
      score: number; 
      xpEarned: number;
      // Dados para o Overlay
      oldXp: number;
      newXp: number;
      oldLevel: number;
      newLevel: number;
      leveledUp: boolean;
  } | null>(null);

  // --- 1. Inicialização: Busca Perguntas ---
  useEffect(() => {
    const loadQuestions = async () => {
      const res = await getQuizQuestionsAction(courseId, moduleId);
      if (res.success && res.data && res.data.length > 0) {
        setQuestions(res.data);
      } else {
        addToast(res.message || "Erro ao carregar prova.", "error");
        onClose();
      }
      setLoading(false);
    };
    loadQuestions();
  }, [courseId, moduleId, addToast, onClose]);

  // --- 2. Animação de Entrada do Card (GSAP) ---
  useGSAP(() => {
    if (!loading && questions.length > 0 && cardRef.current && !result) {
      gsap.fromTo(cardRef.current,
        { y: 40, opacity: 0, scale: 0.95 },
        { y: 0, opacity: 1, scale: 1, duration: 0.6, ease: "back.out(1.4)" }
      );
    }
  }, [loading, currentQIndex, result]);

  // --- 3. Lógica de Navegação e Seleção ---
  const handleSelectOption = (optId: string) => {
    const currentQ = questions[currentQIndex];
    setUserAnswers(prev => ({ ...prev, [currentQ.id]: optId }));
  };

  const handleNext = () => {
    const isLast = currentQIndex === questions.length - 1;
    
    // Animação de Saída (Slide Left)
    gsap.to(cardRef.current, {
      x: -50, opacity: 0, duration: 0.3, ease: "power2.in",
      onComplete: () => {
        if (!isLast) {
          setCurrentQIndex(prev => prev + 1);
          // Prepara a entrada da próxima (Slide In from Right)
          gsap.set(cardRef.current, { x: 50 }); 
        } else {
          handleSubmit();
        }
      }
    });
  };

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);

    try {
      const token = await user.getIdToken();
      // Chama a Server Action Atualizada
      const response = await submitQuizAction(token, courseId, moduleId, userAnswers);
      
      if (response.success) {
        // Popula o estado com TODOS os dados necessários para o Overlay
        setResult({
          passed: response.passed || false,
          score: response.scorePercent || 0,
          xpEarned: response.xpEarned || 0,
          
          // Dados estatísticos vindos do backend
          oldXp: response.stats?.oldXp || 0,
          newXp: response.stats?.newXp || 0,
          oldLevel: response.stats?.oldLevel || 1,
          newLevel: response.stats?.newLevel || 1,
          leveledUp: response.stats?.leveledUp || false
        });
        
        // Notifica o componente pai (Sidebar) se passou
        if(response.passed) {
            onPass(response.xpEarned || 0);
        }
      } else {
        addToast(response.message || "Erro ao corrigir.", "error");
      }
    } catch (e) {
      console.error(e);
      addToast("Erro de conexão ao enviar prova.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // --- 4. Atalhos de Teclado ---
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (loading || result || submitting) return;
      
      const currentQ = questions[currentQIndex];
      if(!currentQ) return;

      // Seleção Numérica (1, 2, 3...)
      const num = parseInt(e.key);
      if (!isNaN(num) && num > 0 && num <= currentQ.options.length) {
        handleSelectOption(currentQ.options[num - 1].id);
      }
      
      // Enter para Avançar
      if (e.key === "Enter" && userAnswers[currentQ.id]) {
        handleNext();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [questions, currentQIndex, userAnswers, loading, result, submitting]);


  // --- RENDERIZAÇÃO ---

  // 1. Loading
  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingWrapper}>
          <Loader2 size={48} className={styles.spin} color="#915bf5"/>
          <p>Preparando desafio...</p>
        </div>
      </div>
    );
  }

  // 2. Resultado (OVERLAY CINEMATOGRÁFICO)
  if (result) {
    return (
      <LevelUpOverlay 
        data={result} 
        onClose={() => {
            if (result.passed) {
                onClose(); // Fecha o player e volta pro curso
            } else {
                // Reinicia para tentar de novo
                setResult(null); 
                setCurrentQIndex(0); 
                setUserAnswers({}); 
            }
        }} 
      />
    );
  }

  // 3. Quiz Interface
  const currentQ = questions[currentQIndex];
  const selectedOptId = userAnswers[currentQ.id];
  const isLast = currentQIndex === questions.length - 1;
  const shortcuts = ['A', 'B', 'C', 'D', 'E', 'F']; // Visual helper

  return (
    <div className={styles.container} ref={containerRef}>
      
      {/* Botão Fechar (Sair) */}
      <button onClick={onClose} className={styles.closeBtn} title="Sair da prova"><X size={20}/></button>

      {/* Barra de Progresso Segmentada */}
      <div className={styles.progressHeader}>
        {questions.map((_, idx) => (
          <div key={idx} className={`${styles.segment} ${idx < currentQIndex ? styles.completed : idx === currentQIndex ? styles.active : ''}`}>
            <div className={styles.segmentFill} />
          </div>
        ))}
      </div>

      {/* Card da Pergunta */}
      <div className={styles.quizCard} ref={cardRef}>
        
        {/* Enunciado */}
        <div className={styles.questionHeader}>
          <div className={styles.labelWrapper}>
            <span className={styles.questionLabel}>QUESTÃO {currentQIndex + 1}</span>
            <span className={styles.difficultyBadge}>Valendo pontos</span>
          </div>
          <h2 className={styles.questionText}>{currentQ.text}</h2>
        </div>

        {/* Opções */}
        <div className={styles.optionsGrid}>
          {currentQ.options.map((opt, idx) => {
            const isSelected = selectedOptId === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => handleSelectOption(opt.id)}
                className={`${styles.optionCard} ${isSelected ? styles.selected : ''}`}
                disabled={submitting}
              >
                <div className={styles.keyHint}>
                  {shortcuts[idx] || idx + 1}
                </div>
                
                <span className={styles.optionText}>{opt.text}</span>
                
                <div className={styles.radioIndicator} />
              </button>
            );
          })}
        </div>

        {/* Footer de Ação */}
        <div className={styles.footer}>
          <button 
            className={styles.nextBtn} 
            onClick={handleNext}
            disabled={!selectedOptId || submitting}
          >
            {submitting ? (
               <><Loader2 className={styles.spin} size={18}/> Processando...</>
            ) : isLast ? (
               <>Finalizar Prova <Check size={18} /></>
            ) : (
               <>Próxima <ArrowRight size={18} /></>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}