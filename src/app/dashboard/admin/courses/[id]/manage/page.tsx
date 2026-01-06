"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  doc, getDoc, collection, getDocs, orderBy, query, 
  addDoc, updateDoc, deleteDoc, serverTimestamp 
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"; // Para capa do curso
import { db, storage } from "@/lib/firebase";
import { deleteCourseFull } from "@/services/courseManagementServices"; // Serviço de delete completo

// Componentes
import VideoUploader from "@/components/Admin/VideoUploader";
import QuizEditor from "@/components/Admin/QuizEditor";

// Ícones e Estilos
import { 
  ArrowLeft, Plus, Trash2, Edit2, Save, X, 
  MoreVertical, GripVertical, FileVideo, Clock, Zap 
} from "lucide-react";
import styles from "./styles.module.css";

// GSAP
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

// --- TIPOS ---
type Lesson = { id: string; title: string; videoUrl: string; duration: string; xpReward: number; order: number };
type Module = { id: string; title: string; order: number; lessons: Lesson[] };
type CourseData = { id: string; title: string; description: string; coverUrl: string; level?: string };

export default function ManageCourse() {
  const { id } = useParams();
  const courseId = id as string;
  const router = useRouter();

  // Estados de Dados
  const [course, setCourse] = useState<CourseData | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados de UI - Modais
  const [isEditingCourse, setIsEditingCourse] = useState(false);
  
  // -- Modal de Aula --
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null); // Se null, é criação
  const [lessonForm, setLessonForm] = useState({ title: "", videoUrl: "", duration: "10 min", xpReward: 50 });

  // -- Modal de Quiz --
  const [quizModuleId, setQuizModuleId] = useState<string | null>(null); // Se preenchido, abre o editor

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const lessonModalRef = useRef<HTMLDivElement>(null);

  // --- 1. CARREGAR DADOS ---
  const loadData = async () => {
    try {
      // Curso
      const courseSnap = await getDoc(doc(db, "courses", courseId));
      if (!courseSnap.exists()) {
        alert("Curso não encontrado!");
        router.push("/dashboard/courses");
        return;
      }
      setCourse({ id: courseSnap.id, ...courseSnap.data() } as CourseData);

      // Módulos e Aulas
      const modulesQuery = query(collection(db, "courses", courseId, "modules"), orderBy("order", "asc"));
      const modulesSnap = await getDocs(modulesQuery);
      
      const modulesList: Module[] = [];
      for (const modDoc of modulesSnap.docs) {
        const lessonsQuery = query(collection(db, "courses", courseId, "modules", modDoc.id, "lessons"), orderBy("order", "asc"));
        const lessonsSnap = await getDocs(lessonsQuery);
        const lessons = lessonsSnap.docs.map(l => ({ id: l.id, ...l.data() } as Lesson));
        
        modulesList.push({ id: modDoc.id, title: modDoc.data().title, order: modDoc.data().order, lessons });
      }
      setModules(modulesList);

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [courseId]);

  // --- ANIMAÇÕES ---
  useGSAP(() => {
    gsap.from(containerRef.current, { opacity: 0, y: 20, duration: 0.5 });
  }, []);

  // Animação do Modal de Aula
  useEffect(() => {
    if (isLessonModalOpen && lessonModalRef.current) {
        gsap.fromTo(lessonModalRef.current, 
            { scale: 0.9, opacity: 0, y: 20 },
            { scale: 1, opacity: 1, y: 0, duration: 0.3, ease: "back.out(1.2)" }
        );
    }
  }, [isLessonModalOpen]);


  // --- HANDLERS: CURSO ---
  const handleUpdateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!course) return;
    try {
        await updateDoc(doc(db, "courses", courseId), {
            title: course.title,
            description: course.description,
            level: course.level || "Básico"
        });
        setIsEditingCourse(false);
        alert("Curso atualizado!");
    } catch (error) { console.error(error); }
  };

  const handleDeleteCourse = async () => {
    if(!confirm("TEM CERTEZA? Isso apagará TODO o curso, vídeos e progresso dos alunos. Irreversível.")) return;
    try {
        setLoading(true);
        await deleteCourseFull(courseId);
        router.push("/dashboard/courses");
    } catch (error) { 
        alert("Erro ao excluir."); 
        setLoading(false);
    }
  };

  // --- HANDLERS: MÓDULOS ---
  const handleAddModule = async () => {
    const title = prompt("Nome do novo módulo:");
    if(!title) return;
    try {
        const newOrder = modules.length + 1;
        await addDoc(collection(db, "courses", courseId, "modules"), {
            title, order: newOrder, createdAt: serverTimestamp()
        });
        loadData(); // Recarrega tudo
    } catch (error) { console.error(error); }
  };

  const handleDeleteModule = async (modId: string) => {
    if(!confirm("Deletar módulo e todas as aulas dele?")) return;
    try {
        await deleteDoc(doc(db, "courses", courseId, "modules", modId));
        // Nota: Idealmente deletar as aulas do storage também, mas faremos o básico aqui
        loadData();
    } catch (error) { console.error(error); }
  };

  // --- HANDLERS: AULAS (MODAL) ---
  const openLessonModal = (moduleId: string, lesson?: Lesson) => {
    setActiveModuleId(moduleId);
    if (lesson) {
        setEditingLessonId(lesson.id);
        setLessonForm({ 
            title: lesson.title, 
            videoUrl: lesson.videoUrl, 
            duration: lesson.duration, 
            xpReward: lesson.xpReward 
        });
    } else {
        setEditingLessonId(null);
        setLessonForm({ title: "", videoUrl: "", duration: "10 min", xpReward: 50 });
    }
    setIsLessonModalOpen(true);
  };

  const handleSaveLesson = async () => {
    if (!activeModuleId || !lessonForm.title || !lessonForm.videoUrl) {
        return alert("Preencha título e envie o vídeo.");
    }

    try {
        const lessonsRef = collection(db, "courses", courseId, "modules", activeModuleId, "lessons");

        if (editingLessonId) {
            // Editar
            await updateDoc(doc(lessonsRef, editingLessonId), { ...lessonForm });
        } else {
            // Criar
            const currentMod = modules.find(m => m.id === activeModuleId);
            const newOrder = (currentMod?.lessons.length || 0) + 1;
            await addDoc(lessonsRef, { ...lessonForm, order: newOrder, createdAt: serverTimestamp() });
        }
        
        setIsLessonModalOpen(false);
        loadData();
    } catch (error) {
        console.error(error);
        alert("Erro ao salvar aula.");
    }
  };

  const handleDeleteLesson = async (moduleId: string, lessonId: string) => {
    if(!confirm("Deletar esta aula?")) return;
    try {
        await deleteDoc(doc(db, "courses", courseId, "modules", moduleId, "lessons", lessonId));
        loadData();
    } catch (error) { console.error(error); }
  };


  if (loading) return <div className={styles.loadingScreen}>Carregando Gerenciador...</div>;
  if (!course) return null;

  return (
    <div className={styles.container} ref={containerRef}>
      
      {/* --- HEADER SUPERIOR --- */}
      <header className={styles.header}>
        <button onClick={() => router.back()} className={styles.backBtn}>
            <ArrowLeft size={20} /> Voltar
        </button>
        <div className={styles.headerActions}>
            <button className={styles.deleteCourseBtn} onClick={handleDeleteCourse}>
                <Trash2 size={16} /> Excluir Curso
            </button>
        </div>
      </header>

      {/* --- CARTÃO DO CURSO (EDITÁVEL) --- */}
      <div className={styles.courseCard}>
        <div className={styles.coverWrapper}>
            <img src={course.coverUrl} alt="Capa" />
            {/* Futuro: Botão para trocar capa aqui */}
        </div>
        
        {isEditingCourse ? (
            <form onSubmit={handleUpdateCourse} className={styles.editCourseForm}>
                <input 
                    value={course.title} 
                    onChange={e => setCourse({...course, title: e.target.value})} 
                    className={styles.inputTitle}
                />
                <textarea 
                    value={course.description} 
                    onChange={e => setCourse({...course, description: e.target.value})} 
                    className={styles.inputDesc}
                    rows={3}
                />
                 <div className={styles.formActions}>
                    <button type="submit" className={styles.saveBtn}><Save size={16}/> Salvar</button>
                    <button type="button" onClick={() => setIsEditingCourse(false)} className={styles.cancelBtn}>Cancelar</button>
                </div>
            </form>
        ) : (
            <div className={styles.courseInfo}>
                <h1>{course.title}</h1>
                <p>{course.description}</p>
                <div className={styles.tags}>
                    <span>{course.level || "Básico"}</span>
                    <span>{modules.length} Módulos</span>
                </div>
                <button onClick={() => setIsEditingCourse(true)} className={styles.editFloatBtn}>
                    <Edit2 size={16} />
                </button>
            </div>
        )}
      </div>

      <div className={styles.divider} />

      {/* --- LISTA DE MÓDULOS --- */}
      <div className={styles.modulesSection}>
        <div className={styles.sectionHeader}>
            <h2>Estrutura do Curso</h2>
            <button onClick={handleAddModule} className={styles.addModuleBtn}>
                <Plus size={18} /> Novo Módulo
            </button>
        </div>

        <div className={styles.modulesList}>
            {modules.map((mod) => (
                <div key={mod.id} className={styles.moduleItem}>
                    <div className={styles.moduleHeader}>
                        <div className={styles.moduleTitle}>
                            <GripVertical size={20} className={styles.dragIcon} />
                            <h3>{mod.order}. {mod.title}</h3>
                        </div>
                        <div className={styles.moduleActions}>
                            <button 
                                onClick={() => setQuizModuleId(mod.id)} 
                                className={styles.quizBtn}
                                title="Gerenciar Prova"
                            >
                                <Zap size={16} /> Prova
                            </button>
                            <button onClick={() => handleDeleteModule(mod.id)} className={styles.iconBtn}>
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>

                    <div className={styles.lessonsList}>
                        {mod.lessons.map(lesson => (
                            <div key={lesson.id} className={styles.lessonItem}>
                                <div className={styles.lessonInfo}>
                                    <FileVideo size={16} className={styles.lessonIcon} />
                                    <span>{lesson.title}</span>
                                    <span className={styles.lessonDuration}>{lesson.duration}</span>
                                </div>
                                <div className={styles.lessonActions}>
                                    <button onClick={() => openLessonModal(mod.id, lesson)} className={styles.iconBtn}>
                                        <Edit2 size={14} />
                                    </button>
                                    <button onClick={() => handleDeleteLesson(mod.id, lesson.id)} className={styles.iconBtn}>
                                        <X size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        
                        <button onClick={() => openLessonModal(mod.id)} className={styles.addLessonBtn}>
                            <Plus size={14} /> Adicionar Aula
                        </button>
                    </div>
                </div>
            ))}
        </div>
      </div>

      {/* --- MODAL DE EDIÇÃO DE AULA --- */}
      {isLessonModalOpen && (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent} ref={lessonModalRef}>
                <div className={styles.modalHeader}>
                    <h3>{editingLessonId ? "Editar Aula" : "Nova Aula"}</h3>
                    <button onClick={() => setIsLessonModalOpen(false)}><X size={20}/></button>
                </div>
                
                <div className={styles.modalBody}>
                    <div className={styles.formGroup}>
                        <label>Título da Aula</label>
                        <input 
                            type="text" 
                            value={lessonForm.title}
                            onChange={e => setLessonForm({...lessonForm, title: e.target.value})}
                            placeholder="Ex: Introdução à Extrusora"
                        />
                    </div>

                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label><Clock size={14}/> Duração</label>
                            <input 
                                type="text" 
                                value={lessonForm.duration}
                                onChange={e => setLessonForm({...lessonForm, duration: e.target.value})}
                                placeholder="10 min"
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label><Zap size={14}/> Recompensa (XP)</label>
                            <input 
                                type="number" 
                                value={lessonForm.xpReward}
                                onChange={e => setLessonForm({...lessonForm, xpReward: Number(e.target.value)})}
                            />
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <label>Vídeo da Aula</label>
                        <VideoUploader 
                            folderPath={`courses/${courseId}/modules/${activeModuleId}`}
                            currentVideoUrl={lessonForm.videoUrl}
                            onUploadComplete={(url) => setLessonForm({...lessonForm, videoUrl: url})}
                            onRemove={() => setLessonForm({...lessonForm, videoUrl: ""})}
                        />
                    </div>
                </div>

                <div className={styles.modalFooter}>
                    <button onClick={handleSaveLesson} className={styles.saveBtnFull}>
                        Salvar Aula
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* --- MODAL DE QUIZ --- */}
      {quizModuleId && (
        <QuizEditor 
            courseId={courseId}
            moduleId={quizModuleId}
            moduleTitle={modules.find(m => m.id === quizModuleId)?.title || ""}
            onClose={() => setQuizModuleId(null)}
        />
      )}

    </div>
  );
}