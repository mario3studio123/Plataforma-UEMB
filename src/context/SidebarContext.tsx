"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface SidebarContextType {
  isExpanded: boolean;
  toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextType>({} as SidebarContextType);

export function SidebarProvider({ children }: { children: ReactNode }) {
  // Começa false (fechado) ou true, como preferir
  const [isExpanded, setIsExpanded] = useState(true); 

  const toggleSidebar = () => setIsExpanded((prev) => !prev);

  return (
    <SidebarContext.Provider value={{ isExpanded, toggleSidebar }}>
      {children}
    </SidebarContext.Provider>
  );
}

export const useSidebar = () => useContext(SidebarContext);