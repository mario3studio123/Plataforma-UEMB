"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Loader2, FolderOpen } from "lucide-react";
import CourseCard from "@/components/CourseCard";
import CourseCardSkeleton from "@/components/Skeletons/CourseCardSkeleton";
import { Course } from "@/types";
import styles from "./styles.module.css";

interface CourseGridProps {
    courses: Course[];
    loading: boolean;
    loadingMore: boolean;
    hasMore: boolean;
    onLoadMore: () => void;
    isAdmin: boolean;
    onEditCourse: (e: React.MouseEvent, id: string) => void;
}

export default function CourseGrid({ 
    courses, loading, loadingMore, hasMore, onLoadMore, isAdmin, onEditCourse 
}: CourseGridProps) {
    
    const gridRef = useRef<HTMLDivElement>(null);

    // Animação de Entrada
    useGSAP(() => {
        if (!loading && courses.length > 0 && gridRef.current) {
            // Anima apenas os novos itens (simplificado aqui para animar o container)
             gsap.fromTo(gridRef.current.children, 
                { y: 30, opacity: 0 },
                { y: 0, opacity: 1, duration: 0.4, stagger: 0.05, ease: "power2.out", clearProps: "all" }
            );
        }
    }, [loading]); 

    // 1. Loading Inicial
    if (loading) {
        return (
            <div className={styles.grid}>
                {/* Exibimos 6 skeletons para dar a sensação de carregamento */}
                {[1, 2, 3, 4, 5, 6].map(i => <CourseCardSkeleton key={i} />)}
            </div>
        );
    }

    // 2. Vazio
    if (courses.length === 0) {
        return (
            <div className={styles.emptyState}>
                <FolderOpen size={48} strokeWidth={1} />
                <p>Nenhum curso encontrado.</p>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.grid} ref={gridRef}>
                {courses.map((course, index) => (
                    <div key={course.id} className={styles.cardWrapper}>
                        <CourseCard 
                            course={course} 
                            isAdmin={isAdmin} 
                            onEdit={onEditCourse}
                            // Prioriza o carregamento da imagem dos primeiros 3 cards
                            priority={index < 3} 
                        />
                    </div>
                ))}
            </div>

            {/* AQUI ESTÁ A LÓGICA: Só aparece se hasMore for true */}
            {hasMore && (
                <div className={styles.loadMoreWrapper}>
                    <button 
                        onClick={onLoadMore} 
                        disabled={loadingMore}
                        className={styles.loadMoreBtn}
                    >
                        {loadingMore ? (
                            <>
                                <Loader2 className={styles.spin} size={18} /> Carregando...
                            </>
                        ) : (
                            "Carregar mais cursos"
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}