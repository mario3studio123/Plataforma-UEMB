"use client";

import { createContext, useContext, useState, ReactNode, useEffect } from "react";

interface SidebarContextType {
  isExpanded: boolean;
  toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextType>({} as SidebarContextType);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Efeito para sincronizar o Estado do React com a Variável CSS
  useEffect(() => {
    const root = document.documentElement;
    if (isExpanded) {
      root.style.setProperty("--sidebar-current-width", "var(--sidebar-width-expanded)");
    } else {
      root.style.setProperty("--sidebar-current-width", "var(--sidebar-width-collapsed)");
    }
  }, [isExpanded]);

  const toggleSidebar = () => setIsExpanded((prev) => !prev);

  return (
    <SidebarContext.Provider value={{ isExpanded, toggleSidebar }}>
      {children}
    </SidebarContext.Provider>
  );
}

export const useSidebar = () => useContext(SidebarContext);