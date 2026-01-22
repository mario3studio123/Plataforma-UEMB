"use client";

import { useState, useRef } from "react"; // Adicionado useRef
import { useRouter } from "next/navigation";
import { doc, collection } from "firebase/firestore"; 
import { db } from "@/lib/firebase"; 
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { createCourseAction } from "@/app/actions/admin/courseActions";
import { uploadFile } from "@/services/storageService";
import { useTaxonomy } from "@/hooks/admin/useTaxonomy";

// Imports de UI e Constantes
import { COURSE_LEVELS, CourseLevel } from "@/lib/constants";
import { X, Plus, UploadCloud, Loader2, Save, ArrowLeft, Image as ImageIcon, Type, Tag, Layers } from "lucide-react"; 
import styles from "./styles.module.css";
import Image from "next/image";

// Importamos o Card REAL para o Preview
import CourseCard from "@/components/CourseCard";
import { Course } from "@/types";

// --- NOVOS IMPORTS PARA ANIMAÇÃO DA SIDEBAR ---
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useSidebar } from "@/context/SidebarContext";

export default function CreateCourse() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { addToast } = useToast();
  
  // Hook da Sidebar
  const { isExpanded } = useSidebar();
  
  // Ref do Container Principal
  const containerRef = useRef<HTMLDivElement>(null);

  const { tags: globalTags, isLoading: loadingTags, createTag } = useTaxonomy();

  // --- Estados do Formulário ---
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState<CourseLevel>("Básico");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  // --- Estados de Mídia ---
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // --- Estados de Controle ---
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // --- ANIMAÇÃO DE AJUSTE DE LAYOUT (SIDEBAR) ---
  useGSAP(() => {
    if (containerRef.current) {
      gsap.to(containerRef.current, {
        // Ajustamos o paddingLeft baseado no estado da sidebar
        // 420px = 350px (Sidebar Aberta) + 70px (Respiro)
        // 160px = 110px (Sidebar Fechada) + 50px (Respiro)
        paddingLeft: isExpanded ? 420 : 160, 
        duration: 0.5,
        ease: "power3.inOut"
      });
    }
  }, [isExpanded]);

  // Proteção de Rota
  if (profile && !["admin", "master"].includes(profile.role)) {
    router.push("/dashboard");
    return null;
  }

  // --- Handlers (Mantidos iguais) ---
  const handleAddTag = (e?: React.KeyboardEvent) => {
    if (e && e.key !== "Enter") return;
    e?.preventDefault();

    const val = tagInput.trim();
    if (!val) return;
    const formattedVal = val.charAt(0).toUpperCase() + val.slice(1);

    if (tags.includes(formattedVal)) return setTagInput("");
    if (tags.length >= 5) return addToast("Máximo de 5 tags.", "warning");

    setTags([...tags, formattedVal]);
    setTagInput("");

    if (!globalTags.some(t => t.toLowerCase() === formattedVal.toLowerCase())) {
        createTag(formattedVal); 
    }
  };

  const removeTag = (t: string) => setTags(tags.filter(tag => tag !== t));

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) return addToast("Máximo 2MB.", "warning");
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleCreate = async () => {
    if (!title || !description || !imageFile) {
        return addToast("Preencha título, descrição e capa.", "warning");
    }
    if (!user) return;
    
    setLoading(true);
    try {
      const newCourseId = doc(collection(db, "courses")).id;

      // 1. Upload
      const storagePath = `courses/${newCourseId}/cover/${Date.now()}_${imageFile.name}`;
      const downloadUrl = await uploadFile(imageFile, storagePath, (p) => setUploadProgress(p));

      // 2. Action
      const token = await user.getIdToken();
      const result = await createCourseAction(token, {
        id: newCourseId,
        title,
        description,
        coverUrl: downloadUrl,
        level,
        published: false,
        price: 0,
        tags,
        totalDuration: 0, 
        totalLessons: 0,
        syllabus: [],
        // ❌ REMOVA ESTA LINHA ABAIXO:
        // createdBy: user.uid 
      });

      if (result.success) {
        addToast("Curso criado!", "success");
        router.push(`/dashboard/admin/courses/${newCourseId}/manage`);
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      console.error(error);
      addToast(error.message || "Erro ao criar.", "error");
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  // Objeto fake para Preview
  const previewCourse: Course = {
    id: "preview",
    title: title || "Título do Curso",
    description: description || "Breve descrição do conteúdo...",
    coverUrl: previewUrl || "/placeholder-course.jpg", 
    level: level,
    tags: tags,
    modulesCount: 0,
    totalLessons: 0,
    totalDuration: 0,
    published: false,
    price: 0,
    createdAt: new Date().toISOString(),
    userProgress: 0,
    createdBy: "admin"
  };

  return (
    <div className={styles.container} ref={containerRef}> {/* Adicionado o REF aqui */}
      
      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.titleGroup}>
            <button onClick={() => router.back()} className={styles.btnCancel} style={{border:'none', padding:0, marginBottom:10, display:'flex', gap:5, alignItems:'center', fontSize:'0.9rem'}}>
                <ArrowLeft size={16}/> Voltar
            </button>
            <h1>Novo Curso</h1>
            <p>Preencha os detalhes para começar a estruturar o conteúdo.</p>
        </div>
        <div className={styles.headerActions}>
            <button className={styles.btnCancel} onClick={() => router.back()}>Cancelar</button>
            <button className={styles.btnSave} onClick={handleCreate} disabled={loading}>
                {loading ? <Loader2 className={styles.spin} size={20} /> : <Save size={20} />}
                {loading ? "Criando..." : "Criar Curso"}
            </button>
        </div>
      </header>

      <div className={styles.mainGrid}>
        
        {/* COLUNA ESQUERDA: EDITOR */}
        <div className={styles.formColumn}>
            
            {/* Seção 1: Informações Básicas */}
            <div className={styles.section}>
                <h2 className={styles.sectionTitle}><Type size={18} color="#CA8DFF"/> Informações Básicas</h2>
                
                <div className={styles.inputGroup}>
                    <label className={styles.label}>Título do Curso</label>
                    <input 
                        className={styles.input} 
                        placeholder="Ex: Domínio da Extrusão Avançada"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        autoFocus
                    />
                </div>

                <div className={styles.inputGroup}>
                    <label className={styles.label}>Descrição / Resumo</label>
                    <textarea 
                        className={styles.textarea} 
                        placeholder="Descreva o que o aluno irá aprender..."
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                    />
                </div>
            </div>

            {/* Seção 2: Mídia e Categoria */}
            <div className={styles.section}>
                <h2 className={styles.sectionTitle}><ImageIcon size={18} color="#CA8DFF"/> Mídia e Capa</h2>
                
                <div className={styles.inputGroup}>
                    <label className={styles.label}>Capa do Curso (16:9)</label>
                    <label className={styles.uploadContainer}>
                        <input type="file" accept="image/*" hidden onChange={handleImageSelect} />
                        {previewUrl ? (
                            <Image src={previewUrl} alt="Preview" fill className={styles.previewImg} />
                        ) : null}
                        
                        <div className={styles.uploadContent}>
                            <UploadCloud className={styles.uploadIcon} />
                            <span>{previewUrl ? "Clique para alterar a imagem" : "Clique ou arraste sua imagem aqui"}</span>
                        </div>
                        
                        {loading && uploadProgress > 0 && (
                            <div style={{position:'absolute', bottom:0, left:0, height:4, background:'#915bf5', width:`${uploadProgress}%`, transition:'width 0.2s'}} />
                        )}
                    </label>
                </div>
            </div>

            {/* Seção 3: Taxonomia */}
            <div className={styles.section}>
                <h2 className={styles.sectionTitle}><Layers size={18} color="#CA8DFF"/> Classificação</h2>

                <div className={styles.inputGroup}>
                    <label className={styles.label}>Nível de Dificuldade</label>
                    <div className={styles.levelGrid}>
                        {COURSE_LEVELS.map(lvl => (
                            <button 
                                key={lvl} 
                                className={`${styles.levelOption} ${level === lvl ? styles.active : ''}`}
                                onClick={() => setLevel(lvl)}
                            >
                                {lvl}
                            </button>
                        ))}
                    </div>
                </div>

                <div className={styles.inputGroup}>
                    <label className={styles.label}>Tags (Categorias)</label>
                    <div className={styles.tagInputRow}>
                        <input 
                            className={styles.input} 
                            placeholder="Digite e aperte Enter..."
                            value={tagInput}
                            onChange={e => setTagInput(e.target.value)}
                            onKeyDown={handleAddTag}
                        />
                        <button className={styles.addTagBtn} onClick={() => handleAddTag()}><Plus size={20}/></button>
                    </div>
                    
                    <div className={styles.tagsList}>
                        {tags.map(tag => (
                            <span key={tag} className={styles.tagPill}>
                                <Tag size={12} /> {tag}
                                <button onClick={() => removeTag(tag)} className={styles.removeTag}><X size={12}/></button>
                            </span>
                        ))}
                    </div>
                </div>
            </div>

        </div>

        {/* COLUNA DIREITA: LIVE PREVIEW */}
        <aside className={styles.previewColumn}>
            <p className={styles.previewLabel}>Visualização do Card</p>
            <div className={styles.previewWrapper}>
                {/* Usamos o componente real para garantir fidelidade total */}
                <CourseCard course={previewCourse} />
            </div>
            
            <div style={{textAlign:'center', fontSize:'0.8rem', color:'#666', marginTop: 20}}>
                <p>Este é o visual exato que o aluno verá na biblioteca.</p>
            </div>
        </aside>

      </div>
    </div>
  );
}