import { 
  collection, query, orderBy, limit, startAfter, 
  getDocs, where, QueryDocumentSnapshot, DocumentData, 
  QueryConstraint
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Course, Enrollment } from "@/types";

const COURSES_PER_PAGE = 12; 

// Interface para os filtros aceitos
export interface CourseFilters {
  level?: string;
  // Flag para uso administrativo (ex: visualizar como ficaria na home)
  includeDrafts?: boolean;
}

// Resposta padronizada para paginação infinita
export type FetchCoursesResponse = {
  courses: Course[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
};

/**
 * Busca paginada de cursos com filtros aplicados no Server-Side (Firestore).
 * Faz o merge automático com o progresso do usuário (Enrollment).
 */
export async function getCoursesPage(
  userId: string,
  lastVisible: QueryDocumentSnapshot<DocumentData> | null,
  filters: CourseFilters = {} 
): Promise<FetchCoursesResponse> {
  try {
    const coursesRef = collection(db, "courses");
    const constraints: QueryConstraint[] = [];

    // --- 1. CONSTRUÇÃO DA QUERY (Filtros e Segurança) ---

    // REGRA DE OURO: Se NÃO foi pedido explicitamente para ver rascunhos, mostra apenas publicados.
    // Isso protege a integridade visual para o aluno.
    if (!filters.includeDrafts) {
      constraints.push(where("published", "==", true));
    }

    // Filtro de Nível (Ex: "Básico", "Avançado")
    if (filters.level && filters.level !== "all") {
      constraints.push(where("level", "==", filters.level));
    }

    // ORDENAÇÃO
    // Importante: No Firestore, se usarmos 'where' e 'orderBy' em campos diferentes,
    // precisamos de um Índice Composto (ex: published ASC + createdAt DESC).
    constraints.push(orderBy("createdAt", "desc"));
    
    // PAGINAÇÃO
    constraints.push(limit(COURSES_PER_PAGE));

    if (lastVisible) {
      constraints.push(startAfter(lastVisible));
    }

    // --- 2. EXECUÇÃO DA BUSCA ---
    
    const q = query(coursesRef, ...constraints);
    const coursesSnap = await getDocs(q);
    
    // Prepara cursor para a próxima página
    const lastDoc = coursesSnap.docs[coursesSnap.docs.length - 1] || null;
    
    // Verifica se atingiu o limite (se vier menos que o limite, acabou)
    const hasMore = coursesSnap.docs.length === COURSES_PER_PAGE;

    if (coursesSnap.empty) {
      return { courses: [], lastDoc: null, hasMore: false };
    }


    const coursesRaw = coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
    const courseIds = coursesRaw.map(c => c.id);

    
    let enrollmentMap = new Map<string, Enrollment>();
  
    if (userId && courseIds.length > 0) {
      const enrollRef = collection(db, "enrollments");
      const chunks = [];
      const chunkSize = 10;
      for (let i = 0; i < courseIds.length; i += chunkSize) {
        chunks.push(courseIds.slice(i, i + chunkSize));
      }

      const enrollPromises = chunks.map(chunk => {
        const qEnroll = query(
          enrollRef,
          where("userId", "==", userId),
          where("courseId", "in", chunk)
        );
        return getDocs(qEnroll);
      });

      const enrollSnapshots = await Promise.all(enrollPromises);
      
      enrollSnapshots.forEach(snap => {
        snap.forEach((doc) => {
          const data = doc.data() as Enrollment;
          enrollmentMap.set(data.courseId, data);
        });
      });
    }


    const mergedCourses = coursesRaw.map(course => {
      const enrollment = enrollmentMap.get(course.id);
      return {
        ...course,
        userProgress: enrollment ? enrollment.progress : 0,
        userStatus: enrollment ? enrollment.status : null
      };
    });

    return { 
      courses: mergedCourses, 
      lastDoc, 
      hasMore 
    };

  } catch (error: any) {
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
      console.error("⚠️ ATENÇÃO: Falta criar um índice no Firestore.", error.message);
      console.warn("👉 Abra o console do navegador e clique no link fornecido pelo Firebase para criar o índice automaticamente.");
    } else {
      console.error("Erro ao buscar página de cursos:", error);
    }
    throw error;
  }
}