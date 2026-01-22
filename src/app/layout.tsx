import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";
import QueryProvider from "@/providers/QueryProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Universidade da Embalagem",
  description: "Plataforma de ensino gamificada",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <AuthProvider>
          <QueryProvider> {/* <--- Adicione aqui, dentro do Auth ou fora, tanto faz */}
             <ToastProvider>
               {children}
             </ToastProvider>
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}