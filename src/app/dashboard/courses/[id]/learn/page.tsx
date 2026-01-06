"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, collection, getDocs, orderBy, query, updateDoc, increment, arrayUnion, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useSidebar } from "@/context/SidebarContext";
import { enrollStudent } from "@/services/enrollmentService";
import { ChevronDown, ChevronUp, CheckCircle, PlayCircle, Trophy, Clock, Zap } from "lucide-react";
import styles from "./styles.module.css";
import QuizPlayer from "@/components/Course/QuizPlayer";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { finishLessonServerAction } from "@/app/actions/courseActions";

type Lesson = { id: string; title: string; videoUrl: string; order: number; xpReward: number; duration?: string };
type Module = { id: string; title: string; order: number; lessons: Lesson[] };
type ContentType = "lesson" | "quiz";

export default function CoursePlayer() {
  const { id } = useParams();
  const courseId = id as string;
  const { user } = useAuth();
  const { isExpanded } = useSidebar();
  const router = useRouter();

  const containerRef = useRef<HTMLDivElement>(null);

  const [modules, setModules] = useState<Module[]>([]);
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [completedQuizzes, setCompletedQuizzes] = useState<string[]>([]);
  const [openModules, setOpenModules] = useState<string[]>([]);

  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [activeContentType, setActiveContentType] = useState<ContentType>("lesson");
  
  const [loading, setLoading] = useState(true);
  const [markingComplete, setMarkingComplete] = useState(false);

  // --- CARREGAMENTO DE DADOS (Igual ao anterior) ---
  useEffect(() => {
    if (!user || !courseId) return;
    const loadData = async () => {
      try {
        await enrollStudent(user.uid, courseId);
        
        const enrollmentSnap = await getDoc(doc(db, "enrollments", `${user.uid}_${courseId}`));
        if (enrollmentSnap.exists()) {
          const data = enrollmentSnap.data();
          setCompletedLessons(data.completedLessons || []);
          setCompletedQuizzes(data.completedQuizzes || []);
        }

        const modulesSnap = await getDocs(query(collection(db, "courses", courseId, "modules"), orderBy("order", "asc")));
        const modulesData: Module[] = [];
        
        for (const modDoc of modulesSnap.docs) {
          const lessonsSnap = await getDocs(query(collection(db, "courses", courseId, "modules", modDoc.id, "lessons"), orderBy("order", "asc")));
          const lessonsList = lessonsSnap.docs.map(l => ({ id: l.id, ...l.data() } as Lesson));
          modulesData.push({ id: modDoc.id, title: modDoc.data().title, order: modDoc.data().order, lessons: lessonsList });
        }
        setModules(modulesData);

        if (modulesData.length > 0) {
            setOpenModules([modulesData[0].id]);
            if (modulesData[0].lessons.length > 0) {
                setActiveLesson(modulesData[0].lessons[0]);
                setActiveModuleId(modulesData[0].id);
                setActiveContentType("lesson");
            }
        }
      } catch (error) { console.error(error); } finally { setLoading(false); }
    };
    loadData();
  }, [user, courseId]);

  // --- ANIMAÇÃO DE AJUSTE DA MARGEM (SIDEBAR) ---
  useGSAP(() => {
    gsap.to(containerRef.current, {
        paddingLeft: isExpanded ? 380 : 130, // Ajustado para ficar igual ao print
        duration: 0.5,
        ease: "power3.inOut"
    });
  }, [isExpanded]);

  // Handlers
  const toggleModule = (modId: string) => {
    setOpenModules(prev => prev.includes(modId) ? prev.filter(id => id !== modId) : [...prev, modId]);
  };

  const handleSelectLesson = (lesson: Lesson, moduleId: string) => {
    setActiveLesson(lesson);
    setActiveModuleId(moduleId);
    setActiveContentType("lesson");
  };

  const handleSelectQuiz = (moduleId: string) => {
    setActiveModuleId(moduleId);
    setActiveContentType("quiz");
  };

  const handleCompleteLesson = async () => {
    if (!user || !activeLesson || !activeModuleId) return;
    if (completedLessons.includes(activeLesson.id)) return;

    setMarkingComplete(true);
    try {
      const token = await user.getIdToken();
      const result = await finishLessonServerAction(token, courseId, activeLesson.id, activeLesson.xpReward || 50);

      if (result.success) {
        setCompletedLessons(prev => [...prev, activeLesson!.id]); // ! garante não nulo
        if (result.leveledUp) alert(`🎉 SUBIU DE NÍVEL! Agora você é Nível ${result.newLevel}!`);
      } else {
        alert("Erro: " + result.message);
      }
    } catch (error) { console.error(error); } finally { setMarkingComplete(false); }
  };

  const handleQuizPassed = async (xpEarned: number) => {
    if (!user || !activeModuleId) return;
    setCompletedQuizzes(prev => [...prev, activeModuleId]);
    try {
        await updateDoc(doc(db, "enrollments", `${user.uid}_${courseId}`), { completedQuizzes: arrayUnion(activeModuleId), lastAccess: serverTimestamp() });
        await updateDoc(doc(db, "users", user.uid), { xp: increment(xpEarned) });
        alert(`Parabéns! +${xpEarned} XP`);
    } catch (error) { console.error(error); }
  };

  const totalItems = modules.reduce((acc, mod) => acc + mod.lessons.length + 1, 0);
  const completedItems = completedLessons.length + completedQuizzes.length;
  const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  if (loading) return <div className={styles.loading}>Carregando...</div>;

  return (
    <div className={styles.playerContainer} ref={containerRef}>
      
      {/* --- CONTEÚDO PRINCIPAL (VÍDEO + CARD INFO) --- */}
      <main className={styles.mainContent}>
        
        {activeContentType === 'quiz' && activeModuleId ? (
            <div className={styles.quizWrapper}>
                <QuizPlayer 
                    courseId={courseId}
                    moduleId={activeModuleId}
                    onPass={handleQuizPassed}
                    onClose={() => { /* lógica de fechar */ }}
                />
            </div>
        ) : activeLesson ? (
            <div className={styles.contentColumn}>
                
                {/* 1. PLAYER DE VÍDEO (CARD) */}
                <div className={styles.videoPlayerFrame}>
                    <video 
                        key={activeLesson.videoUrl} 
                        src={activeLesson.videoUrl} 
                        controls 
                        className={styles.videoElement} 
                    />
                </div>
                
                {/* 2. INFORMAÇÕES DA AULA (NOVO CARD SEPARADO) */}
                <div className={styles.lessonInfoCard}>
                    <div className={styles.lessonTitleRow}>
                        <h1>{activeLesson.title}</h1>
                        
                        <button 
                            onClick={handleCompleteLesson} 
                            className={`${styles.completeBtn} ${completedLessons.includes(activeLesson.id) ? styles.btnDone : ""}`}
                            disabled={markingComplete || completedLessons.includes(activeLesson.id)}
                        >
                            {completedLessons.includes(activeLesson.id) ? (
                                <><CheckCircle size={18} /> Concluída</>
                            ) : (
                                <>{markingComplete ? "Salvando..." : "Concluir Aula"}</>
                            )}
                        </button>
                    </div>

                    <div className={styles.badgesRow}>
                        <div className={styles.xpBadge}>+{activeLesson.xpReward || 50} XP</div>
                        <div className={styles.timeBadge}>{activeLesson.duration || "15 min"}</div>
                    </div>
                </div>

            </div>
        ) : (
            <div className={styles.emptyState}>Selecione uma aula.</div>
        )}
      </main>

      {/* --- SIDEBAR DIREITA (ROTA) --- */}
      <aside className={styles.rightSidebar}>
        <div className={styles.studyRouteCard}>
            <div className={styles.routeHeader}>
                <h3>Rota de Estudos</h3>
                <span className={styles.progressBadge}>{progressPercent}%</span>
            </div>

            <div className={styles.modulesList}>
                {modules.map(mod => {
                    const isOpen = openModules.includes(mod.id);
                    return (
                        <div key={mod.id} className={styles.moduleItem}>
                            <div className={styles.moduleHeader} onClick={() => toggleModule(mod.id)}>
                                <div className={styles.moduleTitle}>
                                    <span className={styles.modLabel}>MÓDULO {mod.order}</span>
                                    <strong>{mod.title}</strong>
                                </div>
                                {isOpen ? <ChevronUp size={16} color="#666"/> : <ChevronDown size={16} color="#666"/>}
                            </div>

                            {isOpen && (
                                <div className={styles.lessonsContainer}>
                                    {mod.lessons.map(lesson => {
                                        const isActive = activeContentType === 'lesson' && activeLesson?.id === lesson.id;
                                        const isDone = completedLessons.includes(lesson.id);
                                        return (
                                            <div 
                                                key={lesson.id}
                                                className={`${styles.lessonItem} ${isActive ? styles.active : ""}`}
                                                onClick={() => handleSelectLesson(lesson, mod.id)}
                                            >
                                                <div className={styles.lessonIcon}>
                                                    {isDone ? <CheckCircle size={16} color="#4ade80"/> : <CheckCircle size={16} color="#333"/>}
                                                </div>
                                                <div className={styles.lessonMeta}>
                                                    <span className={styles.lessonName}>{lesson.title}</span>
                                                    <span className={styles.lessonDuration}>{lesson.duration || "10 min"}</span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                    {/* Quiz Item (Opcional, igual antes) */}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
      </aside>

    </div>
  );
}