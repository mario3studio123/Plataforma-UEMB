"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowRight, BarChart, BookOpen, Clock, PlayCircle } from "lucide-react"; // Adicionei PlayCircle
import { Course } from "@/types";
import Skeleton from "@/components/ui/Skeleton";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import styles from "@/app/dashboard/layout.module.css"; 
import { useSidebar } from "@/context/SidebarContext";

interface HeroProps {
  course: Course | null;
  loading: boolean;
  // Novas props para controlar o contexto
  mode?: "featured" | "resume"; 
  progress?: number; 
}

export default function HeroSection({ 
  course, 
  loading, 
  mode = "featured", // Padrão é destaque
  progress = 0 
}: HeroProps) {
  const { isExpanded } = useSidebar();
  
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // --- ANIMAÇÕES (Mantidas idênticas para consistência) ---
  useGSAP(() => {
    if (loading || !course || !contentRef.current) return;

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    // Reset para garantir que a animação re-execute se o curso mudar
    gsap.set([imgRef.current, contentRef.current.querySelectorAll(".anim-item")], { clearProps: "all" });

    // Zoom da Imagem
    if (imgRef.current) {
        tl.fromTo(imgRef.current, 
            { scale: 1.15, opacity: 0 }, 
            { scale: 1, opacity: 1, duration: 1.2 }
        );
    }

    // Texto em Cascata
    const items = contentRef.current.querySelectorAll(".anim-item");
    if(items.length > 0) {
        tl.fromTo(items, 
            { y: 30, opacity: 0, filter: "blur(5px)" },
            { y: 0, opacity: 1, filter: "blur(0px)", duration: 0.8, stagger: 0.1 },
            "-=0.8"
        );
    }
  }, [loading, course]); // Re-executa se o curso mudar

  // Lógica de Posicionamento Sidebar
  useGSAP(() => {
    if (loading || !contentRef.current) return;
    gsap.to(contentRef.current, {
      x: isExpanded ? 280 : 0,
      duration: 0.5,
      ease: "power3.inOut",
      overwrite: "auto"
    });
  }, [isExpanded, loading]);

  // Parallax Mouse
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!imgRef.current) return;
    const { clientX, clientY } = e;
    const xPos = (clientX / window.innerWidth - 0.5) * 15;
    const yPos = (clientY / window.innerHeight - 0.5) * 15;
    gsap.to(imgRef.current, { x: xPos, y: yPos, duration: 1, ease: "power2.out" });
  };

  // --- RENDER DO SKELETON (Mantido igual) ---
  if (loading) {
    return (
        <section className={styles.hero} style={{ alignItems: 'center', display: 'flex' }}>
            <div style={{ 
                width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '16px',
                transform: isExpanded ? 'translateX(280px)' : 'translateX(0)', transition: 'transform 0.5s ease'
            }}>
                <Skeleton height="60px" width="70%" />
                <Skeleton height="80px" width="100%" />
                <div style={{ display: 'flex', gap: 10 }}>
                    <Skeleton height="30px" width="100px" borderRadius="99px" />
                    <Skeleton height="30px" width="100px" borderRadius="99px" />
                </div>
                <Skeleton height="50px" width="200px" borderRadius="99px" />
            </div>
        </section>
    );
  }

  if (!course) return null;

  // --- LÓGICA DE EXIBIÇÃO INTELIGENTE ---
  const isResuming = mode === "resume";
  const buttonText = isResuming ? "Continuar Assistindo" : "Assistir Agora";
  const ButtonIcon = isResuming ? PlayCircle : ArrowRight;

  return (
    <section className={styles.hero} ref={containerRef} onMouseMove={handleMouseMove}>
      <div className={styles.heroBg} style={{ overflow: 'hidden' }}>
        <img 
            ref={imgRef}
            src={course.coverUrl} 
            alt={course.title} 
            className={styles.heroImg} 
            style={{ transform: "scale(1.1)" }}
        />
        <div className={styles.heroGradient} />
      </div>

      <div 
        className={styles.heroContent} 
        ref={contentRef}
        style={{ transform: isExpanded ? 'translate3d(280px, 0, 0)' : 'translate3d(0, 0, 0)' }}
      >
         {/* Título */}
         <h1 className={`${styles.heroTitle} anim-item`}>{course.title}</h1>
         
         {/* Descrição */}
         <p className={`${styles.heroDescription} anim-item`}>
            {course.description.length > 180 ? course.description.substring(0, 180) + "..." : course.description}
         </p>

         {/* Meta Tags (Badges) */}
         <div className={`${styles.metaTags} anim-item`}>
            <div className={styles.chip}>
                <BarChart size={14} /> <span>{course.level || "Geral"}</span>
            </div>
            <div className={styles.chip}>
                <BookOpen size={14} /> <span>{course.modulesCount || 0} Módulos</span>
            </div>
            
            {/* Aqui trocamos a informação: Se for resume, mostra progresso. Se não, duração. 
                O layout (CSS .chip) permanece idêntico. */}
            {isResuming ? (
  <div className={styles.chip} style={{ borderColor: '#CA8DFF', color: '#fff' }}>
    <Clock size={14} /> <span>{progress}% Concluído</span>
  </div>
) : (
  /* AQUI A CORREÇÃO 👇 */
  course.totalDuration && (
    <div className={styles.chip}>
      <Clock size={14} /> <span>{course.totalDuration}</span>
    </div>
  )
)}
         </div>

         {/* Botão de Ação */}
         <Link href={`/dashboard/courses/${course.id}/learn`} className="anim-item" style={{ display: 'inline-block' }}>
            <button className={styles.heroBtn}>
               <span>{buttonText}</span>
               <div className={styles.btnIcon}><ArrowRight size={20} /></div>
            </button>
         </Link>
      </div>
    </section>
  );
}