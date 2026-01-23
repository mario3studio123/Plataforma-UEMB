"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy, limit, where, getDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Course, Enrollment } from "@/types";
import { useAuth } from "@/context/AuthContext";

export function useDashboardData() {
  const { user } = useAuth();
  
  const [featured, setFeatured] = useState<Course | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lastActiveCourse, setLastActiveCourse] = useState<{ course: Course; progress: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. CARROSSEL OTIMIZADO: Busca apenas os 10 cursos mais recentes publicados
        const coursesRef = collection(db, "courses");
        const qCourses = query(
          coursesRef, 
          where("published", "==", true),
          orderBy("createdAt", "desc"), 
          limit(10)
        );
        const coursesSnap = await getDocs(qCourses);
        const coursesList = coursesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Course[];

        if (coursesList.length > 0) {
          setFeatured(coursesList[0]); // O mais recente é o destaque
          setCourses(coursesList);
        }

        // 2. CONTINUAR ASSISTINDO: Busca matrícula ativa mais recente
        const enrollRef = collection(db, "enrollments");
        const qEnroll = query(
            enrollRef, 
            where("userId", "==", user.uid), 
            where("status", "==", "active"),
            orderBy("lastAccess", "desc"), 
            limit(1)
        );
        
        const enrollSnap = await getDocs(qEnroll);

        if (!enrollSnap.empty) {
            const enrollData = enrollSnap.docs[0].data() as Enrollment;
            if (enrollData.courseId) {
                const courseDoc = await getDoc(doc(db, "courses", enrollData.courseId));
                if (courseDoc.exists()) {
                    setLastActiveCourse({
                        course: { id: courseDoc.id, ...courseDoc.data() } as Course,
                        progress: enrollData.progress,
                    });
                }
            }
        }

      } catch (err) {
        console.error("Erro no dashboard data:", err);
        setError(err instanceof Error ? err : new Error("Erro ao carregar dados do dashboard"));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  return { featured, courses, lastActiveCourse, loading, error };
}