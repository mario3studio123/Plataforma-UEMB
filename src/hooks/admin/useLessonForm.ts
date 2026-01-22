import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/context/ToastContext";
import { LessonInput, LessonSchema, VideoMetadata } from "@/lib/schemas/courseSchemas";
import { useAdminCourseMutations } from "@/hooks/admin/useAdminCourse";
import { formatDuration, parseDurationToSeconds } from "@/utils/formatters";

export type LessonFormState = {
  title: string;
  description: string;
  videoUrl: string;
  durationStr: string;
  xpReward: number;
  order: number;
  freePreview: boolean;
  videoMetadata?: VideoMetadata;
};

const INITIAL_STATE: LessonFormState = {
  title: "",
  description: "",
  videoUrl: "",
  durationStr: "00:00",
  xpReward: 50,
  order: 0,
  freePreview: false,
  videoMetadata: undefined
};

interface UseLessonFormProps {
  courseId: string;
  moduleId: string;
  lessonId?: string;
  initialData?: any;
  onSuccess?: () => void;
}

export function useLessonForm({ courseId, moduleId, lessonId, initialData, onSuccess }: UseLessonFormProps) {
  const { addToast } = useToast();
  const { upsertLesson } = useAdminCourseMutations(courseId);
  
  const [form, setForm] = useState<LessonFormState>(INITIAL_STATE);
  const [errors, setErrors] = useState<Partial<Record<keyof LessonFormState, string>>>({});

  // Carregar dados iniciais (Edição)
  useEffect(() => {
    if (initialData) {
      setForm({
        title: initialData.title || "",
        description: initialData.description || "",
        videoUrl: initialData.videoUrl || "",
        durationStr: typeof initialData.duration === 'number' 
          ? formatDuration(initialData.duration) 
          : (initialData.duration || "00:00"),
        xpReward: initialData.xpReward || 50,
        order: initialData.order || 0,
        freePreview: initialData.freePreview || false,
        videoMetadata: initialData.videoMetadata
      });
    } else {
      setForm(INITIAL_STATE);
    }
    setErrors({});
  }, [initialData, lessonId]); // Removido INITIAL_STATE da dependência para evitar loop

  const handleChange = (field: keyof LessonFormState, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // ✅ CORREÇÃO: Lógica separada e segura
  const handleVideoSuccess = useCallback((url: string, meta: VideoMetadata) => {
    const formattedTime = formatDuration(Math.round(meta.duration));

    // 1. Atualiza o estado do formulário (Puro)
    setForm(prev => {
        // Evita re-render desnecessário se a URL for a mesma
        if (prev.videoUrl === url) return prev;

        return {
            ...prev,
            videoUrl: url,
            durationStr: formattedTime,
            videoMetadata: meta
        };
    });
    
    // 2. Dispara o Toast (Efeito Colateral) - FORA do setForm
    // Verificamos se a URL é nova ou apenas notificamos o sucesso do processamento
    addToast(`Vídeo processado! Duração: ${formattedTime}`, "info");
    
    // 3. Limpa erros relacionados
    setErrors(prev => ({ ...prev, videoUrl: undefined, durationStr: undefined }));
  }, [addToast]);

  const handleRemoveVideo = useCallback(() => {
    setForm(prev => ({ ...prev, videoUrl: "", videoMetadata: undefined }));
  }, []);

  const handleSubmit = async () => {
    const newErrors: Partial<Record<keyof LessonFormState, string>> = {};

    if (!form.title || form.title.length < 3) {
      newErrors.title = "O título deve ter no mínimo 3 caracteres.";
    }
    
    // Validação de Regex mais robusta
    if (!/^(\d{1,2}:)?([0-5]?\d):([0-5]?\d)$/.test(form.durationStr)) {
      newErrors.durationStr = "Formato inválido. Use MM:SS (ex: 05:30).";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      // Feedback visual opcional
      addToast("Verifique os erros no formulário.", "warning");
      return;
    }

    const durationSeconds = parseDurationToSeconds(form.durationStr);

    if (durationSeconds === 0 && form.videoUrl) {
       if (!confirm("A duração está 00:00. O progresso não será contabilizado corretamente. Salvar mesmo assim?")) return;
    }

    const finalMeta: VideoMetadata = form.videoMetadata || {
      duration: durationSeconds,
      size: 0,
      filename: "manual_entry",
      mimeType: "video/mp4"
    };

    const payload: LessonInput = {
      title: form.title,
      description: form.description,
      videoUrl: form.videoUrl,
      xpReward: Number(form.xpReward),
      order: form.order,
      freePreview: form.freePreview,
      duration: durationSeconds,
      videoMetadata: finalMeta
    };

    const validation = LessonSchema.safeParse(payload);
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      const fieldName = firstError.path[0] as keyof LessonFormState;
      setErrors({ [fieldName]: firstError.message });
      addToast(firstError.message, "error");
      return;
    }

    upsertLesson.mutate(
      {
        moduleId,
        lesson: { ...payload, id: lessonId },
        isEdit: !!lessonId
      },
      {
        onSuccess: () => {
          if (onSuccess) onSuccess();
        }
      }
    );
  };

  return {
    form,
    errors,
    isSubmitting: upsertLesson.isPending,
    handleChange,
    handleVideoSuccess,
    handleRemoveVideo,
    handleSubmit
  };
}