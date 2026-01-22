"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Home, BookOpen, BarChart2, Award, FileEdit, MessageSquare, 
  ShoppingBag, Settings, HelpCircle, ChevronLeft, ChevronRight, LogOut
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSidebar } from "@/context/SidebarContext";
import styles from "./styles.module.css";

// GSAP Imports
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

const mainMenuItems = [
  { icon: Home, label: "Home", path: "/dashboard" },
  { icon: BookOpen, label: "Cursos", path: "/dashboard/courses" },
  { icon: BarChart2, label: "Ranking", path: "/dashboard/ranking" },
  { icon: Award, label: "Certificados", path: "/dashboard/certificates" },
  { icon: FileEdit, label: "Avaliações", path: "/dashboard/evaluations" },
  { icon: MessageSquare, label: "Comunidade", path: "/dashboard/community" },
  { icon: ShoppingBag, label: "Loja", path: "/dashboard/shop" },
];

const bottomMenuItems = [
  { icon: Settings, label: "Configurações", path: "/dashboard/settings" },
  { icon: HelpCircle, label: "Informações", path: "/dashboard/info" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { logout, profile } = useAuth();
  const { isExpanded, toggleSidebar } = useSidebar();
  
  // Refs para GSAP
  const containerRef = useRef<HTMLDivElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  
  // Refs de Elementos
  const labelsRef = useRef<(HTMLSpanElement | null)[]>([]); 
  const logoTextRef = useRef<HTMLDivElement>(null);
  const logoIconRef = useRef<HTMLDivElement>(null);
  const profileDetailsRef = useRef<HTMLDivElement>(null);
  const arrowBtnRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!containerRef.current) return;

    // Criamos a timeline PAUSADA. Vamos controlá-la com o play/reverse baseada no estado.
    const tl = gsap.timeline({ paused: true, defaults: { ease: "power3.inOut" } });

    // 2. Textos dos Menus (Desaparecem e largura zera para não ocupar espaço)
    tl.to(labelsRef.current, {
      opacity: 0,
      x: -10,
      duration: 0.2,
      stagger: 0.01 // Efeito cascata sutil
    }, 0);

    // 3. Logo Texto (Desaparece)
    tl.to(logoTextRef.current, {
      opacity: 0,
      scale: 0.8,
      duration: 0.3,
      display: "none"
    }, 0);

    // 4. Logo Ícone (Aparece e ganha destaque)
    // Começa invisível no CSS, aqui garantimos que ele entre
    tl.to(logoIconRef.current, {
      display: "flex",
      opacity: 1,
      scale: 1,
      duration: 0.4,
    }, 0.2); // Leve delay para cruzar suavemente com o texto

    // 5. Botão da Seta (Move da direita para baixo da logo)
    // No CSS ele é absolute right: 20px. Vamos mover para o centro e descer.
    tl.to(arrowBtnRef.current, {
      right: "50%",
      x: "50%", // Centraliza horizontalmente (trick do transform)
      top: "90px", // Desce para baixo da logo
      duration: 0.6
    }, 0);

    // 6. Header (Aumenta altura para caber a seta embaixo)
    tl.to(headerRef.current, {
      height: 140, // Espaço para Logo + Seta empilhados
      paddingLeft: 0,
      paddingRight: 0,
      duration: 0.6
    }, 0);

    // 7. Perfil (Esconde nome e cargo, mantém avatar)
    tl.to(profileDetailsRef.current, {
      opacity: 0,
      width: 0,
      duration: 0.3,
      paddingLeft: 0
    }, 0);

    timeline.current = tl;

  }, []); // Executa apenas uma vez na montagem

  // Efeito para disparar a animação quando o estado muda
  useEffect(() => {
    if (timeline.current) {
      if (isExpanded) {
        timeline.current.reverse(); // Toca do final para o início (Abre)
      } else {
        timeline.current.play(); // Toca do início para o final (Fecha)
      }
    }
  }, [isExpanded]);

  return (
    <aside className={styles.sidebarContainer} ref={containerRef}>
      <div className={styles.glassContent}>
        
        {/* HEADER */}
        <div className={styles.header} ref={headerRef}>
          <div className={styles.logoArea}>
             {/* Logo Texto (Visível por padrão) */}
             <div ref={logoTextRef} className={styles.logoFullWrapper}>
                <img src="/logo-uemb.png" alt="Universidade da Embalagem" className={styles.logoImgFull} />
             </div>
             
             {/* Logo Ícone (Invisível por padrão, controlado pelo GSAP) */}
             <div ref={logoIconRef} className={styles.logoIconWrapper}>
                <img src="/logo-icon.png" alt="UE" className={styles.logoImgIcon} />
             </div>
          </div>

          <button 
            ref={arrowBtnRef}
            onClick={toggleSidebar} 
            className={styles.toggleBtn}
            title={isExpanded ? "Recolher" : "Expandir"}
          >
            {/* Trocamos o ícone dinamicamente, mas a posição é via GSAP */}
            {isExpanded ? <ChevronLeft size={20} color="#CA8DFF" /> : <ChevronRight size={20} color="#CA8DFF" />}
          </button>
        </div>

        {/* MENU */}
        <div className={styles.navContainer}>
          <nav className={styles.nav}>
            {mainMenuItems.map((item, index) => {
              const isActive = pathname === item.path;
              return (
                <Link key={item.path} href={item.path} className={styles.linkWrapper}>
                  <div className={`${styles.link} ${isActive ? styles.active : ""}`} title={!isExpanded ? item.label : ""}>
                    <div className={styles.iconWrapper}>
                      <item.icon size={22} color="#CA8DFF" style={{ opacity: isActive ? 1 : 0.7 }} />
                    </div>
                    <span 
                        ref={(el) => { if (el) labelsRef.current[index] = el; }} 
                        className={styles.linkLabel}
                    >
                      {item.label}
                    </span>
                    {isActive && <div className={styles.activeGlow} />}
                  </div>
                </Link>
              );
            })}
          </nav>
          
          <div className={styles.divider} />
          
          <nav className={styles.nav}>
            {bottomMenuItems.map((item, i) => {
               const refIndex = mainMenuItems.length + i;
               const isActive = pathname === item.path;
               return (
                <Link key={item.path} href={item.path} className={styles.linkWrapper}>
                    <div className={`${styles.link} ${isActive ? styles.active : ""}`}>
                    <div className={styles.iconWrapper}>
                        <item.icon size={22} color="#CA8DFF" style={{ opacity: 0.6 }} />
                    </div>
                    <span 
                        ref={(el) => { if (el) labelsRef.current[refIndex] = el; }} 
                        className={styles.linkLabel}
                    >
                        {item.label}
                    </span>
                    </div>
                </Link>
               )
            })}
          </nav>
        </div>

        {/* FOOTER */}
        <div className={styles.footer}>
            <div className={styles.profileCard}>
                <div className={styles.avatar}>
                    {profile?.avatarUrl ? (
                        <img src={profile.avatarUrl} alt="User" />
                    ) : (
                        <div className={styles.avatarPlaceholder}>
                            {profile?.name?.charAt(0) || "U"}
                        </div>
                    )}
                </div>
                
                <div ref={profileDetailsRef} className={styles.profileDetails}>
                    <div className={styles.profileInfo}>
                        <p className={styles.userName}>{profile?.name?.split(" ")[0] || "Aluno"}</p>
                        <span className={styles.userRole}>{profile?.role === 'admin' ? 'Admin' : 'Aluno'}</span>
                    </div>
                    
                    <button onClick={logout} className={styles.logoutBtn} title="Sair">
                        <LogOut size={16} />
                    </button>
                </div>
            </div>
        </div>

      </div>
    </aside>
  );
}