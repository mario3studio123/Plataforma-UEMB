"use client";

import { useRef } from "react";
import { Course } from "@/types";
import styles from "@/app/dashboard/layout.module.css";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import CourseCard from "@/components/CourseCard";

export default function CoursesCarousel({ courses, loading }: { courses: Course[], loading: boolean }) {
  const trackRef = useRef<HTMLDivElement>(null);

  // Duplicar apenas se houver poucos cursos, para garantir o scroll infinito visual
  const infiniteCourses = courses.length < 5 ? [...courses, ...courses, ...courses] : [...courses, ...courses]; 

  useGSAP(() => {
    if (loading || courses.length === 0 || !trackRef.current) return;

    const track = trackRef.current;
    const totalWidth = track.scrollWidth;

    gsap.to(track, {
        x: "-50%", // Move metade (já que duplicamos)
        ease: "none",
        duration: courses.length * 5, // Duração dinâmica
        repeat: -1,
        modifiers: {
            x: gsap.utils.unitize(x => parseFloat(x) % (totalWidth / 2))
        }
    });
  }, [loading, courses]);

  if (loading) return <div style={{ paddingLeft: 140, color: '#666', marginTop: 20 }}>Carregando...</div>;
  if (courses.length === 0) return null;

  return (
    <section className={styles.carouselSection}>
        {/* --- ADIÇÃO DOS GRADIENTES AQUI --- */}
        <div className={`${styles.carouselFade} ${styles.fadeLeft}`} />
        <div className={`${styles.carouselFade} ${styles.fadeRight}`} />
        {/* ---------------------------------- */}

        <div className={styles.carouselWrapper}>
            <div className={styles.innerCarousel} ref={trackRef}>
                {infiniteCourses.map((course, index) => (
                    <div key={`${course.id}-${index}`} style={{ minWidth: 320 }}>
                        <CourseCard course={course} />
                    </div>
                ))}
            </div>
        </div>
    </section>
  );
}