"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Course } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { useSidebar } from "@/context/SidebarContext"; 
import { Plus, ArrowRight, Settings, BarChart } from "lucide-react"; 
import styles from "./styles.module.css";

// GSAP
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

export default function CoursesPage() {
  const { profile } = useAuth();
  const { isExpanded } = useSidebar();
  const router = useRouter();
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const q = query(collection(db, "courses"), orderBy("createdAt", "desc")); 
        const querySnapshot = await getDocs(q);
        
        const coursesList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Course[];

        setCourses(coursesList);
      } catch (error) {
        console.error("Erro ao buscar cursos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, []);

  const isAdmin = profile?.role === "admin" || profile?.role === "master";

  // --- ANIMAÇÃO GSAP ---
  useGSAP(() => {
    // 1. Ajuste Responsivo da Margem Esquerda (Sincronizado com Sidebar)
    gsap.to(containerRef.current, {
        paddingLeft: isExpanded ? 440 : 180,
        duration: 0.8,
        ease: "power3.inOut"
    });

    // 2. Entrada Triunfal dos Cards (Waterfall)
    if (courses.length > 0 && cardsRef.current.length > 0) {
        gsap.fromTo(cardsRef.current, 
            { y: 100, opacity: 0, scale: 0.9 },
            { 
                y: 0, 
                opacity: 1, 
                scale: 1,
                duration: 0.8, 
                stagger: 0.1, // 0.1s entre cada card
                ease: "power3.out",
                clearProps: "all" // Limpa transform para não bugar o 3D tilt depois
            }
        );
    }
  }, [isExpanded, courses]); // Roda quando carrega cursos ou sidebar muda

  // --- LÓGICA 3D TILT ---
  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>, index: number) => {
    const card = cardsRef.current[index];
    if(!card) return;

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left; // Posição X do mouse dentro do card
    const y = e.clientY - rect.top;  // Posição Y do mouse dentro do card
    
    // Cálculo do centro
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Intensidade da rotação (divida por números maiores para rotação mais sutil)
    const rotateX = ((y - centerY) / centerY) * -10; // Inverte Y para inclinar corretamente
    const rotateY = ((x - centerX) / centerX) * 10;

    // Aplica GSAP rápido (performático)
    gsap.to(card, {
        rotationX: rotateX,
        rotationY: rotateY,
        transformPerspective: 1000, // Dá a profundidade 3D
        scale: 1.05,
        boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
        duration: 0.4,
        ease: "power2.out"
    });
    
    // Efeito Paralaxe na Imagem Interna (opcional, se quiser ainda mais imersão)
    const img = card.querySelector('img');
    if(img) {
        gsap.to(img, {
            scale: 1.15, // Zoom
            x: (x - centerX) * 0.05, // Move levemente oposto
            y: (y - centerY) * 0.05,
            duration: 0.4
        });
    }
  };

  const handleCardMouseLeave = (index: number) => {
    const card = cardsRef.current[index];
    if(!card) return;

    // Reseta posição
    gsap.to(card, {
        rotationX: 0,
        rotationY: 0,
        scale: 1,
        boxShadow: "0 0 0 rgba(0,0,0,0)",
        duration: 0.6,
        ease: "elastic.out(1, 0.5)"
    });

    const img = card.querySelector('img');
    if(img) {
        gsap.to(img, { scale: 1, x: 0, y: 0, duration: 0.6 });
    }
  };

  const handleEditClick = (e: React.MouseEvent, courseId: string) => {
    e.preventDefault(); 
    e.stopPropagation();
    router.push(`/dashboard/admin/courses/${courseId}/manage`);
  };

  return (
    <div 
      className={styles.container} 
      ref={containerRef}
      // style={{ paddingLeft: ... }} // Removido pois o GSAP controla
    >
      <div className={styles.header}>

        {isAdmin && (
          <Link href="/dashboard/admin/create-course">
            <button className={styles.createBtn}>
              <Plus size={20} />
              <span>Novo Curso</span>
            </button>
          </Link>
        )}
      </div>

      {loading ? (
        <div className={styles.loading}>Carregando biblioteca...</div>
      ) : (
        <div className={styles.grid}>
          {courses.length === 0 ? (
            <div className={styles.empty}>Nenhum curso disponível no momento.</div>
          ) : (
            courses.map((course, index) => (
              <Link 
                href={`/dashboard/courses/${course.id}/learn`} 
                key={course.id} 
                className={styles.cardWrapper}
              >
                {/* CARD INTERATIVO 3D */}
                <div 
                  className={styles.card}
                  ref={el => { if (el) cardsRef.current[index] = el }}
                  onMouseMove={(e) => handleCardMouseMove(e, index)}
                  onMouseLeave={() => handleCardMouseLeave(index)}
                  style={{ transformStyle: 'preserve-3d' }} // Importante para o 3D funcionar
                >
                  <div className={styles.cardImage}>
                    <img src={course.coverUrl} alt={course.title} />
                    
                    {isAdmin && (
                      <div 
                        className={styles.adminEditBtn} 
                        onClick={(e) => handleEditClick(e, course.id)}
                        title="Gerenciar Curso"
                        style={{ transform: 'translateZ(20px)' }} // Flutua sobre o card
                      >
                        <Settings size={18} />
                      </div>
                    )}

                    <div className={styles.cardOverlay} />
                    
                    <div className={styles.cardContentOverlay} style={{ transform: 'translateZ(30px)' }}>
                        <h3 className={styles.cardTitle}>{course.title}</h3>
                        
                        <div className={styles.cardBadge}>
                          <BarChart size={12} />
                          <span>{course.level || "Curso Completo"}</span> 
                        </div>
                    </div>
                  </div>
                  
                  <div className={styles.cardFooterPill} style={{ transform: 'translateZ(20px)' }}>
                      <span className={styles.viewMoreText}>Acessar agora</span>
                      <div className={styles.arrowButton}>
                          <ArrowRight size={20} />
                      </div>
                  </div>

                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}