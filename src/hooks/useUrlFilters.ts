// src/hooks/useUrlFilters.ts
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export function useUrlFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 1. Ler valores atuais da URL (com falback para padrão)
  const getFilterValue = useCallback((key: string, defaultValue: string = "") => {
    return searchParams.get(key) || defaultValue;
  }, [searchParams]);

  // 2. Atualizar a URL
  const setFilterValue = useCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value && value.trim() !== "" && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }

    // replace: Atualiza a URL sem adicionar nova entrada no histórico (mais fluido)
    // scroll: false (Mantém a posição da tela)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  return {
    getFilterValue,
    setFilterValue,
    searchParams // Exposto caso precise ler tudo
  };
}