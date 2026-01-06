import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Universidade da Embalagem",
  description: "Plataforma de ensino gamificada",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <AuthProvider>
          {/* REMOVI A SIDEBAR DAQUI. Ela vai para o layout do dashboard */}
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}