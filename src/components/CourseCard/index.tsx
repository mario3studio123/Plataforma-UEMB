"use client";

import { useRef, memo } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Settings } from "lucide-react";
import { Course } from "@/types";
import styles from "./styles.module.css";
import gsap from "gsap";

interface CourseCardProps {
  course: Course;
  isAdmin?: boolean;
  priority?: boolean; // Se true, carrega a imagem imediatamente (LCP optimization)
  onEdit?: (e: React.MouseEvent, id: string) => void;
}

function CourseCard({ course, isAdmin, priority = false, onEdit }: CourseCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // --- Lógica de Animação 3D (Tilt Effect) ---
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Intensidade da rotação (Tilt)
    const rotateX = ((y - centerY) / centerY) * -8; 
    const rotateY = ((x - centerX) / centerX) * 8;

    // Aplica a rotação no Card
    gsap.to(cardRef.current, {
      rotationX: rotateX,
      rotationY: rotateY,
      transformPerspective: 1000,
      scale: 1.03,
      boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
      duration: 0.4,
      ease: "power2.out"
    });

    // Aplica efeito Paralaxe na Imagem (movimento oposto/ampliado)
    if (imageRef.current) {
        gsap.to(imageRef.current, {
            scale: 1.15, // Zoom leve
            x: (x - centerX) * 0.05,
            y: (y - centerY) * 0.05,
            duration: 0.4
        });
    }
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;

    // Reseta posição do Card
    gsap.to(cardRef.current, {
      rotationX: 0,
      rotationY: 0,
      scale: 1,
      boxShadow: "0 0 0 rgba(0,0,0,0)",
      duration: 0.6,
      ease: "elastic.out(1, 0.5)"
    });

    // Reseta posição da Imagem
    if (imageRef.current) {
        gsap.to(imageRef.current, { scale: 1, x: 0, y: 0, duration: 0.6 });
    }
  };

  return (
    <Link href={`/dashboard/courses/${course.id}/learn`} className={styles.cardWrapper}>
      <div 
        className={styles.card}
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div className={styles.cardImage}>
          {/* Next Image Otimizado */}
          <Image 
            src={course.coverUrl} 
            alt={course.title}
            fill // Ocupa todo o pai relative
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            priority={priority}
            className={styles.nextImage}
            // Tipagem 'any' necessária pois a ref do NextImage aponta para o componente, não o DOM direto às vezes
            ref={imageRef as any} 
          />
          
          {isAdmin && onEdit && (
            <div 
              className={styles.adminEditBtn} 
              onClick={(e) => onEdit(e, course.id)}
              title="Gerenciar Curso"
            >
              <Settings size={18} />
            </div>
          )}

          <div className={styles.cardOverlay} />
          
          <div className={styles.cardContentOverlay}>
             <h3 className={styles.cardTitle}>{course.title}</h3>
          </div>
        </div>

        {/* Barra de Progresso (Só exibe se tiver progresso real) */}
        {course.userProgress !== undefined && course.userProgress > 0 && (
            <div className={styles.progressBarBg}>
                <div 
                    className={styles.progressBarFill} 
                    style={{ width: `${course.userProgress}%` }} 
                />
            </div>
        )}
        
        <div className={styles.cardFooterPill}>
            <span className={styles.viewMoreText}>
                {course.userProgress && course.userProgress > 0 ? "Continuar" : "Acessar agora"}
            </span>
            <div className={styles.arrowButton}>
                <ArrowRight size={20} />
            </div>
        </div>
      </div>
    </Link>
  );
}

// OTIMIZAÇÃO: React.memo com função de comparação customizada
export default memo(CourseCard, (prevProps, nextProps) => {
  return (
    // Se o ID mudar, renderiza
    prevProps.course.id === nextProps.course.id &&
    // Se o Título mudar, renderiza
    prevProps.course.title === nextProps.course.title &&
    // Se a imagem mudar, renderiza
    prevProps.course.coverUrl === nextProps.course.coverUrl &&
    // Se o progresso mudar, renderiza
    prevProps.course.userProgress === nextProps.course.userProgress &&
    // Se o status mudar, renderiza
    prevProps.course.userStatus === nextProps.course.userStatus &&
    // Se a permissão de admin mudar, renderiza
    prevProps.isAdmin === nextProps.isAdmin
    // Ignoramos onEdit e priority na comparação para evitar re-renders por referência de função
  );
});