export interface Course {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  modulesCount: number;
  // Campos visuais para o design
  level?: string;   // Ex: "Básico"
  duration?: string; // Ex: "12 horas"
  
  createdAt: string;
  published: boolean;
}