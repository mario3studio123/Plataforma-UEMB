// src/components/Course/CourseSidebar/index.tsx
"use client";

import React, { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Award, Loader2 } from "lucide-react";
import { Module, Lesson } from "@/types";
import styles from "./styles.module.css";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

// Contextos e Actions
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { issueCertificateAction } from "@/app/actions/certificateActions";

interface CourseSidebarProps {
  courseId: string;
  modules: Module[];
  activeLessonId?: string;
  activeModuleId?: string | null;
  contentType: 'lesson' | 'quiz';
  completedLessons: string[];
  completedQuizzes: string[];
  onSelectLesson: (lesson: Lesson, moduleId: string) => void;
  onSelectQuiz: (moduleId: string) => void;
}

// Formata duração em minutos de forma legível
function formatMinutes(seconds: number | string | undefined): string {
  if (!seconds) return "10 min";
  const secs = typeof seconds === 'string' ? parseInt(seconds) : seconds;
  if (isNaN(secs)) return "10 min";
  const mins = Math.round(secs / 60);
  return `${mins || 1} min`;
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
  const containerRef = useRef<HTMLDivElement>(null);
  const lessonsRef = useRef<HTMLDivElement>(null);

  // Estado de Emissão do Certificado
  const [emitting, setEmitting] = useState(false);

  // Animação de entrada
  useGSAP(() => {
    if (containerRef.current) {
      gsap.fromTo(containerRef.current,
        { opacity: 0, x: 30 },
        { opacity: 1, x: 0, duration: 0.5, ease: "power3.out", delay: 0.1 }
      );
    }
  }, []);

  // Animação das aulas (stagger)
  useGSAP(() => {
    if (lessonsRef.current) {
      const lessonItems = lessonsRef.current.querySelectorAll(`.${styles.lessonRow}, .${styles.quizRow}`);
      gsap.fromTo(lessonItems,
        { opacity: 0, x: 20 },
        { 
          opacity: 1, 
          x: 0, 
          duration: 0.4, 
          stagger: 0.05, 
          ease: "power2.out",
          delay: 0.3
        }
      );
    }
  }, [modules]);

  // --- LÓGICA DE PROGRESSO E CERTIFICADO ---
  const totalLessons = useMemo(() => {
    return modules.reduce((acc, mod) => acc + mod.lessons.length, 0);
  }, [modules]);

  const validCompletedCount = useMemo(() => {
    const allLessonIds = new Set(modules.flatMap(m => m.lessons.map(l => l.id)));
    return completedLessons.filter(id => allLessonIds.has(id)).length;
  }, [modules, completedLessons]);

  const progressPercent = totalLessons > 0 ? (validCompletedCount / totalLessons) * 100 : 0;
  const isCourseCompleted = totalLessons > 0 && validCompletedCount === totalLessons;

  // Pega o módulo atual
  const currentModule = modules.find(m => m.id === activeModuleId) || modules[0];
  const currentModuleIndex = modules.findIndex(m => m.id === currentModule?.id);

  // Handler para emitir certificado
  const handleIssueCertificate = async () => {
    if (!user) return;
    setEmitting(true);
    try {
      const token = await user.getIdToken();
      const res = await issueCertificateAction(token, courseId);

      if (res.success) {
        addToast(res.isNew ? "Certificado emitido!" : "Visualizando certificado...", "success");
        router.push("/dashboard/certificates");
      } else {
        addToast(res.message || "Erro ao emitir.", "error");
      }
    } catch (e) {
      console.error(e);
      addToast("Erro de conexão.", "error");
    } finally {
      setEmitting(false);
    }
  };

  // Handler com animação de click
  const handleLessonClick = (lesson: Lesson, moduleId: string, e: React.MouseEvent) => {
    const target = e.currentTarget as HTMLElement;
    gsap.fromTo(target, 
      { scale: 0.98 }, 
      { scale: 1, duration: 0.2, ease: "back.out(1.7)" }
    );
    onSelectLesson(lesson, moduleId);
  };

  return (
    <div className={styles.sidebarContainer} ref={containerRef}>
      {/* HEADER */}
      <div className={styles.header}>
        <h3 className={styles.headerTitle}>Conteúdo do Curso</h3>
        <span className={styles.progressText}>
          {validCompletedCount}/{totalLessons} aulas concluídas
        </span>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* INFO DO MÓDULO */}
      {currentModule && (
        <div className={styles.moduleInfo}>
          <span className={styles.moduleIndex}>Módulo {currentModuleIndex + 1}</span>
          <h4 className={styles.moduleTitle}>{currentModule.title}</h4>
        </div>
      )}

      {/* LISTA DE AULAS (SEM ACCORDION) */}
      <div className={styles.scrollArea} ref={lessonsRef}>
        {currentModule?.lessons.map((lesson, idx) => {
          const isActive = activeLessonId === lesson.id && contentType === 'lesson';
          const isDone = completedLessons.includes(lesson.id);
          
          // Determina a cor do indicador
          let indicatorClass = styles.indicatorPending;
          if (isDone) indicatorClass = styles.indicatorCompleted;
          else if (isActive) indicatorClass = styles.indicatorActive;

          return (
            <div
              key={lesson.id}
              onClick={(e) => handleLessonClick(lesson, currentModule.id, e)}
              className={`${styles.lessonRow} ${isActive ? styles.active : ''}`}
            >
              {/* Indicador Lateral */}
              <div className={`${styles.lessonIndicator} ${indicatorClass}`} />
              
              {/* Card da Aula */}
              <div className={styles.lessonCard}>
                <span className={styles.lessonMeta}>
                  {formatMinutes(lesson.duration)} • {lesson.xpReward} XP
                </span>
              </div>
            </div>
          );
        })}

        {/* Prova do Módulo */}
        {currentModule && (
          <div
            onClick={() => onSelectQuiz(currentModule.id)}
            className={`${styles.quizRow} ${contentType === 'quiz' && activeModuleId === currentModule.id ? styles.active : ''}`}
          >
            <div className={`${styles.quizIndicator} ${completedQuizzes.includes(currentModule.id) ? styles.indicatorCompleted : ''}`} />
            <div className={styles.quizCard}>
              <span className={styles.quizTitle}>Prova do Módulo</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
