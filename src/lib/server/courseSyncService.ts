import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { SyllabusModule, SyllabusLesson } from "@/lib/schemas/courseSchemas";
import { formatTime } from "@/utils/formatters";
import { logger } from "@/lib/errors/logger";

/**
 * ============================================================================
 * TIPOS INTERNOS
 * ============================================================================
 */

interface ModuleWithLessons {
  moduleId: string;
  moduleTitle: string;
  moduleOrder: number;
  lessons: SyllabusLesson[];
  lessonsCount: number;
  totalDurationSeconds: number;
  hasQuiz: boolean;
}

interface RebuildResult {
  success: boolean;
  modulesCount?: number;
  totalLessons?: number;
  totalDuration?: string;
  error?: string;
}

/**
 * ============================================================================
 * FUNÇÃO PRINCIPAL: rebuildCourseSyllabus
 * ============================================================================
 * Reconstrói o syllabus de um curso a partir da hierarquia completa.
 * Otimizado para fazer uma única passagem pelos dados.
 * 
 * @param courseId - ID do curso a reconstruir
 * @returns Resultado da operação
 */
export async function rebuildCourseSyllabus(courseId: string): Promise<RebuildResult> {
  const startTime = Date.now();
  logger.info(`Iniciando reconstrução do curso`, { courseId });

  try {
    const courseRef = adminDb.collection("courses").doc(courseId);
    
    // ========================================
    // 1. BUSCAR MÓDULOS (ordenados)
    // ========================================
    const modulesSnapshot = await courseRef
      .collection("modules")
      .orderBy("order", "asc")
      .get();

    if (modulesSnapshot.empty) {
      logger.warn("Curso sem módulos", { courseId });
      
      // Atualiza o curso com valores zerados
      await courseRef.update({
        syllabus: [],
        modulesCount: 0,
        totalLessons: 0,
        totalDuration: "00:00:00",
        totalDurationSeconds: 0,
        updatedAt: FieldValue.serverTimestamp()
      });

      return { 
        success: true, 
        modulesCount: 0, 
        totalLessons: 0, 
        totalDuration: "00:00:00" 
      };
    }

    // ========================================
    // 2. BUSCAR AULAS DE TODOS OS MÓDULOS (paralelo)
    // ========================================
    // Uma única passagem com Promise.all que retorna dados estruturados
    const modulesWithLessons: ModuleWithLessons[] = await Promise.all(
      modulesSnapshot.docs.map(async (modDoc, index) => {
        const modData = modDoc.data();
        
        // Busca aulas deste módulo
        const lessonsSnapshot = await courseRef
          .collection("modules")
          .doc(modDoc.id)
          .collection("lessons")
          .orderBy("order", "asc")
          .get();

        // Busca se tem quiz (verifica existência de questions)
        const questionsSnapshot = await courseRef
          .collection("modules")
          .doc(modDoc.id)
          .collection("questions")
          .limit(1)
          .get();

        // Processa as aulas
        let moduleDuration = 0;
        const lessons: SyllabusLesson[] = lessonsSnapshot.docs.map((lessonDoc) => {
          const lData = lessonDoc.data();
          const duration = typeof lData.duration === 'number' ? lData.duration : 0;
          moduleDuration += duration;

          return {
            id: lessonDoc.id,
            title: lData.title || "Sem título",
            duration: duration,
            type: 'video' as const,
            freePreview: lData.freePreview || false
          };
        });

        return {
          moduleId: modDoc.id,
          moduleTitle: modData.title || `Módulo ${index + 1}`,
          moduleOrder: modData.order ?? index,
          lessons,
          lessonsCount: lessons.length,
          totalDurationSeconds: moduleDuration,
          hasQuiz: !questionsSnapshot.empty
        };
      })
    );

    // ========================================
    // 3. ORDENAR E CALCULAR TOTAIS
    // ========================================
    // Garante a ordem correta (Promise.all pode desordenar)
    modulesWithLessons.sort((a, b) => a.moduleOrder - b.moduleOrder);

    // Calcula totais
    let totalLessons = 0;
    let totalDurationSeconds = 0;
    let totalQuizzes = 0;

    for (const mod of modulesWithLessons) {
      totalLessons += mod.lessonsCount;
      totalDurationSeconds += mod.totalDurationSeconds;
      if (mod.hasQuiz) totalQuizzes++;
    }

    // ========================================
    // 4. CONSTRUIR SYLLABUS
    // ========================================
    const syllabus: SyllabusModule[] = modulesWithLessons.map(mod => ({
      id: mod.moduleId,
      title: mod.moduleTitle,
      lessons: mod.lessons,
      hasQuiz: mod.hasQuiz
    }));

    // ========================================
    // 5. ATUALIZAR DOCUMENTO DO CURSO
    // ========================================
    const totalDurationFormatted = formatTime(totalDurationSeconds);
    
    await courseRef.update({
      syllabus,
      modulesCount: modulesWithLessons.length,
      totalLessons,
      totalQuizzes,
      totalDuration: totalDurationFormatted,
      totalDurationSeconds, // Também salva em segundos para cálculos
      updatedAt: FieldValue.serverTimestamp()
    });

    // ========================================
    // 6. LOG E RETORNO
    // ========================================
    const duration = Date.now() - startTime;
    logger.info("Curso reconstruído com sucesso", {
      courseId,
      modulesCount: modulesWithLessons.length,
      totalLessons,
      totalQuizzes,
      totalDuration: totalDurationFormatted,
      executionTimeMs: duration
    });

    return {
      success: true,
      modulesCount: modulesWithLessons.length,
      totalLessons,
      totalDuration: totalDurationFormatted
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    logger.error("Erro crítico ao reconstruir curso", error, { courseId });
    
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * ============================================================================
 * FUNÇÃO AUXILIAR: updateCourseCounts
 * ============================================================================
 * Atualiza apenas as contagens de um curso sem reconstruir o syllabus completo.
 * Útil para operações mais leves.
 */
export async function updateCourseCounts(courseId: string): Promise<RebuildResult> {
  try {
    const courseRef = adminDb.collection("courses").doc(courseId);
    
    // Conta módulos
    const modulesSnapshot = await courseRef.collection("modules").get();
    const modulesCount = modulesSnapshot.size;

    // Conta aulas de todos os módulos em paralelo
    const lessonsCounts = await Promise.all(
      modulesSnapshot.docs.map(async (modDoc) => {
        const lessonsSnapshot = await courseRef
          .collection("modules")
          .doc(modDoc.id)
          .collection("lessons")
          .get();
        return lessonsSnapshot.size;
      })
    );

    const totalLessons = lessonsCounts.reduce((sum, count) => sum + count, 0);

    await courseRef.update({
      modulesCount,
      totalLessons,
      updatedAt: FieldValue.serverTimestamp()
    });

    logger.debug("Contagens do curso atualizadas", { courseId, modulesCount, totalLessons });

    return { success: true, modulesCount, totalLessons };

  } catch (error) {
    logger.error("Erro ao atualizar contagens", error, { courseId });
    return { success: false, error: error instanceof Error ? error.message : "Erro desconhecido" };
  }
}

/**
 * ============================================================================
 * FUNÇÃO AUXILIAR: validateCourseSyllabus
 * ============================================================================
 * Verifica se o syllabus está sincronizado com a estrutura real.
 * Útil para diagnóstico.
 */
export async function validateCourseSyllabus(courseId: string): Promise<{
  isValid: boolean;
  issues: string[];
}> {
  const issues: string[] = [];

  try {
    const courseRef = adminDb.collection("courses").doc(courseId);
    const courseDoc = await courseRef.get();

    if (!courseDoc.exists) {
      return { isValid: false, issues: ["Curso não encontrado"] };
    }

    const courseData = courseDoc.data()!;
    const syllabus = courseData.syllabus as SyllabusModule[] | undefined;

    // Verifica se existe syllabus
    if (!syllabus || !Array.isArray(syllabus)) {
      issues.push("Syllabus não existe ou não é um array");
      return { isValid: false, issues };
    }

    // Busca estrutura real
    const modulesSnapshot = await courseRef.collection("modules").get();
    const realModulesCount = modulesSnapshot.size;

    // Compara contagens
    if (syllabus.length !== realModulesCount) {
      issues.push(`Contagem de módulos inconsistente: syllabus=${syllabus.length}, real=${realModulesCount}`);
    }

    // Verifica cada módulo
    for (const syllabusModule of syllabus) {
      const moduleDoc = modulesSnapshot.docs.find(d => d.id === syllabusModule.id);
      
      if (!moduleDoc) {
        issues.push(`Módulo ${syllabusModule.id} no syllabus não existe na estrutura real`);
        continue;
      }

      const lessonsSnapshot = await courseRef
        .collection("modules")
        .doc(syllabusModule.id)
        .collection("lessons")
        .get();

      if (syllabusModule.lessons.length !== lessonsSnapshot.size) {
        issues.push(`Módulo ${syllabusModule.id}: aulas inconsistentes - syllabus=${syllabusModule.lessons.length}, real=${lessonsSnapshot.size}`);
      }
    }

    return {
      isValid: issues.length === 0,
      issues
    };

  } catch (error) {
    logger.error("Erro ao validar syllabus", error, { courseId });
    return {
      isValid: false,
      issues: [error instanceof Error ? error.message : "Erro desconhecido"]
    };
  }
}