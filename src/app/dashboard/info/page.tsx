// src/app/dashboard/info/page.tsx
"use client";

import { useRef } from "react";
import styles from "./styles.module.css";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useSidebar } from "@/context/SidebarContext";

export default function InfoPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isExpanded } = useSidebar();

  // Animação de Entrada
  useGSAP(() => {
    if (!containerRef.current) return;

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    // Anima o título e o divisor
    tl.fromTo(
      [".anim-title", ".anim-divider"],
      { y: -20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, stagger: 0.1 }
    );

    // Anima os parágrafos em cascata
    tl.fromTo(
      ".anim-text",
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, stagger: 0.1 },
      "-=0.4"
    );
    
    // Anima o logo watermark
    tl.fromTo(
        ".anim-logo",
        { opacity: 0, scale: 0.8 },
        { opacity: 0.5, scale: 1, duration: 1 },
        "-=0.5"
    );

  }, { scope: containerRef });

  // Ajuste fino do padding baseado na sidebar (opcional, se já não estiver no layout global)
  useGSAP(() => {
      if(containerRef.current) {
          gsap.to(containerRef.current, {
              paddingLeft: isExpanded ? 480 : 160,
              duration: 0.5,
              ease: "power3.inOut"
          });
      }
  }, [isExpanded]);

  return (
    <div className={styles.container} ref={containerRef}>
      
      <h1 className={`${styles.title} anim-title`}>Informações Institucionais</h1>
      
      <div className={`${styles.divider} anim-divider`} />

      <div className={styles.content}>
        <p className={`${styles.animText} anim-text`}>
          A UEMB é uma plataforma digital de cursos desenvolvida com foco em desempenho, estabilidade, segurança da informação e experiência do usuário. Sua arquitetura foi projetada seguindo boas práticas de engenharia de software, priorizando escalabilidade, manutenção contínua e integridade dos dados.
        </p>

        <p className={`${styles.animText} anim-text`}>
          A plataforma foi concebida para atender às demandas de um ambiente educacional digital moderno, oferecendo uma infraestrutura confiável, preparada para evolução constante, atualizações técnicas e ampliação de funcionalidades sem comprometer a performance ou a usabilidade.
        </p>

        <p className={`${styles.animText} anim-text`}>
          O desenvolvimento da UEMB foi realizado de forma integral por André Bento, Mario Souza e Lucas Marques, responsáveis pela concepção do produto, definição de requisitos, arquitetura técnica, desenvolvimento, testes e implementação. Todas as etapas do projeto foram conduzidas com base em padrões profissionais de versionamento, controle de mudanças e validação contínua, assegurando um sistema robusto, seguro e alinhado às exigências do mercado.
        </p>

        <p className={`${styles.animText} anim-text`}>
          A plataforma opera em conformidade com as legislações e normas aplicáveis, incluindo diretrizes de privacidade, proteção de dados e segurança digital, e passa por processos contínuos de aprimoramento técnico para garantir estabilidade, confiabilidade e evolução funcional.
        </p>

        <footer className={`${styles.footer} anim-text`}>
          © 3Studio + Artvac — Todos os direitos reservados.
        </footer>
      </div>

      {/* Logo Decorativo (Canto Inferior Direito) */}
      <div className={`${styles.watermark} anim-logo`}>
         {/* Usando o ícone SVG direto ou Imagem */}
         <img src="/logo-icon.png" alt="UEMB Logo" style={{ width: '100%', height: '100%', opacity: 0.6 }} />
      </div>

    </div>
  );
}