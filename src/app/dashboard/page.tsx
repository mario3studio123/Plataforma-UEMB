"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Course } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { useSidebar } from "@/context/SidebarContext";
import { ArrowRight, Clock, BookOpen, BarChart, PlayCircle, DollarSign } from "lucide-react";
import styles from "./layout.module.css";

// GSAP Imports
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export default function DashboardHome() {
  const { user } = useAuth();
  const { isExpanded } = useSidebar();
  
  // Refs para GSAP
  const containerRef = useRef<HTMLDivElement>(null);
  const heroContentRef = useRef<HTMLDivElement>(null);
  const heroBgRef = useRef<HTMLDivElement>(null);
  const heroImgRef = useRef<HTMLImageElement>(null);
  const carouselTrackRef = useRef<HTMLDivElement>(null);

  const [courses, setCourses] = useState<Course[]>([]);
  const [featured, setFeatured] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);

  // 1. Busca de Dados (Mantive igual)
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const q = query(collection(db, "courses"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Course[];

        if (list.length > 0) {
          setFeatured(list[0]);
          setCourses(list);
        }
      } catch (error) {
        console.error("Erro ao buscar cursos:", error);
      } finally {
        setLoading(false);
      }
    };
    if (user) fetchCourses();
  }, [user]);

  // Duplicar lista para o loop infinito
  const infiniteCourses = [...courses, ...courses, ...courses]; 

  // --- 2. ANIMAÇÕES GSAP ---

  // A. Hero Entrance & Sidebar Adjustment
  useGSAP(() => {
    // Ajuste responsivo da margem quando a sidebar abre/fecha
    gsap.to(heroContentRef.current, {
      x: isExpanded ? 280 : 0,
      duration: 0.8,
      ease: "power3.inOut" // Efeito "suave" na aceleração/desaceleração
    });
  }, [isExpanded]); // Dispara quando a sidebar muda

  // B. Hero Content Reveal (Entrada Dramática)
  useGSAP(() => {
    if (!featured) return;

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    // 1. A imagem dá um leve zoom-out inicial
    tl.fromTo(heroImgRef.current, 
      { scale: 1.1, opacity: 0 }, 
      { scale: 1, opacity: 1, duration: 1.5 }
    );

    // 2. O conteúdo desliza e revela (seleciona filhos diretos)
    if (heroContentRef.current) {
        const children = heroContentRef.current.children; // div interna
        // Vamos animar os filhos dessa div interna (Título, Descrição, Tags, Botão)
        // Precisamos garantir que a div interna tenha filhos. 
        // No seu JSX, há uma div motion.div (que vamos remover o motion) envolvendo tudo.
        
        // Seleciona os itens dentro do container de conteúdo
        // Ajuste o seletor conforme a estrutura final do JSX abaixo
        tl.fromTo(".hero-anim-item", 
            { y: 50, opacity: 0, filter: "blur(10px)" },
            { y: 0, opacity: 1, filter: "blur(0px)", duration: 0.8, stagger: 0.1 },
            "-=1" // Começa antes da imagem terminar
        );
    }

  }, [featured]); // Roda quando carrega o destaque

  // C. Efeito Mouse Parallax (Imersão)
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!heroImgRef.current) return;
    const { clientX, clientY } = e;
    const xPos = (clientX / window.innerWidth - 0.5) * 20; // Move +/- 20px
    const yPos = (clientY / window.innerHeight - 0.5) * 20;

    gsap.to(heroImgRef.current, {
      x: xPos,
      y: yPos,
      duration: 1,
      ease: "power2.out"
    });
  };

  // D. Infinite Carousel (Sem CSS keyframes, controle total)
  useGSAP(() => {
    if (!carouselTrackRef.current || courses.length === 0) return;
    
    // Calcula a largura total para saber quanto deslocar
    // Uma técnica simples de carrossel infinito com GSAP
    const track = carouselTrackRef.current;
    
    // Clonamos visualmente o movimento
    // O ideal é usar o plugin SeamlessLoop, mas vamos fazer uma versão manual fluida
    const totalWidth = track.scrollWidth;
    const viewWidth = track.offsetWidth;
    
    // Animação contínua
    gsap.to(track, {
        x: "-33.33%", // Desloca 1/3 (já que triplicamos o array)
        ease: "none",
        duration: 40, // Velocidade (quanto maior, mais lento)
        repeat: -1,
        modifiers: {
            x: gsap.utils.unitize(x => parseFloat(x) % (totalWidth / 3)) // Reinicia imperceptivelmente
        }
    });

  }, [courses]);


  if (loading) return <div className={styles.loadingScreen}><div className={styles.spinner}></div></div>;

  return (
    <div className={styles.container} ref={containerRef} onMouseMove={handleMouseMove}>
      
      {/* --- HERO SECTION --- */}
      {featured ? (
        <section className={styles.hero}>
          {/* Fundo Estático com Parallax */}
          <div className={styles.heroBg} ref={heroBgRef} style={{ overflow: 'hidden' }}>
            <img 
                ref={heroImgRef}
                src={featured.coverUrl} 
                alt="Cover" 
                className={styles.heroImg} 
                style={{ transform: "scale(1.1)" }} // Começa um pouco maior para o parallax não cortar borda
            />
            <div className={styles.heroGradient} />
          </div>

          {/* Conteúdo (Sem Framer Motion, usando Refs) */}
          <div 
            className={styles.heroContent}
            ref={heroContentRef}
            // O estilo inicial de X será controlado pelo GSAP
          >
            {/* Wrapper interno para agrupar animação */}
            <div style={{ opacity: 0 }} className="hero-anim-wrapper"> 
                {/* Adicionei a classe "hero-anim-item" para o stagger do GSAP funcionar */}
              <h1 className={`${styles.heroTitle} hero-anim-item`}>{featured.title}</h1>
              
              <p className={`${styles.heroDescription} hero-anim-item`}>
                {featured.description.length > 200 
                  ? featured.description.substring(0, 200) + "..." 
                  : featured.description}
              </p>

              <div className={`${styles.metaTags} hero-anim-item`}>
                <div className={styles.chip}><BarChart size={14} /> <span>{featured.level || "Intermediário"}</span></div>
                <div className={styles.chip}><BookOpen size={14} /> <span>{featured.modulesCount || 0} Módulos</span></div>
                <div className={styles.chip}><Clock size={14} /> <span>{featured.duration || "12h"}</span></div>
              </div>

              <Link href={`/dashboard/courses/${featured.id}/learn`} className={`${styles.heroLink} hero-anim-item`}>
                <button className={styles.heroBtn}>
                  <span>Assistir Agora</span>
                  <div className={styles.btnIcon}><ArrowRight size={20} /></div>
                </button>
              </Link>
            </div>
            {/* Hackzinho para o GSAP encontrar os itens dentro do wrapper acima caso o wrapper esteja com opacity 0 */}
            <style jsx global>{`
                .hero-anim-wrapper { opacity: 1 !important; }
            `}</style>
          </div>
        </section>
      ) : (
        <div className={styles.emptyState}>Nenhum curso disponível no momento.</div>
      )}

      {/* --- CARROSSEL --- */}
      <section className={styles.carouselSection}>
        <div className={styles.carouselWrapper}>
          {/* Track Ref para o GSAP mover */}
          <div className={styles.innerCarousel} ref={carouselTrackRef}>
            {infiniteCourses.map((course, index) => (
              <Link href={`/dashboard/courses/${course.id}/learn`} key={`${course.id}-${index}`} className={styles.cardLink}>
                {/* Efeito Hover com GSAP (Inline mouse events para simplicidade aqui, ou useGSAP com utils) */}
                <div 
                    className={styles.card}
                    onMouseEnter={(e) => {
                        gsap.to(e.currentTarget, { y: -10, scale: 1.02, duration: 0.3, ease: "back.out(1.7)", borderColor: "#CA8DFF" });
                        gsap.to(e.currentTarget.querySelector('img'), { scale: 1.1, duration: 0.5 });
                    }}
                    onMouseLeave={(e) => {
                        gsap.to(e.currentTarget, { y: 0, scale: 1, duration: 0.3, ease: "power2.out", borderColor: "transparent" });
                        gsap.to(e.currentTarget.querySelector('img'), { scale: 1, duration: 0.5 });
                    }}
                >
                    <div className={styles.cardImage}>
                      <img src={course.coverUrl} alt={course.title} />
                      <div className={styles.cardOverlay} />
                      <div className={styles.cardContentOverlay}>
                          <h3 className={styles.cardTitle}>{course.title}</h3>
                          <div className={styles.cardBadge}>
                            <DollarSign size={12} />
                            <span>{course.level || "Exclusivo"}</span> 
                          </div>
                      </div>
                    </div>
                    
                    <div className={styles.cardFooterPill}>
                        <span className={styles.viewMoreText}>Veja mais</span>
                        <div className={styles.arrowButton}>
                            <ArrowRight size={20} />
                        </div>
                    </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}