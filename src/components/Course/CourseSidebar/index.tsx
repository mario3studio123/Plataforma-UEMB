// src/components/Course/CourseSidebar/index.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  ChevronDown, 
  ChevronUp, 
  PlayCircle, 
  CheckCircle, 
  Trophy, 
  Award, 
  Loader2,
  Lock
} from "lucide-react";
import { Module, Lesson } from "@/types";
import styles from "./styles.module.css";

// Contextos e Actions
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { issueCertificateAction } from "@/app/actions/certificateActions";

interface CourseSidebarProps {
  courseId: string; // Necessário para o certificado
  modules: Module[];
  activeLessonId?: string;
  activeModuleId?: string | null;
  contentType: 'lesson' | 'quiz';
  completedLessons: string[];
  completedQuizzes: string[];
  onSelectLesson: (lesson: Lesson, moduleId: string) => void;
  onSelectQuiz: (moduleId: string) => void;
}

export default function CourseSidebar({
  courseId,
  modules, 
  activeLessonId, 
  activeModuleId, 
  contentType,
  completedLessons, 
  completedQuizzes,
  onSelectLesson, 
  onSelectQuiz
}: CourseSidebarProps) {
  
  const { user } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();

  // Controle de Módulos Abertos
  const [openModules, setOpenModules] = useState<string[]>([]);
  
  // Estado de Emissão do Certificado
  const [emitting, setEmitting] = useState(false);

  // Efeito: Abrir automaticamente o módulo ativo ao carregar ou navegar
  useEffect(() => {
    if (activeModuleId && !openModules.includes(activeModuleId)) {
      setOpenModules(prev => [...prev, activeModuleId]);
    }
  }, [activeModuleId]);

  const toggleModule = (modId: string) => {
    setOpenModules(prev => 
      prev.includes(modId) ? prev.filter(id => id !== modId) : [...prev, modId]
    );
  };

  // --- LÓGICA DE PROGRESSO E CERTIFICADO ---
  
  // Calcula o total de aulas do curso (soma das aulas de todos os módulos)
  const totalLessons = useMemo(() => {
    return modules.reduce((acc, mod) => acc + mod.lessons.length, 0);
  }, [modules]);

  // Calcula quantas aulas foram concluídas (interseção entre as aulas existentes e as completas)
  // Isso evita bugs se uma aula for deletada mas o ID continuar no array de completedLessons
  const validCompletedCount = useMemo(() => {
    const allLessonIds = new Set(modules.flatMap(m => m.lessons.map(l => l.id)));
    return completedLessons.filter(id => allLessonIds.has(id)).length;
  }, [modules, completedLessons]);

  const isCourseCompleted = totalLessons > 0 && validCompletedCount === totalLessons;

  // Handler para emitir certificado
  const handleIssueCertificate = async () => {
    if(!user) return;
    setEmitting(true);
    try {
       const token = await user.getIdToken();
       const res = await issueCertificateAction(token, courseId);
       
       if(res.success) {
           addToast(res.isNew ? "Certificado emitido com sucesso!" : "Certificado visualizado.", "success");
           router.push("/dashboard/certificates");
       } else {
           addToast(res.message || "Erro ao emitir.", "error");
       }
    } catch(e) {
       console.error(e);
       addToast("Erro de conexão ao emitir certificado.", "error");
    } finally {
       setEmitting(false);
    }
  };

  return (
    <div className={styles.sidebarContainer}>
      {/* HEADER DA SIDEBAR */}
      <div className={styles.header}>
        <h3>Conteúdo do Curso</h3>
        <span className={styles.progressText}>
           {validCompletedCount}/{totalLessons} aulas concluídas
        </span>
        {/* Barra de progresso visual */}
        <div style={{ width: '100%', height: 4, background: '#333', marginTop: 10, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ 
                width: `${totalLessons > 0 ? (validCompletedCount / totalLessons) * 100 : 0}%`, 
                height: '100%', 
                background: '#4ade80',
                transition: 'width 0.5s ease'
            }} />
        </div>
      </div>

      {/* ÁREA DE SCROLL (Módulos e Aulas) */}
      <div className={styles.scrollArea}>
        {modules.map((mod, index) => {
          const isOpen = openModules.includes(mod.id);
          const isQuizDone = completedQuizzes.includes(mod.id);
          const hasQuiz = true; // Assumindo que todo módulo tem prova, ou pode passar via prop

          return (
            <div key={mod.id} className={`${styles.moduleItem} ${isOpen ? styles.moduleOpen : ''}`}>
              {/* Header do Módulo */}
              <button onClick={() => toggleModule(mod.id)} className={styles.moduleHeader}>
                <div className={styles.moduleInfo}>
                  <span className={styles.moduleIndex}>Módulo {index + 1}</span>
                  <h4 className={styles.moduleTitle}>{mod.title}</h4>
                </div>
                <div className={styles.chevron}>
                   {isOpen ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                </div>
              </button>

              {/* Lista de Aulas (Accordion) */}
              <div className={`${styles.lessonsWrapper} ${isOpen ? styles.show : ''}`}>
                 <div className={styles.lessonsInner}>
                    {mod.lessons.map((lesson) => {
                       const isActive = activeLessonId === lesson.id && contentType === 'lesson';
                       const isDone = completedLessons.includes(lesson.id);

                       return (
                         <div 
                           key={lesson.id} 
                           onClick={() => onSelectLesson(lesson, mod.id)}
                           className={`${styles.lessonRow} ${isActive ? styles.active : ''} ${isDone ? styles.done : ''}`}
                         >
                            <div className={styles.lessonIcon}>
                               {isActive ? (
                                  <div className={styles.pulsingDot} />
                               ) : isDone ? (
                                  <CheckCircle size={16} className={styles.checkIcon} />
                               ) : (
                                  <PlayCircle size={16} className={styles.playIcon} />
                               )}
                            </div>
                            <div className={styles.lessonText}>
                               <span className={styles.lessonTitleText}>{lesson.title}</span>
                               <span className={styles.lessonMeta}>
                                   {typeof lesson.duration === 'string' ? lesson.duration : "00:00"} • {lesson.xpReward} XP
                               </span>
                            </div>
                         </div>
                       )
                    })}

                    {/* Link para a Prova do Módulo */}
                    {hasQuiz && (
                        <div 
                           onClick={() => onSelectQuiz(mod.id)}
                           className={`${styles.quizRow} ${contentType === 'quiz' && activeModuleId === mod.id ? styles.active : ''}`}
                        >
                           <div className={styles.quizIcon}>
                              <Trophy size={16} color={isQuizDone ? "#fbbf24" : "#888"} />
                           </div>
                           <div className={styles.lessonText}>
                              <span className={styles.lessonTitleText}>Prova do Módulo</span>
                              <span className={styles.lessonMeta}>
                                  {isQuizDone ? "Aprovado" : "Avaliação Final"}
                              </span>
                           </div>
                        </div>
                    )}
                 </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CARD DE CERTIFICADO (Fixo no rodapé se completou) */}
      {isCourseCompleted && (
        <div style={{ padding: 20, borderTop: '1px solid #2d2833', background: '#131116' }}>
            <div style={{ 
                background: 'linear-gradient(135deg, rgba(145, 91, 245, 0.15), rgba(145, 91, 245, 0.05))',
                border: '1px solid rgba(145, 91, 245, 0.4)',
                borderRadius: 16,
                padding: 16,
                textAlign: 'center',
                boxShadow: '0 -4px 20px rgba(0,0,0,0.2)'
            }}>
                <div style={{ marginBottom: 10, color: '#d8b4fe', display:'flex', justifyContent:'center' }}>
                    <Award size={36} strokeWidth={1.5} />
                </div>
                <h4 style={{ color: '#fff', fontSize: '0.95rem', marginBottom: 4, fontWeight: 600 }}>
                    Curso Concluído!
                </h4>
                <p style={{ color: '#ccc', fontSize: '0.8rem', marginBottom: 16, lineHeight: 1.4 }}>
                    Parabéns pelo empenho. Resgate seu certificado oficial agora.
                </p>
                
                <button 
                    onClick={handleIssueCertificate}
                    disabled={emitting}
                    style={{
                        width: '100%', 
                        padding: '12px', 
                        borderRadius: 10,
                        background: '#915bf5', 
                        color: '#fff', 
                        fontWeight: 600, 
                        fontSize: '0.9rem',
                        cursor: 'pointer', 
                        border: 'none',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: 8,
                        transition: 'transform 0.2s, background 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#7c3aed'}
                    onMouseOut={(e) => e.currentTarget.style.background = '#915bf5'}
                >
                    {emitting ? <Loader2 className={styles.spin} size={18}/> : <Award size={18}/>}
                    {emitting ? "Emitindo..." : "Resgatar Certificado"}
                </button>
            </div>
        </div>
      )}
    </div>
  );
}