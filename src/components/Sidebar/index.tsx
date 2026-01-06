"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Home, BookOpen, BarChart2, Award, FileEdit, MessageSquare, 
  ShoppingBag, Settings, HelpCircle, ChevronLeft, ChevronRight, LogOut
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSidebar } from "@/context/SidebarContext";
import styles from "./styles.module.css";
import { useRef } from "react";

// GSAP Imports
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

// Mapeamento dos Menus
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
  
  // Controle de Estado Global
  const { isExpanded, toggleSidebar } = useSidebar();
  
  // Refs para Animações GSAP
  const containerRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<(HTMLSpanElement | null)[]>([]); 
  const logoTextRef = useRef<HTMLDivElement>(null);
  const logoIconRef = useRef<HTMLDivElement>(null);
  const profileInfoRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const ctx = gsap.context(() => {
      // 1. Largura da Sidebar
      gsap.to(containerRef.current, {
        width: isExpanded ? 350 : 90,
        duration: 0.8,
        ease: "power3.inOut"
      });

      // 2. Lógica de Abertura/Fechamento
      if (isExpanded) {
        // --- ABRINDO ---

        // Menus
        gsap.to(labelsRef.current, {
          width: "auto",
          marginLeft: 16,
          duration: 0.2,
          onComplete: () => {
             gsap.to(labelsRef.current, {
                opacity: 1,
                x: 0,
                duration: 0.4,
                stagger: 0.03,
                ease: "back.out(1.2)"
             });
          }
        });

        // Logo
        gsap.to(logoTextRef.current, { opacity: 1, scale: 1, display: 'block', duration: 0.4, delay: 0.3 });
        gsap.to(logoIconRef.current, { opacity: 0, scale: 0.5, display: 'none', duration: 0.3 });

        // Info do Perfil - AQUI ESTÁ A MUDANÇA
        // Mudamos width de 'auto' para '100%' para garantir que o flex-grow funcione
        gsap.to(profileInfoRef.current, {
            opacity: 1, 
            display: 'flex', 
            width: '100%', 
            duration: 0.4, 
            delay: 0.4
        });

      } else {
        // --- FECHANDO ---
        
        // Menus
        gsap.to(labelsRef.current, {
          opacity: 0,
          x: -10,
          duration: 0.2,
          stagger: 0.01,
          ease: "power2.in",
          onComplete: () => {
             gsap.to(labelsRef.current, { width: 0, marginLeft: 0, duration: 0.2 });
          }
        });

        // Logo
        gsap.to(logoTextRef.current, { opacity: 0, scale: 0.8, display: 'none', duration: 0.3 });
        gsap.to(logoIconRef.current, { opacity: 1, scale: 1, display: 'flex', duration: 0.5, delay: 0.3, ease: "elastic.out(1, 0.5)" });

        // Info do Perfil
        gsap.to(profileInfoRef.current, {
            opacity: 0, display: 'none', width: 0, duration: 0.2
        });
      }

    }, containerRef);

    return () => ctx.revert();
  }, [isExpanded]);

  return (
    <aside className={styles.sidebarContainer} ref={containerRef}>
      <div className={styles.glassContent}>
        
        {/* HEADER */}
        <div className={`${styles.header} ${!isExpanded ? styles.headerCollapsed : ''}`}>
          <div className={styles.logoArea}>
             <div ref={logoTextRef} className={styles.logoFullWrapper} style={{ display: isExpanded ? 'block' : 'none', opacity: isExpanded ? 1 : 0 }}>
                <img src="/logo-uemb.png" alt="Universidade da Embalagem" className={styles.logoImgFull} />
             </div>
             <div ref={logoIconRef} className={styles.logoIconWrapper} style={{ display: isExpanded ? 'none' : 'flex', opacity: isExpanded ? 0 : 1 }}>
                <img src="/logo-icon.png" alt="UE" className={styles.logoImgIcon} />
             </div>
          </div>
          <button onClick={toggleSidebar} className={styles.toggleBtn}>
            {!isExpanded ? <ChevronRight size={20} color="#CA8DFF" /> : <ChevronLeft size={20} color="#CA8DFF" />}
          </button>
        </div>

        {/* MENU */}
        <div className={styles.navContainer}>
          <nav className={styles.nav}>
            {mainMenuItems.map((item, index) => {
              const isActive = pathname === item.path;
              return (
                <Link key={item.path} href={item.path} className={styles.linkWrapper}>
                  <div className={`${styles.link} ${isActive ? styles.active : ""} ${!isExpanded ? styles.linkCollapsed : ""}`} title={!isExpanded ? item.label : ""}>
                    <div className={styles.iconWrapper}>
                      <item.icon size={22} color="#CA8DFF" style={{ opacity: isActive ? 1 : 0.7 }} />
                    </div>
                    <span ref={(el) => { if (el) labelsRef.current[index] = el; }} className={styles.linkLabel} style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
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
                    <div className={`${styles.link} ${isActive ? styles.active : ""} ${!isExpanded ? styles.linkCollapsed : ""}`}>
                    <div className={styles.iconWrapper}>
                        <item.icon size={22} color="#CA8DFF" style={{ opacity: 0.6 }} />
                    </div>
                    <span ref={(el) => { if (el) labelsRef.current[refIndex] = el; }} className={styles.linkLabel} style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
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
            <div className={`${styles.profileCard} ${!isExpanded ? styles.profileCardCollapsed : ""}`}>
                <div className={styles.avatar}>
                    {profile?.avatarUrl ? (
                        <img src={profile.avatarUrl} alt="User" />
                    ) : (
                        <div className={styles.avatarPlaceholder}>
                            {profile?.name?.charAt(0) || "U"}
                        </div>
                    )}
                </div>
                
                {/* CONTAINER DO PERFIL: Adicionado flex: 1 para ocupar o espaço */}
                <div 
                    ref={profileInfoRef}
                    style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        // gap: 12, // Gap é opcional se usar flex:1 no filho, mas ajuda no espaçamento minimo
                        marginLeft: 12,
                        overflow: 'hidden',
                        flex: 1, // ISSO GARANTE QUE ELE OCUPE O RESTO DO CARD
                        justifyContent: 'space-between' // Garante separação
                    }}
                >
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