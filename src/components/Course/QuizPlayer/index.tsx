"use client";

import { useState, useRef, useEffect } from "react";
import { Check, X, AlertCircle, Trophy, ArrowRight, RotateCcw } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import styles from "./styles.module.css";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

// Tipos (Podemos mover para types/index.ts depois)
type Option = { id: string; text: string; isCorrect: boolean };
type Question = { id: string; text: string; options: Option[] };

interface QuizPlayerProps {
  courseId: string;
  moduleId: string;
  onPass: (xpEarned: number) => void; // Função chamada ao passar
  onClose: () => void;
}

export default function QuizPlayer({ courseId, moduleId, onPass, onClose }: QuizPlayerProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Estado visual
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswerChecked, setIsAnswerChecked] = useState(false);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const questionCardRef = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  // 1. Carregar Perguntas
  useEffect(() => {
    const loadQuestions = async () => {
      try {
        const ref = collection(db, "courses", courseId, "modules", moduleId, "questions");
        const snap = await getDocs(ref);
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Question));
        // Embaralhar perguntas aleatoriamente para dificultar cola? Opcional.
        setQuestions(list);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadQuestions();
  }, [courseId, moduleId]);

  // Animação de Entrada
  useGSAP(() => {
    gsap.fromTo(containerRef.current, { opacity: 0 }, { opacity: 1, duration: 0.5 });
    if (!loading && questions.length > 0) {
      animateQuestionEntry();
    }
  }, [loading]);

  const animateQuestionEntry = () => {
    gsap.fromTo(questionCardRef.current, 
      { x: 50, opacity: 0, scale: 0.95 }, 
      { x: 0, opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.2)" }
    );
  };

  const handleSelectOption = (optId: string) => {
    if (isAnswerChecked) return;
    setSelectedOption(optId);
  };

  const handleCheckAnswer = () => {
    if (!selectedOption) return;
    setIsAnswerChecked(true);

    const currentQ = questions[currentQIndex];
    const isCorrect = currentQ.options.find(o => o.id === selectedOption)?.isCorrect;

    if (isCorrect) setScore(prev => prev + 1);

    // Animação de Feedback
    gsap.fromTo(feedbackRef.current, 
      { y: 20, opacity: 0 }, 
      { y: 0, opacity: 1, duration: 0.4, ease: "power2.out" }
    );
  };

  const handleNext = () => {
    // Resetar estados
    setIsAnswerChecked(false);
    setSelectedOption(null);
    
    // Animação de Saída da pergunta atual
    gsap.to(questionCardRef.current, {
      x: -50, opacity: 0, duration: 0.3, 
      onComplete: () => {
        if (currentQIndex + 1 < questions.length) {
          setCurrentQIndex(prev => prev + 1);
          animateQuestionEntry(); // Re-anima entrada
        } else {
          setShowResult(true);
        }
      }
    });
  };

  const calculateFinalResult = () => {
    const percentage = (score / questions.length) * 100;
    const passed = percentage >= 70; // 70% para passar
    const xpReward = passed ? questions.length * 20 + 100 : 0; // Ex: 20xp por pergunta + 100 bonus

    return { percentage, passed, xpReward };
  };

  if (loading) return <div className={styles.loading}>Carregando prova...</div>;

  if (questions.length === 0) return (
    <div className={styles.container}>
      <div className={styles.resultCard}>
        <AlertCircle size={48} color="#888" />
        <h2>Nenhuma pergunta cadastrada.</h2>
        <button onClick={onClose} className={styles.btnSecondary}>Voltar</button>
      </div>
    </div>
  );

  // TELA DE RESULTADO
  if (showResult) {
    const { percentage, passed, xpReward } = calculateFinalResult();
    
    return (
      <div className={styles.container}>
        <div className={styles.resultCard}>
          {passed ? (
            <>
              <div className={styles.trophyIcon}><Trophy size={64} /></div>
              <h1>Parabéns!</h1>
              <p>Você acertou {percentage.toFixed(0)}% da prova.</p>
              <div className={styles.xpGained}>+{xpReward} XP</div>
              <button onClick={() => onPass(xpReward)} className={styles.btnPrimary}>
                Resgatar Recompensa & Continuar
              </button>
            </>
          ) : (
            <>
              <div className={styles.failIcon}><X size={64} /></div>
              <h1>Não foi dessa vez...</h1>
              <p>Você precisa de 70% para passar. Você fez {percentage.toFixed(0)}%.</p>
              <button onClick={() => {
                // Reiniciar
                setScore(0); setCurrentQIndex(0); setShowResult(false); setIsAnswerChecked(false); animateQuestionEntry();
              }} className={styles.btnSecondary}>
                <RotateCcw size={18} /> Tentar Novamente
              </button>
              <button onClick={onClose} className={styles.btnLink}>Sair por enquanto</button>
            </>
          )}
        </div>
      </div>
    );
  }

  // TELA DA PERGUNTA
  const currentQ = questions[currentQIndex];

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.progressBar}>
        <div 
          className={styles.progressFill} 
          style={{ width: `${((currentQIndex + 1) / questions.length) * 100}%` }} 
        />
      </div>

      <div className={styles.quizContent} ref={questionCardRef}>
        <div className={styles.questionHeader}>
          <span className={styles.qCount}>Questão {currentQIndex + 1} de {questions.length}</span>
          <h2 className={styles.qText}>{currentQ.text}</h2>
        </div>

        <div className={styles.optionsGrid}>
          {currentQ.options.map((opt) => {
            let statusClass = "";
            if (isAnswerChecked) {
              if (opt.isCorrect) statusClass = styles.correct;
              else if (selectedOption === opt.id) statusClass = styles.wrong;
              else statusClass = styles.dimmed;
            } else if (selectedOption === opt.id) {
              statusClass = styles.selected;
            }

            return (
              <button
                key={opt.id}
                onClick={() => handleSelectOption(opt.id)}
                className={`${styles.optionBtn} ${statusClass}`}
                disabled={isAnswerChecked}
              >
                <div className={styles.optLetter}>{opt.id.slice(-1)}</div> {/* Apenas visual */}
                <span className={styles.optText}>{opt.text}</span>
                {isAnswerChecked && opt.isCorrect && <Check size={20} className={styles.iconCorrect}/>}
                {isAnswerChecked && !opt.isCorrect && selectedOption === opt.id && <X size={20} className={styles.iconWrong}/>}
              </button>
            );
          })}
        </div>
      </div>

      {/* RODAPÉ DE AÇÃO */}
      <div className={styles.footerAction} ref={feedbackRef}>
        {!isAnswerChecked ? (
          <button 
            className={styles.btnConfirm} 
            onClick={handleCheckAnswer}
            disabled={!selectedOption}
          >
            Confirmar Resposta
          </button>
        ) : (
          <div className={styles.feedbackArea}>
            <span className={styles.feedbackText}>
               {currentQ.options.find(o => o.id === selectedOption)?.isCorrect 
                 ? "Resposta Correta! 🎉" 
                 : "Ops! Resposta errada."}
            </span>
            <button className={styles.btnNext} onClick={handleNext}>
              Próxima <ArrowRight size={20} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}