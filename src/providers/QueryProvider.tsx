"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // --- A MÁGICA ACONTECE AQUI ---
        
        // 1. staleTime: Durante 10 minutos, o dado é considerado "novo".
        // O React Query NÃO vai buscar no servidor se o cache tiver menos de 10min.
        staleTime: 1000 * 60 * 10, 
        
        // 2. gcTime (Garbage Collection): Mantém o dado na memória por 1 hora
        // mesmo que não esteja sendo usado, para caso o usuário volte.
        gcTime: 1000 * 60 * 60, 

        // 3. refetchOnWindowFocus: Não recarrega se o usuário der Alt+Tab e voltar
        refetchOnWindowFocus: false, 
        
        // 4. retry: Se der erro, tenta mais 1 vez só (evita loops infinitos)
        retry: 1,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}