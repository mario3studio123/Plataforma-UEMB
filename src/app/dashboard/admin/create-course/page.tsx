"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { doc, setDoc, collection } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, UploadCloud, Loader2 } from "lucide-react";
import styles from "./styles.module.css";

export default function CreateCourse() {
  const router = useRouter();
  const { profile } = useAuth();
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  // Proteção básica: Se não for admin/master, volta.
  if (profile && profile.role === "student") {
    router.push("/dashboard");
    return null;
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !imageFile) return alert("Preencha título e imagem!");

    setLoading(true);

    try {
      // 1. Gera um ID para o curso
      const newCourseRef = doc(collection(db, "courses"));
      const courseId = newCourseRef.id;

      // 2. Upload da Imagem (Capa)
      const storageRef = ref(storage, `courses/${courseId}/cover/${imageFile.name}`);
      await uploadBytes(storageRef, imageFile);
      const coverUrl = await getDownloadURL(storageRef);

      // 3. Salva no Firestore
      await setDoc(newCourseRef, {
        id: courseId,
        title,
        description,
        coverUrl,
        modulesCount: 0,
        published: true,
        createdAt: new Date().toISOString()
      });

      alert("Curso criado com sucesso!");
      router.push("/dashboard/courses"); // Redireciona para a lista

    } catch (error) {
      console.error("Erro ao criar curso:", error);
      alert("Erro ao criar. Veja o console.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <button onClick={() => router.back()} className={styles.backBtn}>
        <ArrowLeft size={20} /> Voltar
      </button>

      <h1 className={styles.title}>Criar Novo Curso</h1>
      <p className={styles.subtitle}>Preencha os dados da nova jornada de conhecimento.</p>

      <form onSubmit={handleCreate} className={styles.form}>
        
        {/* Upload de Imagem */}
        <div className={styles.uploadArea}>
          <input 
            type="file" 
            accept="image/*" 
            id="cover"
            onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            hidden 
          />
          <label htmlFor="cover" className={styles.uploadLabel}>
            {imageFile ? (
              <span className={styles.fileName}>{imageFile.name}</span>
            ) : (
              <>
                <UploadCloud size={40} className={styles.icon} />
                <span>Clique para enviar a capa do curso</span>
                <span className={styles.info}>(1920x1080 recomendado)</span>
              </>
            )}
          </label>
        </div>

        {/* Inputs de Texto */}
        <div className={styles.inputGroup}>
          <label>Título do Curso</label>
          <input 
            type="text" 
            placeholder="Ex: Introdução à Extrusão" 
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </div>

        <div className={styles.inputGroup}>
          <label>Descrição Curta</label>
          <textarea 
            placeholder="O que o aluno vai aprender neste curso?" 
            rows={4}
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? <Loader2 className={styles.spin} /> : "Publicar Curso"}
        </button>
      </form>
    </div>
  );
}