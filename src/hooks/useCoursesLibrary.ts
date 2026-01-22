// src/hooks/useCoursesLibrary.ts
"use client";

import { useState, useMemo, useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { getCoursesPage } from "@/services/courseLibraryService";
import { useUrlFilters } from "./useUrlFilters";

// Utilitário de Debounce para evitar atualizações frenéticas na URL
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export function useCoursesLibrary() {
  // 1. Contextos e Hooks
  const { user, profile } = useAuth();
  const { getFilterValue, setFilterValue } = useUrlFilters();

  // 2. Estado Sincronizado com URL
  const urlSearch = getFilterValue("search", "");
  const urlLevel = getFilterValue("level", "all");

  // Estado local do Input (para resposta imediata na UI ao digitar)
  const [localSearch, setLocalSearch] = useState(urlSearch);
  
  // Debounce do termo de busca
  const debouncedLocalSearch = useDebounce(localSearch, 500);

  // 3. Verificação de Permissões (CORREÇÃO FUNDAMENTAL)
  // Se for Admin ou Master, ele tem permissão de ver rascunhos.
  const isAdmin = profile?.role === "admin" || profile?.role === "master";

  // 4. Efeito: Atualiza a URL quando o usuário para de digitar
  useEffect(() => {
    if (debouncedLocalSearch !== urlSearch) {
      setFilterValue("search", debouncedLocalSearch);
    }
  }, [debouncedLocalSearch, setFilterValue, urlSearch]);

  // 5. REACT QUERY (Busca Infinita)
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingQuery,
    isError
  } = useInfiniteQuery({
    // Adicionamos 'isAdmin' na key. Se a role mudar, o cache invalida e busca de novo.
    queryKey: ['courses-library', user?.uid, urlLevel, isAdmin], 
    
    queryFn: async ({ pageParam }) => {
        if (!user) throw new Error("Usuário não autenticado");
        
        // Passamos a flag includeDrafts baseada na role
        return getCoursesPage(user.uid, pageParam, { 
            level: urlLevel,
            includeDrafts: isAdmin 
        });
    },
    initialPageParam: null as any, // Firestore cursor start
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.lastDoc : undefined,
    
    // Só executa a query se tivermos o usuário e o perfil carregados
    // Isso evita buscar dados antes de saber se é admin ou aluno
    enabled: !!user && !!profile, 
    
    staleTime: 1000 * 60 * 5, // 5 minutos de cache
    refetchOnWindowFocus: false,
  });

  // 6. Filtragem de Texto no Cliente
  // (O Firestore não faz busca textual parcial nativa ("LIKE %text%") de forma barata/simples,
  // então filtramos o título no cliente após carregar a página).
  const processedCourses = useMemo(() => {
    if (!data) return [];
    
    // Achata todas as páginas em um único array
    const allCourses = data.pages.flatMap(page => page.courses);

    // Se não tiver busca, retorna tudo
    if (!urlSearch) return allCourses;

    // Filtra pelo título
    return allCourses.filter(course => 
      course.title.toLowerCase().includes(urlSearch.toLowerCase())
    );
  }, [data, urlSearch]);

  // Indicador visual se está filtrando ou carregando inicial
  const isFiltering = localSearch !== urlSearch; 

  return {
    courses: processedCourses,
    loading: isLoadingQuery,
    loadingMore: isFetchingNextPage,
    hasMore: hasNextPage,
    loadMore: fetchNextPage,
    isError,
    
    // Controles de Filtro
    search: localSearch,       // Valor do Input
    setSearch: setLocalSearch, // Setter do Input
    
    levelFilter: urlLevel,     // Valor do Select/Pills
    setLevelFilter: (val: string) => setFilterValue("level", val),
    
    isFiltering // Para mostrar spinners no input de busca
  };
}