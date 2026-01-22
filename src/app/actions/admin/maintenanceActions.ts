"use server";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { formatTime } from "@/utils/formatters"; // Certifique-se que este util não tem "use client"

export async function syncCourseDataAction(token: string, courseId: string) {
  try {
    // 1. Auth Check
    await adminAuth.verifyIdToken(token);

    console.log(`🔄 Iniciando resync do curso: ${courseId}`);

    // 2. Referências
    const courseRef = adminDb.collection("courses").doc(courseId);
    const modulesRef = courseRef.collection("modules");

    // 3. Buscar todos os módulos
    const modulesSnap = await modulesRef.get();
    const modulesCount = modulesSnap.size;

    let totalLessonsCalculated = 0;
    let totalDurationSeconds = 0;

    // 4. Varrer cada módulo para contar aulas e somar tempo
    // Usamos Promise.all para fazer as leituras em paralelo (muito mais rápido)
    await Promise.all(
      modulesSnap.docs.map(async (modDoc) => {
        const lessonsSnap = await modulesRef.doc(modDoc.id).collection("lessons").get();
        
        totalLessonsCalculated += lessonsSnap.size;

        lessonsSnap.forEach((lessonDoc) => {
          const data = lessonDoc.data();
          // Garante que duration é número. Se não for, trata como 0.
          const duration = typeof data.duration === 'number' ? data.duration : 0;
          totalDurationSeconds += duration;
        });
      })
    );

    // 5. Formatar duração (HH:MM:SS)
    const totalDurationFormatted = formatTime(totalDurationSeconds);

    // 6. Atualizar o Documento Pai (Curso)
    await courseRef.update({
      modulesCount: modulesCount,
      totalLessons: totalLessonsCalculated,
      totalDuration: totalDurationFormatted, // String para exibição
      // totalDurationSeconds: totalDurationSeconds, // Opcional: útil manter o number para cálculos futuros
      updatedAt: new Date() // Marca quando foi a última manutenção
    });

    console.log(`✅ Resync concluído: ${totalLessonsCalculated} aulas, ${totalDurationFormatted} tempo.`);

    return { 
      success: true, 
      stats: {
        modules: modulesCount,
        lessons: totalLessonsCalculated,
        duration: totalDurationFormatted
      }
    };

  } catch (error) {
    console.error("Erro ao sincronizar curso:", error);
    return { success: false, message: "Falha interna ao recalcular dados." };
  }
}