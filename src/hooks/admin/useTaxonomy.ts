// src/hooks/admin/useTaxonomy.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { getGlobalTagsAction, addGlobalTagAction } from "@/app/actions/admin/taxonomyActions";
import { useToast } from "@/context/ToastContext";

export function useTaxonomy() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  // 1. Query para Ler Tags
  const { data: tags = [], isLoading } = useQuery({
    queryKey: ['taxonomy-tags'],
    queryFn: async () => {
      const res = await getGlobalTagsAction();
      return res.tags || [];
    },
    staleTime: 1000 * 60 * 60, // 1 hora de cache (mudam pouco)
  });

  // 2. Mutation para Criar Tag
  const { mutate: createTag, isPending: isCreating } = useMutation({
    mutationFn: async (newTag: string) => {
      if (!user) throw new Error("Usuário não autenticado");
      const token = await user.getIdToken();
      const res = await addGlobalTagAction(token, newTag);
      if (!res.success) throw new Error(res.message);
      return res.tag;
    },
    onSuccess: (newTag) => {
      // Atualiza o cache local imediatamente
      queryClient.setQueryData(['taxonomy-tags'], (oldTags: string[] = []) => {
        return [...oldTags, newTag];
      });
      addToast(`Tag "${newTag}" adicionada ao sistema!`, "success");
    },
    onError: () => {
      addToast("Erro ao salvar nova tag.", "error");
    }
  });

  return { tags, isLoading, createTag, isCreating };
}