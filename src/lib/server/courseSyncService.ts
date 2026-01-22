import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { SyllabusModule, SyllabusLesson } from "@/lib/schemas/courseSchemas";
import { formatTime } from "@/utils/formatters"; // Certifique-se que esta função não usa hooks do React

/**
 * 🔄 REBUILDER (O Coração da Robustez)
 * Esta função lê toda a hierarquia de um curso (Módulos -> Aulas)
 * e regenera o documento pai com dados agregados e o JSON de syllabus atualizado.
 */
export async function rebuildCourseSyllabus(courseId: string) {
  console.log(`🏗️ [Sync] Iniciando reconstrução do curso: ${courseId}`);

  try {
    const courseRef = adminDb.collection("courses").doc(courseId);
    
    // 1. Buscar Módulos (Ordenados)
    const modulesSnapshot = await courseRef
      .collection("modules")
      .orderBy("order", "asc")
      .get();

    const modulesCount = modulesSnapshot.size;
    let totalLessonsCalculated = 0;
    let totalDurationSeconds = 0;
    
    // Array final que será salvo no documento pai
    const syllabus: SyllabusModule[] = [];

    // 2. Iterar Módulos e Buscar Aulas (Parallel Fetching para performance)
    // Usamos Promise.all para não bloquear em cascata (Waterfall)
    await Promise.all(
      modulesSnapshot.docs.map(async (modDoc) => {
        const modData = modDoc.data();
        
        // Busca aulas deste módulo
        const lessonsSnapshot = await courseRef
          .collection("modules")
          .doc(modDoc.id)
          .collection("lessons")
          .orderBy("order", "asc")
          .get();

        const lessons: SyllabusLesson[] = [];

        lessonsSnapshot.forEach((lessonDoc) => {
          const lData = lessonDoc.data();
          const duration = typeof lData.duration === 'number' ? lData.duration : 0;

          // Somatórios Globais
          totalLessonsCalculated++;
          totalDurationSeconds += duration;

          // Constrói objeto leve para o Syllabus
          lessons.push({
            id: lessonDoc.id,
            title: lData.title || "Sem título",
            duration: duration,
            type: 'video', // Por enquanto fixo, mas preparado para 'quiz'
            freePreview: lData.freePreview || false
          });
        });

        // Adiciona ao array principal (Respeitando a ordem do map original não é garantido no Promise.all
        // por isso construímos o objeto completo e ordenamos depois ou inserimos com índice se necessário.
        // Como o map do Promise.all pode desordenar, vamos usar um truque:
        // A syllabus vai ser reconstruída baseada na ordem do modulesSnapshot síncrono abaixo.
      })
    );

    // *Correção para garantir ordem correta após Promise.all:*
    // O loop acima foi para *cálculos*. Vamos montar o Syllabus sequencialmente ou mapear corretamente.
    // Maneira mais segura e ainda rápida:
    
    for (const modDoc of modulesSnapshot.docs) {
      const lessonsSnapshot = await courseRef
        .collection("modules")
        .doc(modDoc.id)
        .collection("lessons")
        .orderBy("order", "asc")
        .get();

      const modLessons: SyllabusLesson[] = lessonsSnapshot.docs.map(l => ({
        id: l.id,
        title: l.data().title,
        duration: l.data().duration || 0,
        type: 'video',
        freePreview: l.data().freePreview || false
      }));

      syllabus.push({
        id: modDoc.id,
        title: modDoc.data().title,
        lessons: modLessons
      });
    }

    // 3. Atualização Atômica no Pai
    // Agora temos a certeza absoluta dos números. Nada de "increment/decrement".
    await courseRef.update({
      syllabus: syllabus, // O JSON Cacheado atualizado
      modulesCount: modulesCount,
      totalLessons: totalLessonsCalculated,
      totalDuration: formatTime(totalDurationSeconds), // String formatada "HH:MM:SS"
      // totalDurationSeconds: totalDurationSeconds, // Sugestão: Mantenha também o number para cálculos futuros
      updatedAt: FieldValue.serverTimestamp()
    });

    console.log(`✅ [Sync] Curso reconstruído. ${totalLessonsCalculated} aulas.`);
    return { success: true };

  } catch (error) {
    console.error("❌ [Sync] Erro crítico ao reconstruir curso:", error);
    // Não lançamos erro para não quebrar a UI do admin, mas logamos severamente
    return { success: false };
  }
}